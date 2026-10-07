// Verifies that an email address found on a business's site is actually real and deliverable, before it
// goes anywhere near a drafted message -- the whole point is never sending to an address that looks right
// but bounces. Uses Hunter.io's Email Verifier API (free plan: a limited number of verifications/month, no
// card required to sign up as of 2026).
//
// Entirely optional and additive: with no HUNTER_API_KEY set, verifyEmail() returns { ok: false, enabled:
// false } immediately -- no network call, no error -- and the caller just skips verification, exactly as
// before this file existed.

const HUNTER_VERIFY_URL = 'https://api.hunter.io/v2/email-verifier';
const FETCH_TIMEOUT_MS = 10000;

export type EmailVerificationResult =
  | { ok: true; enabled: true; status: 'deliverable'; detail: string }
  | { ok: true; enabled: true; status: 'risky'; detail: string }
  | { ok: true; enabled: true; status: 'undeliverable'; detail: string }
  | { ok: true; enabled: true; status: 'unknown'; detail: string }
  | { ok: false; enabled: false; error?: string };

function isConfigured(): boolean {
  return Boolean(process.env.HUNTER_API_KEY && process.env.HUNTER_API_KEY.trim());
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Checks whether an email address found on a site is real and likely to actually receive mail. Never
 * throws -- any failure (no key, rate limit, network error, an unexpected response shape) comes back as
 * enabled: false / status: 'unknown' so a caller can treat verification as optional, best-effort evidence
 * rather than something that can break a lead. */
export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  if (!isConfigured()) return { ok: false, enabled: false };
  if (!email || !email.includes('@')) return { ok: false, enabled: false, error: 'Not a usable email address' };

  try {
    const url = `${HUNTER_VERIFY_URL}?email=${encodeURIComponent(email)}&api_key=${process.env.HUNTER_API_KEY}`;
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      // A rate-limit (429) or an exhausted free-tier quota shouldn't be treated as "this email is bad" --
      // it's "we couldn't check," which is a different, honest thing to report.
      return { ok: false, enabled: true, error: `Hunter.io verification failed: HTTP ${res.status}` };
    }
    const body = (await res.json()) as any;
    const result = body?.data?.result; // 'deliverable' | 'undeliverable' | 'risky', per Hunter's API
    const subStatus = body?.data?.status || body?.data?._details?.status;

    if (result === 'deliverable') return { ok: true, enabled: true, status: 'deliverable', detail: 'Verified as a real, deliverable address.' };
    if (result === 'undeliverable') return { ok: true, enabled: true, status: 'undeliverable', detail: 'This address bounces -- it does not accept mail.' };
    if (result === 'risky') return { ok: true, enabled: true, status: 'risky', detail: `Flagged as risky (${subStatus || 'possible catch-all/disposable address'}) -- may not reach anyone.` };
    return { ok: true, enabled: true, status: 'unknown', detail: 'Could not confirm either way.' };
  } catch (e: any) {
    return { ok: false, enabled: true, error: `Hunter.io verification failed: ${e.message || e}` };
  }
}
