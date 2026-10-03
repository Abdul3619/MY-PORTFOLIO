import type { MutableRefObject } from "react";
import { Orb } from "orb-ui";
import OrbVisual, { type AssistantState } from "./OrbVisual";

// orb-ui drives the orb's state (and, once voice arrives, audio levels from its LiveKit/OpenAI Realtime adapters);
// the look is our own glass orb, rendered through orb-ui's renderTheme hook. `energy` is forwarded straight
// through to OrbVisual's own canvas render -- the same real activity-level ref useOrbWobble reads, not something
// orb-ui provides.
export default function AssistantOrb({
  state,
  size,
  energy,
  reduceMotion,
}: {
  state: AssistantState;
  size: number;
  energy?: MutableRefObject<number>;
  reduceMotion?: boolean;
}) {
  return (
    <Orb
      signal={{ state }}
      size={size}
      interactive={false}
      renderTheme={({ rootProps }) => {
        const { ref, className, style, ...attrs } = rootProps;
        return (
          <OrbVisual
            {...attrs}
            rootRef={ref}
            className={className}
            style={style}
            size={size}
            energy={energy}
            reduceMotion={reduceMotion}
          />
        );
      }}
    />
  );
}
