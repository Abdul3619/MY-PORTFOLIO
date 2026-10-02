import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { AssistantState } from "./OrbVisual";

// Drives a continuous, non-uniform wobble on whatever element the returned ref is attached to: several sine waves
// at different frequencies and phases on each axis (so the motion drifts in a changing direction, never a flat
// back-and-forth), slow and gentle while idle/listening, fast and energetic while speaking -- scaled by `energy`,
// a 0..~1.4 value the caller bumps on real signal (typed characters, mic volume, TTS word boundaries). Shared by
// the small widget orb and the big voice-call orb so both breathe with the same feel at different sizes/amplitudes.
export default function useOrbWobble(
  energy: MutableRefObject<number>,
  state: AssistantState,
  size: number,
  reduceMotion: boolean,
  amplitudeScale = 1,
) {
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion) return;
    let frame: number;
    const tick = (now: number) => {
      const t = now / 1000;
      const s = stateRef.current;
      const e = Math.min(energy.current, 1.4);
      // freq: how fast it wobbles. amp: how far it drifts, as a fraction of size. scaleAmp: how much it swells.
      let freq = 0.5, amp = 0.012, scaleAmp = 0.012;
      if (s === "listening") {
        freq = 0.9 + e * 1.1;
        amp = 0.018 + e * 0.045;
        scaleAmp = 0.018 + e * 0.035;
      } else if (s === "speaking") {
        freq = 2.2 + e * 2.6;
        amp = 0.03 + e * 0.085;
        scaleAmp = 0.035 + e * 0.08;
      } else if (s === "thinking") {
        freq = 1.4;
        amp = 0.02;
        scaleAmp = 0.025;
      }
      amp *= amplitudeScale;
      scaleAmp *= amplitudeScale;
      // Two sine terms per axis at incommensurate frequencies/phases so the path never repeats as a simple
      // straight line -- it traces a slowly changing loop, which is what reads as "wobbling" rather than
      // "bouncing on one axis".
      const dx = (Math.sin(t * freq * 1.3 + 0.6) + Math.sin(t * freq * 2.1 + 2.4) * 0.5) * amp * size;
      const dy = (Math.cos(t * freq * 1.7 + 1.1) + Math.sin(t * freq * 0.9 + 0.3) * 0.6) * amp * size;
      const scale = 1 + Math.sin(t * freq * 1.9 + 0.8) * scaleAmp;
      el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [energy, reduceMotion, size, amplitudeScale]);

  return ref as RefObject<HTMLDivElement>;
}
