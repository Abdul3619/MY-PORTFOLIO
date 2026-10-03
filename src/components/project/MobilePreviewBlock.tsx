import { useState } from "react";
import { motion } from "motion/react";
import { Smartphone, Tablet, Monitor } from "lucide-react";
import { COLOR_SCHEMES, WifiIcon, CellularIcon, BatteryIcon } from "./PhoneFrame";

// A device-frame preview for a project that's a real, running app rather than screenshots.
//
// IMPORTANT sizing technique -- this is what fixes the "squished/nested" look the real device preview used to
// have on a visitor's own phone: the <iframe> is ALWAYS given its true native viewport size (390x843 for the
// phone view, matching a real iPhone, similarly sized for tablet/desktop) so the live app inside it lays
// itself out exactly as it does when opened directly -- nothing inside ever has to reflow into an undersized
// box. The whole native-size box (bezel + iframe together) is then visually shrunk as ONE unit with a single
// CSS transform: scale(), wrapped in a container sized to the already-scaled dimensions so it still fits
// neatly in the preview card. The app is always rendered at its real, normal size; only the final picture of
// it is smaller -- never double-shrunk or reflowed small.
//
// The phone view uses a realistic PhoneFrame mockup (rose-gold metallic bezel, dynamic island with a glowing
// camera lens, live status bar, home indicator) built from a reference image via Google AI Studio. Tablet and
// desktop keep a simpler hand-built CSS bezel. All views share the SAME <iframe>, so switching between them
// never reloads the live app or loses its state. The QR code hands the same URL to the visitor's own phone,
// where "Add to Home Screen" makes it behave like an installed app.

type DeviceView = "phone" | "tablet" | "desktop";

const DEVICE_OPTIONS: { id: DeviceView; label: string; icon: typeof Smartphone }[] = [
  { id: "phone", label: "Phone", icon: Smartphone },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

// Native (real) resolution the iframe renders at for each view, and the final on-page display width it's
// scaled down to. The displayed box is always nativeWidth * (displayWidth / nativeWidth) tall too, so nothing
// gets stretched or squashed -- only uniformly scaled.
const DEVICE_SIZE: Record<DeviceView, { nativeWidth: number; nativeHeight: number; displayWidth: number }> = {
  phone: { nativeWidth: 390, nativeHeight: 844, displayWidth: 240 },
  tablet: { nativeWidth: 820, nativeHeight: 1060, displayWidth: 320 },
  desktop: { nativeWidth: 1280, nativeHeight: 800, displayWidth: 560 },
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
  const d = DEVICE_SIZE[view];
  const displayScale = d.displayWidth / d.nativeWidth;
  const displayHeight = Math.round(d.nativeHeight * displayScale);
  const isPhone = view === "phone";
  const rose = COLOR_SCHEMES["rose-gold"];

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
          {/* The on-page footprint: exactly the final, scaled-down size -- nothing bigger, nothing overflowing. */}
          <div className="relative" style={{ width: d.displayWidth, height: displayHeight }}>
            {/* The real device, rendered at its TRUE native resolution (390x844 for phone, etc.) so the live
                app inside lays itself out exactly as it does when opened directly -- then this whole box is
                shrunk as one unit with a single transform: scale(). Nothing inside is ever reflowed into an
                undersized viewport; only the final picture of it is smaller. */}
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{ width: d.nativeWidth, height: d.nativeHeight, transform: `scale(${displayScale})` }}
            >
              <div
                className="relative overflow-hidden"
                style={{
                  width: d.nativeWidth,
                  height: d.nativeHeight,
                  borderRadius: isPhone ? 56 : view === "tablet" ? 36 : 18,
                  padding: isPhone ? 10 : view === "tablet" ? 20 : 14,
                  background: isPhone ? rose.bezelGradient : "#161616",
                  boxShadow: isPhone
                    ? `0 0 0 1px ${rose.outerRing}, 0 24px 60px -12px rgba(0,0,0,0.65), 0 8px 24px -6px rgba(0,0,0,0.45)`
                    : "0 20px 60px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.04)",
                }}
              >
                <div className="relative w-full h-full rounded-[inherit] bg-black overflow-hidden [&_iframe]:border-0">
                  {/* Realistic phone chrome: dynamic island with a glowing camera lens, live status bar, home
                      indicator -- ported from the AI-Studio-generated PhoneFrame reference. Pure overlay, so it
                      never touches the iframe underneath. */}
                  {isPhone && (
                    <>
                      <div className="absolute top-[11px] left-1/2 -translate-x-1/2 z-30 w-[114px] h-[30px] bg-black rounded-full flex items-center justify-between px-3 pointer-events-none">
                        <div className="w-[10px] h-[10px] rounded-full bg-[#0a0a0c] border border-white/5" />
                        <div className="relative flex items-center justify-center">
                          <div
                            className="absolute w-6 h-6 rounded-full"
                            style={{ background: "radial-gradient(circle, #F06BA655 0%, #F06BA622 55%, transparent 75%)", boxShadow: "0 0 10px 2px #F06BA666, 0 0 18px 4px #F06BA633" }}
                          />
                          <div className="relative w-[11px] h-[11px] rounded-full" style={{ background: "radial-gradient(circle, #08101e 30%, #030712 100%)" }} />
                        </div>
                      </div>
                      <div className="absolute top-0 left-0 right-0 h-[44px] px-6 pt-3 flex items-center justify-between text-white z-20 pointer-events-none">
                        <span className="text-[13px] font-semibold tabular-nums">9:41</span>
                        <div className="flex items-center gap-1.5">
                          <CellularIcon level={4} />
                          <WifiIcon />
                          <BatteryIcon level={88} />
                        </div>
                      </div>
                      <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[120px] h-[4px] rounded-full bg-white/70 z-30 pointer-events-none" />
                    </>
                  )}
                  {view === "tablet" && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#2a2a2a] z-20 pointer-events-none" />
                  )}
                  {view === "desktop" && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#2a2a2a] z-20 pointer-events-none" />
                  )}

                  <iframe
                    key="device-preview-iframe"
                    src={url}
                    title={`${appName} live preview`}
                    className="w-full h-full"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Laptop base, drawn separately so the hinge reads as a real seam rather than a rounded corner. */}
          {view === "desktop" && (
            <div
              className="bg-gradient-to-b from-[#2a2a2a] to-[#161616] rounded-b-[0.6rem]"
              style={{ width: d.displayWidth + 40, height: 14, marginTop: -2 }}
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
