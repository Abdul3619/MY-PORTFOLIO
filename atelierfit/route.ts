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
import QRCode from 'qrcode';
import sharp from 'sharp';

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

// Fabric options for the Design Review step -- a flat surcharge per fabric, same pattern as garment pricing:
// fixed server-side, the client only ever picks an id. "Everyday Cotton" carries no surcharge so every
// garment has a zero-extra-cost option.
export const FABRICS: Record<string, { label: string; tagline: string; surchargeNaira: number }> = {
  cotton: { label: 'Everyday Cotton', tagline: 'Breathable & reliable', surchargeNaira: 0 },
  linen: { label: 'Linen Blend', tagline: 'Breathable & fresh', surchargeNaira: 4000 },
  silk: { label: 'Silk Satin', tagline: 'Luxurious & elegant', surchargeNaira: 12000 },
  cashmere: { label: 'Cashmere Blend', tagline: 'Soft & premium', surchargeNaira: 15000 },
  velvet: { label: 'Velvet', tagline: 'Rich & sophisticated', surchargeNaira: 10000 },
};

export const OCCASIONS = ['Wedding', 'Evening', 'Business', 'Casual', 'Other'] as const;

// How many working days out a slot can be booked, and which slots exist per day -- used by both the
// /config response (so the client can render real selectable dates) and order creation (so a bad date/time
// can't be submitted around the UI).
const BOOKING_WINDOW_DAYS = 21;
const TIME_SLOTS = ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '5:00 PM'];
const ESTIMATED_TURNAROUND_DAYS = 9; // "7-10 days" from the reference design, midpoint

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
  fabric: z.string().refine((f) => f in FABRICS, { message: 'Unknown fabric' }).optional().nullable(),
  embroideryNotes: z.string().max(500).optional().nullable(),
  occasion: z.enum(OCCASIONS).optional().nullable(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'appointmentDate must be YYYY-MM-DD').optional().nullable(),
  appointmentTime: z.string().refine((t) => TIME_SLOTS.includes(t), { message: 'Unknown time slot' }).optional().nullable(),
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
      // Real selectable dates -- the next BOOKING_WINDOW_DAYS calendar days, Mondays-Saturdays only (the
      // reference design's calendar grid needs actual dates to render, not just a visual mockup).
      const bookableDates: string[] = [];
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      cursor.setDate(cursor.getDate() + 1); // earliest slot is tomorrow
      while (bookableDates.length < BOOKING_WINDOW_DAYS) {
        if (cursor.getDay() !== 0) bookableDates.push(cursor.toISOString().slice(0, 10)); // skip Sundays
        cursor.setDate(cursor.getDate() + 1);
      }

      res.json({
        paystackConfigured: Boolean(paystackSecret && paystackPublicKey),
        paystackPublicKey: paystackPublicKey || null,
        garments: Object.entries(GARMENTS).map(([id, g]: [string, { label: string; basePriceNaira: number; imageUrl?: string }]) => ({ id, ...g })),
        fabrics: Object.entries(FABRICS).map(([id, f]) => ({ id, ...f })),
        occasions: OCCASIONS,
        depositRate: DEPOSIT_RATE,
        bookableDates,
        timeSlots: TIME_SLOTS,
        estimatedTurnaroundDays: ESTIMATED_TURNAROUND_DAYS,
      });
    }),
  );

  // ---- Public: a real, scannable QR code for the installable app ----------
  // Encodes the actual /atelierfit URL (not a placeholder) with the AtelierFit icon composited in the
  // center -- level-H error correction tolerates roughly 30% of the code being obscured, so a logo badge
  // sized well under that still scans reliably. Scanning it opens /atelierfit, which is itself a fully
  // installable PWA (manifest + service worker, see src/pages/AtelierFit/index.tsx) -- so "scan to open"
  // and "scan to install" are the same link; the phone's own browser offers the install/home-screen prompt.
  router.get(
    '/qr-code.png',
    asyncHandler(async (req, res) => {
      const targetUrl = `${req.protocol}://${req.get('host')}/atelierfit`;
      const qrSize = 900;
      const qrBuffer = await QRCode.toBuffer(targetUrl, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 2,
        width: qrSize,
        color: { dark: '#0B0A08', light: '#FFFFFF' },
      });

      const badgeSize = Math.round(qrSize * 0.26);
      const logoSize = Math.round(badgeSize * 0.74);

      let finalBuffer = qrBuffer;
      try {
        const logoRes = await fetch(`${req.protocol}://${req.get('host')}/icons/atelierfit-512.png`);
        if (logoRes.ok) {
          const logoBuffer = Buffer.from(await logoRes.arrayBuffer());
          const badgeSvg = Buffer.from(
            `<svg width="${badgeSize}" height="${badgeSize}"><rect width="${badgeSize}" height="${badgeSize}" rx="${Math.round(badgeSize * 0.22)}" fill="#FFFFFF"/></svg>`,
          );
          const resizedLogo = await sharp(logoBuffer).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer();
          const badge = await sharp(badgeSvg).composite([{ input: resizedLogo, gravity: 'center' }]).png().toBuffer();
          const offset = Math.round((qrSize - badgeSize) / 2);
          finalBuffer = await sharp(qrBuffer).composite([{ input: badge, left: offset, top: offset }]).png().toBuffer();
        }
      } catch (logoErr) {
        // A failed logo fetch/composite still leaves a perfectly scannable plain QR code -- never block on it.
        console.warn('AtelierFit QR logo overlay skipped:', (logoErr as any)?.message || logoErr);
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(finalBuffer);
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
      const fabric = body.fabric ? FABRICS[body.fabric] : null;
      const basePriceNaira = garment.basePriceNaira + (fabric?.surchargeNaira ?? 0);
      const amountNaira = Math.round(basePriceNaira * DEPOSIT_RATE);
      const amountKobo = amountNaira * 100;
      const reference = `ATF-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

      const { data, error } = await db
        .from('atelierfit_orders')
        .insert({
          customer_name: body.customerName,
          customer_email: body.customerEmail,
          customer_phone: body.customerPhone || null,
          garment_type: garment.label,
          fabric: fabric?.label || null,
          fabric_surcharge_kobo: (fabric?.surchargeNaira ?? 0) * 100,
          embroidery_notes: body.embroideryNotes || null,
          occasion: body.occasion || null,
          appointment_date: body.appointmentDate || null,
          appointment_time: body.appointmentTime || null,
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
        .select('id, payment_reference, amount_kobo, created_at')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      // Real, computed estimate -- not a hardcoded string -- from either the chosen appointment date (if
      // the fitting itself is in the future) or today, whichever anchors the turnaround more sensibly.
      const anchor = body.appointmentDate ? new Date(body.appointmentDate) : new Date(data.created_at);
      const estimatedReadyAt = new Date(anchor.getTime() + ESTIMATED_TURNAROUND_DAYS * 86400000).toISOString();

      res.status(201).json({
        orderId: data.id,
        reference: data.payment_reference,
        amountKobo: data.amount_kobo,
        paystackReady: Boolean(paystackSecret && paystackPublicKey),
        estimatedReadyAt,
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

  // ---- Public (customer-authenticated): my own order history + profile ----
  //
  // Orders have no RLS read access for anon/authenticated (see the migration) -- the service-role client
  // here is the only thing that can read them, so this route is the sole gate. It verifies the caller's own
  // Supabase access token (sent as a Bearer header, the same session the client already holds from
  // signInWithOAuth) against Supabase's auth server, then filters strictly by *that verified* email --
  // never a client-supplied one -- so one signed-in customer can never list another's orders.
  router.get(
    '/my-orders',
    asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!token) {
        res.status(401).json({ error: 'Sign in to see your orders.' });
        return;
      }
      const { data: userData, error: userErr } = await db.auth.getUser(token);
      const email = userData?.user?.email;
      if (userErr || !email) {
        res.status(401).json({ error: 'Your session has expired -- sign in again.' });
        return;
      }

      const { data, error } = await db
        .from('atelierfit_orders')
        .select('id, garment_type, fabric, occasion, amount_kobo, currency, payment_status, status, measurements, appointment_date, appointment_time, created_at')
        .eq('customer_email', email)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const orders = (data || []).map((o: any) => ({
        ...o,
        estimatedReadyAt: new Date(
          new Date(o.appointment_date || o.created_at).getTime() + ESTIMATED_TURNAROUND_DAYS * 86400000,
        ).toISOString(),
      }));
      res.json({ email, orders });
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
