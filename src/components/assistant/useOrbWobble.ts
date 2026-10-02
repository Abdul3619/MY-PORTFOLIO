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
  // The raw `energy` ref jumps in discrete steps (a bump per keystroke, per recognized word, per TTS word
  // boundary) rather than rising and falling smoothly, and feeding that straight into the motion is what read as
  // "dispatched"/disjointed rather than something you could flow with. These three keep their own smoothed,
  // continuously-eased value and only ever drift toward wherever the raw inputs currently point, at a pace slow
  // enough to feel like something settling rather than snapping -- that's the actual source of "slow when it's
  // slow, fast when it's fast" instead of a flat wobble that occasionally twitches.
  const smoothedEnergy = useRef(0);
  const curFreq = useRef(0.5);
  const curAmp = useRef(0.012);
  const curScaleAmp = useRef(0.012);
  const lastTime = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion) return;
    let frame: number;
    const tick = (now: number) => {
      const t = now / 1000;
      const dt = lastTime.current === null ? 1 / 60 : Math.min(0.1, (now - lastTime.current) / 1000);
      lastTime.current = now;
      const s = stateRef.current;

      // Energy itself eases toward the raw (jumpy) input -- quick to rise so a sudden loud word still registers,
      // slower to fall so it doesn't look like it's twitching between syllables.
      const targetEnergy = Math.min(energy.current, 1.4);
      const energyRate = 1 - Math.exp(-dt / (targetEnergy > smoothedEnergy.current ? 0.12 : 0.6));
      smoothedEnergy.current += (targetEnergy - smoothedEnergy.current) * energyRate;
      const e = smoothedEnergy.current;

      // freq: how fast it wobbles. amp: how far it drifts, as a fraction of size. scaleAmp: how much it swells.
      let targetFreq = 0.5, targetAmp = 0.012, targetScaleAmp = 0.012;
      if (s === "listening") {
        targetFreq = 0.55 + e * 0.7;
        targetAmp = 0.016 + e * 0.038;
        targetScaleAmp = 0.016 + e * 0.03;
      } else if (s === "speaking") {
        targetFreq = 1.8 + e * 2.3;
        targetAmp = 0.028 + e * 0.078;
        targetScaleAmp = 0.032 + e * 0.072;
      } else if (s === "thinking") {
        targetFreq = 1.1;
        targetAmp = 0.02;
        targetScaleAmp = 0.025;
      } else if (s === "reconnecting") {
        // Slower than idle and unmistakably not "listening" -- a steady, patient pulse rather than the sharper
        // "working on it" read of thinking, since nothing is actually being computed while the socket's down.
        targetFreq = 0.3;
        targetAmp = 0.014;
        targetScaleAmp = 0.02;
      }
      // The parameters that shape the motion also ease toward their target (slower still, ~0.4s) rather than
      // jumping the instant the state changes -- a switch from listening to speaking ramps up into its new pace
      // instead of cutting straight to it, which is the "flowing" quality that was missing.
      const paramRate = 1 - Math.exp(-dt / 0.4);
      curFreq.current += (targetFreq - curFreq.current) * paramRate;
      curAmp.current += (targetAmp - curAmp.current) * paramRate;
      curScaleAmp.current += (targetScaleAmp - curScaleAmp.current) * paramRate;

      const freq = curFreq.current;
      const amp = curAmp.current * amplitudeScale;
      const scaleAmp = curScaleAmp.current * amplitudeScale;

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
    return () => {
      cancelAnimationFrame(frame);
      lastTime.current = null;
    };
  }, [energy, reduceMotion, size, amplitudeScale]);

  return ref as RefObject<HTMLDivElement>;
}
