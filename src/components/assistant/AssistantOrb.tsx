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
  return <Orb signal={{ state }} theme={THEME} size={size} interactive={false} aria-hidden="true" />;
}
