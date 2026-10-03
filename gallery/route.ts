// Read-only bridge onto the Atelier Noir / Agbada Luxe product catalog (`agbada_products`), which lives in a
// separate app/codebase this session doesn't have access to but shares this project's Supabase database. That
// table is already the real system of record for the catalog -- this router does NOT duplicate it with a
// second schema, it just lets AtelierFit (and, later, the rebuilt Atelier Noir pages in this repo) read from it.
//
// Nothing here can write to agbada_products -- that stays the other app's job. This uses the service-role key
// server-side (same as every other router in this project), since agbada_products has RLS enabled with no
// public policies: only a service-role connection can read it at all today.
//
// Until that catalog actually has real, unisex/international products in it, these endpoints just return an
// empty list -- which is the honest state. No placeholder/stock items are inserted here; see the earlier lesson
// in AtelierFit/index.tsx about guessing garment/country names onto unverified photos.

import express from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createGalleryRouter(deps: { supabaseUrl: string; supabaseServiceKey: string }) {
  const router = express.Router();
  const db: SupabaseClient = createClient(deps.supabaseUrl, deps.supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    (req: express.Request, res: express.Response) => {
      fn(req, res).catch((err: any) => {
        console.error('Gallery route error:', err?.message);
        res.status(502).json({ error: err?.message || String(err) });
      });
    };

  // GET /api/gallery/items -- published products only, optionally filtered by category.
  // ?category=<text>  ?unisexOnly=true  ?limit=<n, default 24, max 100>
  router.get(
    '/items',
    asyncHandler(async (req, res) => {
      const category = typeof req.query.category === 'string' ? req.query.category : null;
      const unisexOnly = req.query.unisexOnly === 'true';
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 24));

      let query = db
        .from('agbada_products')
        .select('id, name, description, category, image_url, region, is_unisex, sort_order')
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .limit(limit);

      if (category) query = query.eq('category', category);
      if (unisexOnly) query = query.eq('is_unisex', true);

      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data || []);
    }),
  );

  // GET /api/gallery/categories -- the distinct categories actually present among published products, so
  // consumers never have to hardcode a category list that can drift from what's really in the catalog.
  router.get(
    '/categories',
    asyncHandler(async (_req, res) => {
      const { data, error } = await db
        .from('agbada_products')
        .select('category')
        .eq('is_published', true);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const categories = Array.from(new Set((data || []).map((r: { category: string }) => r.category))).sort();
      res.json(categories);
    }),
  );

  return router;
}
