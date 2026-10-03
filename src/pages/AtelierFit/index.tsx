import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Camera, Ruler, ShieldCheck, Loader2, CheckCircle2, ArrowLeft, Sparkles, ArrowRight, Scan, Palette, Images, Home as HomeIcon, User } from "lucide-react";
import { detectPoseFromImage, estimateMeasurements, type EstimatedMeasurements } from "@/lib/atelierfit/measure";
import { openPaystackCheckout } from "@/lib/atelierfit/paystack";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholders";

// AtelierFit -- a real tailoring order app, not a portfolio mockup. Lives outside the main site's SSR'd layout
// (registered as a pure client route, same as /admin) so it can behave like an installable app: full-screen,
// its own manifest + service worker, no site header/footer. See src/entry-server.tsx and src/App.tsx.
//
// AtelierFit shares Atelier Noir's dark-editorial family (near-black, serif display type) but carries its own
// accent -- copper-rose instead of the website's gold -- so the app reads as its own thing, not a sub-page.

// AtelierFit's own signature accent is copper-rose (#D6397D / hover #F06BA6), distinct from Atelier Noir's gold.

type Garment = { id: string; label: string; basePriceNaira: number };
type Step = "home" | "gallery" | "garment" | "method" | "camera" | "manual" | "review" | "details" | "checkout" | "success";

// Compact gallery -- the same visual world as Atelier Noir, standing in for its real catalog until that
// gallery is rebuilt (unisex, African + international fashion together). Curated, not browsable in depth:
// a handful of pieces to prove the aesthetic, not a shop. Falls back to the site's own placeholder graphic
// if a photo fails to load, so a dead link never breaks the layout.
const GALLERY: { id: string; title: string; tag: string; img: string }[] = [
  { id: "g1", title: "Tailored Agbada", tag: "Menswear · West Africa", img: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=480&q=80&auto=format&fit=crop" },
  { id: "g2", title: "Structured Blazer", tag: "Womenswear · Tailoring", img: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=480&q=80&auto=format&fit=crop" },
  { id: "g3", title: "Draped Kaftan", tag: "Unisex · Modern", img: "https://images.unsplash.com/photo-1583391733956-6c78276477b2?w=480&q=80&auto=format&fit=crop" },
  { id: "g4", title: "Silk Kimono Coat", tag: "Womenswear · East Asia inspired", img: "https://images.unsplash.com/photo-1600370370825-3c3d5c5a5f4f?w=480&q=80&auto=format&fit=crop" },
  { id: "g5", title: "Two-Piece Suit", tag: "Menswear · Classic", img: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=480&q=80&auto=format&fit=crop" },
  { id: "g6", title: "Embroidered Gown", tag: "Womenswear · Occasion", img: "https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=480&q=80&auto=format&fit=crop" },
  { id: "g7", title: "Street-Tailored Jacket", tag: "Unisex · Contemporary", img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=480&q=80&auto=format&fit=crop" },
  { id: "g8", title: "Wrapped Dansiki", tag: "Menswear · West Africa", img: "https://images.unsplash.com/photo-1589363460779-cd717b2c0806?w=480&q=80&auto=format&fit=crop" },
];

const emptyMeasurements: EstimatedMeasurements = {
  heightCm: 170, shoulderWidthCm: 45, chestCm: 96, waistCm: 82, hipCm: 98, sleeveLengthCm: 60, armLengthCm: 60, legLengthCm: 100,
};

const FIELD_LABELS: Record<keyof EstimatedMeasurements, string> = {
  heightCm: "Height", shoulderWidthCm: "Shoulder width", chestCm: "Chest / bust", waistCm: "Waist",
  hipCm: "Hip", sleeveLengthCm: "Sleeve length", armLengthCm: "Arm length", legLengthCm: "Leg / inseam length",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function naira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
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
    <div className="min-h-screen w-full bg-[#0B0A08] text-[#F5F0E6] font-sans flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <header className="flex items-center gap-3 mb-8">
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
            <span className="font-display text-lg tracking-wide font-semibold">AtelierFit</span>
          </div>
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
                <h1 className="text-2xl font-display font-bold leading-tight">{greeting()}.</h1>
                <p className="text-white/60 text-sm mt-0.5">Ready to start your next fit?</p>
              </div>
            </div>

            {/* The AI-copilot hero -- a breathing orb rather than a flat banner, carrying the app's own
                magenta-rose personality while staying in the same dark-editorial family as the website. */}
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] py-10 flex flex-col items-center gap-3 overflow-hidden">
              <div
                className="absolute inset-0 opacity-40"
                style={{ background: "radial-gradient(circle at 50% 35%, rgba(214,57,125,0.35), transparent 60%)" }}
                aria-hidden
              />
              <button
                onClick={() => setStep("garment")}
                disabled={!config}
                aria-label="Begin fitting"
                className="relative z-10 w-36 h-36 rounded-full flex items-center justify-center group disabled:opacity-50 transition-opacity"
                style={{ background: "radial-gradient(circle at 35% 30%, #F06BA6, #D6397D 55%, #5a1540 100%)" }}
              >
                <span className="absolute inset-0 rounded-full border border-[#D6397D]/40 animate-[af-ring_2.6s_ease-out_infinite]" aria-hidden />
                <span
                  className="absolute inset-0 rounded-full border border-[#D6397D]/30 animate-[af-ring_2.6s_ease-out_infinite]"
                  style={{ animationDelay: "0.9s" }}
                  aria-hidden
                />
                <span className="relative z-10 flex flex-col items-center gap-1 text-black">
                  <Ruler size={22} />
                  <span className="font-display font-semibold text-sm tracking-wide">
                    {config ? "Begin fitting" : "Loading..."}
                  </span>
                </span>
              </button>
              <style>{`@keyframes af-ring { 0% { transform: scale(0.85); opacity: 0.9; } 100% { transform: scale(1.55); opacity: 0; } }`}</style>
              <div className="relative z-10 text-center">
                <div className="font-display text-sm tracking-wide text-white/80">AtelierFit Copilot</div>
                <div className="text-[11px] text-white/40">Measuring · Fitting · Creating</div>
              </div>
            </div>

            {/* Quick actions, echoing the reference's three-card row. */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => { setMethod("camera_ai"); setStep("garment"); }}
                className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#D6397D]/50 transition-colors text-center"
              >
                <Scan size={19} className="text-[#D6397D]" />
                <span className="text-xs font-medium leading-tight">Scan Body</span>
                <span className="text-[10px] text-white/40 leading-tight">AI measurements</span>
              </button>
              <button
                onClick={() => setStep("garment")}
                disabled={!config}
                className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#D6397D]/50 transition-colors text-center disabled:opacity-50"
              >
                <Palette size={19} className="text-[#D6397D]" />
                <span className="text-xs font-medium leading-tight">Start Order</span>
                <span className="text-[10px] text-white/40 leading-tight">Pick a garment</span>
              </button>
              <button
                onClick={() => setStep("gallery")}
                className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#D6397D]/50 transition-colors text-center"
              >
                <Images size={19} className="text-[#D6397D]" />
                <span className="text-xs font-medium leading-tight">Gallery</span>
                <span className="text-[10px] text-white/40 leading-tight">See our work</span>
              </button>
            </div>

            <div className="flex items-start gap-3 text-sm text-white/60 bg-white/5 rounded-xl p-4 border border-white/10">
              <ShieldCheck size={18} className="text-[#D6397D] shrink-0 mt-0.5" />
              <span>Camera measurements are estimated entirely on your own phone. No photo is ever uploaded or stored -- you confirm every number before anything is charged.</span>
            </div>

            {/* Compact gallery teaser -- the same aesthetic world as the Atelier Noir website, just small here. */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-sm uppercase tracking-wide text-white/80">What we've made</h2>
                <button onClick={() => setStep("gallery")} className="text-xs text-[#D6397D] hover:text-[#F06BA6] flex items-center gap-1 transition-colors">
                  See all <ArrowRight size={13} />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory [scrollbar-width:none]">
                {GALLERY.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setStep("gallery")}
                    className="shrink-0 w-28 snap-start text-left"
                  >
                    <img
                      src={item.img}
                      alt={item.title}
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                      className="w-28 h-28 object-cover rounded-xl border border-white/10"
                    />
                    <div className="mt-1.5 text-[11px] text-white/60 leading-snug">{item.title}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === "gallery" && (
          <section className="space-y-5 pb-20">
            <div>
              <h2 className="text-xl font-display font-semibold mb-1">What we've made</h2>
              <p className="text-sm text-white/60">A small selection -- unisex, African and international fashion together, the same gallery Atelier Noir shows on the web.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {GALLERY.map((item) => (
                <div key={item.id} className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
                  <img
                    src={item.img}
                    alt={item.title}
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                    className="w-full h-36 object-cover"
                  />
                  <div className="p-2.5">
                    <div className="text-sm font-medium leading-snug">{item.title}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{item.tag}</div>
                  </div>
                </div>
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
            <h2 className="text-xl font-display font-semibold mb-2">What are you having made?</h2>
            {config.garments.map((g) => (
              <button
                key={g.id}
                onClick={() => { setGarment(g); setStep("method"); }}
                className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#D6397D]/50 transition-colors flex justify-between items-center"
              >
                <span>{g.label}</span>
                <span className="text-white/50 text-sm">{naira(g.basePriceNaira)}</span>
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
        <nav className="fixed bottom-0 inset-x-0 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md flex items-center justify-around bg-[#121015]/90 backdrop-blur border-t border-white/10 px-2 py-2.5 mx-4 mb-3 rounded-2xl">
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
