import { Suspense, lazy, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { PhoneOff } from "lucide-react";
import OrbVisual, { type AssistantState } from "./OrbVisual";
import useOrbWobble from "./useOrbWobble";
import { getSpeechRecognitionCtor, getSpeechSynthesis, type SpeechRecognitionLike } from "./speechRecognition";

const AssistantOrb = lazy(() => import("./AssistantOrb"));

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const HISTORY_TURNS = 10;

// The big centered orb for the call screen -- same wobble hook as the small widget orb (see ChatWidget's `Orb`),
// just bigger and with more amplitude so it reads clearly from across the room, not just up close.
function CallOrb({ state, size, energy, reduceMotion }: { state: AssistantState; size: number; energy: MutableRefObject<number>; reduceMotion: boolean }) {
  const wobbleRef = useOrbWobble(energy, state, size, reduceMotion, 1.7);
  return (
    <div ref={wobbleRef} style={{ display: "inline-flex" }}>
      <Suspense fallback={<OrbVisual size={size} />}>
        <AssistantOrb state={state} size={size} />
      </Suspense>
    </div>
  );
}

// Breaks a growing answer into speakable chunks as soon as a sentence (or a long clause) completes, instead of
// waiting for the whole reply -- this is how the caption on screen and the spoken voice stay in step: each chunk
// is queued for speech the moment it's final, while later text keeps streaming in and appending visibly above it.
function nextChunk(buffer: string, from: number, final: boolean): { chunk: string; upTo: number } | null {
  const rest = buffer.slice(from);
  if (!rest) return null;
  const sentenceEnd = rest.search(/[.!?](\s|$)/);
  if (sentenceEnd !== -1) {
    const upTo = from + sentenceEnd + 1;
    return { chunk: buffer.slice(from, upTo).trim(), upTo };
  }
  if (!final && rest.length > 160) {
    // No sentence end yet but it's getting long -- split on the last space so speech doesn't fall too far behind.
    const lastSpace = rest.lastIndexOf(" ", 160);
    const splitAt = lastSpace > 20 ? lastSpace : rest.length;
    const upTo = from + splitAt;
    return { chunk: buffer.slice(from, upTo).trim(), upTo };
  }
  if (final) return { chunk: rest.trim(), upTo: buffer.length };
  return null;
}

interface VoiceCallOverlayProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  // Fires once a full spoken exchange (what the visitor said, what the assistant said back) is complete, so the
  // parent can fold it into the same conversation history the text chat uses -- one transcript either way.
  onExchange: (userText: string, assistantText: string) => void;
  reduceMotion: boolean;
}

export default function VoiceCallOverlay({ open, onClose, messages, onExchange, reduceMotion }: VoiceCallOverlayProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<AssistantState>("idle");
  const [caption, setCaption] = useState("");
  const [youSaid, setYouSaid] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const energy = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const activeRef = useRef(false); // true while the overlay is mounted & live, false once closing -- guards async callbacks
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const synth = getSpeechSynthesis();

  const stopAll = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    synth?.cancel();
    speechQueueRef.current = [];
    speakingRef.current = false;
    energy.current = 0;
  }, [synth]);

  const speakNext = useCallback(() => {
    if (!synth || speakingRef.current) return;
    const chunk = speechQueueRef.current.shift();
    if (!chunk) {
      // Nothing left queued right now -- state settles back from "speaking" once onReplyDone also agrees we're done.
      return;
    }
    speakingRef.current = true;
    const utter = new SpeechSynthesisUtterance(chunk);
    utter.rate = 1.02;
    utter.onboundary = () => {
      energy.current = Math.min(1.4, energy.current + 0.35);
    };
    utter.onend = () => {
      speakingRef.current = false;
      if (!activeRef.current) return;
      if (speechQueueRef.current.length > 0) {
        speakNext();
      }
    };
    utter.onerror = () => {
      speakingRef.current = false;
    };
    synth.speak(utter);
  }, [synth]);

  const queueSpeech = useCallback(
    (chunk: string) => {
      if (!chunk) return;
      speechQueueRef.current.push(chunk);
      speakNext();
    },
    [speakNext],
  );

  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setUnsupported(true);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    let finalText = "";
    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0]?.transcript ?? "";
        else interim += r[0]?.transcript ?? "";
      }
      setYouSaid((finalText + interim).trim());
      energy.current = Math.min(1.2, energy.current + 0.3);
    };
    recognition.onerror = (e: any) => {
      if (e?.error === "no-speech" || e?.error === "aborted") return;
      setErrorMsg(t("assistant.call_mic_error", "I couldn't hear you there -- check the microphone permission and try again."));
    };
    recognition.onend = () => {
      if (!activeRef.current) return;
      const said = finalText.trim();
      if (said) {
        void handleTurn(said);
      } else {
        // Silence timed out -- just keep listening rather than ending the call.
        startListening();
      }
    };
    recognitionRef.current = recognition;
    setState("listening");
    setYouSaid("");
    setCaption("");
    recognition.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleTurn = useCallback(
    async (said: string) => {
      recognitionRef.current = null;
      setState("thinking");
      const history = messagesRef.current.slice(-HISTORY_TURNS);
      while (history.length && history[0].role !== "user") history.shift();
      const controller = new AbortController();
      abortRef.current = controller;
      let answer = "";
      let spokenUpTo = 0;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: said, history }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || t("assistant.error", "Something went wrong. Please try again, or use the contact form at /contact."));
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let failed = "";
        let spoke = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const line = event.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta" && typeof data.text === "string") {
              answer += data.text;
              if (!activeRef.current) continue;
              if (!spoke) {
                spoke = true;
                setState("speaking");
              }
              setCaption(answer);
              for (;;) {
                const next = nextChunk(answer, spokenUpTo, false);
                if (!next) break;
                spokenUpTo = next.upTo;
                queueSpeech(next.chunk);
              }
            } else if (data.type === "error") {
              failed = data.message;
            }
          }
        }
        if (failed && !answer) throw new Error(failed);
        if (!answer) throw new Error(t("assistant.error", "Something went wrong. Please try again, or use the contact form at /contact."));
        const tail = nextChunk(answer, spokenUpTo, true);
        if (tail) queueSpeech(tail.chunk);
        if (!activeRef.current) return;
        onExchange(said, answer);
        // Wait for the speech queue to actually finish before listening again, so the call doesn't talk over itself.
        const waitForSpeechDone = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              if (!activeRef.current) return resolve();
              if (!speakingRef.current && speechQueueRef.current.length === 0) resolve();
              else setTimeout(check, 120);
            };
            check();
          });
        await waitForSpeechDone();
        if (!activeRef.current) return;
        startListening();
      } catch (err: any) {
        if (controller.signal.aborted) return;
        if (!activeRef.current) return;
        setErrorMsg(err?.message || t("assistant.error", "Something went wrong. Please try again, or use the contact form at /contact."));
        setState("idle");
        setTimeout(() => {
          if (activeRef.current) startListening();
        }, 2500);
      } finally {
        abortRef.current = null;
      }
    },
    [onExchange, queueSpeech, startListening, t],
  );

  useEffect(() => {
    if (!open) return;
    activeRef.current = true;
    setErrorMsg("");
    setUnsupported(false);
    setState("idle");
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !getSpeechSynthesis()) {
      setUnsupported(true);
      return;
    }
    // A short beat for the grow-from-small-orb entrance to land before the mic opens.
    const timer = setTimeout(() => startListening(), 500);
    return () => {
      clearTimeout(timer);
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    stopAll();
    onClose();
  };

  const transition: Transition = reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 };

  const stateLabel: Record<AssistantState, string> = {
    idle: t("assistant.state_ready", "Ready"),
    listening: t("assistant.state_listening", "Listening"),
    thinking: t("assistant.state_thinking", "Thinking"),
    speaking: t("assistant.state_speaking", "Speaking"),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="voice-call"
          role="dialog"
          aria-modal="true"
          aria-label={t("assistant.call_title", "Voice call with the portfolio assistant")}
          data-state={state}
          className="ai-assistant fixed inset-0 z-[60] flex flex-col items-center justify-between bg-black/90 backdrop-blur-xl px-6 py-10 sm:py-16"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
          transition={transition}
          style={{ transformOrigin: "bottom right" }}
        >
          <div className="w-full flex items-center justify-center font-mono text-xs text-gray-400 tracking-wide uppercase">
            {stateLabel[state]}
          </div>

          <div className="flex-1 flex items-center justify-center">
            <CallOrb state={state} size={Math.min(260, typeof window !== "undefined" ? window.innerWidth * 0.55 : 220)} energy={energy} reduceMotion={reduceMotion} />
          </div>

          <div className="w-full max-w-lg flex flex-col items-center gap-4 text-center">
            {unsupported ? (
              <p className="text-sm text-gray-300">
                {t(
                  "assistant.call_unsupported",
                  "Voice calls need a browser with built-in speech recognition (Chrome, Edge or Safari). Yours doesn't seem to have it.",
                )}
              </p>
            ) : (
              <>
                {youSaid && state !== "speaking" && (
                  <p className="text-sm text-gray-400 italic">&ldquo;{youSaid}&rdquo;</p>
                )}
                {caption && (
                  <p className="text-base sm:text-lg text-white leading-relaxed whitespace-pre-wrap">{caption}</p>
                )}
                {errorMsg && <p role="alert" className="text-xs text-red-300">{errorMsg}</p>}
              </>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label={t("assistant.end_call", "End the call")}
              className="interactive mt-4 inline-flex items-center gap-2 rounded-full bg-red-500 hover:bg-red-600 text-white px-5 py-3 text-sm font-medium transition-colors"
            >
              <PhoneOff size={16} aria-hidden="true" />
              {t("assistant.end_call", "End call")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
