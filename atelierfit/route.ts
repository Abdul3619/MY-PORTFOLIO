// AtelierFit: order intake + Paystack verification, mounted at /api/atelierfit. Customer-facing routes (create
// order, verify payment) are public but tightly validated; the order list/status-update routes are admin-only,
// gated by the same requireAuth used everywhere else in server.ts.
//
// Pricing lives here, server-side, keyed by garment id -- the client never gets to say how much an order costs.
// Deposit is a flat 40% of the garment's base price, in Nigerian Naira (kobo = NGN x 100, which is what Paystack's
// API expects as "amount").

import express from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';

// `imageUrl` is the one-line hook for real cutout-collection photos later -- unset today (the client falls
// back to an honest abstract placeholder, see GarmentPlaceholder), set it here once real photos exist and
// the gallery tile picks it up automatically, no other code changes needed.
export const GARMENTS: Record<string, { label: string; basePriceNaira: number; imageUrl?: string }> = {
  agbada: { label: 'Agbada (full set)', basePriceNaira: 65000 },
  kaftan: { label: 'Kaftan', basePriceNaira: 35000 },
  senator: { label: 'Senator Suit', basePriceNaira: 40000 },
  shirt: { label: 'Tailored Shirt', basePriceNaira: 18000 },
  trousers: { label: 'Tailored Trousers', basePriceNaira: 15000 },
  dress: { label: "Women's Dress", basePriceNaira: 30000 },
  custom: { label: 'Custom / Other (confirmed by message)', basePriceNaira: 25000 },
};

const DEPOSIT_RATE = 0.4;

const measurementsSchema = z.object({
  heightCm: z.number().positive().max(260),
  shoulderWidthCm: z.number().positive().max(100).optional(),
  chestCm: z.number().positive().max(200).optional(),
  waistCm: z.number().positive().max(200).optional(),
  hipCm: z.number().positive().max(200).optional(),
  sleeveLengthCm: z.number().positive().max(120).optional(),
  armLengthCm: z.number().positive().max(120).optional(),
  legLengthCm: z.number().positive().max(140).optional(),
}).passthrough();

const createOrderSchema = z.object({
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().max(254),
  customerPhone: z.string().max(30).optional().nullable(),
  garment: z.string().refine((g) => g in GARMENTS, { message: 'Unknown garment type' }),
  notes: z.string().max(2000).optional().nullable(),
  measurements: measurementsSchema,
  measurementMethod: z.enum(['camera_ai', 'manual']),
});

export function createAtelierFitRouter(deps: { requireAuth: express.RequestHandler; supabaseUrl: string; supabaseServiceKey: string }) {
  const router = express.Router();
  const db: SupabaseClient = createClient(deps.supabaseUrl, deps.supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const paystackSecret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  const paystackPublicKey = (process.env.PAYSTACK_PUBLIC_KEY || '').trim();

  const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    (req: express.Request, res: express.Response) => {
      fn(req, res).catch((err: any) => {
        console.error('AtelierFit route error:', err?.message);
        res.status(502).json({ error: err?.message || String(err) });
      });
    };

  // ---- Public: feature flags + catalogue ---------------------------------

  router.get(
    '/config',
    asyncHandler(async (_req, res) => {
      res.json({
        paystackConfigured: Boolean(paystackSecret && paystackPublicKey),
        paystackPublicKey: paystackPublicKey || null,
        garments: Object.entries(GARMENTS).map(([id, g]: [string, { label: string; basePriceNaira: number; imageUrl?: string }]) => ({ id, ...g })),
        depositRate: DEPOSIT_RATE,
      });
    }),
  );

  // ---- Public: create an order (status starts pending) --------------------

  router.post(
    '/orders',
    asyncHandler(async (req, res) => {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues.map((i: { message: string }) => i.message).join(', ') });
        return;
      }
      const body = parsed.data;
      const garment = GARMENTS[body.garment];
      const amountNaira = Math.round(garment.basePriceNaira * DEPOSIT_RATE);
      const amountKobo = amountNaira * 100;
      const reference = `ATF-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

      const { data, error } = await db
        .from('atelierfit_orders')
        .insert({
          customer_name: body.customerName,
          customer_email: body.customerEmail,
          customer_phone: body.customerPhone || null,
          garment_type: garment.label,
          notes: body.notes || null,
          measurements: body.measurements,
          measurement_method: body.measurementMethod,
          measurements_confirmed_by_customer: true, // the review step is mandatory before this call is ever made
          amount_kobo: amountKobo,
          currency: 'NGN',
          payment_provider: 'paystack',
          payment_reference: reference,
          payment_status: 'pending',
          status: 'New',
        })
        .select('id, payment_reference, amount_kobo')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(201).json({
        orderId: data.id,
        reference: data.payment_reference,
        amountKobo: data.amount_kobo,
        paystackReady: Boolean(paystackSecret && paystackPublicKey),
      });
    }),
  );

  // ---- Public: verify a Paystack transaction and mark the order paid ------

  router.post(
    '/verify',
    asyncHandler(async (req, res) => {
      const reference = typeof req.body?.reference === 'string' ? req.body.reference : '';
      if (!reference) {
        res.status(400).json({ error: 'reference is required' });
        return;
      }
      if (!paystackSecret) {
        res.status(503).json({ error: 'Payments are not configured on the server yet.' });
        return;
      }

      const { data: order, error: fetchErr } = await db
        .from('atelierfit_orders')
        .select('id, amount_kobo, payment_status')
        .eq('payment_reference', reference)
        .single();
      if (fetchErr || !order) {
        res.status(404).json({ error: 'Order not found for that reference' });
        return;
      }
      if (order.payment_status === 'paid') {
        res.json({ success: true, alreadyConfirmed: true });
        return;
      }

      const verifyResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecret}` },
      });
      const verifyJson: any = await verifyResp.json().catch(() => null);
      const txn = verifyJson?.data;
      const isGenuinePaid = verifyResp.ok && txn?.status === 'success' && txn?.amount === order.amount_kobo;

      await db
        .from('atelierfit_orders')
        .update({
          payment_status: isGenuinePaid ? 'paid' : 'failed',
          status: isGenuinePaid ? 'Confirmed' : 'New',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (!isGenuinePaid) {
        res.status(402).json({ error: 'Payment could not be verified.' });
        return;
      }
      res.json({ success: true });
    }),
  );

  // ---- Admin: list + update orders ----------------------------------------

  router.get(
    '/admin/orders',
    deps.requireAuth,
    asyncHandler(async (_req, res) => {
      const { data, error } = await db
        .from('atelierfit_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  router.patch(
    '/admin/orders/:id',
    deps.requireAuth,
    asyncHandler(async (req, res) => {
      const status = typeof req.body?.status === 'string' ? req.body.status : null;
      const allowed = ['New', 'Confirmed', 'In Progress', 'Ready', 'Delivered', 'Cancelled'];
      if (!status || !allowed.includes(status)) {
        res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
        return;
      }
      const { data, error } = await db
        .from('atelierfit_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json(data);
    }),
  );

  return router;
}
