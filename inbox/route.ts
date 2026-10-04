// Admin-only "Inbox" API: a read-only view into the admin's own Gmail (INBOX + SENT), scoped to the email
// addresses of actual outreach leads, so the Review Queue's "sent" / "no reply yet" / "replied" / "looks
// like an unsubscribe" status has real evidence behind it instead of just the manual "mark sent" click.
//
// This never sends anything and never touches a lead's Gmail inbox, only the admin's own -- it reads the
// admin's Gmail, searching for messages to/from the specific business email addresses already on file in
// the outreach tool. See inbox/google.ts for the actual Google API calls.

import express from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  isGoogleOAuthConfigured,
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchGmailEmailAddress,
  searchGmailMessages,
  type GmailMessageSummary,
} from './google.js';

const UNSUBSCRIBE_PATTERNS = /\b(unsubscribe|remove me|take me off|stop (emailing|contacting|sending)|opt(ed)? out|no longer interested)\b/i;

export function createInboxRouter(deps: { requireAuth: express.RequestHandler; supabaseUrl: string; supabaseServiceKey: string }) {
  const router = express.Router();

  const db: SupabaseClient = createClient(deps.supabaseUrl, deps.supabaseServiceKey, { auth: { persistSession: false } });

  async function getStoredTokens() {
    const { data, error } = await db.from('admin_gmail_tokens').select('*').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data as
      | { id: number; email: string | null; access_token: string; refresh_token: string; token_expiry: string }
      | null;
  }

  /** Returns a valid access token, refreshing and persisting it first if it's expired or about to be. */
  async function getValidAccessToken(): Promise<string> {
    const row = await getStoredTokens();
    if (!row) throw new Error('Gmail is not connected yet. Connect it from the Inbox tab first.');

    const expiresAt = new Date(row.token_expiry).getTime();
    if (Date.now() < expiresAt - 60_000) return row.access_token;

    const refreshed = await refreshAccessToken(row.refresh_token);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const { error } = await db
      .from('admin_gmail_tokens')
      .update({ access_token: refreshed.access_token, token_expiry: newExpiry, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error(error.message);
    return refreshed.access_token;
  }

  // The requireAuth-gated routes below need a logged-in admin for every call except the OAuth callback
  // itself, which Google redirects the browser to directly (no way to attach our own auth header to that
  // redirect). That's safe without a separate CSRF token here: the authorization `code` Google sends back
  // is single-use, short-lived, and only ever issued for the exact client_id + redirect_uri registered in
  // this admin's own Google Cloud project, so it can't be forged or replayed by anyone else.

  router.get('/status', deps.requireAuth, async (_req, res) => {
    try {
      if (!isGoogleOAuthConfigured()) return void res.json({ configured: false, connected: false });
      const row = await getStoredTokens();
      res.json({ configured: true, connected: Boolean(row), email: row?.email ?? null });
    } catch (e: any) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.get('/connect', deps.requireAuth, (_req, res) => {
    if (!isGoogleOAuthConfigured()) {
      return void res.status(400).json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI are not set yet.' });
    }
    res.json({ url: buildAuthUrl(Math.random().toString(36).slice(2)) });
  });

  // Google redirects the browser here directly (not an API call from our own frontend), so this renders a
  // small plain HTML page rather than JSON -- it's meant to be looked at for a second, then closed/redirected.
  router.get('/callback', async (req, res) => {
    const code = String(req.query.code || '');
    const errorParam = String(req.query.error || '');
    const page = (title: string, body: string) =>
      res
        .status(200)
        .type('html')
        .send(`<!doctype html><html><body style="font-family:system-ui;padding:2rem;max-width:480px;margin:auto">
          <h2>${title}</h2><p>${body}</p>
          <script>setTimeout(() => { window.location.href = '/admin/outreach'; }, 2500);</script>
        </body></html>`);

    if (errorParam) return void page('Gmail connection cancelled', `Google reported: ${errorParam}. You can try again from the Inbox tab. Redirecting back now.`);
    if (!code) return void page('Something went wrong', 'No authorization code was returned by Google. Redirecting back now.');

    try {
      const tokens = await exchangeCodeForTokens(code);
      if (!tokens.refresh_token) {
        return void page(
          'Almost there',
          'Google did not return a long-lived connection this time (this can happen on a repeat attempt). ' +
            'Go to your Google Account settings, remove this app under "Third-party access," then try connecting again. Redirecting back now.',
        );
      }
      const email = await fetchGmailEmailAddress(tokens.access_token);
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      const { error } = await db.from('admin_gmail_tokens').upsert({
        id: 1,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokenExpiry,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      page('Gmail connected', `Connected as ${email}. Redirecting back to the dashboard now.`);
    } catch (e: any) {
      page('Connection failed', `${e.message || e}. Redirecting back now.`);
    }
  });

  router.post('/disconnect', deps.requireAuth, async (_req, res) => {
    try {
      const { error } = await db.from('admin_gmail_tokens').delete().eq('id', 1);
      if (error) throw new Error(error.message);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // Given a list of business email addresses already on file for outreach leads, finds any Gmail activity
  // (in the admin's own INBOX or SENT) to/from each one -- a reply, confirmation it was actually sent, or
  // (flagged specially) something that reads like an unsubscribe request.
  router.post('/messages', deps.requireAuth, async (req, res) => {
    const emails: string[] = Array.isArray(req.body?.emails) ? req.body.emails.filter((e: unknown) => typeof e === 'string' && e) : [];
    if (emails.length === 0) return void res.json({ byEmail: {} });

    try {
      const accessToken = await getValidAccessToken();
      // One OR-joined query per batch of addresses keeps this to a small, fixed number of Gmail API calls
      // no matter how many leads there are, rather than one search per lead.
      const BATCH = 12;
      const byEmail: Record<string, { messages: GmailMessageSummary[]; looksLikeUnsubscribe: boolean }> = {};
      for (const email of emails) byEmail[email] = { messages: [], looksLikeUnsubscribe: false };

      for (let i = 0; i < emails.length; i += BATCH) {
        const batch = emails.slice(i, i + BATCH);
        const addrClause = batch.map((e) => `"${e}"`).join(' OR ');
        const results = await searchGmailMessages(accessToken, `{from:(${addrClause}) to:(${addrClause})} -in:spam -in:trash`, 80);
        for (const msg of results) {
          const matched = batch.find((e) => msg.from.toLowerCase().includes(e.toLowerCase()) || msg.to.toLowerCase().includes(e.toLowerCase()));
          if (!matched) continue;
          byEmail[matched].messages.push(msg);
          if (msg.labelIds.includes('INBOX') && UNSUBSCRIBE_PATTERNS.test(`${msg.subject} ${msg.snippet}`)) {
            byEmail[matched].looksLikeUnsubscribe = true;
          }
        }
      }

      for (const email of Object.keys(byEmail)) {
        byEmail[email].messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      // GDPR/UK-PECR expect an opt-out to be honored right away, not just noticed on a later manual check
      // (CAN-SPAM is more lenient -- a 10-business-day window -- but there's no reason to rely on the looser
      // rule when this can just be immediate). So any reply that looks like an unsubscribe request gets added
      // to the permanent do-not-contact list automatically, the moment this scan sees it, rather than waiting
      // for the admin to notice the badge in the Inbox tab and add it by hand.
      const newlyOptedOut: string[] = [];
      for (const [email, info] of Object.entries(byEmail)) {
        if (!info.looksLikeUnsubscribe) continue;
        try {
          const { data: alreadyOptedOut, error: checkErr } = await db.rpc('ai_outreach_check_optout', { p_email: email });
          if (checkErr) throw new Error(checkErr.message);
          if (!alreadyOptedOut) {
            const { error: addErr } = await db.rpc('ai_outreach_add_optout', { p_email: email });
            if (addErr) throw new Error(addErr.message);
            newlyOptedOut.push(email);
          }
        } catch (optOutErr: any) {
          // Never let a failure to record one opt-out break the rest of this response -- the badge still
          // shows "looks like unsubscribe" either way, so nothing is silently lost.
          console.warn('Failed to auto-record opt-out for', email, optOutErr.message || optOutErr);
        }
      }

      res.json({ byEmail, newlyOptedOut });
    } catch (e: any) {
      res.status(502).json({ error: e.message || String(e) });
    }
  });

  return router;
}
