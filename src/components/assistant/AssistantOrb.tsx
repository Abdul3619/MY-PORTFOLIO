import { Orb } from "orb-ui";
import OrbVisual, { type AssistantState } from "./OrbVisual";

// orb-ui drives the orb's state (and, once voice arrives, audio levels from its LiveKit/OpenAI Realtime adapters);
// the look is our own glass orb, rendered through orb-ui's renderTheme hook.
export default function AssistantOrb({ state, size }: { state: AssistantState; size: number }) {
  return (
    <Orb
      signal={{ state }}
      size={size}
      interactive={false}
      renderTheme={({ rootProps }) => {
        const { ref, className, style, ...attrs } = rootProps;
        return <OrbVisual {...attrs} rootRef={ref} className={className} style={style} size={size} />;
      }}
    />
  );
}
