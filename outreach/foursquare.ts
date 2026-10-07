// Second, independent data source for auto-search, merged alongside overpass.ts's OpenStreetMap results.
// OSM is comprehensive in some places and nearly empty in others -- Foursquare's own places dataset covers
// a different (often larger, more commercial-skewing) slice of real businesses, so running both and merging
// finds businesses that either source alone would miss entirely.
//
// Entirely optional and additive: with no FOURSQUARE_API_KEY set, searchFoursquarePlaces() returns an empty
// result immediately (no network call, no error) -- the tool keeps working exactly as before on OSM alone.
// Get a free key at https://docs.foursquare.com/developer/reference/get-started-devcon-places-api (free tier:
// 500 Pro-endpoint calls/month as of mid-2026) and set FOURSQUARE_API_KEY in the environment to turn this on.

import type { OsmBusinessResult, BoundingBox } from './overpass.js';

const FOURSQUARE_SEARCH_URL = 'https://places-api.foursquare.com/places/search';
const FOURSQUARE_API_VERSION = '2025-06-17';
const FETCH_TIMEOUT_MS = 15000;

export interface FoursquareSearchResult {
  businesses: OsmBusinessResult[];
  /** How many raw places Foursquare returned before filtering for usable contact info -- mirrors
   * overpass.ts's SearchBusinessesResult.rawCount, for the same "found nothing" vs. "found some, none
   * reachable" distinction. */
  rawCount: number;
  /** True only when a key is configured; lets callers skip calling Foursquare at all when it's not. */
  enabled: boolean;
}

function isConfigured(): boolean {
  return Boolean(process.env.FOURSQUARE_API_KEY && process.env.FOURSQUARE_API_KEY.trim());
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`Foursquare request timed out after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** A bbox's center point and a radius (meters) that comfortably covers it -- Foursquare's search is
 * point+radius, not a bounding box, so geocodeCity's OSM bbox is converted rather than duplicating the
 * geocoding call. Capped at 100km (the API's own ceiling). */
function bboxToCenterAndRadius(bbox: BoundingBox): { lat: number; lon: number; radiusMeters: number } {
  const lat = (bbox.north + bbox.south) / 2;
  const lon = (bbox.east + bbox.west) / 2;
  const latSpanMeters = (bbox.north - bbox.south) * 111_320;
  const lonSpanMeters = (bbox.east - bbox.west) * 111_320 * Math.cos((lat * Math.PI) / 180);
  const radiusMeters = Math.min(100_000, Math.max(1_000, Math.round(Math.max(latSpanMeters, lonSpanMeters) / 2)));
  return { lat, lon, radiusMeters };
}

function looksUsablePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  return digits.length >= 7 ? raw : null;
}

/** Picks the same channel priority order overpass.ts uses (website > whatsapp > phone > facebook >
 * instagram) so results from either source are handled identically downstream -- Foursquare's schema has no
 * WhatsApp field, so that rung is simply always skipped here. */
function extractContactFromPlace(place: any): { channel: OsmBusinessResult['contactChannel']; website: string | null; value: string | null; osmPhone: string | null } | null {
  const phone = looksUsablePhone(place.tel);
  const website = typeof place.website === 'string' && place.website.trim() ? place.website.trim() : null;
  if (website) return { channel: 'website', website, value: null, osmPhone: phone };
  if (phone) return { channel: 'phone', website: null, value: phone, osmPhone: phone };

  const social = place.social_media || {};
  const facebook = typeof social.facebook_id === 'string' && social.facebook_id ? `https://facebook.com/${social.facebook_id}` : null;
  if (facebook) return { channel: 'facebook', website: null, value: facebook, osmPhone: phone };

  const instagram = typeof social.instagram === 'string' && social.instagram ? `https://instagram.com/${social.instagram.replace(/^@/, '')}` : null;
  if (instagram) return { channel: 'instagram', website: null, value: instagram, osmPhone: phone };

  return null;
}

export async function searchFoursquarePlaces(bbox: BoundingBox, category: string): Promise<FoursquareSearchResult> {
  if (!isConfigured()) return { businesses: [], rawCount: 0, enabled: false };

  const { lat, lon, radiusMeters } = bboxToCenterAndRadius(bbox);
  const url = new URL(FOURSQUARE_SEARCH_URL);
  url.searchParams.set('ll', `${lat},${lon}`);
  url.searchParams.set('radius', String(radiusMeters));
  url.searchParams.set('query', category);
  url.searchParams.set('limit', '50');
  url.searchParams.set('fields', 'fsq_place_id,name,tel,website,social_media,latitude,longitude,categories');

  let res: Response;
  try {
    res = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          Authorization: `Bearer ${process.env.FOURSQUARE_API_KEY}`,
          'X-Places-Api-Version': FOURSQUARE_API_VERSION,
          Accept: 'application/json',
        },
      },
      FETCH_TIMEOUT_MS,
    );
  } catch (e: any) {
    // Best-effort second source: a Foursquare outage/timeout should never take down a search that OSM
    // alone could have served fine.
    throw new Error(`Foursquare search failed: ${e.message || e}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Foursquare search failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { results?: any[] };
  const places = data.results || [];

  const businesses: OsmBusinessResult[] = [];
  for (const place of places) {
    const contact = extractContactFromPlace(place);
    if (!contact) continue;
    businesses.push({
      name: place.name || 'Unnamed business',
      website: contact.website,
      contactChannel: contact.channel,
      contactValue: contact.value,
      osmPhone: contact.osmPhone,
      lat: typeof place.latitude === 'number' ? place.latitude : 0,
      lon: typeof place.longitude === 'number' ? place.longitude : 0,
      osmTags: { source: 'foursquare', fsq_place_id: place.fsq_place_id || '' },
    });
  }

  return { businesses, rawCount: places.length, enabled: true };
}
