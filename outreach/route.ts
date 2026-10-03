// Admin-only outreach API: lead discovery, crawling, AI drafting and a review queue, merged in from the
// standalone AI-Outreach tool (see https://github.com/Abdul3619/ai-outreach for its original, independently
// deployable form). Every route here is mounted behind the same requireAuth gate as the rest of /api/admin.
//
// The ai_outreach_* functions have an extra gate beyond their normal grants: ai_outreach_require_key() checks a
// PostgREST request header (x-ai-outreach-key) against a SHA-256 hash stored in ai_outreach_config, a safeguard
// added back when this tool only ever held a public anon key with no login of its own. That gate only ever sees
// a header on a call that actually goes through PostgREST, so a direct Postgres connection (or the existing
// supabaseAdmin client, which carries no such header) gets 'unauthorized' no matter what role it holds -- this
// is why a dedicated client with that header is created below, rather than reusing supabaseAdmin as-is. The key
// itself lives only in AI_OUTREACH_SERVER_KEY (never the browser), so this route file is still the only thing,
// besides Abdulwahab's own SQL access, that can call these functions.
//
// All business logic (crawling, the SSRF guard, drafting, the coverage registry, opt-outs) is unchanged from the
// original: this file is only the Express wiring (routes.ts there used a tiny custom router; this uses an
// express.Router instead) plus a one-method adapter so Store can call this client's .rpc().

import express from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Store, type RpcClient } from './store.js';
import { runLeadPipeline, runNoWebsiteLeadPipeline, runWithConcurrency, loadSenderProfileFromEnv, type PipelineDeps } from './pipeline.js';
import { parseCsv } from './csv.js';
import { searchBusinesses, knownCategories, type OsmBusinessResult } from './overpass.js';
import type { LeadStatus } from './types.js';

export function createOutreachRouter(deps: { requireAuth: express.RequestHandler; supabaseUrl: string; supabaseServiceKey: string }) {
  // Body parsing comes from the app-wide express.json() middleware already mounted in server.ts by the time this
  // router is registered (see server.ts) -- no need to add a second one here.
  const router = express.Router();
  router.use(deps.requireAuth);

  const serverKey = (process.env.AI_OUTREACH_SERVER_KEY || '').trim();
  const outreachClient: SupabaseClient = createClient(deps.supabaseUrl, deps.supabaseServiceKey, {
    auth: { persistSession: false },
    global: { headers: serverKey ? { 'x-ai-outreach-key': serverKey } : {} },
  });

  const rpcClient: RpcClient = {
    async rpc(fn, params) {
      if (!serverKey) return { data: null, error: { message: 'AI_OUTREACH_SERVER_KEY is not set on the server.' } };
      const { data, error } = await outreachClient.rpc(fn, params ?? {});
      return { data: data ?? null, error: error ? { message: error.message } : null };
    },
  };
  const store = new Store(rpcClient);
  const pipelineDeps: PipelineDeps = { store, sender: loadSenderProfileFromEnv() };

  const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    (req: express.Request, res: express.Response) => {
      fn(req, res).catch((err: any) => {
        console.error('Outreach route error:', err?.message);
        res.status(502).json({ error: err?.message || String(err) });
      });
    };

  // ---- Config (is this feature usable right now) -----------------------

  router.get(
    '/config',
    asyncHandler(async (_req, res) => {
      res.json({
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        senderConfigured: Boolean(process.env.SENDER_BUSINESS_NAME && process.env.SENDER_ADDRESS),
        osmContactConfigured: Boolean(process.env.OSM_CONTACT_EMAIL),
      });
    }),
  );

  // ---- Leads -------------------------------------------------------------

  router.get(
    '/leads',
    asyncHandler(async (req, res) => {
      const status = typeof req.query.status === 'string' ? (req.query.status as LeadStatus) : undefined;
      res.json(await store.listLeads(status ? { status } : undefined));
    }),
  );

  router.get(
    '/leads/:id',
    asyncHandler(async (req, res) => {
      const lead = await store.getLead(Number(req.params.id));
      if (!lead) return void res.status(404).json({ error: 'Lead not found' });
      res.json(lead);
    }),
  );

  router.post(
    '/leads/url',
    asyncHandler(async (req, res) => {
      const { website, businessName, city, country } = req.body || {};
      if (!website) return void res.status(400).json({ error: 'website is required' });
      try {
        const outcome = await runLeadPipeline({ website, businessName, city, country, source: 'manual_url' }, pipelineDeps);
        res.json(outcome);
      } catch (e: any) {
        res.status(400).json({ error: e.message || String(e) });
      }
    }),
  );

  router.post(
    '/leads/csv',
    asyncHandler(async (req, res) => {
      const text: string | undefined = typeof req.body === 'string' ? req.body : req.body?.csv;
      if (!text) return void res.status(400).json({ error: 'Send CSV text as { "csv": "..." }.' });
      const { rows, skipped } = parseCsv(text);
      const outcomes = await runWithConcurrency(rows, 5, async (row) => {
        try {
          const outcome = await runLeadPipeline({ website: row.website, businessName: row.businessName, city: row.city, country: row.country, source: 'csv' }, pipelineDeps);
          return { row: row.website, ...outcome };
        } catch (e: any) {
          return { row: row.website, kind: 'invalid', error: e.message || String(e) };
        }
      });
      res.json({ imported: rows.length, skipped, outcomes });
    }),
  );

  router.patch(
    '/leads/:id',
    asyncHandler(async (req, res) => {
      const lead = await store.getLead(Number(req.params.id));
      if (!lead) return void res.status(404).json({ error: 'Lead not found' });

      const body = req.body || {};
      const patch: Record<string, unknown> = {};
      if (typeof body.draftSubject === 'string') patch.draftSubject = body.draftSubject;
      if (typeof body.draftBody === 'string') patch.draftBody = body.draftBody;

      if (body.action === 'approve') {
        patch.status = 'approved';
        await store.recordRegistryAction({ domain: lead.domain, status: 'approved' });
      } else if (body.action === 'reject') {
        patch.status = 'rejected';
        await store.recordRegistryAction({ domain: lead.domain, status: 'rejected' });
      } else if (body.action === 'mark_sent') {
        patch.status = 'sent';
        await store.recordRegistryAction({ domain: lead.domain, status: 'sent' });
      }

      await store.updateLead(lead.id, patch as any);
      res.json(await store.getLead(lead.id));
    }),
  );

  // ---- Auto-search (OpenStreetMap) --------------------------------------

  router.get('/search/categories', (_req, res) => res.json(knownCategories()));

  router.get(
    '/search/history',
    asyncHandler(async (_req, res) => res.json(await store.listSearches())),
  );

  router.post(
    '/search',
    asyncHandler(async (req, res) => {
      const city = String(req.body?.city || '').trim();
      const category = String(req.body?.category || '').trim();
      if (!city || !category) return void res.status(400).json({ error: 'city and category are required' });

      const prior = await store.findPriorSearch(city, category);
      if (prior && req.body?.force !== true) {
        return void res.json({
          repeat: true,
          priorSearch: prior,
          message: `You already ran "${category} in ${city}" on ${prior.createdAt}. Pass { "force": true } to run it again anyway.`,
        });
      }

      let businesses, resolvedPlace: string;
      try {
        const result = await searchBusinesses(city, category);
        businesses = result.businesses;
        resolvedPlace = result.resolvedPlace;
      } catch (e: any) {
        return void res.status(502).json({ error: `OpenStreetMap search failed: ${e.message || e}` });
      }

      // Each business is crawled (if it has a website) and drafted via Gemini -- both network calls, so
      // running several at once instead of one-at-a-time lets this request get through far more businesses
      // before the platform's request time limit cuts it off (see runWithConcurrency's own comment).
      const outcomes = await runWithConcurrency(businesses, 5, async (b: OsmBusinessResult) => {
        try {
          const outcome =
            b.contactChannel === 'website'
              ? await runLeadPipeline({ website: b.website!, businessName: b.name, city, source: 'auto_search' }, pipelineDeps)
              : await runNoWebsiteLeadPipeline(
                  { businessName: b.name, category, city, contactChannel: b.contactChannel, contactValue: b.contactValue!, source: 'auto_search' },
                  pipelineDeps,
                );
          return { business: b.name, website: b.website, contactChannel: b.contactChannel, ...outcome };
        } catch (e: any) {
          return { business: b.name, website: b.website, contactChannel: b.contactChannel, kind: 'invalid', error: e.message || String(e) };
        }
      });

      await store.recordSearch(city, category, businesses.length);
      // resolvedPlace tells the user exactly where OSM actually searched -- so a wrong-place geocode
      // (e.g. "Saki" matching Şəki, Azerbaijan instead of Saki, Nigeria) is visible, not a silent zero.
      res.json({ repeat: false, found: businesses.length, resolvedPlace, outcomes });
    }),
  );

  // ---- Coverage / stats ---------------------------------------------------

  router.get(
    '/coverage',
    asyncHandler(async (_req, res) => res.json(await store.coverageStats())),
  );

  // ---- Opt-outs ------------------------------------------------------------

  router.get(
    '/optouts',
    asyncHandler(async (_req, res) => res.json(await store.listOptOuts())),
  );

  router.post(
    '/optouts',
    asyncHandler(async (req, res) => {
      const email = String(req.body?.email || '').trim();
      if (!email) return void res.status(400).json({ error: 'email is required' });
      await store.addOptOut(email);
      res.json({ ok: true });
    }),
  );

  return router;
}
