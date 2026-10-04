// Auto-search: given "plumbers in Lagos", geocodes the city with Nominatim
// and queries Overpass for matching businesses. Both are free OpenStreetMap
// services with no API key — but both ask callers to identify themselves
// and to keep request volume low, per:
//   https://operations.osmfoundation.org/policies/nominatim/
//   https://operations.osmfoundation.org/policies/overpass/
// so every request here carries a real contact (OSM_CONTACT_EMAIL) and
// this module makes at most one request per call, sequentially.
//
// IMPORTANT: this used to require every result to already have a `website`
// (or `contact:website`) tag -- which meant it could only ever find
// businesses that already had a website, and silently threw away every
// WhatsApp-only, Instagram-only, or phone-only business (the majority of
// small local businesses in a lot of places). It no longer requires that:
// it now also accepts OSM's own `contact:whatsapp`, `contact:facebook`,
// `contact:instagram` and phone tags as valid ways to reach a business.

export interface OsmBusinessResult {
  name: string;
  /** Present only when this business has a real website. */
  website: string | null;
  /** How to reach this business when it has no website. */
  contactChannel: 'website' | 'whatsapp' | 'facebook' | 'instagram' | 'phone';
  /** The raw value for a non-website channel (a phone number or a social handle/URL). Null for website leads. */
  contactValue: string | null;
  /** A phone number OSM had tagged on this business even though website won out as the primary channel --
   * carried separately so a website-channel lead doesn't lose a real, independently-confirmed phone number
   * just because it wasn't the "best" channel. Null when OSM had no phone tag, or when contactChannel is
   * already 'phone' (in which case it's in contactValue instead, not duplicated here). */
  osmPhone: string | null;
  lat: number;
  lon: number;
  osmTags: Record<string, string>;
}

// Maps a free-text category the user types (e.g. "plumbers", "restaurants",
// "hair salons") to OpenStreetMap tag key/value pairs to search for. This
// list covers common service-business categories; anything not recognized
// falls back to a generic name-based search (see buildOverpassQuery).
const CATEGORY_TAGS: Record<string, [string, string][]> = {
  plumber: [['shop', 'plumber'], ['craft', 'plumber']],
  plumbers: [['shop', 'plumber'], ['craft', 'plumber']],
  electrician: [['shop', 'electrician'], ['craft', 'electrician']],
  electricians: [['shop', 'electrician'], ['craft', 'electrician']],
  restaurant: [['amenity', 'restaurant']],
  restaurants: [['amenity', 'restaurant']],
  cafe: [['amenity', 'cafe']],
  cafes: [['amenity', 'cafe']],
  bakery: [['shop', 'bakery']],
  bakeries: [['shop', 'bakery']],
  'hair salon': [['shop', 'hairdresser']],
  'hair salons': [['shop', 'hairdresser']],
  hairdresser: [['shop', 'hairdresser']],
  hairdressers: [['shop', 'hairdresser']],
  barber: [['shop', 'hairdresser'], ['shop', 'barber']],
  barbers: [['shop', 'hairdresser'], ['shop', 'barber']],
  barbershop: [['shop', 'hairdresser'], ['shop', 'barber']],
  barbershops: [['shop', 'hairdresser'], ['shop', 'barber']],
  salon: [['shop', 'hairdresser'], ['shop', 'beauty']],
  salons: [['shop', 'hairdresser'], ['shop', 'beauty']],
  'beauty salon': [['shop', 'beauty'], ['shop', 'hairdresser']],
  'beauty salons': [['shop', 'beauty'], ['shop', 'hairdresser']],
  beautician: [['shop', 'beauty']],
  beauticians: [['shop', 'beauty']],
  spa: [['shop', 'beauty'], ['leisure', 'spa']],
  spas: [['shop', 'beauty'], ['leisure', 'spa']],
  'nail salon': [['shop', 'beauty']],
  'nail salons': [['shop', 'beauty']],
  dentist: [['amenity', 'dentist']],
  dentists: [['amenity', 'dentist']],
  lawyer: [['office', 'lawyer']],
  lawyers: [['office', 'lawyer']],
  accountant: [['office', 'accountant']],
  accountants: [['office', 'accountant']],
  gym: [['leisure', 'fitness_centre']],
  gyms: [['leisure', 'fitness_centre']],
  hotel: [['tourism', 'hotel']],
  hotels: [['tourism', 'hotel']],
  clinic: [['amenity', 'clinic']],
  clinics: [['amenity', 'clinic']],
  tailor: [['shop', 'tailor']],
  tailors: [['shop', 'tailor']],
  'fashion designer': [['shop', 'tailor'], ['shop', 'boutique']],
  'fashion designers': [['shop', 'tailor'], ['shop', 'boutique']],
  boutique: [['shop', 'boutique'], ['shop', 'clothes']],
  boutiques: [['shop', 'boutique'], ['shop', 'clothes']],
  photographer: [['craft', 'photographer']],
  photographers: [['craft', 'photographer']],
  florist: [['shop', 'florist']],
  florists: [['shop', 'florist']],
  'car repair': [['shop', 'car_repair']],
  mechanic: [['shop', 'car_repair']],
  mechanics: [['shop', 'car_repair']],
  'real estate agent': [['office', 'estate_agent']],
  'real estate agents': [['office', 'estate_agent']],
  'real estate agency': [['office', 'estate_agent']],
  'car dealer': [['shop', 'car']],
  'car dealers': [['shop', 'car']],
  'car dealership': [['shop', 'car']],
  'auto dealer': [['shop', 'car']],
  veterinary: [['amenity', 'veterinary']],
  vet: [['amenity', 'veterinary']],
  vets: [['amenity', 'veterinary']],
  'it company': [['office', 'it']],
  'it companies': [['office', 'it']],
  'marketing agency': [['office', 'advertising_agency']],
  'marketing agencies': [['office', 'advertising_agency']],
  'web design agency': [['office', 'it']],
  'driving school': [['amenity', 'driving_school']],
  'driving schools': [['amenity', 'driving_school']],
};

/** Finds the best category match for free-typed input: an exact key, then
 * a plural/singular variant, then a substring match against known keys
 * (so "beauty salon services" or "salon" both land on the right tags)
 * before giving up and falling back to a generic name search. */
function resolveCategory(input: string): [string, string][] | null {
  const key = input.trim().toLowerCase();
  if (CATEGORY_TAGS[key]) return CATEGORY_TAGS[key];

  const singular = key.endsWith('s') ? key.slice(0, -1) : `${key}s`;
  if (CATEGORY_TAGS[singular]) return CATEGORY_TAGS[singular];

  const knownKeys = Object.keys(CATEGORY_TAGS);
  const contains = knownKeys.find((k) => key.includes(k) || k.includes(key));
  return contains ? CATEGORY_TAGS[contains] : null;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Builds an Overpass QL query for the given category within a bounding
 * box. No longer requires a website/contact tag at the query level — that
 * would exclude every business without one before we even see them. All
 * matching businesses come back; `extractContact` below decides, per
 * result, whether there's any real way to reach them at all. */
export function buildOverpassQuery(category: string, bbox: BoundingBox): string {
  const tagPairs = resolveCategory(category);
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const filters: string[] = [];

  if (tagPairs) {
    for (const [k, v] of tagPairs) {
      filters.push(`node["${k}"="${v}"](${bboxStr});`);
      filters.push(`way["${k}"="${v}"](${bboxStr});`);
    }
  } else {
    // Generic fallback: name-contains match.
    const escaped = category.trim().toLowerCase().replace(/"/g, '\\"');
    filters.push(`node["name"~"${escaped}",i](${bboxStr});`);
    filters.push(`way["name"~"${escaped}",i](${bboxStr});`);
  }

  return `[out:json][timeout:25];(${filters.join('')});out center 80;`;
}

export function knownCategories(): string[] {
  return Object.keys(CATEGORY_TAGS);
}

/** Picks the best available way to reach a business from its OSM tags,
 * preferring a real website (richest evidence to crawl), then WhatsApp,
 * then a phone number, then Facebook, then Instagram. Returns null if none
 * of these are present -- that business genuinely can't be reached from
 * what OSM has on file, and gets dropped. */
function extractContact(
  tags: Record<string, string>,
): { channel: OsmBusinessResult['contactChannel']; website: string | null; value: string | null; osmPhone: string | null } | null {
  const phone = tags['contact:phone'] || tags.phone || null;

  const website = tags.website || tags['contact:website'];
  // A phone tag riding alongside a website isn't the "best" channel, but it's a real, independently
  // confirmed way to reach them -- worth keeping rather than discarding just because website won.
  if (website) return { channel: 'website', website, value: null, osmPhone: phone };

  const whatsapp = tags['contact:whatsapp'] || tags.whatsapp;
  if (whatsapp) return { channel: 'whatsapp', website: null, value: whatsapp, osmPhone: null };

  if (phone) return { channel: 'phone', website: null, value: phone, osmPhone: null };

  const facebook = tags['contact:facebook'] || tags.facebook;
  if (facebook) return { channel: 'facebook', website: null, value: facebook, osmPhone: null };

  const instagram = tags['contact:instagram'] || tags.instagram;
  if (instagram) return { channel: 'instagram', website: null, value: instagram, osmPhone: null };

  return null;
}

// ---- Network calls ------------------------------------------------------

function contactHeader(): string {
  const email = process.env.OSM_CONTACT_EMAIL;
  return `AIOutreachBot/1.0 (single-user local tool${email ? `; contact: ${email}` : ''})`;
}

// A plain fetch() has no timeout of its own -- if a mirror accepts the
// connection but never finishes responding, the request just hangs. Without
// this, that hang would run until Vercel's own hard function time limit (60s
// on this plan) kills the whole request from the outside, which happens
// before our own try/catch (and Sentry.captureException) ever runs -- so a
// stuck request looks like total silence: no error, no log, no DB row.
// Failing fast here turns that into a normal, visible, reportable error.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`timed out after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export interface GeocodedPlace {
  bbox: BoundingBox;
  /** The full place name OSM actually resolved the input to -- e.g. typing
   * "Saki, Nigeria" could silently resolve to Şəki, Azerbaijan (a same-
   * named, much more heavily-mapped city) if that's what Nominatim's free-
   * text search ranks higher. Surfacing this lets the caller notice a
   * wrong-place match instead of just seeing an unexplained zero results. */
  resolvedName: string;
}

export async function geocodeCity(city: string): Promise<GeocodedPlace> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': contactHeader() } }, 15000);
  if (!res.ok) throw new Error(`Nominatim geocoding failed: HTTP ${res.status}`);
  const data = (await res.json()) as any[];
  if (!data.length) throw new Error(`Could not find "${city}" on OpenStreetMap. Try a more specific name (e.g. "Lagos, Nigeria").`);
  const bb = data[0].boundingbox as [string, string, string, string]; // [south, north, west, east]
  return {
    bbox: {
      south: Number(bb[0]),
      north: Number(bb[1]),
      west: Number(bb[2]),
      east: Number(bb[3]),
    },
    resolvedName: data[0].display_name || city,
  };
}

export interface SearchBusinessesResult {
  businesses: OsmBusinessResult[];
  resolvedPlace: string;
  /** How many matching nodes/ways OSM returned for this category+area BEFORE filtering for contact info. Lets
   * the caller tell apart two very different situations that both look like "0 found" otherwise: OSM has
   * nothing mapped under this category here at all (rawCount 0), vs. it has businesses mapped but none of
   * them have a website/WhatsApp/phone/Facebook/Instagram on file (rawCount > 0, businesses.length 0). */
  rawCount: number;
}

// The public Overpass service has no single point of truth -- several
// independent mirrors run the same data. overpass-api.de is the default,
// heaviest-used one, so it's also the one most likely to hand back a 429
// (rate limited) or 504 (busy) under normal, moderate use. Falling back to
// a second mirror on either of those turns a transient "someone else was
// hammering it" moment into a working search instead of a dead end.
const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function queryOverpass(query: string): Promise<{ elements: any[] }> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'User-Agent': contactHeader(), 'Content-Type': 'text/plain' },
          body: query,
        },
        20000,
      );
      if (res.ok) return (await res.json()) as { elements: any[] };
      if (res.status === 429 || res.status === 504 || res.status === 503) {
        // Busy/rate-limited -- worth trying the next mirror before giving up.
        lastError = new Error(`busy (HTTP ${res.status})`);
        continue;
      }
      // Any other status (e.g. a malformed query -> 400) won't be fixed by a different mirror.
      throw new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(
    `Overpass query failed on every mirror tried (${lastError?.message || 'unknown error'}). ` +
      `OpenStreetMap's free query service is a shared, rate-limited resource -- this usually means it's ` +
      `temporarily busy or you've searched a few times in quick succession. Wait about a minute and try again.`,
  );
}

export async function searchBusinesses(city: string, category: string): Promise<SearchBusinessesResult> {
  const { bbox, resolvedName } = await geocodeCity(city);
  const query = buildOverpassQuery(category, bbox);
  const data = await queryOverpass(query);

  const results: OsmBusinessResult[] = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const contact = extractContact(tags);
    if (!contact) continue; // no website, WhatsApp, phone, Facebook, or Instagram -- genuinely unreachable from OSM alone
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    results.push({
      name: tags.name || 'Unnamed business',
      website: contact.website,
      contactChannel: contact.channel,
      contactValue: contact.value,
      osmPhone: contact.osmPhone,
      lat: typeof lat === 'number' ? lat : 0,
      lon: typeof lon === 'number' ? lon : 0,
      osmTags: tags,
    });
  }
  return { businesses: results, resolvedPlace: resolvedName, rawCount: (data.elements || []).length };
}
