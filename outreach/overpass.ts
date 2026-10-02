// Auto-search: given "plumbers in Lagos", geocodes the city with Nominatim
// and queries Overpass for matching businesses that have a listed website.
// Both are free OpenStreetMap services with no API key — but both ask
// callers to identify themselves and to keep request volume low, per:
//   https://operations.osmfoundation.org/policies/nominatim/
//   https://operations.osmfoundation.org/policies/overpass/
// so every request here carries a real contact (OSM_CONTACT_EMAIL) and
// this module makes at most one request per call, sequentially.

export interface OsmBusinessResult {
  name: string;
  website: string;
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
  salon: [['shop', 'hairdresser'], ['shop', 'beauty']],
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
  photographer: [['craft', 'photographer']],
  photographers: [['craft', 'photographer']],
  florist: [['shop', 'florist']],
  florists: [['shop', 'florist']],
  'car repair': [['shop', 'car_repair']],
  mechanic: [['shop', 'car_repair']],
  mechanics: [['shop', 'car_repair']],
};

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Builds an Overpass QL query for the given category within a bounding
 * box, restricted to nodes/ways that have a `website` (or `contact:website`)
 * tag — anything without one can't be fed into the crawl pipeline anyway. */
export function buildOverpassQuery(category: string, bbox: BoundingBox): string {
  const key = category.trim().toLowerCase();
  const tagPairs = CATEGORY_TAGS[key];

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const filters: string[] = [];

  if (tagPairs) {
    for (const [k, v] of tagPairs) {
      filters.push(`node["${k}"="${v}"]["website"](${bboxStr});`);
      filters.push(`way["${k}"="${v}"]["website"](${bboxStr});`);
      filters.push(`node["${k}"="${v}"]["contact:website"](${bboxStr});`);
      filters.push(`way["${k}"="${v}"]["contact:website"](${bboxStr});`);
    }
  } else {
    // Generic fallback: name-contains match, still requiring a website tag.
    const escaped = key.replace(/"/g, '\\"');
    filters.push(`node["name"~"${escaped}",i]["website"](${bboxStr});`);
    filters.push(`way["name"~"${escaped}",i]["website"](${bboxStr});`);
  }

  return `[out:json][timeout:25];(${filters.join('')});out center 50;`;
}

export function knownCategories(): string[] {
  return Object.keys(CATEGORY_TAGS);
}

// ---- Network calls ------------------------------------------------------

function contactHeader(): string {
  const email = process.env.OSM_CONTACT_EMAIL;
  return `AIOutreachBot/1.0 (single-user local tool${email ? `; contact: ${email}` : ''})`;
}

export async function geocodeCity(city: string): Promise<BoundingBox> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { 'User-Agent': contactHeader() } });
  if (!res.ok) throw new Error(`Nominatim geocoding failed: HTTP ${res.status}`);
  const data = (await res.json()) as any[];
  if (!data.length) throw new Error(`Could not find "${city}" on OpenStreetMap. Try a more specific name (e.g. "Lagos, Nigeria").`);
  const bb = data[0].boundingbox as [string, string, string, string]; // [south, north, west, east]
  return {
    south: Number(bb[0]),
    north: Number(bb[1]),
    west: Number(bb[2]),
    east: Number(bb[3]),
  };
}

export async function searchBusinesses(city: string, category: string): Promise<OsmBusinessResult[]> {
  const bbox = await geocodeCity(city);
  const query = buildOverpassQuery(category, bbox);

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': contactHeader(), 'Content-Type': 'text/plain' },
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass query failed: HTTP ${res.status}`);
  const data = (await res.json()) as { elements: any[] };

  const results: OsmBusinessResult[] = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const website = tags.website || tags['contact:website'];
    if (!website) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    results.push({
      name: tags.name || 'Unnamed business',
      website,
      lat: typeof lat === 'number' ? lat : 0,
      lon: typeof lon === 'number' ? lon : 0,
      osmTags: tags,
    });
  }
  return results;
}
