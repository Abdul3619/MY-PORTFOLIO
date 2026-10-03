// StitchBook: a desktop-oriented tailor-shop management demo, mounted at /api/stitchbook.
//
// This is the "desktop app" project -- unlike atelierfit (a real customer intake form), every route here is
// public, no auth, by design: it's a live portfolio demo of a desktop management tool, and visitors are meant
// to add/edit/delete rows to see how it behaves. RLS on the tables already allows anon full CRUD (see the
// migration); this router just adds basic shape validation and prunes each table back to MAX_ROWS on insert
// so the demo can't grow without bound.

import express from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const MAX_ROWS = 200;

const orderSchema = z.object({
  clientName: z.string().min(1).max(120),
  clientPhone: z.string().max(30).optional().nullable(),
  garment: z.string().min(1).max(120),
  fabricSource: z.enum(['client_provided', 'shop_stock']).optional().nullable(),
  priceNaira: z.number().int().min(0),
  depositNaira: z.number().int().min(0).default(0),
  dueDate: z.string().optional().nullable(),
  status: z.enum(['New', 'Cutting', 'Sewing', 'Fitting', 'Ready', 'Delivered', 'Cancelled']).default('New'),
  notes: z.string().max(2000).optional().nullable(),
});

const inventorySchema = z.object({
  itemName: z.string().min(1).max(120),
  category: z.enum(['Fabric', 'Thread', 'Button/Zip', 'Lining', 'Other']).default('Fabric'),
  quantity: z.number().min(0),
  unit: z.enum(['yards', 'meters', 'rolls', 'pieces', 'sets']).default('yards'),
  reorderLevel: z.number().min(0).default(5),
  notes: z.string().max(2000).optional().nullable(),
});

export function createStitchBookRouter(deps: { supabaseUrl: string; supabaseServiceKey: string }) {
  const router = express.Router();
  const db: SupabaseClient = createClient(deps.supabaseUrl, deps.supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    (req: express.Request, res: express.Response) => {
      fn(req, res).catch((err: any) => {
        console.error('StitchBook route error:', err?.message);
        res.status(502).json({ error: err?.message || String(err) });
      });
    };

  // Keep a table from growing past MAX_ROWS by deleting the oldest rows beyond that count.
  async function pruneOldest(table: 'stitchbook_orders' | 'stitchbook_inventory') {
    const { data } = await db.from(table).select('id').order('created_at', { ascending: false }).range(MAX_ROWS, MAX_ROWS + 50);
    const staleIds = (data || []).map((r: { id: string }) => r.id);
    if (staleIds.length > 0) {
      await db.from(table).delete().in('id', staleIds);
    }
  }

  // ---- Orders --------------------------------------------------------------

  router.get(
    '/orders',
    asyncHandler(async (_req, res) => {
      const { data, error } = await db.from('stitchbook_orders').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  router.post(
    '/orders',
    asyncHandler(async (req, res) => {
      const parsed = orderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join(', ') });
        return;
      }
      const b = parsed.data;
      const { data, error } = await db
        .from('stitchbook_orders')
        .insert({
          client_name: b.clientName,
          client_phone: b.clientPhone || null,
          garment: b.garment,
          fabric_source: b.fabricSource || null,
          price_naira: b.priceNaira,
          deposit_naira: b.depositNaira,
          due_date: b.dueDate || null,
          status: b.status,
          notes: b.notes || null,
        })
        .select()
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      await pruneOldest('stitchbook_orders');
      res.status(201).json(data);
    }),
  );

  router.patch(
    '/orders/:id',
    asyncHandler(async (req, res) => {
      const parsed = orderSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join(', ') });
        return;
      }
      const b = parsed.data;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.clientName !== undefined) patch.client_name = b.clientName;
      if (b.clientPhone !== undefined) patch.client_phone = b.clientPhone;
      if (b.garment !== undefined) patch.garment = b.garment;
      if (b.fabricSource !== undefined) patch.fabric_source = b.fabricSource;
      if (b.priceNaira !== undefined) patch.price_naira = b.priceNaira;
      if (b.depositNaira !== undefined) patch.deposit_naira = b.depositNaira;
      if (b.dueDate !== undefined) patch.due_date = b.dueDate;
      if (b.status !== undefined) patch.status = b.status;
      if (b.notes !== undefined) patch.notes = b.notes;

      const { data, error } = await db.from('stitchbook_orders').update(patch).eq('id', req.params.id).select().single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  router.delete(
    '/orders/:id',
    asyncHandler(async (req, res) => {
      const { error } = await db.from('stitchbook_orders').delete().eq('id', req.params.id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(204).end();
    }),
  );

  // ---- Inventory -------------------------------------------------------------

  router.get(
    '/inventory',
    asyncHandler(async (_req, res) => {
      const { data, error } = await db.from('stitchbook_inventory').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  router.post(
    '/inventory',
    asyncHandler(async (req, res) => {
      const parsed = inventorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join(', ') });
        return;
      }
      const b = parsed.data;
      const { data, error } = await db
        .from('stitchbook_inventory')
        .insert({
          item_name: b.itemName,
          category: b.category,
          quantity: b.quantity,
          unit: b.unit,
          reorder_level: b.reorderLevel,
          notes: b.notes || null,
        })
        .select()
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      await pruneOldest('stitchbook_inventory');
      res.status(201).json(data);
    }),
  );

  router.patch(
    '/inventory/:id',
    asyncHandler(async (req, res) => {
      const parsed = inventorySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join(', ') });
        return;
      }
      const b = parsed.data;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.itemName !== undefined) patch.item_name = b.itemName;
      if (b.category !== undefined) patch.category = b.category;
      if (b.quantity !== undefined) patch.quantity = b.quantity;
      if (b.unit !== undefined) patch.unit = b.unit;
      if (b.reorderLevel !== undefined) patch.reorder_level = b.reorderLevel;
      if (b.notes !== undefined) patch.notes = b.notes;

      const { data, error } = await db.from('stitchbook_inventory').update(patch).eq('id', req.params.id).select().single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  router.delete(
    '/inventory/:id',
    asyncHandler(async (req, res) => {
      const { error } = await db.from('stitchbook_inventory').delete().eq('id', req.params.id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(204).end();
    }),
  );

  return router;
}
