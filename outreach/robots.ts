// A small, dependency-free robots.txt parser. Only implements what we
// actually need: matching Disallow/Allow rules for our user agent (falling
// back to "*"), and reading a Crawl-delay if present. Longest-match-wins,
// which is how real robots.txt parsers resolve overlapping rules.

export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelaySeconds: number | null;
}

export function parseRobotsTxt(text: string, userAgent: string): RobotsRules {
  const ua = userAgent.toLowerCase();
  const lines = text.split(/\r?\n/);

  const groups: { agents: string[]; rules: { type: 'allow' | 'disallow'; path: string }[]; crawlDelay: number | null }[] = [];
  let current: (typeof groups)[number] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      if (!current || current.rules.length > 0 || current.crawlDelay !== null) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === 'disallow' && current) {
      current.rules.push({ type: 'disallow', path: value });
    } else if (key === 'allow' && current) {
      current.rules.push({ type: 'allow', path: value });
    } else if (key === 'crawl-delay' && current) {
      const n = Number(value);
      if (!Number.isNaN(n)) current.crawlDelay = n;
    }
  }

  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && ua.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = specific || wildcard;

  if (!chosen) return { disallow: [], allow: [], crawlDelaySeconds: null };

  return {
    disallow: chosen.rules.filter((r) => r.type === 'disallow').map((r) => r.path),
    allow: chosen.rules.filter((r) => r.type === 'allow').map((r) => r.path),
    crawlDelaySeconds: chosen.crawlDelay,
  };
}

function patternToRegex(pattern: string): RegExp {
  // robots.txt paths support `*` (any sequence) and `$` (end of string).
  let out = '^';
  for (const ch of pattern) {
    if (ch === '*') out += '.*';
    else if (ch === '$') out += '$';
    else out += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out);
}

export function isAllowed(rules: RobotsRules, path: string): boolean {
  let bestMatch: { type: 'allow' | 'disallow'; length: number } | null = null;

  const consider = (type: 'allow' | 'disallow', pattern: string) => {
    if (!pattern) {
      // An empty Disallow means "allow everything"; skip empty Allow entries.
      if (type === 'disallow') return;
    }
    if (patternToRegex(pattern).test(path)) {
      if (!bestMatch || pattern.length > bestMatch.length) {
        bestMatch = { type, length: pattern.length };
      }
    }
  };

  for (const p of rules.disallow) consider('disallow', p);
  for (const p of rules.allow) consider('allow', p);

  if (!bestMatch) return true;
  return (bestMatch as { type: 'allow' | 'disallow'; length: number }).type === 'allow';
}
