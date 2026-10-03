import { useState } from "react";
import { motion } from "motion/react";
import { Smartphone, Tablet, Monitor } from "lucide-react";

// A device-frame preview for a project that's a real, running app rather than screenshots. Hand-built in CSS
// rather than pulled from an npm device-mockup library: a quick evaluation of the available packages turned
// up real reliability risk for a live, deployed build (one broke the production bundle outright), so this
// draws its own photorealistic bezels instead -- notch, speaker slit and camera dot on the phone, a thicker
// tablet bezel, and a laptop hinge + base on the desktop view -- with zero extra dependency risk. All three
// views share the SAME <iframe>, so switching between them never reloads the live app or loses its state.
// The QR code hands the same URL to the visitor's own phone, where "Add to Home Screen" makes it behave like
// an installed app.

type DeviceView = "phone" | "tablet" | "desktop";

const DEVICE_OPTIONS: { id: DeviceView; label: string; icon: typeof Smartphone }[] = [
  { id: "phone", label: "Phone", icon: Smartphone },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

// Per-view sizing for the outer bezel; the iframe itself always fills the inner screen area.
const FRAME_SIZE: Record<DeviceView, { width: number; height: number; radius: string; border: string }> = {
  phone: { width: 260, height: 540, radius: "2.75rem", border: "14px" },
  tablet: { width: 420, height: 560, radius: "1.75rem", border: "18px" },
  desktop: { width: 760, height: 480, radius: "0.9rem", border: "14px" },
};

export function MobilePreviewBlock({
  url,
  appName,
  defaultView = "phone",
  showQr = true,
}: {
  url: string;
  appName: string;
  defaultView?: DeviceView;
  showQr?: boolean;
}) {
  const [view, setView] = useState<DeviceView>(defaultView);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&color=212-175-55&bgcolor=11-10-8&data=${encodeURIComponent(url)}`;
  const size = FRAME_SIZE[view];

  return (
    <motion.section
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.45 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-2">
        <h2 className="text-2xl font-display font-semibold text-gold tracking-wide uppercase flex items-center gap-2">
          <Smartphone size={20} className="text-gold" />
          <span>Live Preview</span>
        </h2>
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-full p-1">
          {DEVICE_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-label={`Preview as ${label}`}
              aria-pressed={view === id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors interactive ${
                view === id ? "bg-gold text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-8 bg-white/[0.03] border border-white/10 rounded-2xl p-6 overflow-x-auto">
        <div className="shrink-0 flex flex-col items-center">
          {/* The bezel. Sizing is per-view; the iframe inside is identical across views, so toggling never
              remounts it. */}
          <div
            className="relative bg-[#161616] shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
            style={{
              width: size.width,
              height: size.height,
              borderRadius: size.radius,
              border: `${size.border} solid #161616`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.04)",
            }}
          >
            {view === "phone" && (
              <>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#161616] rounded-b-2xl z-20 flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2a2a2a]" />
                  <span className="w-8 h-1 rounded-full bg-[#2a2a2a]" />
                </div>
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-white/25 z-20" />
              </>
            )}
            {view === "tablet" && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#2a2a2a] z-20" />
            )}
            {view === "desktop" && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#2a2a2a] z-20" />
            )}

            <div className="absolute inset-0 rounded-[inherit] overflow-hidden bg-black [&_iframe]:border-0">
              <iframe
                key="device-preview-iframe"
                src={url}
                title={`${appName} live preview`}
                className="w-full h-full"
                loading="lazy"
              />
            </div>
          </div>

          {/* Laptop base, drawn separately so the hinge reads as a real seam rather than a rounded corner. */}
          {view === "desktop" && (
            <div
              className="bg-gradient-to-b from-[#2a2a2a] to-[#161616] rounded-b-[0.6rem]"
              style={{ width: size.width + 40, height: 14, marginTop: -2 }}
            >
              <div className="w-20 h-1.5 bg-black/40 rounded-full mx-auto mt-1.5" />
            </div>
          )}
        </div>

        {showQr && (
          <div className="flex flex-col items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="bg-white rounded-xl p-3">
              <img src={qrSrc} alt={`QR code linking to ${appName}`} width={160} height={160} className="block" />
            </div>
            <div className="max-w-xs">
              <p className="text-white font-medium mb-1">Scan to try it on your own phone</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Opens straight in your mobile browser -- no app-store install needed. Once it's open, use your
                browser's "Add to Home Screen" option and it behaves like any other installed app from then on.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
