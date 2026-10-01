import type { HTMLAttributes, Ref } from "react";

export type AssistantState = "idle" | "listening" | "thinking" | "speaking";

interface OrbVisualProps extends HTMLAttributes<HTMLDivElement> {
  size: number;
  rootRef?: Ref<HTMLDivElement>;
}

// Glassy orb: two slowly rotating, morphing colour blobs under a frosted surface. Pure CSS, so it also renders on
// the server; the colours come from the state on the surrounding .ai-assistant element (see assistant.css).
export default function OrbVisual({ size, rootRef, className, style, ...rest }: OrbVisualProps) {
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      {...rest}
      className={`ai-orb${className ? ` ${className}` : ""}`}
      style={{ ...style, ["--ai-orb-size" as string]: `${size}px` }}
    >
      <div className="ai-orb__core">
        <div className="ai-orb__blob ai-orb__blob--a" />
        <div className="ai-orb__blob ai-orb__blob--b" />
      </div>
      <div className="ai-orb__glass" />
    </div>
  );
}
