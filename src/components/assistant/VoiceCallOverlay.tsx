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
  // Accumulates everything finalized across however many recognition instances a single "turn" spans -- the
  // browser's own engine stops and restarts on its own well before the visitor is actually done talking, so a
  // turn is only considered over when nothing NEW has come in for a while (see silenceTimerRef), never just
  // because one instance happened to end.
  const finalTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set right before we deliberately stop a recognition instance ourselves (to finalize the turn), so its onend
  // handler knows not to treat that as "the engine gave up, restart it" and start listening all over again.
  const finalizingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const errorCooldownRef = useRef(false); // true once a non-transient mic error (permission denied) has fired
  // finalizeTurn is defined before handleTurn/startListening (it's used by beginRecognitionInstance, which has to
  // exist before startListening can call it) but needs to invoke both -- routed through refs, always reassigned
  // to this render's versions below, so it never calls a stale closure from an earlier render.
  const handleTurnRef = useRef<(said: string) => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});

  const synth = getSpeechSynthesis();

  // Earlier version of this also opened a second, independent getUserMedia stream (through an AnalyserNode) just
  // to measure real mic loudness for the orb. That's what started throwing "audio-capture"/mic errors even with
  // the permission already granted: SpeechRecognition manages its own exclusive microphone capture internally
  // (the Web Speech API has no way to hand it an existing MediaStreamTrack -- see w3c/speech-api#66), and on a
  // lot of setups a second app/stream trying to open the same device at once makes the OS hand back "busy"
  // instead of sharing it. So the orb's listening energy is driven purely by recognition events (below) and
  // eased/smoothed in useOrbWobble -- less literally tied to loudness, but it doesn't fight the mic for it.
  const stopAll = useCallback(() => {
    activeRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    finalizingRef.current = false;
    consecutiveErrorsRef.current = 0;
    errorCooldownRef.current = false;
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

  // Called once nothing new has come in for a while (see SILENCE_MS below) -- this, not the recognition engine's
  // own onend, is what decides the visitor is actually done talking. That's deliberate: Chrome/Safari's engine
  // stops on its own after every short breath even with continuous=true, which is what was cutting people off
  // mid-sentence. A beginRecognitionInstance() ending on its own just gets silently restarted (see onend below)
  // and never finalizes anything by itself.
  const finalizeTurn = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    const said = finalTranscriptRef.current.trim();
    finalizingRef.current = true;
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    finalTranscriptRef.current = "";
    if (said) {
      handleTurnRef.current(said);
    } else {
      startListeningRef.current();
    }
  }, []);

  // How long to wait after the visitor goes quiet before treating the turn as finished. Real-time voice assistants
  // (OpenAI's Realtime API, for one) default this around 500-800ms when they're listening to a raw, continuous
  // audio stream -- but that number only works because they're measuring actual silence in the audio itself. The
  // browser's own speech engine instead gives us discrete recognized phrases with gaps between them that don't
  // mean much (thinking pauses, a breath, the engine just being slow), so a much longer window is the safer
  // trade-off here: a few seconds feels slower to respond, but a short one is what was finishing your sentence
  // for you. 3s given it was still cutting in at 2s.
  const SILENCE_MS = 3000;

  const beginRecognitionInstance = useCallback(() => {
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
    recognition.onresult = (e: any) => {
      // Only walk the results that are NEW in this event (from e.resultIndex onward) -- re-summing from 0 every
      // time, like an earlier version of this did, re-appends every already-finalized phrase on every single
      // event and is why "hello" once came out repeated a dozen times with the vowel stretched further each time.
      let interim = "";
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const r = e.results[i];
        const transcript = r[0]?.transcript ?? "";
        if (r.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
        } else {
          interim += transcript;
        }
      }
      setYouSaid(`${finalTranscriptRef.current} ${interim}`.trim());
      consecutiveErrorsRef.current = 0;
      errorCooldownRef.current = false;
      setErrorMsg("");
      energy.current = Math.min(1.2, energy.current + 0.2);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(finalizeTurn, SILENCE_MS);
    };
    recognition.onerror = (e: any) => {
      const code = e?.error;
      if (code === "no-speech" || code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        // Permission was actually denied/blocked -- this one isn't transient, don't keep hammering the API.
        errorCooldownRef.current = true;
        setErrorMsg(t("assistant.call_mic_denied", "The microphone permission looks blocked for this site -- check your browser's site settings and try again."));
        return;
      }
      // "audio-capture" (device busy/unavailable) and anything else transient: these can happen for a moment even
      // with permission already granted, so don't scare the visitor on the first one -- only speak up if several
      // happen back to back, and keep retrying underneath either way.
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= 3) {
        setErrorMsg(t("assistant.call_mic_error", "I'm having trouble reaching the microphone right now -- check that another app or tab isn't using it, then try again."));
      }
    };
    recognition.onend = () => {
      if (finalizingRef.current) {
        finalizingRef.current = false;
        return;
      }
      if (!activeRef.current || errorCooldownRef.current) return;
      // The engine stopped on its own (a short pause, or just its own internal time limit) -- the visitor hasn't
      // necessarily finished, so pick a fresh instance back up immediately rather than treating this as the end
      // of the turn. Whatever's already in finalTranscriptRef carries over untouched.
      beginRecognitionInstance();
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [finalizeTurn, t]);

  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    finalTranscriptRef.current = "";
    consecutiveErrorsRef.current = 0;
    setState("listening");
    setYouSaid("");
    setCaption("");
    beginRecognitionInstance();
  }, [beginRecognitionInstance]);

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

  handleTurnRef.current = handleTurn;
  startListeningRef.current = startListening;

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
    const timer = setTimeout(() => startListeningRef.current(), 500);
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
