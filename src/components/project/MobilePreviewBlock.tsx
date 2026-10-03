import { useState } from "react";
import { motion } from "motion/react";
import { Smartphone, Tablet, Monitor } from "lucide-react";

// A device-frame preview for a project that's a real, running app rather than screenshots. One <iframe>, loading
// the live app exactly once, stays mounted across every toggle -- only the surrounding frame's CSS (width/height/
// radius/bezel) changes between phone/tablet/desktop, so switching views never reloads the page or loses
// whatever state the visitor built up inside it (a half-filled form, a scroll position, anything). The QR code
// hands the same URL to the visitor's own phone, where "Add to Home Screen" makes it behave like an installed app.

type DeviceView = "phone" | "tablet" | "desktop";

const FRAME_STYLES: Record<DeviceView, { wrapper: string; bezel: string; notch?: boolean }> = {
  phone: { wrapper: "w-[220px] h-[460px] rounded-[2.5rem]", bezel: "border-[8px]", notch: true },
  tablet: { wrapper: "w-[320px] h-[420px] rounded-[1.5rem]", bezel: "border-[10px]" },
  desktop: { wrapper: "w-full max-w-[560px] h-[360px] rounded-lg", bezel: "border-[10px] border-b-[28px]" },
};

const DEVICE_OPTIONS: { id: DeviceView; label: string; icon: typeof Smartphone }[] = [
  { id: "phone", label: "Phone", icon: Smartphone },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

export function MobilePreviewBlock({ url, appName }: { url: string; appName: string }) {
  const [view, setView] = useState<DeviceView>("phone");
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&color=212-175-55&bgcolor=11-10-8&data=${encodeURIComponent(url)}`;
  const frame = FRAME_STYLES[view];

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

      <div className="flex flex-col sm:flex-row items-center gap-8 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        {/* Device bezel around a real, interactive iframe of the deployed app -- the iframe itself never remounts
            when `view` changes, only the wrapper classes below do, so in-page state survives the toggle. */}
        <div
          className={`relative shrink-0 ${frame.wrapper} ${frame.bezel} border-[#1c1c1c] bg-black shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300`}
        >
          {frame.notch && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#1c1c1c] rounded-b-xl z-10" />}
          <iframe
            src={url}
            title={`${appName} live preview`}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>

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
      </div>
    </motion.section>
  );
}
