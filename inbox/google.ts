// Thin wrapper around Google's OAuth2 + Gmail REST API. Deliberately stateless -- this file knows nothing
// about Supabase or token storage (that's inbox/route.ts's job); it only knows how to talk to Google.
//
// Scope used: gmail.readonly only. This is a read-only "show me what's happening" feature (replies,
// unsubscribes, confirmation that something was actually sent) -- it never sends on the admin's behalf, so
// it never asks for more access than that.

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to your environment (see the setup steps for the Inbox tab).`);
  return v;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: env('GOOGLE_REDIRECT_URI'),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Forces Google to hand back a refresh_token even if this admin account has authorized this app
    // before (otherwise a second connect attempt silently omits it, and the connection can't be renewed).
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: env('GOOGLE_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${data.error_description || data.error || res.status}`);
  return data;
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Google token refresh failed: ${data.error_description || data.error || res.status}. ` +
        `If this says "invalid_grant", the connection needs to be re-established from the Inbox tab.`,
    );
  }
  return data;
}

export async function fetchGmailEmailAddress(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL_API}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Could not read Gmail profile: ${data.error?.message || res.status}`);
  return data.emailAddress;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
}

/** Runs one Gmail search query (standard Gmail search syntax, e.g. "from:x@y.com OR to:x@y.com") and
 * returns lightweight summaries (not full bodies) for the matches, newest first. Capped at `maxResults` to
 * keep this fast and cheap -- this is meant to answer "did they reply / did this actually go out," not to
 * be a full inbox browser. */
export async function searchGmailMessages(accessToken: string, query: string, maxResults = 25): Promise<GmailMessageSummary[]> {
  const listUrl = `${GMAIL_API}/messages?${new URLSearchParams({ q: query, maxResults: String(maxResults) })}`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const listData = await listRes.json();
  if (!listRes.ok) throw new Error(`Gmail search failed: ${listData.error?.message || listRes.status}`);

  const ids: string[] = (listData.messages || []).map((m: any) => m.id);
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async (id) => {
      const url = `${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (!res.ok) return null;
      const headers: Record<string, string> = {};
      for (const h of data.payload?.headers || []) headers[h.name] = h.value;
      return {
        id: data.id,
        threadId: data.threadId,
        from: headers.From || '',
        to: headers.To || '',
        subject: headers.Subject || '',
        snippet: data.snippet || '',
        date: headers.Date || '',
        labelIds: data.labelIds || [],
      } as GmailMessageSummary;
    }),
  );

  return results.filter((r): r is GmailMessageSummary => r !== null);
}
