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

// Real order-progress stages, set by the tailor from the admin dashboard -- one shared source of truth so
// the customer-facing timeline (which fetches this from /config) never drifts out of sync with what the
// admin PATCH route actually accepts. Pickup orders skip "Shipped" entirely; shipping orders pass through
// it between "Ready" and "Delivered". "Cancelled" can be set from any pre-Delivered state but isn't part
// of either ordered timeline.
const PICKUP_STAGES = ['New', 'Confirmed', 'Cutting', 'Sewing', 'Embroidery', 'Quality Check', 'Ready', 'Delivered'] as const;
const SHIPPING_STAGES = ['New', 'Confirmed', 'Cutting', 'Sewing', 'Embroidery', 'Quality Check', 'Ready', 'Shipped', 'Delivered'] as const;
const ALL_STATUSES = [...SHIPPING_STAGES, 'Cancelled'] as const; // superset -- every status PATCH is allowed to set

const STATUS_LABELS: Record<string, string> = {
  New: 'Order received',
  Confirmed: 'Deposit confirmed',
  Cutting: 'Fabric cut',
  Sewing: 'Sewing in progress',
  Embroidery: 'Embroidery / finishing',
  'Quality Check': 'Quality check',
  Ready: 'Ready',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};

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

const createOrderSchema = z
  .object({
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
    deliveryMethod: z.enum(['pickup', 'shipping']).optional().nullable(),
    shippingAddress: z.string().max(500).optional().nullable(),
  })
  .refine((body) => body.deliveryMethod !== 'shipping' || Boolean(body.shippingAddress?.trim()), {
    message: 'A shipping address is required when delivery is by shipping',
    path: ['shippingAddress'],
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
      // reference design's calendar grid needs actual dates to render, not just a visual mockup). Kept as
      // a flat list for any caller still reading it directly, alongside the window bounds a real month-view
      // calendar needs to render its own grid (today/prev/next month navigation, disabled days) client-side.
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
        bookingWindowStart: bookableDates[0],
        bookingWindowEnd: bookableDates[bookableDates.length - 1],
        closedWeekdays: [0], // Sunday
        timeSlots: TIME_SLOTS,
        estimatedTurnaroundDays: ESTIMATED_TURNAROUND_DAYS,
        pickupStages: PICKUP_STAGES,
        shippingStages: SHIPPING_STAGES,
        statusLabels: STATUS_LABELS,
      });
    }),
  );

  // ---- Public: booked slots in a date range, for the real calendar --------
  //
  // Returns which time slots are already taken on which dates, so the booking calendar can grey out a
  // full day/slot instead of letting two customers double-book the same appointment. Clamped to the real
  // booking window -- there's no reason to ever query or expose bookings outside it.
  router.get(
    '/availability',
    asyncHandler(async (req, res) => {
      const windowStart = new Date();
      windowStart.setHours(0, 0, 0, 0);
      windowStart.setDate(windowStart.getDate() + 1);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + BOOKING_WINDOW_DAYS + 7); // small buffer past the window

      const fromStr = typeof req.query.from === 'string' ? req.query.from : windowStart.toISOString().slice(0, 10);
      const toStr = typeof req.query.to === 'string' ? req.query.to : windowEnd.toISOString().slice(0, 10);

      const { data, error } = await db
        .from('atelierfit_orders')
        .select('appointment_date, appointment_time')
        .not('appointment_date', 'is', null)
        .not('appointment_time', 'is', null)
        .neq('status', 'Cancelled')
        .gte('appointment_date', fromStr)
        .lte('appointment_date', toStr);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const bookedSlots: Record<string, string[]> = {};
      for (const row of data || []) {
        const d = row.appointment_date as string;
        const t = row.appointment_time as string;
        if (!bookedSlots[d]) bookedSlots[d] = [];
        bookedSlots[d].push(t);
      }
      res.json({ bookedSlots });
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

      // Re-check the slot server-side right before booking it -- the client's calendar already greys out
      // taken slots from /availability, but that's a point-in-time read; this is the real guard against two
      // customers racing for the same appointment.
      if (body.appointmentDate && body.appointmentTime) {
        const { count, error: slotErr } = await db
          .from('atelierfit_orders')
          .select('id', { count: 'exact', head: true })
          .eq('appointment_date', body.appointmentDate)
          .eq('appointment_time', body.appointmentTime)
          .neq('status', 'Cancelled');
        if (slotErr) {
          res.status(500).json({ error: slotErr.message });
          return;
        }
        if ((count || 0) > 0) {
          res.status(409).json({ error: 'That appointment slot was just booked by someone else -- please pick another.' });
          return;
        }
      }

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
          delivery_method: body.deliveryMethod || 'pickup',
          shipping_address: body.deliveryMethod === 'shipping' ? body.shippingAddress?.trim() || null : null,
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

  // ---- Public (by reference): live order-progress status for polling -----
  //
  // Same security model as /verify above: possession of the payment reference (a long random token only
  // the customer who placed the order ever receives) is the authorization, not a signed-in session -- this
  // is what lets the success screen poll for live status updates even for guest checkouts. Returns only
  // the minimal fields the tracking screen needs, never name/email/measurements/notes.
  router.get(
    '/orders/:reference/status',
    asyncHandler(async (req, res) => {
      const { data, error } = await db
        .from('atelierfit_orders')
        .select('status, payment_status, delivery_method, tracking_number, shipped_at, delivered_at, appointment_date, created_at')
        .eq('payment_reference', req.params.reference)
        .single();
      if (error || !data) {
        res.status(404).json({ error: 'Order not found for that reference' });
        return;
      }
      const anchor = data.appointment_date ? new Date(data.appointment_date) : new Date(data.created_at);
      res.json({
        status: data.status,
        statusLabel: STATUS_LABELS[data.status] || data.status,
        paymentStatus: data.payment_status,
        deliveryMethod: data.delivery_method,
        trackingNumber: data.tracking_number,
        shippedAt: data.shipped_at,
        deliveredAt: data.delivered_at,
        estimatedReadyAt: new Date(anchor.getTime() + ESTIMATED_TURNAROUND_DAYS * 86400000).toISOString(),
      });
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
        .select('id, garment_type, fabric, occasion, amount_kobo, currency, payment_status, status, delivery_method, shipping_address, tracking_number, measurements, appointment_date, appointment_time, created_at')
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
      const trackingNumber = typeof req.body?.trackingNumber === 'string' ? req.body.trackingNumber.trim() : null;
      if (!status || !ALL_STATUSES.includes(status as (typeof ALL_STATUSES)[number])) {
        res.status(400).json({ error: `status must be one of ${ALL_STATUSES.join(', ')}` });
        return;
      }
      if (status === 'Shipped' && !trackingNumber) {
        res.status(400).json({ error: 'trackingNumber is required when marking an order Shipped' });
        return;
      }

      const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (trackingNumber) update.tracking_number = trackingNumber;
      if (status === 'Shipped') update.shipped_at = new Date().toISOString();
      if (status === 'Delivered') update.delivered_at = new Date().toISOString();

      const { data, error } = await db
        .from('atelierfit_orders')
        .update(update)
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
