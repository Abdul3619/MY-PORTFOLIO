import { useEffect, useRef, type MutableRefObject } from "react";
import type { AssistantState } from "./OrbVisual";

interface WaveformProps {
  state: AssistantState;
  // Bumped by the widget on each keystroke (listening) and each typed character (speaking)
  energy: MutableRefObject<number>;
  bars?: number;
  active: boolean;
  reduceMotion: boolean;
}

// Static heights used when motion is reduced, so the state still reads at a glance
const STATIC_LEVEL: Record<AssistantState, number> = { idle: 0.12, listening: 0.45, thinking: 0.6, speaking: 0.75 };

// A row of bars that reacts to what the assistant is doing. Not audio-driven yet: listening reacts to typing,
// thinking runs a travelling wave, speaking pulses with the characters as they appear.
export default function Waveform({ state, energy, bars = 32, active, reduceMotion }: WaveformProps) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const levels = useRef<number[]>(Array(bars).fill(0.1));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const centre = (bars - 1) / 2;
    const envelope = (i: number) => 1 - (Math.abs(i - centre) / centre) * 0.55;

    if (reduceMotion || !active) {
      barRefs.current.forEach((bar, i) => {
        if (bar) bar.style.transform = `scaleY(${Math.max(0.08, STATIC_LEVEL[state] * envelope(i))})`;
      });
      return;
    }

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const t = now / 1000;
      energy.current *= Math.pow(0.9, dt / 16);
      const e = Math.min(energy.current, 1);
      const s = stateRef.current;
      for (let i = 0; i < bars; i++) {
        let target: number;
        if (s === "thinking") {
          target = 0.3 + 0.32 * Math.sin(t * 4.2 - i * 0.45) * (0.65 + 0.35 * Math.sin(t * 1.3 + i * 0.2)) + 0.15;
        } else if (s === "speaking") {
          target = 0.22 + e * (0.45 + 0.35 * Math.sin(t * 9 + i * 1.7)) + 0.1 * Math.sin(t * 5 + i * 0.8);
        } else if (s === "listening") {
          target = 0.16 + e * (0.5 + 0.4 * Math.sin(t * 11 + i * 2.3)) + 0.05 * Math.sin(t * 2 + i * 0.5);
        } else {
          target = 0.09 + 0.04 * Math.sin(t * 1.6 + i * 0.4);
        }
        target = Math.max(0.06, Math.min(1, target * envelope(i)));
        const level = levels.current[i] + (target - levels.current[i]) * Math.min(1, dt / 70);
        levels.current[i] = level;
        const bar = barRefs.current[i];
        if (bar) bar.style.transform = `scaleY(${level.toFixed(3)})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reduceMotion, bars, energy, reduceMotion ? state : null]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-full w-full" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} ref={(el) => { barRefs.current[i] = el; }} className="ai-wave__bar" />
      ))}
    </div>
  );
}
