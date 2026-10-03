// AtelierFit's own background -- adapted directly from the portfolio's own BackgroundContext.tsx technique
// (large, heavily-blurred breathing color fields with mix-blend-screen so they glow/add rather than sit flat,
// plus a dark vignette to keep the center readable), recolored to the magenta-rose family the user referenced,
// with an SVG turbulence filter layered on top for an organic "flowing silk" quality a plain blurred circle
// can't give on its own. This is the screen's OWN background -- separate from any photorealistic phone-mockup
// presentation around it.
import { motion } from "motion/react";

export function FlowingBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0B0A08]" aria-hidden>
      {/* Breathing color fields -- same technique as the portfolio's BackgroundContext, magenta/rose family */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-[480px] h-[480px] bg-fuchsia-500/25 rounded-full blur-[130px] mix-blend-screen will-change-transform"
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-15%] right-[-10%] w-[520px] h-[520px] bg-rose-500/22 rounded-full blur-[150px] mix-blend-screen will-change-transform"
        animate={{ scale: [1, 1.35, 1], opacity: [0.18, 0.38, 0.18] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute top-[25%] right-[-5%] w-[380px] h-[380px] bg-pink-400/20 rounded-full blur-[120px] mix-blend-screen will-change-transform"
        animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.32, 0.15] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[10%] left-[5%] w-[360px] h-[360px] bg-purple-500/18 rounded-full blur-[130px] mix-blend-screen will-change-transform"
        animate={{ scale: [1, 1.3, 1], opacity: [0.14, 0.3, 0.14] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      {/* Organic flow texture -- an SVG turbulence filter distorts a soft gradient layer so it reads as
          drifting silk/plasma rather than static blurred circles. Very low opacity: texture, not a visible shape. */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]" aria-hidden>
        <defs>
          <filter id="af-flow-turbulence">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.015" numOctaves="2" seed="7" result="noise">
              <animate attributeName="baseFrequency" values="0.008 0.015;0.012 0.02;0.008 0.015" dur="22s" repeatCount="indefinite" />
            </feTurbulence>
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.95   0 0 0 0 0.3   0 0 0 0 0.6   0 0 0 0.9 0"
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#af-flow-turbulence)" />
      </svg>

      {/* Vignette -- keeps text/cards legible against the glow instead of washing everything out */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_25%,_#0B0A08_92%)]" />
    </div>
  );
}
