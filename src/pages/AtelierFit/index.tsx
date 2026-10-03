import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Ruler, ShieldCheck, Loader2, CheckCircle2, ArrowLeft, Sparkles, ArrowRight, Scan, Palette, Images, Home as HomeIcon, User, Lock } from "lucide-react";
import { estimateMeasurements, type EstimatedMeasurements } from "@/lib/atelierfit/measure";
import { LiveCameraStage, type CapturedPose } from "@/components/atelierfit/LiveCameraStage";
import { openPaystackCheckout } from "@/lib/atelierfit/paystack";
import { BackgroundGlow } from "@/components/atelierfit/ui/BackgroundGlow";
import { CopilotOrb } from "@/components/atelierfit/ui/CopilotOrb";
import type { AssistantState } from "@/components/assistant/OrbVisual";
import { GlassCard } from "@/components/atelierfit/ui/GlassCard";
import { GarmentPlaceholder } from "@/components/atelierfit/ui/GarmentPlaceholder";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import "@/components/atelierfit/ui/atelierfit-glass.css";

// Standard four-colour "G" mark used on "Continue/Sign in with Google" buttons -- this is the button
// convention Google's own brand guidelines ask for, not a design flourish, same as the card-network logos
// on the payment step.
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
type Step = "splash" | "home" | "gallery" | "garment" | "method" | "camera" | "manual" | "review" | "details" | "checkout" | "success";

const GUEST_FLAG = "atelierfit_guest";

// Compact gallery -- standing in for Atelier Noir's real catalog until that catalog exists. Deliberately NOT
// photos: an earlier version used stock-photo URLs labeled with specific garment/country names (e.g. "Tailored
// Agbada") that this sandbox can't actually render to verify, so those names were guesses, not facts -- and
// guessing a culture's name onto an unseen image is exactly the mistake to avoid. Until there are real photos
// (the user's own work, or images sent directly in chat, which Claude can actually see), these tiles are
// honest, unphotographed categories -- organized by garment type, international and not Nigeria-only, each
// drawn as its own glass-panel pattern so the gallery still has visual variety without faking content.
const GALLERY: { id: string; title: string; tag: string; pattern: "diagonal" | "grid" | "dots" | "wave" | "chevron" | "arc" }[] = [
  { id: "g1", title: "Tailored Suits", tag: "International · Menswear & Womenswear", pattern: "diagonal" },
  { id: "g2", title: "Traditional Wear", tag: "Africa, Asia & beyond", pattern: "wave" },
  { id: "g3", title: "Dresses & Gowns", tag: "Occasion · Unisex-friendly cuts", pattern: "arc" },
  { id: "g4", title: "Outerwear & Layers", tag: "Coats, jackets, capes", pattern: "chevron" },
  { id: "g5", title: "Everyday Tailoring", tag: "Shirts, trousers, skirts", pattern: "grid" },
  { id: "g6", title: "Streetwear Cuts", tag: "Contemporary · Unisex", pattern: "dots" },
];

const emptyMeasurements: EstimatedMeasurements = {
  heightCm: 170, shoulderWidthCm: 45, chestCm: 96, waistCm: 82, hipCm: 98, sleeveLengthCm: 60, armLengthCm: 60, legLengthCm: 100,
};

const FIELD_LABELS: Record<keyof EstimatedMeasurements, string> = {
  heightCm: "Height", shoulderWidthCm: "Shoulder width", chestCm: "Chest / bust", waistCm: "Waist",
  hipCm: "Hip", sleeveLengthCm: "Sleeve length", armLengthCm: "Arm length", legLengthCm: "Leg / inseam length",
};

const PATTERN_BG: Record<string, string> = {
  diagonal: "repeating-linear-gradient(135deg, rgba(240,107,166,0.22) 0px, rgba(240,107,166,0.22) 2px, transparent 2px, transparent 14px)",
  grid: "linear-gradient(rgba(240,107,166,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(240,107,166,0.18) 1px, transparent 1px)",
  dots: "radial-gradient(rgba(240,107,166,0.35) 1.5px, transparent 1.5px)",
  wave: "repeating-radial-gradient(circle at 0% 50%, rgba(214,57,125,0.22) 0, rgba(214,57,125,0.22) 3px, transparent 3px, transparent 18px)",
  chevron: "repeating-linear-gradient(45deg, rgba(214,57,125,0.2) 0, rgba(214,57,125,0.2) 2px, transparent 2px, transparent 10px), repeating-linear-gradient(-45deg, rgba(240,107,166,0.15) 0, rgba(240,107,166,0.15) 2px, transparent 2px, transparent 10px)",
  arc: "radial-gradient(circle at 50% 120%, rgba(240,107,166,0.35), transparent 60%)",
};

function GalleryTile({ title, tag, pattern }: { title: string; tag: string; pattern: string }) {
  return (
    <div className="relative h-36 rounded-[18px] overflow-hidden glass-card-subtle flowing-pink-edge flex flex-col justify-end p-3">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: PATTERN_BG[pattern], backgroundSize: pattern === "dots" ? "14px 14px" : pattern === "grid" ? "16px 16px" : "auto" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a0515]/90 via-transparent to-transparent" aria-hidden />
      <div className="relative z-10">
        <div className="text-sm font-medium leading-snug font-serif">{title}</div>
        <div className="text-[11px] text-white/50 mt-0.5">{tag}</div>
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
// unphotographed placeholder (see the GALLERY comment above), just shaped roughly like the garment.
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
  const [config, setConfig] = useState<{ garments: Garment[]; depositRate: number; paystackConfigured: boolean; paystackPublicKey: string | null } | null>(null);
  const [garment, setGarment] = useState<Garment | null>(null);
  const [heightCm, setHeightCm] = useState(170);
  const [method, setMethod] = useState<"camera_ai" | "manual" | null>(null);
  const [measurements, setMeasurements] = useState<EstimatedMeasurements>(emptyMeasurements);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [order, setOrder] = useState<{ orderId: string; reference: string; amountKobo: number; paystackReady: boolean } | null>(null);

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
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/atelierfit-sw.js", { scope: "/atelierfit" }).catch(() => {});
    }
    return () => {
      link.remove();
      if (themeMeta && prevThemeColor) themeMeta.content = prevThemeColor;
    };
  }, []);

  useEffect(() => {
    fetch("/api/atelierfit/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("Couldn't reach the server -- check your connection and reload."));
  }, []);

  const deposit = useMemo(() => (garment ? Math.round(garment.basePriceNaira * (config?.depositRate ?? 0.4)) : 0), [garment, config]);

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
          notes: customer.notes || null,
          measurements,
          measurementMethod: method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the order.");
      setOrder(data);
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
  }, [garment, customer, measurements, method, config]);

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
    <div className="atelierfit-root relative min-h-screen w-full text-[#F5F0E6] font-sans flex flex-col items-center px-6 py-10">
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
          <section className="min-h-[85vh] flex flex-col items-center justify-center text-center gap-8 pb-10">
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
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/40 mb-1">
                  <Sparkles size={13} className="text-[#D6397D]" />
                  <span>By Atelier Noir</span>
                </div>
                <h1 className="text-2xl font-serif font-bold leading-tight">{greeting()}.</h1>
                <p className="text-white/60 text-sm mt-0.5">Ready to start your next fit?</p>
              </div>
            </div>

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

            {/* Quick actions -- pink glass tiles with the flowing animated edge. */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => { setMethod("camera_ai"); setStep("garment"); }}
                className="aspect-square flex flex-col items-center justify-center gap-2 p-2 rounded-2xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors text-center"
              >
                <Scan size={22} className="text-[#F06BA6]" />
                <span className="text-xs font-medium leading-tight">Scan Body</span>
                <span className="text-[10px] text-white/40 leading-tight">AI measurements</span>
              </button>
              <button
                onClick={() => setStep("garment")}
                disabled={!config}
                className="aspect-square flex flex-col items-center justify-center gap-2 p-2 rounded-2xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors text-center disabled:opacity-50"
              >
                <Palette size={22} className="text-[#F06BA6]" />
                <span className="text-xs font-medium leading-tight">Start Order</span>
                <span className="text-[10px] text-white/40 leading-tight">Pick a garment</span>
              </button>
              <button
                onClick={() => setStep("gallery")}
                className="aspect-square flex flex-col items-center justify-center gap-2 p-2 rounded-2xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors text-center"
              >
                <Images size={22} className="text-[#F06BA6]" />
                <span className="text-xs font-medium leading-tight">Gallery</span>
                <span className="text-[10px] text-white/40 leading-tight">See our work</span>
              </button>
            </div>

            <div className="flex items-start gap-3 text-sm text-white/60 glass-card-subtle rounded-xl p-4">
              <ShieldCheck size={18} className="text-[#F06BA6] shrink-0 mt-0.5" />
              <span>Camera measurements are estimated entirely on your own phone. No photo is ever uploaded or stored -- you confirm every number before anything is charged.</span>
            </div>

            {/* Compact gallery teaser -- categories, not unverified stock photos (see the GALLERY comment above). */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-white/80">What we make</h2>
                <button onClick={() => setStep("gallery")} className="text-xs text-[#F06BA6] hover:text-[#F8A0C8] flex items-center gap-1 transition-colors">
                  See all <ArrowRight size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {GALLERY.slice(0, 4).map((item) => (
                  <button key={item.id} onClick={() => setStep("gallery")} className="text-left">
                    <GalleryTile title={item.title} tag={item.tag} pattern={item.pattern} />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === "gallery" && (
          <section className="space-y-6 pb-24">
            <div>
              <h2 className="text-xl font-display font-semibold mb-1">What we make</h2>
              <p className="text-sm text-white/60">Unisex, international and traditional fashion together -- the same categories Atelier Noir organizes on the web. Real pieces are on their way; these stand in for the catalog until then.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GALLERY.map((item) => (
                <GalleryTile key={item.id} title={item.title} tag={item.tag} pattern={item.pattern} />
              ))}
            </div>
            <button
              onClick={() => setStep("garment")}
              disabled={!config}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors disabled:opacity-50"
            >
              {config ? "Begin fitting" : "Loading..."}
            </button>
          </section>
        )}

        {step === "garment" && config && (
          <section className="space-y-5">
            <h2 className="text-xl font-serif font-semibold mb-2">What are you having made?</h2>
            {config.garments.map((g) => (
              <button
                key={g.id}
                onClick={() => { setGarment(g); setStep("method"); }}
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
              onClick={() => setStep("details")}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors"
            >
              These look right -- continue
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
            <button
              onClick={pay}
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {busy ? "Opening Paystack..." : `Pay ${naira(deposit)} with Paystack`}
            </button>
          </section>
        )}

        {step === "success" && (
          <section className="space-y-6 text-center py-6">
            <div className="rounded-[22px] glass-card flowing-pink-edge py-10 px-6 space-y-4 flex flex-col items-center">
              <CopilotOrb size="lg" state="speaking" className="relative z-10" />
              <h2 className="relative z-10 text-2xl font-display font-semibold">Order received</h2>
              <p className="relative z-10 text-white/60">
                {order?.paystackReady
                  ? "Your deposit is confirmed. The tailor will reach out shortly to arrange fitting and timeline."
                  : "Online payment isn't switched on yet, so the tailor will contact you directly to arrange your deposit."}
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Bottom nav -- only on the two "browsing" screens, out of the way once someone's mid-order. */}
      {(step === "home" || step === "gallery") && (
        <nav className="atelierfit-root fixed bottom-0 inset-x-0 flex justify-center pointer-events-none z-20">
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
            <button disabled aria-disabled className="flex flex-col items-center gap-1 px-4 py-1 rounded-xl text-white/20 cursor-not-allowed" title="Coming soon">
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
  const order: Step[] = ["home", "gallery", "garment", "method", "camera", "manual", "review", "details", "checkout", "success"];
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
