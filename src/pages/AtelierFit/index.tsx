import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Ruler, ShieldCheck, Loader2, CheckCircle2, ArrowLeft, Sparkles, ArrowRight, Scan, Palette, Images, Home as HomeIcon, User, Lock, Bell, Package } from "lucide-react";
import { estimateMeasurements, type EstimatedMeasurements } from "@/lib/atelierfit/measure";
import { LiveCameraStage, type CapturedPose } from "@/components/atelierfit/LiveCameraStage";
import { openPaystackCheckout } from "@/lib/atelierfit/paystack";
import { BackgroundGlow } from "@/components/atelierfit/ui/BackgroundGlow";
import { CopilotOrb } from "@/components/atelierfit/ui/CopilotOrb";
import type { AssistantState } from "@/components/assistant/OrbVisual";
import { GlassCard } from "@/components/atelierfit/ui/GlassCard";
import { GarmentPlaceholder } from "@/components/atelierfit/ui/GarmentPlaceholder";
import { useAuth } from "@/contexts/AuthContext";
import { useContactInfo } from "@/hooks/useApi";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { WorldCollectionBook } from "@/components/atelierfit/WorldCollectionBook";
import { WORLD_COLLECTION, type WorldGarment } from "@/lib/atelierfit/worldCollection";
import { BookingCalendar } from "@/components/atelierfit/BookingCalendar";
import "@/components/atelierfit/ui/atelierfit-glass.css";

// Standard four-colour "G" mark used on "Continue/Sign in with Google" buttons -- this is the button
// convention Google's own brand guidelines ask for, not a design flourish, same as the card-network logos
// on the payment step.
function AppleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.46 2.1-1.18 2.84-.78.8-2.07 1.42-3.03 1.34-.12-1.1.46-2.25 1.17-2.98.8-.82 2.16-1.42 3.04-1.2zM20.3 17.2c-.5 1.16-.74 1.68-1.39 2.7-.9 1.42-2.17 3.2-3.74 3.22-1.4.02-1.76-.92-3.66-.91-1.9.01-2.3.93-3.7.91-1.57-.02-2.77-1.62-3.67-3.04-2.52-3.98-2.78-8.65-1.23-11.13.1-1.6 2.56-2.6 4.17-2.63 1.44-.03 2.12.95 3.7.95 1.56 0 1.9-.95 3.66-.92 1.1.02 2.76.44 3.86 2.06-3.3 2.01-2.77 6.02.5 7.3z" />
    </svg>
  );
}

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.3 18.9 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 15.8 3 8.7 7.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.8 14.3-5l-6.6-5.6C29.6 36.6 26.9 37.5 24 37.5c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C8.6 40 15.7 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.6C41.5 36 44 30.7 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// AtelierFit -- a real tailoring order app, not a portfolio mockup. Lives outside the main site's SSR'd layout
// (registered as a pure client route, same as /admin) so it can behave like an installable app: full-screen,
// its own manifest + service worker, no site header/footer. See src/entry-server.tsx and src/App.tsx.
//
// AtelierFit shares Atelier Noir's dark-editorial family (near-black, serif display type) but carries its own
// accent -- copper-rose instead of the website's gold -- so the app reads as its own thing, not a sub-page.

// AtelierFit's own signature accent is copper-rose (#D6397D / hover #F06BA6), distinct from Atelier Noir's gold.

type Garment = { id: string; label: string; basePriceNaira: number; imageUrl?: string };

// Turns a WorldGarment (the real, worldwide catalog -- see worldCollection.ts) into the plain Garment shape
// the rest of this order flow already works with, so picking a piece from the real gallery drops straight
// into the existing design/details/checkout steps with zero changes to them.
function worldGarmentToGarment(g: WorldGarment): Garment {
  return { id: g.id, label: g.label, basePriceNaira: g.basePriceNaira, imageUrl: g.imageUrl };
}
type Fabric = { id: string; label: string; tagline: string; surchargeNaira: number };
type Step = "splash" | "home" | "gallery" | "garment" | "design" | "method" | "camera" | "manual" | "review" | "booking" | "details" | "checkout" | "success" | "profile";

const GUEST_FLAG = "atelierfit_guest";

// Real worldwide-catalog highlights for the home screen's "Featured Collection" strip -- the same
// WORLD_COLLECTION photos and copy that power the full gallery (WorldCollectionBook) below, and that
// Atelier Noir's own web catalog draws from, so the two apps show the same collection with their own
// distinct designs. Picked for spread across regions/genders rather than any fixed order.
const FEATURED_COLLECTIONS: WorldGarment[] = [
  WORLD_COLLECTION.find((g) => g.id === "women_sari")!,
  WORLD_COLLECTION.find((g) => g.id === "men_agbada")!,
  WORLD_COLLECTION.find((g) => g.id === "women_kimono")!,
  WORLD_COLLECTION.find((g) => g.id === "men_suit")!,
  WORLD_COLLECTION.find((g) => g.id === "women_boubou")!,
].filter(Boolean);

const emptyMeasurements: EstimatedMeasurements = {
  heightCm: 170, shoulderWidthCm: 45, chestCm: 96, waistCm: 82, hipCm: 98, sleeveLengthCm: 60, armLengthCm: 60, legLengthCm: 100,
};

const FIELD_LABELS: Record<keyof EstimatedMeasurements, string> = {
  heightCm: "Height", shoulderWidthCm: "Shoulder width", chestCm: "Chest / bust", waistCm: "Waist",
  hipCm: "Hip", sleeveLengthCm: "Sleeve length", armLengthCm: "Arm length", legLengthCm: "Leg / inseam length",
};

function GalleryTile({ title, tag, imageUrl }: { title: string; tag: string; imageUrl: string }) {
  return (
    <div className="relative h-36 rounded-[18px] overflow-hidden glass-card-subtle flowing-pink-edge flex flex-col justify-end p-3">
      <img src={imageUrl} alt={title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0515]/90 via-transparent to-transparent" aria-hidden />
      <div className="relative z-10">
        <div className="text-sm font-medium leading-snug font-serif">{title}</div>
        <div className="text-[11px] text-white/50 mt-0.5">{tag}</div>
      </div>
    </div>
  );
}

// Swipeable "Featured Collection" card -- a real scroll-snap carousel (not just a static image), with dots
// that track true scroll position so they stay honest if someone swipes instead of tapping a dot. Now backed
// by real photos from the worldwide catalog (WORLD_COLLECTION) instead of pattern placeholders.
function FeaturedCollectionCarousel({ onOpen }: { onOpen: (g: WorldGarment) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory rounded-[20px]"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {FEATURED_COLLECTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => onOpen(c)}
            className="relative w-full shrink-0 snap-center h-40 overflow-hidden glass-card flowing-pink-edge flex flex-col justify-end p-4 text-left"
            style={{ scrollSnapAlign: "center" }}
          >
            <img src={c.imageUrl} alt={c.label} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a0515]/95 via-[#1a0515]/30 to-transparent" aria-hidden />
            <div className="relative z-10">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#F8A0C8] mb-1 flex items-center gap-1">
                {c.flagEmoji} Featured Collection
              </div>
              <div className="font-serif text-lg font-semibold leading-snug">{c.label}</div>
              <div className="text-xs text-white/55 mt-1 max-w-[85%]">{c.description}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {FEATURED_COLLECTIONS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-[#F06BA6]" : "w-1.5 bg-white/25"}`}
          />
        ))}
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function naira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

// Maps a garment id to one of GarmentPlaceholder's abstract silhouette types -- still an honest,
// unphotographed placeholder, just shaped roughly like the garment.
function garmentPlaceholderType(garmentId: string): "gown" | "suit" | "fabric" {
  if (garmentId === "dress") return "gown";
  if (garmentId === "agbada" || garmentId === "kaftan" || garmentId === "senator") return "suit";
  return "fabric";
}

// A fixed-aspect cutout-collection frame per garment -- a flat-lay/cutout look on a dark ground, the same
// shape whether it's showing a real photo or today's honest placeholder. `g.imageUrl` is the one-line hook
// from the server catalogue (see atelierfit/route.ts) -- the moment a real photo exists there, it replaces
// the placeholder here automatically, no other change needed.
function GarmentCutoutThumb({ garment }: { garment: Garment }) {
  return (
    <div className="relative w-14 h-14 rounded-xl shrink-0 overflow-hidden bg-[#1a0515] border border-white/10">
      {garment.imageUrl ? (
        <img src={garment.imageUrl} alt={garment.label} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <GarmentPlaceholder type={garmentPlaceholderType(garment.id)} className="w-full h-full rounded-none" ratio="square" />
      )}
    </div>
  );
}

export default function AtelierFit() {
  const { user, loading: authLoading } = useAuth();
  // Skip the splash for anyone already signed in, or who already chose "guest" earlier this session --
  // read synchronously so there's no flash of the splash screen before this effect would otherwise run.
  const [step, setStep] = useState<Step>(() => {
    try {
      if (sessionStorage.getItem(GUEST_FLAG) === "1") return "home";
    } catch {
      // sessionStorage unavailable (private mode, etc.) -- just show the splash
    }
    return "splash";
  });
  const [config, setConfig] = useState<{
    garments: Garment[];
    fabrics: Fabric[];
    occasions: string[];
    depositRate: number;
    paystackConfigured: boolean;
    paystackPublicKey: string | null;
    bookableDates: string[];
    bookingWindowStart: string;
    bookingWindowEnd: string;
    closedWeekdays: number[];
    timeSlots: string[];
    estimatedTurnaroundDays: number;
    pickupStages: string[];
    shippingStages: string[];
    statusLabels: Record<string, string>;
  } | null>(null);
  const [garment, setGarment] = useState<Garment | null>(null);
  const [fabricId, setFabricId] = useState<string>("cotton");
  const [embroideryNotes, setEmbroideryNotes] = useState("");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "shipping">("pickup");
  const [shippingAddress, setShippingAddress] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  const [appointmentDate, setAppointmentDate] = useState<string | null>(null);
  const [appointmentTime, setAppointmentTime] = useState<string | null>(null);
  const [heightCm, setHeightCm] = useState(170);
  const [method, setMethod] = useState<"camera_ai" | "manual" | null>(null);
  const [measurements, setMeasurements] = useState<EstimatedMeasurements>(emptyMeasurements);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [order, setOrder] = useState<{ orderId: string; reference: string; amountKobo: number; paystackReady: boolean; estimatedReadyAt?: string } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [orderStatus, setOrderStatus] = useState("New");
  const [showCopilotTip, setShowCopilotTip] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const { data: contactInfo } = useContactInfo();
  const [myOrders, setMyOrders] = useState<any[] | null>(null);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [myOrdersError, setMyOrdersError] = useState<string | null>(null);

  const fabric = useMemo(() => config?.fabrics.find((f) => f.id === fabricId) || null, [config, fabricId]);

  // Once auth finishes loading (including right after a Google OAuth redirect back into this page), a
  // visitor who signed in with Google specifically for AtelierFit skips straight past the splash -- they
  // just proved who they are, no need to ask again. This checks the OAuth provider, not just "is there any
  // session at all": the site owner's own admin login shares this same Supabase client/localStorage, so a
  // plain "if (user)" check would also fire for the owner's admin session and hide the splash screen for
  // them permanently on every visit -- which is exactly the bug this was causing.
  const isAtelierFitGoogleUser = user?.app_metadata?.provider === "google";
  useEffect(() => {
    if (!authLoading && isAtelierFitGoogleUser && step === "splash") setStep("home");
  }, [authLoading, isAtelierFitGoogleUser, step]);

  // Pre-fill the name/email a signed-in visitor already gave Google, so they don't retype it at checkout.
  useEffect(() => {
    if (!user) return;
    setCustomer((c) => ({
      ...c,
      name: c.name || (user.user_metadata?.full_name as string) || "",
      email: c.email || user.email || "",
    }));
  }, [user]);

  const continueAsGuest = useCallback(() => {
    try {
      sessionStorage.setItem(GUEST_FLAG, "1");
    } catch {
      // best-effort only
    }
    setStep("home");
  }, []);

  const continueWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError("Sign-in isn't configured yet -- continue as a guest for now.");
      return;
    }
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/atelierfit` },
    });
    if (oauthError) setError(oauthError.message || "Couldn't start Google sign-in.");
  }, []);

  const [frontCapture, setFrontCapture] = useState<CapturedPose | null>(null);
  const [sideCapture, setSideCapture] = useState<CapturedPose | null>(null);

  // Installable PWA shell: manifest + service worker only for this route, so the rest of the portfolio keeps
  // its own identity. Registering the SW is also what makes "Add to Home Screen" show up on Android/Chrome.
  //
  // Also where the real "doesn't fit every phone screen" bug gets fixed: the shared app.html viewport tag
  // (used by every other page on the site) has no `viewport-fit=cover`, so on a notched/Dynamic-Island or
  // home-indicator iPhone the browser keeps the whole page letterboxed inside the *safe* area instead of
  // drawing edge-to-edge -- on some screen sizes that's exactly the "doesn't properly fit" symptom. Scoped
  // the same way theme-color/manifest already are here: only changed while AtelierFit is mounted, restored
  // on unmount, so the rest of the portfolio's pages are unaffected. iOS specifically also needs its own
  // apple-mobile-web-app-* tags and an apple-touch-icon to render standalone/edge-to-edge at all -- the
  // manifest alone (an Android/Chrome mechanism) does nothing for "Add to Home Screen" on iOS Safari.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/atelierfit-manifest.webmanifest";
    document.head.appendChild(link);
    const prevThemeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute("content");
    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = "#0B0A08";

    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const prevViewportContent = viewportMeta?.getAttribute("content") ?? null;
    if (viewportMeta) viewportMeta.content = "width=device-width, initial-scale=1.0, viewport-fit=cover";

    const extraTags: HTMLMetaElement[] = [];
    const addMeta = (name: string, content: string) => {
      const m = document.createElement("meta");
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
      extraTags.push(m);
    };
    addMeta("apple-mobile-web-app-capable", "yes");
    addMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    addMeta("apple-mobile-web-app-title", "AtelierFit");
    const appleIconLink = document.createElement("link");
    appleIconLink.rel = "apple-touch-icon";
    appleIconLink.href = "/icons/atelierfit-192.png";
    document.head.appendChild(appleIconLink);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/atelierfit-sw.js", { scope: "/atelierfit" }).catch(() => {});
    }
    return () => {
      link.remove();
      if (themeMeta && prevThemeColor) themeMeta.content = prevThemeColor;
      if (viewportMeta && prevViewportContent !== null) viewportMeta.content = prevViewportContent;
      extraTags.forEach((m) => m.remove());
      appleIconLink.remove();
    };
  }, []);

  useEffect(() => {
    fetch("/api/atelierfit/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("Couldn't reach the server -- check your connection and reload."));
  }, []);

  // Real booked slots for the calendar -- re-fetched each time the booking step is opened, so a slot
  // someone else just took doesn't keep showing as free.
  useEffect(() => {
    if (step !== "booking") return;
    fetch("/api/atelierfit/availability")
      .then((r) => r.json())
      .then((d) => setBookedSlots(d.bookedSlots || {}))
      .catch(() => {
        // Non-fatal -- the server re-checks the slot again at submit time either way.
      });
  }, [step]);

  // Loads the signed-in customer's own order history -- fetched fresh each time the Profile tab is opened,
  // never cached client-side, since it's the one screen showing real order data back to them.
  useEffect(() => {
    if (step !== "profile" || !isAtelierFitGoogleUser) return;
    let cancelled = false;
    setMyOrdersLoading(true);
    setMyOrdersError(null);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      try {
        const res = await fetch("/api/atelierfit/my-orders", {
          headers: { Authorization: `Bearer ${session?.access_token || ""}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Couldn't load your orders.");
        setMyOrders(data.orders || []);
      } catch (e: any) {
        if (!cancelled) setMyOrdersError(e?.message || "Couldn't load your orders.");
      } finally {
        if (!cancelled) setMyOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, isAtelierFitGoogleUser]);

  // Ticks the pickup countdown on the tracking screen -- a real timer against order.estimatedReadyAt, not a
  // static string, but only runs while that screen is actually visible.
  useEffect(() => {
    if (step !== "success") return;
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [step]);

  // Live order-progress polling -- the admin dashboard can move an order through real stages (Cutting,
  // Sewing, Shipped, etc.) at any time, so this screen re-checks the server instead of freezing at whatever
  // status existed the moment checkout finished. Scoped by the order's own payment reference, same
  // possession-based access the /verify route already uses -- works for guest checkouts too, no sign-in
  // required.
  const [liveOrderStatus, setLiveOrderStatus] = useState<{
    status: string;
    statusLabel: string;
    paymentStatus: string;
    deliveryMethod: "pickup" | "shipping";
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    estimatedReadyAt: string;
  } | null>(null);
  useEffect(() => {
    if (step !== "success" || !order?.reference) return;
    let cancelled = false;
    const poll = () => {
      fetch(`/api/atelierfit/orders/${encodeURIComponent(order.reference)}/status`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setLiveOrderStatus(d);
          if (typeof d.status === "string") setOrderStatus(d.status);
        })
        .catch(() => {
          // Non-fatal -- the last-known status (from checkout or a previous poll) just stays on screen.
        });
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, order?.reference]);

  const totalPriceNaira = useMemo(() => (garment ? garment.basePriceNaira + (fabric?.surchargeNaira ?? 0) : 0), [garment, fabric]);
  const deposit = useMemo(() => Math.round(totalPriceNaira * (config?.depositRate ?? 0.4)), [totalPriceNaira, config]);
  const balanceDue = totalPriceNaira - deposit;

  // A single source of truth for how the AI orb should "feel" right now -- not wired to a real backend brain,
  // but reflecting real app state (still loading the catalogue, mid-submit, actively watching the camera, just
  // finished) so it reads as connected to what's happening rather than a static decoration.
  const orbState: AssistantState = useMemo(() => {
    if (authLoading) return "thinking";
    if (busy) return "thinking";
    if (step === "camera") return "listening";
    if (step === "success" || step === "checkout") return "speaking";
    if (!config) return "thinking";
    return "idle";
  }, [authLoading, busy, step, config]);

  const runCameraMeasure = useCallback(() => {
    if (!frontCapture || !sideCapture) {
      setError("Capture both a front and a side view first.");
      return;
    }
    setError(null);
    try {
      const result = estimateMeasurements({
        heightCm,
        front: { landmarks: frontCapture.landmarks, width: frontCapture.width, height: frontCapture.height },
        side: { landmarks: sideCapture.landmarks, width: sideCapture.width, height: sideCapture.height },
      });
      setMeasurements(result);
      setStep("review");
    } catch (e: any) {
      setError(e?.message || "Couldn't estimate measurements from those captures -- try recapturing with better lighting, or switch to manual entry.");
    }
  }, [heightCm, frontCapture, sideCapture]);

  const submitOrder = useCallback(async () => {
    if (!garment) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/atelierfit/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone || null,
          garment: garment.id,
          fabric: fabricId,
          embroideryNotes: embroideryNotes || null,
          occasion,
          appointmentDate,
          appointmentTime,
          notes: customer.notes || null,
          measurements,
          measurementMethod: method,
          deliveryMethod,
          shippingAddress: deliveryMethod === "shipping" ? shippingAddress : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the order.");
      setOrder(data);
      setOrderStatus("New");
      if (data.paystackReady && config?.paystackPublicKey) {
        setStep("checkout");
      } else {
        setStep("success"); // payments not configured yet -- order is recorded, tailor follows up to arrange payment
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong submitting your order.");
    } finally {
      setBusy(false);
    }
  }, [garment, fabricId, embroideryNotes, occasion, appointmentDate, appointmentTime, customer, measurements, method, config, deliveryMethod, shippingAddress]);

  const pay = useCallback(async () => {
    if (!order || !config?.paystackPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      await openPaystackCheckout({
        publicKey: config.paystackPublicKey,
        email: customer.email,
        amountKobo: order.amountKobo,
        reference: order.reference,
        onSuccess: async (reference) => {
          await fetch("/api/atelierfit/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference }),
          });
          setOrderStatus("Confirmed");
          setStep("success");
          setBusy(false);
        },
        onClose: () => setBusy(false),
      });
    } catch (e: any) {
      setError(e?.message || "Couldn't open the payment window.");
      setBusy(false);
    }
  }, [order, config, customer.email]);

  return (
    <div className="atelierfit-root relative min-h-dvh w-full text-[#F5F0E6] font-sans flex flex-col items-center px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <BackgroundGlow glowPositions={["top-right", "top-left", "bottom-left", "bottom-right"]} intensity="vibrant" />
      <div className="w-full max-w-md relative z-10">
        {step !== "splash" && (
          <header className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              {step !== "home" && (
                <button
                  onClick={() => setStep(stepBack(step))}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="flex items-center gap-2">
                <Ruler className="text-[#D6397D]" size={22} />
                <span className="font-serif text-lg tracking-wide font-semibold">AtelierFit</span>
              </div>
            </div>
            {step === "home" && <CopilotOrb size="sm" statusText="Ready to help" showWaveform state={orbState} />}
          </header>
        )}

        {error && step !== "splash" && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3">{error}</div>
        )}

        {step === "splash" && (
          <section className="min-h-[85dvh] flex flex-col items-center justify-center text-center gap-8 pb-10">
            <div className="flex flex-col items-center gap-4">
              <CopilotOrb size="hero" state={orbState} />
              <div>
                <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/40 mb-2">
                  <Sparkles size={13} className="text-[#D6397D]" />
                  <span>By Atelier Noir</span>
                </div>
                <h1 className="text-3xl font-serif font-bold leading-tight">AtelierFit</h1>
                <p className="text-white/60 text-sm mt-2 max-w-xs mx-auto">
                  AI-measured, made-to-fit tailoring -- from your phone, to our workshop.
                </p>
              </div>
            </div>

            {error && (
              <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3">{error}</div>
            )}

            <div className="w-full max-w-xs flex flex-col gap-3">
              <button
                onClick={continueWithGoogle}
                className="w-full flex items-center justify-center gap-2.5 rounded-full bg-white text-[#1a0515] font-medium text-sm py-3 px-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:bg-white/90 transition-colors"
              >
                <GoogleG size={18} />
                <span>Continue with Google</span>
              </button>
              <button
                onClick={continueAsGuest}
                className="w-full flex items-center justify-center gap-2 rounded-full glass-card-subtle flowing-pink-edge text-white/80 font-medium text-sm py-3 px-5 hover:text-white transition-colors"
              >
                <User size={16} />
                <span>Continue as guest</span>
              </button>
              <p className="text-[11px] text-white/35 mt-1">
                Signing in just saves you retyping your name and email later -- nothing is locked behind it.
              </p>
            </div>
          </section>
        )}

        {step === "home" && (
          <section className="space-y-8 pb-24">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/40 mb-1">
                  <Sparkles size={13} className="text-[#D6397D]" />
                  <span>By Atelier Noir</span>
                </div>
                <h1 className="text-2xl font-serif font-bold leading-tight">{greeting()}.</h1>
                <p className="text-white/60 text-sm mt-0.5">Ready to start your next fit?</p>
              </div>
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowNotifications((v) => !v)}
                  aria-label="Notifications"
                  className="relative p-2.5 rounded-full glass-card-subtle hover:border-pink-400/50 transition-colors"
                >
                  <Bell size={18} className="text-white/70" />
                  {order && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F06BA6]" aria-hidden />}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-12 w-64 rounded-xl glass-card flowing-pink-edge p-4 z-20 text-left">
                    <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Notifications</div>
                    {order ? (
                      <div className="text-sm text-white/80">Your order is in -- status: <span className="text-[#F8A0C8] font-medium">New</span>. We'll update you here as it moves along.</div>
                    ) : (
                      <div className="text-sm text-white/50">You're all caught up. Start a fitting and we'll keep you posted here.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick actions -- single row of four, matching the reference layout. */}
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { icon: Scan, label: "Scan Measurements", onClick: () => { setMethod("camera_ai"); setStep("garment"); } },
                { icon: Palette, label: "Book Outfit", onClick: () => setStep("garment") },
                { icon: Images, label: "Browse Styles", onClick: () => setStep("gallery") },
                { icon: Package, label: "Track Order", onClick: () => setStep("profile") },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  disabled={a.label !== "Browse Styles" && a.label !== "Track Order" && !config}
                  className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors text-center disabled:opacity-50"
                >
                  <a.icon size={19} className="text-[#F06BA6]" />
                  <span className="text-[10px] font-medium leading-tight px-1">{a.label}</span>
                </button>
              ))}
            </div>

            <FeaturedCollectionCarousel onOpen={(g) => { setGarment(worldGarmentToGarment(g)); setStep("design"); }} />

            {/* The AI-copilot hero -- pink glassmorphism panel (ported from the AI-Studio build) with an
                animated flowing border and inner glow, rather than a flat banner. */}
            <div className="relative py-6">
              <div className="relative rounded-[28px] glass-card py-10 flex flex-col items-center gap-3">
                <button
                  onClick={() => setStep("garment")}
                  disabled={!config}
                  aria-label="Begin fitting"
                  className="relative z-10 flex flex-col items-center gap-3 group disabled:opacity-50 transition-opacity"
                >
                  <CopilotOrb size="hero" interactive state={orbState} />
                </button>
                <div className="relative z-10 text-center">
                  <div className="font-serif font-semibold text-sm tracking-wide text-white/90 flex items-center justify-center gap-1.5">
                    <Ruler size={16} className="text-[#F06BA6]" />
                    {config ? "Begin fitting" : "Loading..."}
                  </div>
                  <div className="text-[11px] text-white/40 mt-1">Measuring · Fitting · Creating</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm text-white/60 glass-card-subtle rounded-xl p-4">
              <ShieldCheck size={18} className="text-[#F06BA6] shrink-0 mt-0.5" />
              <span>Camera measurements are estimated entirely on your own phone. No photo is ever uploaded or stored -- you confirm every number before anything is charged.</span>
            </div>

            {/* Compact gallery teaser -- real worldwide-catalog photos, see worldCollection.ts. */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-white/80">What we make</h2>
                <button onClick={() => setStep("gallery")} className="text-xs text-[#F06BA6] hover:text-[#F8A0C8] flex items-center gap-1 transition-colors">
                  See all <ArrowRight size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {WORLD_COLLECTION.slice(0, 4).map((item) => (
                  <button key={item.id} onClick={() => setStep("gallery")} className="text-left">
                    <GalleryTile title={item.label} tag={item.categoryLabel} imageUrl={item.imageUrl} />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === "gallery" && (
          <WorldCollectionBook
            onSelectGarment={(g) => { setGarment(worldGarmentToGarment(g)); setStep("design"); }}
            onBeginFitting={() => setStep("garment")}
          />
        )}

        {step === "profile" && (
          <section className="space-y-5 pb-24">
            <h2 className="text-xl font-serif font-semibold mb-1">Profile & orders</h2>

            {!isAtelierFitGoogleUser ? (
              <div className="rounded-xl glass-card-subtle p-5 text-center space-y-3">
                <User size={28} className="mx-auto text-white/40" />
                <p className="text-sm text-white/60">Sign in with Google to see your saved measurements and order history here.</p>
                <button
                  onClick={continueWithGoogle}
                  className="inline-flex items-center justify-center gap-2.5 rounded-full bg-white text-[#1a0515] font-medium text-sm py-2.5 px-5 hover:bg-white/90 transition-colors"
                >
                  <GoogleG size={16} />
                  <span>Continue with Google</span>
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-xl glass-card-subtle p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F8A0C8] to-[#D6397D] flex items-center justify-center shrink-0 font-serif font-semibold text-black">
                    {(customer.name || customer.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{customer.name || "Your account"}</div>
                    <div className="text-[11px] text-white/45 truncate">{customer.email}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Your orders</div>
                  {myOrdersLoading && (
                    <div className="flex items-center gap-2 text-sm text-white/50 py-4"><Loader2 className="animate-spin" size={16} /> Loading your orders...</div>
                  )}
                  {myOrdersError && <p className="text-sm text-red-300">{myOrdersError}</p>}
                  {!myOrdersLoading && myOrders && myOrders.length === 0 && (
                    <p className="text-sm text-white/50">No orders yet -- your first fitting will show up here.</p>
                  )}
                  <div className="space-y-2.5">
                    {myOrders?.map((o) => (
                      <div key={o.id} className="rounded-xl glass-card-subtle p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{o.garment_type}{o.fabric ? ` · ${o.fabric}` : ""}</span>
                          <span className="text-xs text-[#F8A0C8]">{o.status}</span>
                        </div>
                        <div className="text-[11px] text-white/45 mt-0.5">
                          {new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          {o.appointment_date ? ` · Fitting ${new Date(o.appointment_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-xs">
                          <span className={o.payment_status === "paid" ? "text-emerald-400" : "text-amber-300"}>{o.payment_status === "paid" ? "Deposit paid" : "Payment pending"}</span>
                          <span className="text-white/40">Est. ready {new Date(o.estimatedReadyAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {measurements.heightCm !== emptyMeasurements.heightCm && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Last saved measurements</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(FIELD_LABELS) as (keyof EstimatedMeasurements)[]).map((k) => (
                        <div key={k} className="rounded-lg glass-card-subtle px-3 py-2 flex justify-between text-xs">
                          <span className="text-white/50">{FIELD_LABELS[k]}</span>
                          <span className="font-medium">{measurements[k]}cm</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {step === "garment" && config && (
          <section className="space-y-5">
            <h2 className="text-xl font-serif font-semibold mb-2">What are you having made?</h2>
            {config.garments.map((g) => (
              <button
                key={g.id}
                onClick={() => { setGarment(g); setStep("design"); }}
                className="w-full text-left p-3 rounded-xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors flex items-center gap-3"
              >
                <GarmentCutoutThumb garment={g} />
                <span className="flex-1 flex justify-between items-center">
                  <span>{g.label}</span>
                  <span className="text-white/50 text-sm">{naira(g.basePriceNaira)}</span>
                </span>
              </button>
            ))}
          </section>
        )}

        {step === "design" && garment && config && (
          <section className="space-y-5">
            <h2 className="text-xl font-serif font-semibold mb-1">Design review</h2>
            <p className="text-sm text-white/60 mb-2">Pick a fabric and any details -- your price updates live as you choose.</p>

            <div>
              <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Fabric</div>
              <div className="grid grid-cols-2 gap-2.5">
                {config.fabrics.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFabricId(f.id)}
                    className={`text-left p-3 rounded-xl transition-colors ${fabricId === f.id ? "glass-card flowing-pink-edge" : "glass-card-subtle hover:border-pink-400/40"}`}
                  >
                    <div className="text-sm font-medium flex items-center justify-between">
                      <span>{f.label}</span>
                      {fabricId === f.id && <CheckCircle2 size={14} className="text-[#F06BA6]" />}
                    </div>
                    <div className="text-[11px] text-white/45 mt-0.5">{f.tagline}</div>
                    <div className="text-[11px] text-[#F8A0C8] mt-1">{f.surchargeNaira > 0 ? `+${naira(f.surchargeNaira)}` : "Included"}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Occasion</div>
              <div className="flex flex-wrap gap-2">
                {config.occasions.map((o) => (
                  <button
                    key={o}
                    onClick={() => setOccasion(occasion === o ? null : o)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${occasion === o ? "bg-[#D6397D] text-black" : "glass-card-subtle text-white/60 hover:text-white"}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">Embroidery / style notes (optional)</label>
              <textarea
                value={embroideryNotes}
                onChange={(e) => setEmbroideryNotes(e.target.value)}
                placeholder="e.g. floral embroidery on the collar, your initials monogrammed..."
                rows={3}
                className="w-full p-3 rounded-lg glass-input resize-none text-sm"
              />
            </div>

            <div className="rounded-xl glass-card-subtle p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
                <Sparkles size={13} className="text-[#F06BA6]" /> Delivery timeline
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/50">
                {["Design", "Crafting", "Quality check", "Delivery"].map((label, i) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1 relative">
                    {i > 0 && <span className="absolute top-1.5 right-1/2 w-full h-px bg-white/15" aria-hidden />}
                    <span className={`relative z-10 w-3 h-3 rounded-full ${i === 0 ? "bg-[#F06BA6]" : "bg-white/20"}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs text-white/60">Estimated {config.estimatedTurnaroundDays - 2}-{config.estimatedTurnaroundDays + 1} days from your fitting appointment</div>
            </div>

            <div className="rounded-xl glass-card p-4 flex items-center justify-between">
              <span className="text-sm text-white/60">Estimated price</span>
              <span className="font-serif font-semibold text-lg">{naira(totalPriceNaira)}</span>
            </div>

            <button
              onClick={() => setStep("method")}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors"
            >
              Continue to measurements
            </button>
          </section>
        )}

        {step === "method" && garment && (
          <section className="space-y-5">
            <h2 className="text-xl font-display font-semibold mb-2">How should we take your measurements?</h2>
            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-1">Your height (cm) -- needed either way, as the scale reference</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full p-3 rounded-lg glass-input"
              />
            </div>
            <button
              onClick={() => { setMethod("camera_ai"); setStep("camera"); }}
              className="w-full text-left p-4 rounded-xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors flex items-center gap-3"
            >
              <Camera size={20} className="text-[#D6397D]" />
              <div>
                <div className="font-medium">Use my camera (AI estimate)</div>
                <div className="text-xs text-white/50">Two photos, ~1 minute. You'll review and can correct every number.</div>
              </div>
            </button>
            <button
              onClick={() => { setMethod("manual"); setStep("manual"); }}
              className="w-full text-left p-4 rounded-xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors flex items-center gap-3"
            >
              <Ruler size={20} className="text-[#D6397D]" />
              <div>
                <div className="font-medium">Enter my own measurements</div>
                <div className="text-xs text-white/50">If you already have a tape measure and your numbers handy.</div>
              </div>
            </button>
          </section>
        )}

        {step === "camera" && (
          <section className="space-y-5">
            <h2 className="text-xl font-display font-semibold">Live body scan</h2>
            <p className="text-sm text-white/60">
              Hand your phone to someone else. Stand ~2.5m back in good light, arms slightly away from your body, in fitted clothing -- tap Capture once you're tracked and aligned.
            </p>
            <LiveCameraStage
              label="Front-facing view"
              hint="Face the camera, whole body in frame."
              captured={frontCapture}
              onCaptured={setFrontCapture}
              onRetake={() => setFrontCapture(null)}
            />
            <LiveCameraStage
              label="Side-on view"
              hint="Turn 90 degrees, whole body still in frame."
              captured={sideCapture}
              onCaptured={setSideCapture}
              onRetake={() => setSideCapture(null)}
            />
            <button
              onClick={runCameraMeasure}
              disabled={busy || !frontCapture || !sideCapture}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {busy ? "Measuring..." : "Estimate my measurements"}
            </button>
            <button onClick={() => { setMethod("manual"); setStep("manual"); }} className="w-full text-center text-sm text-white/50 hover:text-white/80 py-2">
              Prefer to type them in instead?
            </button>
          </section>
        )}

        {step === "manual" && (
          <section className="space-y-5">
            <h2 className="text-xl font-display font-semibold mb-2">Your measurements (cm)</h2>
            <MeasurementForm measurements={{ ...measurements, heightCm }} onChange={(m) => { setMeasurements(m); setHeightCm(m.heightCm); }} />
            <button
              onClick={() => setStep("review")}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors"
            >
              Continue
            </button>
          </section>
        )}

        {step === "review" && (
          <section className="space-y-5">
            <h2 className="text-xl font-display font-semibold mb-1">Confirm your measurements</h2>
            <p className="text-sm text-white/60 mb-2">
              {method === "camera_ai" ? "Estimated from your photos -- adjust anything that looks off before continuing." : "As you entered them."}
            </p>
            <MeasurementForm measurements={measurements} onChange={setMeasurements} />
            <button
              onClick={() => setStep("booking")}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors"
            >
              These look right -- continue
            </button>
          </section>
        )}

        {step === "booking" && garment && config && (
          <section className="space-y-5">
            <h2 className="text-xl font-serif font-semibold mb-1">Book your fitting</h2>
            <p className="text-sm text-white/60 mb-2">Pick a date and time for your fitting appointment at the atelier.</p>

            <div className="rounded-xl glass-card-subtle p-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F8A0C8] to-[#D6397D] flex items-center justify-center shrink-0">
                <Scan size={18} className="text-black" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Atelier Noir</div>
                <div className="text-[11px] text-white/45">Your tailor · usually responds within a day</div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden />
            </div>

            <div className="rounded-xl glass-card-subtle p-4">
              <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Select a date</div>
              <BookingCalendar
                windowStart={config.bookingWindowStart}
                windowEnd={config.bookingWindowEnd}
                closedWeekdays={config.closedWeekdays}
                timeSlots={config.timeSlots}
                bookedSlots={bookedSlots}
                selectedDate={appointmentDate}
                selectedTime={appointmentTime}
                onSelectDate={(d) => { setAppointmentDate(d); setAppointmentTime(null); }}
                onSelectTime={setAppointmentTime}
              />
            </div>

            {appointmentDate && (
              <div className="rounded-xl glass-card-subtle p-4 text-sm flex items-center justify-between">
                <span className="text-white/60">Estimated completion</span>
                <span className="font-medium">
                  {new Date(new Date(appointmentDate + "T00:00:00").getTime() + config.estimatedTurnaroundDays * 86400000)
                    .toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            )}

            {/* Pickup vs shipping -- a real address is collected and stored on the order when shipping is
                chosen, so the tailor knows where to send it; there's no courier API wired up, so what the
                tailor later marks "Shipped" carries a real tracking number but not a live GPS feed. */}
            <div>
              <div className="text-xs uppercase tracking-wide text-white/40 mb-2">How should it reach you?</div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setDeliveryMethod("pickup")}
                  className={`text-left p-3 rounded-xl transition-colors flex items-center gap-2.5 ${deliveryMethod === "pickup" ? "glass-card flowing-pink-edge" : "glass-card-subtle hover:border-pink-400/40"}`}
                >
                  <Package size={16} className="text-[#F06BA6] shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Pickup</div>
                    <div className="text-[11px] text-white/45">At the atelier</div>
                  </div>
                </button>
                <button
                  onClick={() => setDeliveryMethod("shipping")}
                  className={`text-left p-3 rounded-xl transition-colors flex items-center gap-2.5 ${deliveryMethod === "shipping" ? "glass-card flowing-pink-edge" : "glass-card-subtle hover:border-pink-400/40"}`}
                >
                  <ArrowRight size={16} className="text-[#F06BA6] shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Shipping</div>
                    <div className="text-[11px] text-white/45">Delivered to you</div>
                  </div>
                </button>
              </div>
              {deliveryMethod === "shipping" && (
                <textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Full delivery address -- street, city, state"
                  rows={2}
                  className="w-full mt-2.5 p-3 rounded-lg glass-input resize-none text-sm"
                />
              )}
            </div>

            <div className="rounded-xl glass-card p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/60">Deposit due now (40%)</span><span className="font-semibold">{naira(deposit)}</span></div>
              <div className="flex justify-between text-white/50 text-xs"><span>Balance on delivery (60%)</span><span>{naira(balanceDue)}</span></div>
            </div>

            <button
              onClick={() => setStep("details")}
              disabled={!appointmentDate || !appointmentTime || (deliveryMethod === "shipping" && !shippingAddress.trim())}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors disabled:opacity-50"
            >
              Reserve appointment
            </button>
          </section>
        )}

        {step === "details" && garment && (
          <section className="space-y-5">
            <h2 className="text-xl font-serif font-semibold mb-2">Your details</h2>

            <PaymentCardPreview name={customer.name} amountLabel={naira(deposit)} />
            <CardNetworkLogos />

            <input placeholder="Full name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full p-3 rounded-lg glass-input" />
            <input placeholder="Email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="w-full p-3 rounded-lg glass-input" />
            <input placeholder="Phone (optional)" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="w-full p-3 rounded-lg glass-input" />
            <textarea placeholder="Notes for the tailor (fabric, colour, style references...)" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} rows={3} className="w-full p-3 rounded-lg glass-input resize-none" />
            <div className="rounded-xl glass-card-subtle p-4 text-sm flex justify-between">
              <span className="text-white/60">Deposit due now (40%)</span>
              <span className="font-semibold">{naira(deposit)}</span>
            </div>
            <button
              onClick={submitOrder}
              disabled={busy || !customer.name || !customer.email}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {busy ? "Submitting..." : "Submit order"}
            </button>
          </section>
        )}

        {step === "checkout" && order && garment && (
          <section className="space-y-6 text-center">
            <div className="rounded-[22px] glass-card flowing-pink-edge py-10 px-6 space-y-5">
              <CheckCircle2 className="relative z-10 mx-auto text-[#F06BA6]" size={40} />
              <h2 className="relative z-10 text-xl font-display font-semibold">Order recorded</h2>
              <p className="relative z-10 text-white/60 text-sm">Reference {order.reference}. Pay your {naira(deposit)} deposit to confirm it.</p>
            </div>

            {/* Three ways in, one real processor underneath -- Paystack's own checkout natively supports
                Apple Pay and Google Pay wherever the customer's device/bank does, alongside card, so these
                aren't decorative: each one opens the same real Paystack popup, which then offers whichever
                of these the customer's own device actually supports. */}
            <div className="space-y-2.5 text-left">
              <button
                onClick={pay}
                disabled={busy}
                className="w-full py-3.5 rounded-xl bg-black text-white font-semibold hover:bg-black/80 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : <AppleLogo size={18} />}
                <span>Pay</span>
              </button>
              <button
                onClick={pay}
                disabled={busy}
                className="w-full py-3.5 rounded-xl bg-white text-[#1a0515] font-semibold hover:bg-white/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : <GoogleG size={18} />}
                <span>Pay</span>
              </button>
              <button
                onClick={pay}
                disabled={busy}
                className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : <Lock size={16} />}
                {busy ? "Opening Paystack..." : `Pay ${naira(deposit)} with card`}
              </button>
              <p className="text-center text-[11px] text-white/35">All options are processed securely by Paystack.</p>
            </div>
          </section>
        )}

        {step === "success" && (() => {
          // Real stage order from the server (/config) -- pickup orders skip "Shipped" entirely, shipping
          // orders pass through it between "Ready" and "Delivered". Falls back to the pickup list before
          // config loads, and switches to whichever the order actually used once the first poll confirms it.
          const effectiveDeliveryMethod = liveOrderStatus?.deliveryMethod ?? deliveryMethod;
          const stageKeys = (effectiveDeliveryMethod === "shipping" ? config?.shippingStages : config?.pickupStages) ?? [
            "New", "Confirmed", "Ready", "Delivered",
          ];
          const STAGES = stageKeys.map((key) => ({ key, label: config?.statusLabels?.[key] ?? key }));
          const currentStatus = liveOrderStatus?.status ?? orderStatus;
          const stageIdx = Math.max(0, STAGES.findIndex((s) => s.key === currentStatus));
          const readyAt = liveOrderStatus?.estimatedReadyAt
            ? new Date(liveOrderStatus.estimatedReadyAt).getTime()
            : order?.estimatedReadyAt
            ? new Date(order.estimatedReadyAt).getTime()
            : null;
          const remainingMs = readyAt ? Math.max(0, readyAt - nowTick) : null;
          const remDays = remainingMs !== null ? Math.floor(remainingMs / 86400000) : null;
          const remHours = remainingMs !== null ? Math.floor((remainingMs % 86400000) / 3600000) : null;
          const whatsappNumber = contactInfo?.whatsapp as string | undefined;
          const whatsappHref = whatsappNumber
            ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I'd like an update on my AtelierFit order (${order?.reference}).`)}`
            : null;

          return (
            <section className="space-y-5 text-center py-6">
              <div className="rounded-[22px] glass-card flowing-pink-edge py-8 px-6 space-y-3 flex flex-col items-center">
                <CopilotOrb size="lg" state="speaking" className="relative z-10" />
                <h2 className="relative z-10 text-xl font-display font-semibold">Order received</h2>
                <p className="relative z-10 text-white/60 text-sm">
                  {order?.paystackReady
                    ? "Your deposit is confirmed. The tailor will reach out shortly to arrange fitting and timeline."
                    : "Online payment isn't switched on yet, so the tailor will contact you directly to arrange your deposit."}
                </p>
              </div>

              {/* Status timeline -- mapped 1:1 to the real statuses the tailor sets from the admin dashboard,
                  not invented sub-steps nobody is actually tracking. */}
              <div className="rounded-xl glass-card-subtle p-4 text-left">
                <div className="text-xs uppercase tracking-wide text-white/40 mb-3 text-center">Order progress</div>
                <div className="space-y-0">
                  {STAGES.map((s, i) => (
                    <div key={s.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${i <= stageIdx ? "bg-[#F06BA6]" : "bg-white/15"}`} />
                        {i < STAGES.length - 1 && <span className={`w-px flex-1 min-h-[18px] ${i < stageIdx ? "bg-[#F06BA6]/50" : "bg-white/10"}`} />}
                      </div>
                      <span className={`text-sm pb-4 ${i <= stageIdx ? "text-white/90" : "text-white/35"}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Illustrative route -- not a live GPS feed (there's no courier service wired up), just a
                  static sense of "workshop to you" alongside the real countdown below. The tracking number,
                  when there is one, is real -- set by the tailor from the admin dashboard once an order
                  actually ships -- it's just not plugged into a live courier map. */}
              <div className="rounded-xl glass-card-subtle p-5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="w-8 h-8 rounded-full bg-[#D6397D]/30 border border-[#F06BA6]/50 flex items-center justify-center"><Scan size={14} className="text-[#F8A0C8]" /></span>
                    <span className="text-[10px] text-white/50">Atelier Noir</span>
                  </div>
                  <div className="flex-1 h-px mx-2 relative top-[-10px]" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(240,107,166,0.5) 0 6px, transparent 6px 12px)" }} aria-hidden />
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"><User size={14} className="text-white/70" /></span>
                    <span className="text-[10px] text-white/50">{effectiveDeliveryMethod === "shipping" ? "Your address" : "Pickup"}</span>
                  </div>
                </div>
                {remDays !== null && (
                  <div className="mt-4 text-center">
                    <div className="text-[11px] text-white/40 uppercase tracking-wide">Ready in</div>
                    <div className="font-serif text-lg font-semibold mt-0.5">{remDays}d {remHours}h</div>
                  </div>
                )}
                {liveOrderStatus?.trackingNumber && (
                  <div className="mt-4 pt-4 border-t border-white/10 text-center">
                    <div className="text-[11px] text-white/40 uppercase tracking-wide">Tracking number</div>
                    <div className="font-mono text-sm mt-0.5 text-[#F8A0C8]">{liveOrderStatus.trackingNumber}</div>
                  </div>
                )}
              </div>

              {/* Contact -- a real WhatsApp link (from the site's own contact settings) and the copilot's own
                  speech bubble for quick FAQ-style help, not a dead "voice call" button we can't back up. */}
              <div className="flex gap-2.5">
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 rounded-xl glass-card-subtle flowing-pink-edge text-sm font-medium hover:border-pink-400/60 transition-colors"
                  >
                    Message on WhatsApp
                  </a>
                )}
                <button
                  onClick={() => setShowCopilotTip((v) => !v)}
                  className="flex-1 py-3 rounded-xl glass-card-subtle flowing-pink-edge text-sm font-medium hover:border-pink-400/60 transition-colors"
                >
                  Ask the AI copilot
                </button>
              </div>
              {showCopilotTip && (
                <div className="flex justify-center">
                  <CopilotOrb
                    size="sm"
                    speechBubble={{
                      title: "AI Copilot",
                      text: "Your deposit secures your slot -- the balance is due when you pick up or receive your piece. I'll keep this page updated as the tailor moves your order along.",
                    }}
                  />
                </div>
              )}
            </section>
          );
        })()}
      </div>

      {/* Bottom nav -- only on the "browsing" screens, out of the way once someone's mid-order. */}
      {(step === "home" || step === "gallery" || step === "profile") && (
        <nav className="atelierfit-root fixed bottom-0 inset-x-0 flex justify-center pointer-events-none z-20 pb-[env(safe-area-inset-bottom)]">
          <div className="pointer-events-auto w-full max-w-md flex items-center justify-around pink-glass-card px-2 py-2.5 mx-4 mb-3 rounded-[22px]">
            <button onClick={() => setStep("home")} className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${step === "home" ? "text-[#D6397D]" : "text-white/40 hover:text-white/70"}`}>
              <HomeIcon size={18} />
              <span className="text-[10px] font-medium">Home</span>
            </button>
            <button onClick={() => setStep("gallery")} className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${step === "gallery" ? "text-[#D6397D]" : "text-white/40 hover:text-white/70"}`}>
              <Images size={18} />
              <span className="text-[10px] font-medium">Gallery</span>
            </button>
            <button onClick={() => setStep("garment")} disabled={!config} className="flex flex-col items-center gap-1 px-4 py-1 rounded-xl text-white/40 hover:text-white/70 transition-colors disabled:opacity-40">
              <Ruler size={18} />
              <span className="text-[10px] font-medium">Fitting</span>
            </button>
            <button onClick={() => setStep("profile")} className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${step === "profile" ? "text-[#D6397D]" : "text-white/40 hover:text-white/70"}`}>
              <User size={18} />
              <span className="text-[10px] font-medium">Profile</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

// A live, glossy card preview -- fills in with the customer's own name as they type it, like the holographic
// card mockup in the reference images. It never shows a real card number: this app doesn't collect raw card
// details itself (Paystack's own secured popup does, for PCI compliance), so the number stays fully masked by
// design, not because of a missing feature. The shine sweep, metallic edge highlight and embossed chip are
// what make it read as a real card rather than a flat rectangle.
function PaymentCardPreview({ name, amountLabel }: { name: string; amountLabel: string }) {
  const displayName = name.trim() ? name.trim().toUpperCase() : "YOUR NAME HERE";
  return (
    <div
      className="relative w-full aspect-[1.6/1] rounded-2xl overflow-hidden p-5 flex flex-col justify-between text-white select-none"
      style={{
        background: "linear-gradient(135deg, #3d0f30 0%, #701a45 28%, #D6397D 55%, #a8277f 75%, #3b0a2e 100%)",
        boxShadow: "0 20px 45px -12px rgba(0,0,0,0.75), inset 0 1.5px 2px rgba(255,210,240,0.5), inset 0 0 30px rgba(236,72,153,0.25)",
        border: "1px solid rgba(255,180,220,0.4)",
      }}
    >
      {/* Metallic edge highlight sweeping diagonally across the glass */}
      <div
        className="absolute inset-0 opacity-60 mix-blend-overlay pointer-events-none animate-[af-card-shine_5s_ease-in-out_infinite]"
        style={{ background: "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.65) 42%, rgba(255,255,255,0.1) 50%, transparent 65%)", backgroundSize: "250% 250%" }}
      />
      <style>{`@keyframes af-card-shine { 0%, 100% { background-position: 0% 0%; } 50% { background-position: 100% 60%; } }`}</style>

      <div className="relative z-10 flex items-center justify-between">
        {/* Embossed chip */}
        <div className="w-10 h-7 rounded-md bg-gradient-to-br from-[#f3d9a8] via-[#d8b067] to-[#9c7a3c] shadow-inner border border-black/10" />
        <span className="font-serif text-sm tracking-[0.2em] text-white/90">ATELIERFIT PAY</span>
      </div>

      <div className="relative z-10 font-mono text-lg tracking-[0.25em] text-white/85">
        •••• •••• •••• ••••
      </div>

      <div className="relative z-10 flex items-end justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Cardholder</div>
          <div className="text-xs font-medium tracking-wide truncate max-w-[180px]">{displayName}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-white/50">Due now</div>
          <div className="text-xs font-semibold">{amountLabel}</div>
        </div>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-[9px] text-emerald-300">
        <Lock size={9} />
        <span>Secured by Paystack</span>
      </div>
    </div>
  );
}

// Proof the card accepts real money before the customer gets to Paystack's own popup -- the same network
// marks any real checkout shows, not a decorative flourish. Paystack still does the actual card capture
// (PaymentCardPreview's number stays masked by design); this row just reassures before that step.
function CardNetworkLogos() {
  return (
    <div className="flex items-center justify-center gap-4 py-1">
      <svg width="38" height="12" viewBox="0 0 48 16" aria-label="Visa">
        <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="15" fill="#F5F0E6">VISA</text>
      </svg>
      <svg width="30" height="18" viewBox="0 0 30 18" aria-label="Mastercard">
        <circle cx="11" cy="9" r="9" fill="#EB001B" />
        <circle cx="19" cy="9" r="9" fill="#F79E1B" fillOpacity="0.92" />
      </svg>
      <svg width="40" height="16" viewBox="0 0 48 20" aria-label="Google Pay">
        <text x="0" y="15" fontFamily="Arial, sans-serif" fontWeight="500" fontSize="14" fill="#F5F0E6">
          <tspan fill="#4285F4">G</tspan>
          <tspan fill="#EA4335">o</tspan>
          <tspan fill="#FBBC05">o</tspan>
          <tspan fill="#4285F4">g</tspan>
          <tspan fill="#34A853">l</tspan>
          <tspan fill="#EA4335">e</tspan>
          <tspan fill="#F5F0E6"> Pay</tspan>
        </text>
      </svg>
      <span className="text-[10px] font-semibold tracking-wide text-emerald-300/90">Paystack</span>
    </div>
  );
}

function stepBack(step: Step): Step {
  const order: Step[] = ["home", "gallery", "garment", "design", "method", "camera", "manual", "review", "booking", "details", "checkout", "success"];
  const idx = order.indexOf(step);
  if (step === "manual" || step === "camera") return "method";
  return order[Math.max(0, idx - 1)];
}

function MeasurementForm({ measurements, onChange }: { measurements: EstimatedMeasurements; onChange: (m: EstimatedMeasurements) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(Object.keys(FIELD_LABELS) as (keyof EstimatedMeasurements)[]).map((key) => (
        <div key={key}>
          <label className="block text-xs text-white/50 mb-1">{FIELD_LABELS[key]}</label>
          <input
            type="number"
            step="0.1"
            value={measurements[key]}
            onChange={(e) => onChange({ ...measurements, [key]: Number(e.target.value) })}
            className="w-full p-2.5 rounded-lg glass-input text-sm"
          />
        </div>
      ))}
    </div>
  );
}
