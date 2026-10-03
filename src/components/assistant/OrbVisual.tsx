import { useEffect, useRef, type HTMLAttributes, type MutableRefObject, type Ref } from "react";

// "reconnecting" only ever happens in the voice call (a dropped/handed-over Live connection, see
// VoiceCallOverlay.tsx) -- the text chat widget's own Orb usage never produces it, but needs to handle the type.
export type AssistantState = "idle" | "listening" | "thinking" | "speaking" | "reconnecting";

interface OrbVisualProps extends HTMLAttributes<HTMLDivElement> {
  size: number;
  rootRef?: Ref<HTMLDivElement>;
  // The same real 0..~1.4 activity level useOrbWobble reads (mic input level, TTS playback level, typed
  // characters) -- not a fake/simulated value. When omitted the orb still breathes from its own clock, just
  // without the audio-reactive pulse/ripples.
  energy?: MutableRefObject<number>;
  reduceMotion?: boolean;
}

// Default palette (the portfolio's own gold, matching assistant.css's initial-value custom properties) used only
// until the real --ai-c1/c2/c3/glow custom properties are read from the DOM below -- AtelierFit's copper-rose and
// any other theme override those via CSS (see atelierfit-glass.css), this file never hardcodes a theme.
const DEFAULT_C1: [number, number, number] = [222, 155, 51];
const DEFAULT_C2: [number, number, number] = [248, 198, 34];
const DEFAULT_C3: [number, number, number] = [176, 141, 87];

function parseColor(value: string, fallback: [number, number, number]): [number, number, number] {
  const v = value.trim();
  const rgb = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return fallback;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

interface Ripple {
  radius: number;
  maxRadius: number;
  alpha: number;
  initialAlpha: number;
  speed: number;
  lineWidth: number;
}

// Glassy orb -- a canvas-rendered liquid-glass sphere (volumetric outer glow, two counter-rotating morphing
// colour blobs in `screen` blend mode, a frosted diffusion overlay, an inner vignette, a specular highlight arc,
// a thin rim reflection) plus audio-reactive diffusion ripples, all driven by the SAME real inputs the old pure-CSS
// version used: the --ai-c1/--ai-c2/--ai-c3/--ai-glow custom properties set on the nearest .ai-assistant[data-state]
// ancestor (read live off this element's own computed style every frame, which also makes an in-progress colour
// cross-fade between states read correctly -- see assistant.css's `transition: --ai-c1 ...`), and `energy`, the
// same real activity-level ref useOrbWobble already reads (never a fake/simulated audio level).
//
// The original CSS blob/glass layers are kept underneath as the SSR/pre-hydration fallback (so the orb still
// looks like something, not a blank circle, before this effect's canvas starts painting on top of it) and as a
// graceful degrade if canvas ever fails to get a context.
export default function OrbVisual({ size, rootRef, className, style, energy, reduceMotion, ...rest }: OrbVisualProps) {
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const lastSpawnRef = useRef(0);
  const smoothedEnergyRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerElRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasSize = size * 2.3;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    const cx = (canvasSize * dpr) / 2;
    const cy = (canvasSize * dpr) / 2;
    const baseRadius = (size * dpr) / 2;
    let time = Math.random() * 20; // desynchronise multiple orbs on the same page
    let lastTs = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const dt = reduceMotion ? 0 : Math.min((now - lastTs) / 1000, 0.1);
      lastTs = now;
      time += dt;

      // Live colours, read off this element's own computed style so an in-progress state cross-fade (the
      // transitioning @property custom properties in assistant.css) is reflected frame-by-frame, and so this
      // component never needs to know which theme/state it's in -- that's entirely the CSS cascade's job.
      const cs = getComputedStyle(container);
      const c1 = parseColor(cs.getPropertyValue("--ai-c1"), DEFAULT_C1);
      const c2 = parseColor(cs.getPropertyValue("--ai-c2"), DEFAULT_C2);
      const c3 = parseColor(cs.getPropertyValue("--ai-c3"), DEFAULT_C3);
      const glowRaw = cs.getPropertyValue("--ai-glow");
      const glowRgb = parseColor(glowRaw, c1);
      const glowAlphaMatch = glowRaw.match(/,\s*([\d.]+)\s*\)/);
      const glowBaseAlpha = glowAlphaMatch ? Number(glowAlphaMatch[1]) : 0.35;
      const highlightBright = mix(c2, [255, 255, 255], 0.55);
      const shadow = mix(c3, [0, 0, 0], 0.45);

      const targetEnergy = reduceMotion ? 0 : Math.min(1, (energy?.current ?? 0) / 1.2);
      smoothedEnergyRef.current += (targetEnergy - smoothedEnergyRef.current) * Math.min(1, dt / 0.18);
      const e = smoothedEnergyRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const breath = reduceMotion ? 0 : Math.sin(time * 1.2) * 0.02 + Math.cos(time * 0.7) * 0.015;
      const currentRadius = baseRadius * (1 + breath + e * 0.09);

      // 1. Outer volumetric glow
      const outerGlowRadius = currentRadius * 1.5;
      const glowGrad = ctx.createRadialGradient(cx, cy, currentRadius * 0.75, cx, cy, outerGlowRadius);
      const glowAlpha = Math.min(1, glowBaseAlpha + (reduceMotion ? 0 : Math.sin(time * 1.5) * 0.08) + e * 0.3);
      glowGrad.addColorStop(0, `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},${glowAlpha * 0.8})`);
      glowGrad.addColorStop(0.45, `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},${glowAlpha * 0.4})`);
      glowGrad.addColorStop(1, `rgba(${glowRgb[0]},${glowRgb[1]},${glowRgb[2]},0)`);
      ctx.save();
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, outerGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Audio-reactive diffusion ripples, spawned faster/brighter the more activity `energy` reports
      if (!reduceMotion) {
        const spawnInterval = 650 - e * 400;
        if (now - lastSpawnRef.current > spawnInterval) {
          lastSpawnRef.current = now;
          const intensity = Math.min(1, 0.2 + e * 0.8);
          ripplesRef.current.push({
            radius: currentRadius + 2 * dpr,
            maxRadius: currentRadius * 1.8 + e * 30 * dpr,
            alpha: intensity * 0.4,
            initialAlpha: intensity * 0.4,
            speed: (0.6 + e * 1.1) * dpr,
            lineWidth: (1.1 + e * 1.3) * dpr,
          });
        }
        const alive: Ripple[] = [];
        for (const ripple of ripplesRef.current) {
          const progress = Math.max(0, Math.min(1, (ripple.radius - currentRadius) / (ripple.maxRadius - currentRadius)));
          ripple.radius += ripple.speed * (1 + progress * 0.4);
          ripple.alpha = ripple.initialAlpha * Math.pow(1 - progress, 1.4);
          if (progress < 1 && ripple.alpha > 0.004) {
            alive.push(ripple);
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, ripple.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${c2[0]},${c2[1]},${c2[2]},${ripple.alpha})`;
            ctx.lineWidth = ripple.lineWidth;
            ctx.stroke();
            ctx.restore();
          }
        }
        ripplesRef.current = alive;
      }

      // 3. Everything "inside the glass", clipped to the sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.clip();

      const innerBase = ctx.createRadialGradient(cx - currentRadius * 0.25, cy - currentRadius * 0.25, currentRadius * 0.1, cx, cy, currentRadius);
      innerBase.addColorStop(0, "#15120d");
      innerBase.addColorStop(0.7, "#0a0908");
      innerBase.addColorStop(1, "#020202");
      ctx.fillStyle = innerBase;
      ctx.fillRect(cx - currentRadius, cy - currentRadius, currentRadius * 2, currentRadius * 2);

      // Core filament
      const corePulse = (reduceMotion ? 0 : Math.sin(time * 2.2) * 0.15) + e * 0.3;
      const coreRadius = currentRadius * (0.4 + corePulse * 0.2);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, coreRadius));
      const coreTop = e > 0.5 ? highlightBright : c2;
      coreGrad.addColorStop(0, `rgb(${coreTop[0]},${coreTop[1]},${coreTop[2]})`);
      coreGrad.addColorStop(0.5, `rgb(${c3[0]},${c3[1]},${c3[2]})`);
      coreGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.5 + e * 0.35;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, coreRadius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Blob 1 -- main fluid core
      const b1Angle = reduceMotion ? 0.6 : time * 0.85;
      const b1Dist = currentRadius * 0.38 + (reduceMotion ? 0 : Math.sin(time * 1.1) * currentRadius * 0.12);
      const b1x = cx + Math.cos(b1Angle) * b1Dist;
      const b1y = cy + Math.sin(b1Angle * 1.2) * b1Dist;
      const b1r = currentRadius * (0.65 + (reduceMotion ? 0 : Math.sin(time * 1.4) * 0.12) + e * 0.15);
      const blob1 = ctx.createRadialGradient(b1x, b1y, b1r * 0.05, b1x, b1y, Math.max(1, b1r));
      blob1.addColorStop(0, `rgb(${c2[0]},${c2[1]},${c2[2]})`);
      blob1.addColorStop(0.35, `rgb(${c1[0]},${c1[1]},${c1[2]})`);
      blob1.addColorStop(0.75, `rgb(${c3[0]},${c3[1]},${c3[2]})`);
      blob1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = blob1;
      ctx.beginPath();
      ctx.arc(b1x, b1y, Math.max(1, b1r), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Blob 2 -- counter-rotating secondary fluid
      const b2Angle = reduceMotion ? 2.4 : -time * 0.65 + Math.PI * 0.75;
      const b2Dist = currentRadius * 0.42 + (reduceMotion ? 0 : Math.cos(time * 0.95) * currentRadius * 0.1);
      const b2x = cx + Math.cos(b2Angle) * b2Dist;
      const b2y = cy + Math.sin(b2Angle * 0.85) * b2Dist;
      const b2r = currentRadius * (0.58 + (reduceMotion ? 0 : Math.cos(time * 1.3) * 0.1) + e * 0.12);
      const blob2 = ctx.createRadialGradient(b2x, b2y, b2r * 0.08, b2x, b2y, Math.max(1, b2r));
      blob2.addColorStop(0, `rgb(${c2[0]},${c2[1]},${c2[2]})`);
      blob2.addColorStop(0.4, `rgb(${c1[0]},${c1[1]},${c1[2]})`);
      blob2.addColorStop(0.8, `rgb(${shadow[0]},${shadow[1]},${shadow[2]})`);
      blob2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = blob2;
      ctx.beginPath();
      ctx.arc(b2x, b2y, Math.max(1, b2r), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Frosted glass diffusion overlay
      const frosted = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentRadius);
      frosted.addColorStop(0, "rgba(255,255,255,0.03)");
      frosted.addColorStop(0.7, "rgba(255,255,255,0.06)");
      frosted.addColorStop(0.92, "rgba(255,255,255,0.12)");
      frosted.addColorStop(1, "rgba(255,255,255,0.25)");
      ctx.fillStyle = frosted;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Inner shadow / rim vignette
      const vignette = ctx.createRadialGradient(cx - currentRadius * 0.15, cy - currentRadius * 0.15, currentRadius * 0.5, cx, cy, currentRadius);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(0.8, "rgba(0,0,0,0.25)");
      vignette.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vignette;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Glass specular highlight arc
      const specX = cx - currentRadius * 0.35;
      const specY = cy - currentRadius * 0.42;
      const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, currentRadius * 0.55);
      spec.addColorStop(0, "rgba(255,255,255,0.8)");
      spec.addColorStop(0.25, "rgba(255,255,255,0.38)");
      spec.addColorStop(0.6, "rgba(255,255,255,0.1)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI * 0.18);
      ctx.scale(1.2, 0.6);
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(-currentRadius * 0.25, -currentRadius * 0.45, currentRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore(); // end clip

      // Ultra-thin glass boundary rim
      const rim = ctx.createLinearGradient(cx - currentRadius, cy - currentRadius, cx + currentRadius, cy + currentRadius);
      rim.addColorStop(0, "rgba(255,255,255,0.65)");
      rim.addColorStop(0.3, `rgba(${c1[0]},${c1[1]},${c1[2]},0.55)`);
      rim.addColorStop(0.7, "rgba(255,255,255,0.2)");
      rim.addColorStop(1, `rgba(${c1[0]},${c1[1]},${c1[2]},0.4)`);
      ctx.save();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.25 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, currentRadius - 0.6 * dpr), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, reduceMotion]);

  return (
    <div
      ref={(node) => {
        containerElRef.current = node;
        if (typeof rootRef === "function") rootRef(node);
        else if (rootRef && typeof rootRef === "object") (rootRef as { current: HTMLDivElement | null }).current = node;
      }}
      aria-hidden="true"
      {...rest}
      className={`ai-orb${className ? ` ${className}` : ""}`}
      style={{ ...style, ["--ai-orb-size" as string]: `${size}px` }}
    >
      {/* Pure-CSS fallback: renders on the server and for the brief moment before the canvas effect above has
          painted its first frame, so the orb is never a blank circle. */}
      <div className="ai-orb__core">
        <div className="ai-orb__blob ai-orb__blob--a" />
        <div className="ai-orb__blob ai-orb__blob--b" />
      </div>
      <div className="ai-orb__glass" />
      {/* The real liquid-glass render, painted on top once mounted. */}
      <canvas ref={canvasRef} className="ai-orb__canvas" aria-hidden="true" />
    </div>
  );
}
