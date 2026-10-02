// Blocks the crawler from ever being pointed at localhost, private/internal
// IP ranges, or link-local addresses. This matters specifically because
// auto-search feeds the crawler arbitrary URLs pulled from OpenStreetMap
// data with no manual review beforehand, so a malicious or malformed
// "website" tag must not be able to make this server fetch its own
// internal network (SSRF).

import dns from 'node:dns/promises';
import net from 'node:net';

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
  resolvedIps?: string[];
}

const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];
const BLOCKED_HOSTNAMES = new Set(['localhost']);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking range
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === '::1') return true; // loopback
  if (norm === '::') return true;
  if (norm.startsWith('fe80:')) return true; // link-local
  if (norm.startsWith('fc') || norm.startsWith('fd')) return true; // unique local fc00::/7
  if (norm.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 address — check the embedded IPv4 part too.
    const v4 = norm.split(':').pop() || '';
    if (v4.includes('.')) return isPrivateIPv4(v4);
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // unrecognized — fail closed
}

/**
 * Resolves the hostname and rejects it if it points anywhere private,
 * internal, or loopback. Call this before every fetch the crawler makes,
 * including the robots.txt fetch and any redirect target.
 */
export async function checkUrlIsSafeToFetch(rawUrl: string): Promise<UrlSafetyResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Not a valid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { safe: false, reason: `Unsupported protocol: ${url.protocol}` };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOSTNAME_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return { safe: false, reason: `Blocked hostname: ${hostname}` };
  }

  // A literal IP in the URL — check it directly, no DNS needed.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: `Blocked private/internal IP: ${hostname}` };
    }
    return { safe: true, resolvedIps: [hostname] };
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch (e: any) {
    return { safe: false, reason: `DNS lookup failed for ${hostname}: ${e.message || e}` };
  }

  if (addresses.length === 0) {
    return { safe: false, reason: `DNS lookup returned no addresses for ${hostname}` };
  }

  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      return { safe: false, reason: `${hostname} resolves to a private/internal IP (${ip})` };
    }
  }

  return { safe: true, resolvedIps: addresses };
}
