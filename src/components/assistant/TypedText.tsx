import { useEffect, useRef, useState, type ReactNode } from "react";

// Characters per second. The base pace is brisk; when the model streams faster than that, the pace rises with the
// backlog so the text never falls far behind.
const BASE_RATE = 75;
const CATCH_UP_PER_CHAR = 2.2;
// The last few characters fade in individually; everything before them renders as plain text.
const FADING_TAIL = 10;

interface TypedTextProps {
  text: string;
  // More text may still arrive
  streaming: boolean;
  render: (text: string) => ReactNode;
  onType?: (count: number) => void;
  onDone?: () => void;
}

// Types `text` out character by character at a steady pace, however unevenly it arrives from the stream.
export default function TypedText({ text, streaming, render, onType, onDone }: TypedTextProps) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const textRef = useRef(text);
  textRef.current = text;
  const callbacks = useRef({ onType, onDone });
  callbacks.current = { onType, onDone };
  const doneRef = useRef(false);

  useEffect(() => {
    if (shownRef.current >= text.length) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 250);
      last = now;
      const target = textRef.current.length;
      const backlog = target - shownRef.current;
      if (backlog <= 0) return;
      carry += ((BASE_RATE + backlog * CATCH_UP_PER_CHAR) * dt) / 1000;
      const step = Math.min(backlog, Math.floor(carry));
      if (step > 0) {
        carry -= step;
        shownRef.current += step;
        setShown(shownRef.current);
        callbacks.current.onType?.(step);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text]);

  useEffect(() => {
    if (!streaming && shown >= text.length && !doneRef.current) {
      doneRef.current = true;
      callbacks.current.onDone?.();
    }
  }, [streaming, shown, text.length]);

  const typing = streaming || shown < text.length;
  const tailStart = Math.max(0, shown - FADING_TAIL);
  return (
    <>
      {render(text.slice(0, tailStart))}
      {Array.from(text.slice(tailStart, shown), (ch, i) => (
        <span key={tailStart + i} className="ai-char">{ch}</span>
      ))}
      {typing && <span className="ai-caret" aria-hidden="true" />}
    </>
  );
}
