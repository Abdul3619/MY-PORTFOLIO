import { useState } from "react";
import { motion } from "motion/react";
import Device from "react-device-frame";
import { Smartphone, Tablet, Monitor } from "lucide-react";

// A device-frame preview for a project that's a real, running app rather than screenshots. `react-device-frame`
// (built on the well-known Devices.css) draws genuinely photorealistic bezels -- this is the "application you'd
// download instead of building from scratch" version, rather than a hand-drawn CSS box. Each device renders its
// own real <iframe> of the live app pointed at `url`; switching between phone/tablet/desktop swaps which frame
// is mounted (a deliberate trade-off for visual realism -- the app reloads on switch, same as opening it fresh).
// The QR code hands the same URL to the visitor's own phone, where "Add to Home Screen" makes it behave like an
// installed app.

type DeviceView = "phone" | "tablet" | "desktop";

const DEVICE_NAME: Record<DeviceView, string> = {
  phone: "iphone-x",
  tablet: "ipad-mini",
  desktop: "macbook-pro",
};

const DEVICE_OPTIONS: { id: DeviceView; label: string; icon: typeof Smartphone }[] = [
  { id: "phone", label: "Phone", icon: Smartphone },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

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
        <div className="shrink-0 [&_iframe]:border-0">
          <Device name={DEVICE_NAME[view]} url={url} />
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
