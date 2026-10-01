import { motion, useReducedMotion } from "motion/react";
import { Orb } from "orb-ui";

export type AssistantState = "idle" | "thinking" | "speaking";

// Site palette only: bronze at rest, cyan while working out an answer, gold while the answer streams in.
const THEME = {
  name: "circle",
  preset: "calm",
  appearance: {
    colors: { idle: "#B08D57", thinking: "#00F0FF", speaking: "#D4AF37" },
  },
  // Colours blend in RGB, and halfway between cyan and gold is green, so keep the change between states short
  motion: { stateTransitionMs: 220 },
} as const;

export default function AssistantOrb({ state, size }: { state: AssistantState; size: number }) {
  const reduceMotion = useReducedMotion();
  // A slow, subtle breathing scale at rest, so the orb reads as alive rather than a static icon. It stops the
  // moment there's real work to show (thinking/speaking already carry their own motion), and never runs at all
  // if the visitor has reduced motion set.
  const breathing = state === "idle" && !reduceMotion;
  return (
    <motion.span
      className="inline-flex"
      animate={breathing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={breathing ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
    >
      <Orb signal={{ state }} theme={THEME} size={size} interactive={false} aria-hidden="true" />
    </motion.span>
  );
}
