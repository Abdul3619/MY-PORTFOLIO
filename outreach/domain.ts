// Turns any of "example.com", "www.example.com", "https://example.com/path"
// into one canonical key ("example.com") so the same business is recognized
// no matter how its URL was entered (pasted URL, CSV row, or OSM result).

export function normalizeUrl(input: string): string {
  let cleaned = input.trim();
  if (!cleaned) throw new Error('Empty URL');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}

export function domainKey(input: string): string {
  const url = new URL(normalizeUrl(input));
  let host = url.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  return host;
}

// For a business with no website, there's no domain to dedupe on, so this
// builds an equivalent stable key from its contact channel instead -- e.g.
// "whatsapp:2348012345678" or "facebook:somebusiness". Same contact info
// found again (a repeat search, a different category) always collapses to
// the same key, exactly like domainKey does for real domains.
export function contactKey(channel: 'whatsapp' | 'facebook' | 'instagram' | 'phone', value: string): string {
  let v = value.trim().toLowerCase();
  if (channel === 'whatsapp' || channel === 'phone') {
    v = v.replace(/[^\d+]/g, '');
    if (!v) throw new Error(`Empty phone/WhatsApp number for channel "${channel}"`);
  } else {
    // facebook/instagram: keep just the page handle/path, drop the domain and query string.
    v = v.replace(/^https?:\/\//, '').replace(/^(www\.)?(facebook|instagram)\.com\//i, '').replace(/\/+$/, '').split('?')[0];
    if (!v) throw new Error(`Empty ${channel} handle`);
  }
  return `${channel}:${v}`;
}
