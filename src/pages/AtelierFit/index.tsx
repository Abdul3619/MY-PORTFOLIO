import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Camera, Ruler, ShieldCheck, Loader2, CheckCircle2, ArrowLeft, Sparkles, ArrowRight, Scan, Palette, Images, Home as HomeIcon, User } from "lucide-react";
import { detectPoseFromImage, estimateMeasurements, type EstimatedMeasurements } from "@/lib/atelierfit/measure";
import { openPaystackCheckout } from "@/lib/atelierfit/paystack";
import { BackgroundGlow } from "@/components/atelierfit/ui/BackgroundGlow";
import { CopilotOrb } from "@/components/atelierfit/ui/CopilotOrb";
import { GlassCard } from "@/components/atelierfit/ui/GlassCard";
import { GarmentPlaceholder } from "@/components/atelierfit/ui/GarmentPlaceholder";
import "@/components/atelierfit/ui/atelierfit-glass.css";

// AtelierFit -- a real tailoring order app, not a portfolio mockup. Lives outside the main site's SSR'd layout
// (registered as a pure client route, same as /admin) so it can behave like an installable app: full-screen,
// its own manifest + service worker, no site header/footer. See src/entry-server.tsx and src/App.tsx.
//
// AtelierFit shares Atelier Noir's dark-editorial family (near-black, serif display type) but carries its own
// accent -- copper-rose instead of the website's gold -- so the app reads as its own thing, not a sub-page.

// AtelierFit's own signature accent is copper-rose (#D6397D / hover #F06BA6), distinct from Atelier Noir's gold.

type Garment = { id: string; label: string; basePriceNaira: number };
type Step = "home" | "gallery" | "garment" | "method" | "camera" | "manual" | "review" | "details" | "checkout" | "success";

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

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("That file couldn't be read as an image."));
      img.src = url;
    });
    return img;
  } finally {
    // Revoke after the caller is done reading naturalWidth/Height; browsers keep the bitmap decoded already.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export default function AtelierFit() {
  const [step, setStep] = useState<Step>("home");
  const [config, setConfig] = useState<{ garments: Garment[]; depositRate: number; paystackConfigured: boolean; paystackPublicKey: string | null } | null>(null);
  const [garment, setGarment] = useState<Garment | null>(null);
  const [heightCm, setHeightCm] = useState(170);
  const [method, setMethod] = useState<"camera_ai" | "manual" | null>(null);
  const [measurements, setMeasurements] = useState<EstimatedMeasurements>(emptyMeasurements);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [order, setOrder] = useState<{ orderId: string; reference: string; amountKobo: number; paystackReady: boolean } | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const sideInputRef = useRef<HTMLInputElement>(null);

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

  const runCameraMeasure = useCallback(async () => {
    const frontFile = frontInputRef.current?.files?.[0];
    const sideFile = sideInputRef.current?.files?.[0];
    if (!frontFile || !sideFile) {
      setError("Add both a front photo and a side photo first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [frontImg, sideImg] = await Promise.all([loadImage(frontFile), loadImage(sideFile)]);
      const [frontLandmarks, sideLandmarks] = await Promise.all([
        detectPoseFromImage(frontImg),
        detectPoseFromImage(sideImg),
      ]);
      const result = estimateMeasurements({
        heightCm,
        front: { landmarks: frontLandmarks, width: frontImg.naturalWidth, height: frontImg.naturalHeight },
        side: { landmarks: sideLandmarks, width: sideImg.naturalWidth, height: sideImg.naturalHeight },
      });
      setMeasurements(result);
      setStep("review");
    } catch (e: any) {
      setError(e?.message || "Couldn't estimate measurements from those photos -- try again with better lighting, or switch to manual entry.");
    } finally {
      setBusy(false);
    }
  }, [heightCm]);

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
    <div className="atelierfit-root relative min-h-screen w-full text-[#F5F0E6] font-sans flex flex-col items-center px-4 py-8">
      <BackgroundGlow glowPositions={["top-right", "top-left", "bottom-left", "bottom-right"]} intensity="vibrant" />
      <div className="w-full max-w-md relative z-10">
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
          {step === "home" && <CopilotOrb size="sm" statusText="Ready to help" showWaveform />}
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3">{error}</div>
        )}

        {step === "home" && (
          <section className="space-y-7 pb-20">
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
                  className="relative z-10 w-40 h-40 rounded-full flex items-center justify-center group disabled:opacity-50 transition-opacity"
                  style={{ background: "radial-gradient(circle at 35% 30%, #F8A0C8, #F06BA6 40%, #D6397D 70%, #5a1540 100%)", boxShadow: "0 0 50px 6px rgba(240,107,166,0.55)" }}
                >
                  <span className="absolute inset-0 rounded-full border border-[#F06BA6]/50 animate-[af-ring_2.6s_ease-out_infinite]" aria-hidden />
                  <span
                    className="absolute inset-0 rounded-full border border-[#F06BA6]/40 animate-[af-ring_2.6s_ease-out_infinite]"
                    style={{ animationDelay: "0.9s" }}
                    aria-hidden
                  />
                  <span
                    className="absolute inset-0 rounded-full border border-[#F06BA6]/30 animate-[af-ring_2.6s_ease-out_infinite]"
                    style={{ animationDelay: "1.8s" }}
                    aria-hidden
                  />
                  <span className="relative z-10 flex flex-col items-center gap-1 text-black">
                    <Ruler size={24} />
                    <span className="font-serif font-semibold text-sm tracking-wide">
                      {config ? "Begin fitting" : "Loading..."}
                    </span>
                  </span>
                </button>
                <style>{`@keyframes af-ring { 0% { transform: scale(0.85); opacity: 0.9; } 100% { transform: scale(1.65); opacity: 0; } }`}</style>
                <div className="relative z-10 text-center">
                  <div className="font-serif text-sm tracking-wide text-white/80">AtelierFit Copilot</div>
                  <div className="text-[11px] text-white/40">Measuring · Fitting · Creating</div>
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
          <section className="space-y-5 pb-20">
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
          <section className="space-y-4">
            <h2 className="text-xl font-serif font-semibold mb-2">What are you having made?</h2>
            {config.garments.map((g) => (
              <button
                key={g.id}
                onClick={() => { setGarment(g); setStep("method"); }}
                className="w-full text-left p-3 rounded-xl glass-card-subtle flowing-pink-edge hover:border-pink-400/60 transition-colors flex items-center gap-3"
              >
                <GarmentPlaceholder type={garmentPlaceholderType(g.id)} className="w-14 h-14 rounded-xl shrink-0" ratio="square" />
                <span className="flex-1 flex justify-between items-center">
                  <span>{g.label}</span>
                  <span className="text-white/50 text-sm">{naira(g.basePriceNaira)}</span>
                </span>
              </button>
            ))}
          </section>
        )}

        {step === "method" && garment && (
          <section className="space-y-4">
            <h2 className="text-xl font-display font-semibold mb-2">How should we take your measurements?</h2>
            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-1">Your height (cm) -- needed either way, as the scale reference</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D6397D]/60 outline-none"
              />
            </div>
            <button
              onClick={() => { setMethod("camera_ai"); setStep("camera"); }}
              className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#D6397D]/50 transition-colors flex items-center gap-3"
            >
              <Camera size={20} className="text-[#D6397D]" />
              <div>
                <div className="font-medium">Use my camera (AI estimate)</div>
                <div className="text-xs text-white/50">Two photos, ~1 minute. You'll review and can correct every number.</div>
              </div>
            </button>
            <button
              onClick={() => { setMethod("manual"); setStep("manual"); }}
              className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#D6397D]/50 transition-colors flex items-center gap-3"
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
            <h2 className="text-xl font-display font-semibold">Two photos</h2>
            <p className="text-sm text-white/60">
              Hand your phone to someone else. Stand ~2.5m back in good light, arms slightly away from your body, in fitted clothing.
            </p>
            <PhotoPicker label="Front-facing photo" inputRef={frontInputRef} />
            <PhotoPicker label="Side-on photo" inputRef={sideInputRef} />
            <button
              onClick={runCameraMeasure}
              disabled={busy}
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
          <section className="space-y-4">
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
          <section className="space-y-4">
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
          <section className="space-y-4">
            <h2 className="text-xl font-display font-semibold mb-2">Your details</h2>
            <input placeholder="Full name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D6397D]/60 outline-none" />
            <input placeholder="Email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D6397D]/60 outline-none" />
            <input placeholder="Phone (optional)" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D6397D]/60 outline-none" />
            <textarea placeholder="Notes for the tailor (fabric, colour, style references...)" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} rows={3} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D6397D]/60 outline-none resize-none" />
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm flex justify-between">
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
          <section className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto text-[#D6397D]" size={40} />
            <h2 className="text-xl font-display font-semibold">Order recorded</h2>
            <p className="text-white/60 text-sm">Reference {order.reference}. Pay your {naira(deposit)} deposit to confirm it.</p>
            <button
              onClick={pay}
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-[#D6397D] text-black font-semibold hover:bg-[#F06BA6] transition-colors disabled:opacity-60"
            >
              Pay {naira(deposit)} with Paystack
            </button>
          </section>
        )}

        {step === "success" && (
          <section className="space-y-5 text-center py-8">
            <CheckCircle2 className="mx-auto text-[#D6397D]" size={48} />
            <h2 className="text-2xl font-display font-semibold">Order received</h2>
            <p className="text-white/60">
              {order?.paystackReady
                ? "Your deposit is confirmed. The tailor will reach out shortly to arrange fitting and timeline."
                : "Online payment isn't switched on yet, so the tailor will contact you directly to arrange your deposit."}
            </p>
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

function stepBack(step: Step): Step {
  const order: Step[] = ["home", "gallery", "garment", "method", "camera", "manual", "review", "details", "checkout", "success"];
  const idx = order.indexOf(step);
  if (step === "manual" || step === "camera") return "method";
  return order[Math.max(0, idx - 1)];
}

function PhotoPicker({ label, inputRef }: { label: string; inputRef: RefObject<HTMLInputElement | null> }) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <label className="block w-full p-4 rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-[#D6397D]/50 transition-colors cursor-pointer text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
      />
      <Camera size={20} className="mx-auto mb-2 text-[#D6397D]" />
      <span className="text-sm">{fileName || label}</span>
    </label>
  );
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
            className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-[#D6397D]/60 outline-none text-sm"
          />
        </div>
      ))}
    </div>
  );
}
