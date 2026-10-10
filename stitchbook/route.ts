// StitchBook: a desktop-oriented tailor-shop management tool, mounted at /api/stitchbook. It is the shared owner
// dashboard for AtelierFit and Atelier Noir.
//
// Dashboard/Orders/Inventory are a public demo on their own tables (stitchbook_orders, stitchbook_inventory):
// visitors can add, edit and delete rows freely. Writes are rate limited per visitor and each table is pruned
// back to MAX_ROWS on insert, so the demo can't grow without bound.
//
// The /live/* routes show the real AtelierFit orders, Atelier Noir bookings/catalog and the Real Inventory.
// They are public so a visitor can see a test order they just placed arrive here, but customer names, emails,
// phones and addresses are masked unless the signed-in owner is asking.
//
// The /manage/* routes are the Real Inventory (workshop_inventory), which used to live in the portfolio /admin.
// Open to visitors: they can add their own stock and move orders through stages (undone after 24 hours).

import express from 'express';
import rateLimit from 'express-rate-limit';
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

export function createStitchBookRouter(deps: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  // Resolves the signed-in owner (portfolio admin) for a request, or null for a visitor.
  getOwner: (req: express.Request) => Promise<unknown | null>;
}) {
  const router = express.Router();
  const db: SupabaseClient = createClient(deps.supabaseUrl, deps.supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Abuse protection for the public demo tabs: each visitor gets a modest budget of writes, on top of the
  // site-wide /api limiter in server.ts.
  router.use(
    rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 60,
      skip: (req) => req.method === 'GET',
      validate: { xForwardedForHeader: false, trustProxy: false, default: false },
      message: { error: 'You have made a lot of changes in a short time. Please wait a few minutes and try again.' },
    }),
  );

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

  // ---- Live (real, read-only, intentionally unlocked) -----------------------
  //
  // Same service-role client as above, now pointed at the real tables instead of the demo ones. These three
  // tables -- atelierfit_orders, agbada_products/agbada_bookings, workshop_inventory -- all live in this same
  // Supabase project, so no extra connection or secret is needed, only different table names. Read-only: GET
  // only, no insert/update/delete routes exist here, on purpose.

  const LIVE_ORDER_LIMIT = 100;

  // Visitors see that real orders exist, not who placed them: names are cut to first name + initial, email
  // and phone are masked, and shipping addresses are hidden. The signed-in owner gets the full rows.
  function maskName(name: string | null) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }
  function maskEmail(email: string | null) {
    if (!email) return email;
    const [user, domain] = email.split('@');
    return domain ? `${user.slice(0, 2)}***@${domain}` : '***';
  }
  function maskPhone(phone: string | null) {
    if (!phone) return phone;
    const digits = phone.replace(/\D/g, '');
    return digits.length > 3 ? `***${digits.slice(-3)}` : '***';
  }

  router.get(
    '/live/atelierfit-orders',
    asyncHandler(async (req, res) => {
      const { data, error } = await db
        .from('atelierfit_orders')
        .select(
          'id, customer_name, customer_email, customer_phone, garment_type, fabric, occasion, amount_kobo, payment_status, status, delivery_method, shipping_address, tracking_number, appointment_date, appointment_time, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(LIVE_ORDER_LIMIT);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      if (await deps.getOwner(req)) {
        res.json(data);
        return;
      }
      res.json(
        (data || []).map((o: any) => ({
          ...o,
          customer_name: maskName(o.customer_name),
          customer_email: maskEmail(o.customer_email),
          customer_phone: maskPhone(o.customer_phone),
          shipping_address: null,
        })),
      );
    }),
  );

  router.get(
    '/live/atelier-noir',
    asyncHandler(async (req, res) => {
      const [productsRes, bookingsRes] = await Promise.all([
        db
          .from('agbada_products')
          .select('id, name, description, price, currency, category, image_url, is_published, sort_order')
          .eq('is_published', true)
          .order('sort_order', { ascending: true })
          .limit(LIVE_ORDER_LIMIT),
        db
          .from('agbada_bookings')
          .select('id, kind, full_name, email, phone, service, preferred_date, message, status, created_at')
          .order('created_at', { ascending: false })
          .limit(LIVE_ORDER_LIMIT),
      ]);
      if (productsRes.error) {
        res.status(500).json({ error: productsRes.error.message });
        return;
      }
      if (bookingsRes.error) {
        res.status(500).json({ error: bookingsRes.error.message });
        return;
      }
      const isOwner = Boolean(await deps.getOwner(req));
      const bookings = isOwner
        ? bookingsRes.data
        : (bookingsRes.data || []).map((b: any) => ({
            ...b,
            full_name: maskName(b.full_name),
            email: maskEmail(b.email),
            phone: maskPhone(b.phone),
            message: null,
          }));
      res.json({ products: productsRes.data, bookings });
    }),
  );

  router.get(
    '/live/inventory',
    asyncHandler(async (_req, res) => {
      const { data, error } = await db
        .from('workshop_inventory')
        .select('id, item_name, category, quantity, unit, reorder_level, supplier, notes, updated_at')
        .order('item_name', { ascending: true });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  // ---- Real Inventory (Manage tab) ------------------------------------------
  //
  // The real fabric/supplies stock (workshop_inventory) is managed here, inside StitchBook, instead of the
  // portfolio /admin. Anyone can read it (the Live tab already shows it); only the signed-in owner can write.

  const realInventorySchema = z.object({
    itemName: z.string().min(1).max(120),
    category: z.enum(['Fabric', 'Thread', 'Button/Zip', 'Lining', 'Embroidery Supplies', 'Other']).default('Fabric'),
    quantity: z.number().min(0),
    unit: z.enum(['yards', 'meters', 'rolls', 'pieces', 'sets', 'spools']).default('yards'),
    reorderLevel: z.number().min(0).default(5),
    costNaira: z.number().int().min(0).max(100000000).optional().nullable(),
    supplier: z.string().max(160).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  });

  // Visitors can use the Manage tab freely. Their changes are limited to rows/orders they can safely undo:
  // stock rows they add themselves (flagged visitor_created) and order stages (original saved, restored after
  // 24 hours). The signed-in owner can change anything and is never snapshotted.
  const VISITOR_TTL_MS = 24 * 60 * 60 * 1000;
  let lastCleanup = 0;

  async function isOwner(req: express.Request): Promise<boolean> {
    try {
      return !!(await deps.getOwner(req));
    } catch {
      return false;
    }
  }

  // Throttled clean-up, run on Manage requests: removes visitor-added stock older than 24h and puts back any
  // order a visitor moved, using the state saved before their first change.
  async function cleanupVisitorData() {
    if (Date.now() - lastCleanup < 5 * 60 * 1000) return;
    lastCleanup = Date.now();
    const cutoff = new Date(Date.now() - VISITOR_TTL_MS).toISOString();
    await db.from('workshop_inventory').delete().eq('visitor_created', true).lt('created_at', cutoff);
    const { data: edits } = await db
      .from('stitchbook_visitor_edits')
      .select('id, order_id, original')
      .is('reverted_at', null)
      .lt('created_at', cutoff)
      .limit(100);
    for (const e of edits || []) {
      await db.from('atelierfit_orders').update(e.original).eq('id', e.order_id);
      await db.from('stitchbook_visitor_edits').update({ reverted_at: new Date().toISOString() }).eq('id', e.id);
    }
  }

  router.get(
    '/manage/inventory',
    asyncHandler(async (_req, res) => {
      await cleanupVisitorData().catch((e) => console.error('cleanup', e?.message));
      const { data, error } = await db
        .from('workshop_inventory')
        .select('id, item_name, category, quantity, unit, reorder_level, cost_naira, supplier, notes, updated_at, visitor_created')
        .order('item_name', { ascending: true });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  router.post(
    '/manage/inventory',
    asyncHandler(async (req, res) => {
      const owner = await isOwner(req);
      const parsed = realInventorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join(', ') });
        return;
      }
      const b = parsed.data;
      const { data, error } = await db
        .from('workshop_inventory')
        .insert({
          item_name: b.itemName,
          category: b.category,
          quantity: b.quantity,
          unit: b.unit,
          reorder_level: b.reorderLevel,
          cost_naira: b.costNaira ?? null,
          supplier: b.supplier || null,
          notes: b.notes || null,
          visitor_created: !owner,
        })
        .select()
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      if (!owner) {
        // Keep visitor-added stock bounded.
        const { data: old } = await db.from('workshop_inventory').select('id').eq('visitor_created', true).order('created_at', { ascending: false }).range(50, 100);
        if (old && old.length) await db.from('workshop_inventory').delete().in('id', old.map((r: { id: string }) => r.id));
      }
      res.status(201).json(data);
    }),
  );

  router.patch(
    '/manage/inventory/:id',
    asyncHandler(async (req, res) => {
      if (!(await isOwner(req))) {
        const { data: row } = await db.from('workshop_inventory').select('visitor_created').eq('id', req.params.id).maybeSingle();
        if (!row?.visitor_created) {
          res.status(403).json({ error: 'This is the shop’s sample stock. Add your own item to try editing.' });
          return;
        }
      }
      const parsed = realInventorySchema.partial().safeParse(req.body);
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
      if (b.costNaira !== undefined) patch.cost_naira = b.costNaira;
      if (b.supplier !== undefined) patch.supplier = b.supplier;
      if (b.notes !== undefined) patch.notes = b.notes;
      const { data, error } = await db.from('workshop_inventory').update(patch).eq('id', req.params.id).select().single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  router.delete(
    '/manage/inventory/:id',
    asyncHandler(async (req, res) => {
      if (!(await isOwner(req))) {
        const { data: row } = await db.from('workshop_inventory').select('visitor_created').eq('id', req.params.id).maybeSingle();
        if (!row?.visitor_created) {
          res.status(403).json({ error: 'This is the shop’s sample stock. Add your own item to try deleting.' });
          return;
        }
      }
      const { error } = await db.from('workshop_inventory').delete().eq('id', req.params.id);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(204).end();
    }),
  );

  // ---- Orders (Manage tab) ---------------------------------------------------
  // Open to visitors: they can see every AtelierFit order (customer details masked) and move one through its
  // stages. Their change is undone after 24 hours; the owner's own changes are permanent.

  const MANAGE_STATUSES = ['New', 'Confirmed', 'Cutting', 'Sewing', 'Embroidery', 'Quality Check', 'Ready', 'Shipped', 'Delivered', 'Cancelled'];

  router.get(
    '/manage/orders',
    asyncHandler(async (req, res) => {
      await cleanupVisitorData().catch((e) => console.error('cleanup', e?.message));
      const owner = await isOwner(req);
      const { data, error } = await db.from('atelierfit_orders').select('*').order('created_at', { ascending: false }).limit(LIVE_ORDER_LIMIT);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(
        (data || []).map((o: any) =>
          owner
            ? o
            : { ...o, customer_name: maskName(o.customer_name), customer_email: maskEmail(o.customer_email), customer_phone: maskPhone(o.customer_phone), shipping_address: null, measurements: null },
        ),
      );
    }),
  );

  router.patch(
    '/manage/orders/:id',
    asyncHandler(async (req, res) => {
      const status = typeof req.body?.status === 'string' ? req.body.status : null;
      const trackingNumber = typeof req.body?.trackingNumber === 'string' ? req.body.trackingNumber.trim().slice(0, 60) : null;
      if (!status || !MANAGE_STATUSES.includes(status)) {
        res.status(400).json({ error: `status must be one of ${MANAGE_STATUSES.join(', ')}` });
        return;
      }
      if (status === 'Shipped' && !trackingNumber) {
        res.status(400).json({ error: 'trackingNumber is required when marking an order Shipped' });
        return;
      }
      const owner = await isOwner(req);
      if (!owner) {
        const { data: before } = await db.from('atelierfit_orders').select('status, tracking_number, shipped_at, delivered_at').eq('id', req.params.id).maybeSingle();
        if (!before) {
          res.status(404).json({ error: 'Order not found' });
          return;
        }
        const { data: pending } = await db.from('stitchbook_visitor_edits').select('id').eq('order_id', req.params.id).is('reverted_at', null).limit(1);
        if (!pending || pending.length === 0) {
          await db.from('stitchbook_visitor_edits').insert({ order_id: req.params.id, original: { ...before, updated_at: new Date().toISOString() } });
        }
      }
      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (trackingNumber) update.tracking_number = trackingNumber;
      if (status === 'Shipped') update.shipped_at = new Date().toISOString();
      if (status === 'Delivered') update.delivered_at = new Date().toISOString();
      const { data, error } = await db.from('atelierfit_orders').update(update).eq('id', req.params.id).select().single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      if (owner) {
        // The owner's change is the new baseline: drop any pending visitor snapshot so the 24-hour clean-up
        // doesn't roll this order back to its pre-visitor state.
        await db
          .from('stitchbook_visitor_edits')
          .update({ reverted_at: new Date().toISOString() })
          .eq('order_id', req.params.id)
          .is('reverted_at', null);
      }
      res.json(data);
    }),
  );

  // One combined summary so the Live tab's headline numbers load in a single request.
  router.get(
    '/live/overview',
    asyncHandler(async (_req, res) => {
      const [ordersRes, productsRes, bookingsRes, inventoryRes] = await Promise.all([
        db.from('atelierfit_orders').select('id, status, amount_kobo, payment_status'),
        db.from('agbada_products').select('id', { count: 'exact', head: true }).eq('is_published', true),
        db.from('agbada_bookings').select('id, status').order('created_at', { ascending: false }).limit(LIVE_ORDER_LIMIT),
        db.from('workshop_inventory').select('id, quantity, reorder_level'),
      ]);
      if (ordersRes.error || bookingsRes.error || inventoryRes.error) {
        res.status(500).json({ error: ordersRes.error?.message || bookingsRes.error?.message || inventoryRes.error?.message });
        return;
      }
      const orders = ordersRes.data || [];
      const activeOrders = orders.filter((o: { status: string }) => o.status !== 'Delivered' && o.status !== 'Cancelled');
      const paidRevenueKobo = orders
        .filter((o: { payment_status: string }) => o.payment_status === 'paid')
        .reduce((sum: number, o: { amount_kobo: number }) => sum + (o.amount_kobo || 0), 0);
      const inventory = inventoryRes.data || [];
      const lowStockCount = inventory.filter((i: { quantity: number; reorder_level: number }) => i.quantity <= i.reorder_level).length;
      res.json({
        atelierfit: { totalOrders: orders.length, activeOrders: activeOrders.length, paidRevenueKobo },
        atelierNoir: { publishedProducts: productsRes.count ?? 0, totalBookings: (bookingsRes.data || []).length },
        inventory: { totalItems: inventory.length, lowStockCount },
      });
    }),
  );

  return router;
}
