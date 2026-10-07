import { motion } from "motion/react";
import { Smartphone } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";

// The AtelierFit-specific live preview. Unlike MobilePreviewBlock (which keeps a phone/tablet/desktop
// switcher for other projects), this one is deliberately single-view: it wraps the live AtelierFit app in
// the REAL, untouched PhoneFrame component exactly as generated in Google AI Studio -- real physical side
// buttons, real metallic bezel, real dynamic island with the glowing camera lens -- with no switcher and no
// hand-simplified substitute chrome. PhoneFrame's own `scale` prop (part of its real, documented API) is
// what shrinks the whole thing to fit the page; nothing about the component itself is modified.
const NATIVE_WIDTH = 390;
const DISPLAY_WIDTH = 280;
// Mirrors PhoneFrame's own internal aspect-ratio math (~19.5:9) so our layout footprint matches its
// rendered size exactly.
const NATIVE_HEIGHT = Math.round(NATIVE_WIDTH * 2.164);
const SCALE = DISPLAY_WIDTH / NATIVE_WIDTH;
const DISPLAY_HEIGHT = Math.round(NATIVE_HEIGHT * SCALE);

export function AtelierFitPreview({
  url,
  appName,
  showQr = true,
}: {
  url: string;
  appName: string;
  showQr?: boolean;
}) {
  // Use relative route /atelierfit for the iframe preview to avoid cross-origin framing blocks
  const iframeSrc = (!url || url.includes("abdulwahab-portfolio-tau.vercel.app") || url.includes("/atelierfit")) ? "/atelierfit" : url;
  // Our own server-generated code (atelierfit/route.ts) -- the actual live /atelierfit URl with the
  // AtelierFit icon composited into the center, not a third-party QR service.
  const qrSrc = "/api/atelierfit/qr-code.png";

  return (
    <motion.section
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.45 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <h2 className="text-2xl font-display font-semibold text-gold tracking-wide uppercase flex items-center gap-2">
          <Smartphone size={20} className="text-gold" />
          <span>Live Preview</span>
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-8 bg-white/[0.03] border border-white/10 rounded-2xl p-6 overflow-x-auto">
        <div className="shrink-0 relative" style={{ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT }}>
          {/* The real PhoneFrame rendered at its true native size (390 wide, ~19.5:9 tall), then shrunk to
              the page's display width as one unit via PhoneFrame's own `scale` prop -- the same technique
              its own transform-origin ("top center") already expects, so it lands centered in this box
              without any extra wrapping math on our side. */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: NATIVE_WIDTH, height: NATIVE_HEIGHT }}
          >
            <PhoneFrame width={NATIVE_WIDTH} scale={SCALE} color="rose-gold">
              <iframe
                key="atelierfit-device-preview-iframe"
                src={iframeSrc}
                title={`${appName} live preview`}
                style={{ width: "100%", height: "100%", border: 0 }}
                loading="lazy"
              />
            </PhoneFrame>
          </div>
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
