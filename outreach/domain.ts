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
