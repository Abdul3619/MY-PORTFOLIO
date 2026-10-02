import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Camera, Ruler, ShieldCheck, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { detectPoseFromImage, estimateMeasurements, type EstimatedMeasurements } from "@/lib/atelierfit/measure";
import { openPaystackCheckout } from "@/lib/atelierfit/paystack";

// AtelierFit -- a real tailoring order app, not a portfolio mockup. Lives outside the main site's SSR'd layout
// (registered as a pure client route, same as /admin) so it can behave like an installable app: full-screen,
// its own manifest + service worker, no site header/footer. See src/entry-server.tsx and src/App.tsx.

type Garment = { id: string; label: string; basePriceNaira: number };
type Step = "landing" | "garment" | "method" | "camera" | "manual" | "review" | "details" | "checkout" | "success";

const emptyMeasurements: EstimatedMeasurements = {
  heightCm: 170, shoulderWidthCm: 45, chestCm: 96, waistCm: 82, hipCm: 98, sleeveLengthCm: 60, armLengthCm: 60, legLengthCm: 100,
};

const FIELD_LABELS: Record<keyof EstimatedMeasurements, string> = {
  heightCm: "Height", shoulderWidthCm: "Shoulder width", chestCm: "Chest / bust", waistCm: "Waist",
  hipCm: "Hip", sleeveLengthCm: "Sleeve length", armLengthCm: "Arm length", legLengthCm: "Leg / inseam length",
};

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
  const [step, setStep] = useState<Step>("landing");
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
          {step !== "landing" && (
            <button
              onClick={() => setStep(stepBack(step))}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Ruler className="text-[#D4AF37]" size={22} />
            <span className="font-display text-lg tracking-wide font-semibold">AtelierFit</span>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3">{error}</div>
        )}

        {step === "landing" && (
          <section className="space-y-6">
            <h1 className="text-3xl font-display font-bold leading-tight">Order a fit, start to finish, from your phone.</h1>
            <p className="text-white/70 leading-relaxed">
              Pick a garment, get measured -- by your camera or by hand -- and pay a deposit to lock in your order.
              No account needed. Add this page to your home screen and it behaves like any other app.
            </p>
            <div className="flex items-start gap-3 text-sm text-white/60 bg-white/5 rounded-xl p-4 border border-white/10">
              <ShieldCheck size={18} className="text-[#D4AF37] shrink-0 mt-0.5" />
              <span>Camera measurements are estimated entirely on your own phone. No photo is ever uploaded or stored -- you confirm every number before anything is charged.</span>
            </div>
            <button
              onClick={() => setStep("garment")}
              disabled={!config}
              className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-semibold hover:bg-[#e6c250] transition-colors disabled:opacity-50"
            >
              {config ? "Start your order" : "Loading..."}
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
                className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/50 transition-colors flex justify-between items-center"
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
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D4AF37]/60 outline-none"
              />
            </div>
            <button
              onClick={() => { setMethod("camera_ai"); setStep("camera"); }}
              className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/50 transition-colors flex items-center gap-3"
            >
              <Camera size={20} className="text-[#D4AF37]" />
              <div>
                <div className="font-medium">Use my camera (AI estimate)</div>
                <div className="text-xs text-white/50">Two photos, ~1 minute. You'll review and can correct every number.</div>
              </div>
            </button>
            <button
              onClick={() => { setMethod("manual"); setStep("manual"); }}
              className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/50 transition-colors flex items-center gap-3"
            >
              <Ruler size={20} className="text-[#D4AF37]" />
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
              className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-semibold hover:bg-[#e6c250] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
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
              className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-semibold hover:bg-[#e6c250] transition-colors"
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
              className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-semibold hover:bg-[#e6c250] transition-colors"
            >
              These look right -- continue
            </button>
          </section>
        )}

        {step === "details" && garment && (
          <section className="space-y-4">
            <h2 className="text-xl font-display font-semibold mb-2">Your details</h2>
            <input placeholder="Full name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D4AF37]/60 outline-none" />
            <input placeholder="Email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D4AF37]/60 outline-none" />
            <input placeholder="Phone (optional)" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D4AF37]/60 outline-none" />
            <textarea placeholder="Notes for the tailor (fabric, colour, style references...)" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} rows={3} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D4AF37]/60 outline-none resize-none" />
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm flex justify-between">
              <span className="text-white/60">Deposit due now (40%)</span>
              <span className="font-semibold">{naira(deposit)}</span>
            </div>
            <button
              onClick={submitOrder}
              disabled={busy || !customer.name || !customer.email}
              className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-semibold hover:bg-[#e6c250] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {busy ? "Submitting..." : "Submit order"}
            </button>
          </section>
        )}

        {step === "checkout" && order && garment && (
          <section className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto text-[#D4AF37]" size={40} />
            <h2 className="text-xl font-display font-semibold">Order recorded</h2>
            <p className="text-white/60 text-sm">Reference {order.reference}. Pay your {naira(deposit)} deposit to confirm it.</p>
            <button
              onClick={pay}
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-semibold hover:bg-[#e6c250] transition-colors disabled:opacity-60"
            >
              Pay {naira(deposit)} with Paystack
            </button>
          </section>
        )}

        {step === "success" && (
          <section className="space-y-5 text-center py-8">
            <CheckCircle2 className="mx-auto text-[#D4AF37]" size={48} />
            <h2 className="text-2xl font-display font-semibold">Order received</h2>
            <p className="text-white/60">
              {order?.paystackReady
                ? "Your deposit is confirmed. The tailor will reach out shortly to arrange fitting and timeline."
                : "Online payment isn't switched on yet, so the tailor will contact you directly to arrange your deposit."}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function stepBack(step: Step): Step {
  const order: Step[] = ["landing", "garment", "method", "camera", "manual", "review", "details", "checkout", "success"];
  const idx = order.indexOf(step);
  if (step === "manual" || step === "camera") return "method";
  return order[Math.max(0, idx - 1)];
}

function PhotoPicker({ label, inputRef }: { label: string; inputRef: RefObject<HTMLInputElement | null> }) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <label className="block w-full p-4 rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-[#D4AF37]/50 transition-colors cursor-pointer text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
      />
      <Camera size={20} className="mx-auto mb-2 text-[#D4AF37]" />
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
            className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-[#D4AF37]/60 outline-none text-sm"
          />
        </div>
      ))}
    </div>
  );
}
