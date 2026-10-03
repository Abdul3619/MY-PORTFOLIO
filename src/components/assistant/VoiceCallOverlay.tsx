import { Suspense, lazy, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { PhoneOff, MessageSquareText, X } from "lucide-react";
import OrbVisual, { type AssistantState } from "./OrbVisual";
import useOrbWobble from "./useOrbWobble";
import Waveform from "./Waveform";
import { startMicCapture, createPcmPlayer, type MicCapture, type PcmPlayer } from "./liveAudio";
import { fetchVoiceSession, runVoiceTool, connectLiveVoice, type LiveVoiceHandle, type VoiceSessionInfo } from "./liveVoiceClient";

const AssistantOrb = lazy(() => import("./AssistantOrb"));

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// How long the orb waits after the visitor last said something, with no reply started yet, before it shows
// "thinking" instead of "listening". This is purely cosmetic -- Gemini Live's own server-side VAD independently
// decides when a turn is actually over (see liveVoiceClient's silenceDurationMs, the real turn-detection knob);
// the API gives no separate "I've decided you're done talking, now generating" event to key this off of, so this
// is a guess timed just past that VAD window, long enough that an ordinary mid-sentence breath doesn't flicker
// into "thinking" and back.
const THINKING_GUESS_MS = 800;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const MAX_RECONNECT_ATTEMPTS = 6;
// How long before a connection's forced close (see onGoAway) to proactively reconnect, so the visitor ideally
// never notices the handover.
const GOAWAY_LEAD_MS = 4000;

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
  const [showTranscript, setShowTranscript] = useState(false);
  const energy = useRef(0);

  const activeRef = useRef(false); // true while the overlay is mounted & live, false once closing -- guards async callbacks
  const stateRef = useRef<AssistantState>("idle");
  stateRef.current = state;

  const micRef = useRef<MicCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  // Swapped out on every reconnect, but the mic itself is never stopped/restarted for that -- audio chunks just
  // get routed to whichever connection is current (or silently dropped for the brief gap while reconnecting).
  // That's deliberate: a socket reconnect is a transport detail, not a reason to blink the mic off.
  const liveRef = useRef<LiveVoiceHandle | null>(null);
  const resumeHandleRef = useRef<string | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goAwayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What's been said/replied so far in the current turn -- reset once a turn is finalized (see finalizeTurn).
  // Unlike the old build, there's no client-side turn-boundary logic here at all: Gemini's own VAD decides when
  // the visitor is done, this just reflects whatever it reports.
  const turnInputRef = useRef("");
  const turnOutputRef = useRef("");
  const turnCompleteRef = useRef(false);

  const clearThinkingTimer = useCallback(() => {
    if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
    thinkingTimerRef.current = null;
  }, []);

  const armThinkingTimer = useCallback(() => {
    clearThinkingTimer();
    thinkingTimerRef.current = setTimeout(() => {
      if (activeRef.current && stateRef.current === "listening") setState("thinking");
    }, THINKING_GUESS_MS);
  }, [clearThinkingTimer]);

  const finalizeTurn = useCallback(() => {
    const said = turnInputRef.current.trim();
    const answer = turnOutputRef.current.trim();
    turnInputRef.current = "";
    turnOutputRef.current = "";
    turnCompleteRef.current = false;
    setYouSaid("");
    setCaption("");
    if (said) onExchange(said, answer);
    if (activeRef.current) setState("listening");
  }, [onExchange]);

  const stopEngine = useCallback(() => {
    if (goAwayTimerRef.current) clearTimeout(goAwayTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    clearThinkingTimer();
    goAwayTimerRef.current = null;
    reconnectTimerRef.current = null;
    liveRef.current?.close();
    liveRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    energy.current = 0;
  }, [clearThinkingTimer]);

  // Opens one Live connection (fresh, or resuming via resumeHandleRef) and wires every server event to the state
  // above. Called once on mount, and again -- with the same mic/player, just a new socket -- whenever the
  // connection drops or Google asks for a handover (see onGoAway/onClose below).
  const connect = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      const session: VoiceSessionInfo = await fetchVoiceSession();
      if (!activeRef.current) return;
      const handle = await connectLiveVoice(session, resumeHandleRef.current, {
        onOutputAudioChunk: (b64) => {
          clearThinkingTimer();
          if (stateRef.current !== "speaking") setState("speaking");
          playerRef.current?.enqueue(b64);
        },
        onInputTranscript: (delta) => {
          turnInputRef.current += delta;
          setYouSaid(turnInputRef.current);
          if (stateRef.current !== "speaking") {
            setState("listening");
            armThinkingTimer();
          }
        },
        onOutputTranscript: (delta) => {
          clearThinkingTimer();
          turnOutputRef.current += delta;
          setCaption(turnOutputRef.current);
          if (stateRef.current !== "speaking") setState("speaking");
        },
        onInterrupted: () => {
          // Barge-in: the visitor started talking while the assistant was still speaking. Stop the audio that's
          // already queued/playing immediately -- waiting for it to finish would defeat the entire point.
          playerRef.current?.clear();
          clearThinkingTimer();
          if (turnInputRef.current.trim() || turnOutputRef.current.trim()) {
            // Keep whatever the assistant had actually said before being cut off in the visible history, rather
            // than silently dropping a real (if truncated) reply.
            onExchange(turnInputRef.current.trim(), turnOutputRef.current.trim() || "(interrupted)");
          }
          turnInputRef.current = "";
          turnOutputRef.current = "";
          setYouSaid("");
          setCaption("");
          if (activeRef.current) setState("listening");
        },
        onTurnComplete: () => {
          turnCompleteRef.current = true;
          if (!playerRef.current?.isPlaying()) finalizeTurn();
          // else: wait for the player to drain (onDrained below) so playback and the UI settle together.
        },
        onToolCall: (calls) => {
          for (const call of calls) {
            runVoiceTool(call.name, call.args).then((result) => {
              liveRef.current?.sendToolResponse(call.id, call.name, result);
            });
          }
        },
        onToolCallCancelled: () => {
          /* Nothing queued client-side depends on a specific pending call id, so there's nothing to undo here --
             the server already knows not to expect those responses. */
        },
        onGoAway: (timeLeftMs) => {
          if (goAwayTimerRef.current) clearTimeout(goAwayTimerRef.current);
          const delay = Math.max(0, timeLeftMs - GOAWAY_LEAD_MS);
          goAwayTimerRef.current = setTimeout(() => {
            if (activeRef.current) void connect();
          }, delay);
        },
        onSessionHandle: (h) => {
          resumeHandleRef.current = h;
        },
        onClose: () => {
          liveRef.current = null;
          if (!activeRef.current) return;
          scheduleReconnect();
        },
        onError: () => {
          // onclose always follows onerror for a WebSocket, so the actual reconnect decision happens there --
          // this just means a connection problem is likely imminent, nothing to do yet.
        },
      });
      if (!activeRef.current) {
        handle.close();
        return;
      }
      liveRef.current = handle;
      reconnectAttemptsRef.current = 0;
      setErrorMsg("");
      setState("listening");
    } catch (err: any) {
      if (!activeRef.current) return;
      scheduleReconnect(err?.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armThinkingTimer, clearThinkingTimer, finalizeTurn, onExchange]);

  const connectRef = useRef(connect);
  connectRef.current = connect;

  const scheduleReconnect = useCallback((reason?: string) => {
    if (!activeRef.current) return;
    reconnectAttemptsRef.current += 1;
    if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
      setErrorMsg(t("assistant.call_connection_lost", "Lost the voice connection and couldn't get it back. Please end the call and try again."));
      return;
    }
    setState("reconnecting");
    if (reason) setErrorMsg(t("assistant.call_reconnecting", "Connection hiccup -- reconnecting..."));
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** (reconnectAttemptsRef.current - 1));
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (activeRef.current) void connectRef.current();
    }, delay);
  }, [t]);

  useEffect(() => {
    if (!open) return;
    activeRef.current = true;
    setErrorMsg("");
    setUnsupported(false);
    setState("idle");
    setYouSaid("");
    setCaption("");
    setShowTranscript(false);
    turnInputRef.current = "";
    turnOutputRef.current = "";
    reconnectAttemptsRef.current = 0;
    resumeHandleRef.current = undefined;

    const CtorOk = typeof window !== "undefined" && "WebSocket" in window && !!(window.AudioContext || (window as any).webkitAudioContext) && !!navigator.mediaDevices?.getUserMedia;
    if (!CtorOk) {
      setUnsupported(true);
      return;
    }

    let cancelled = false;
    playerRef.current = createPcmPlayer(
      (level) => {
        energy.current = Math.min(1.4, energy.current + level * 2.2);
      },
      () => {
        if (turnCompleteRef.current) finalizeTurn();
      },
    );

    // A short beat for the grow-from-small-orb entrance to land before the mic opens.
    const timer = setTimeout(async () => {
      try {
        const mic = await startMicCapture((base64Pcm, level) => {
          energy.current = Math.min(1.2, energy.current + level * 3);
          liveRef.current?.sendAudioChunk(base64Pcm);
        });
        if (cancelled || !activeRef.current) {
          mic.stop();
          return;
        }
        micRef.current = mic;
        await connectRef.current();
      } catch (err: any) {
        if (!activeRef.current) return;
        if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
          setErrorMsg(t("assistant.call_mic_denied", "The microphone permission looks blocked for this site -- check your browser's site settings and try again."));
        } else if (err?.name === "NotFoundError") {
          setErrorMsg(t("assistant.call_mic_error", "No microphone was found. Check that one is connected, then try again."));
        } else {
          setUnsupported(true);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      activeRef.current = false;
      stopEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    activeRef.current = false;
    stopEngine();
    onClose();
  };

  const transition: Transition = reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 };

  const stateLabel: Record<AssistantState, string> = {
    idle: t("assistant.state_ready", "Ready"),
    listening: t("assistant.state_listening", "Listening"),
    thinking: t("assistant.state_thinking", "Thinking"),
    speaking: t("assistant.state_speaking", "Speaking"),
    reconnecting: t("assistant.state_reconnecting", "Reconnecting..."),
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

          <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
            <CallOrb state={state} size={Math.min(260, typeof window !== "undefined" ? window.innerWidth * 0.55 : 220)} energy={energy} reduceMotion={reduceMotion} />
            {!unsupported && (
              <div className="h-10 w-full max-w-xs">
                <Waveform state={state} energy={energy} bars={48} active={open} reduceMotion={reduceMotion} />
              </div>
            )}
          </div>

          <div className="w-full max-w-lg flex flex-col items-center gap-4 text-center">
            {unsupported ? (
              <p className="text-sm text-gray-300">
                {t(
                  "assistant.call_unsupported",
                  "Voice calls need a modern browser with microphone and WebSocket support (Chrome, Edge or Safari). Yours doesn't seem to support it.",
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
            <div className="mt-4 flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  aria-label={t("assistant.call_transcript", "Conversation transcript")}
                  aria-pressed={showTranscript}
                  className="interactive inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 text-white px-4 py-3 text-sm font-medium transition-colors"
                >
                  <MessageSquareText size={16} aria-hidden="true" />
                  {t("assistant.call_transcript", "Transcript")}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                aria-label={t("assistant.end_call", "End the call")}
                className="interactive inline-flex items-center gap-2 rounded-full bg-red-500 hover:bg-red-600 text-white px-5 py-3 text-sm font-medium transition-colors"
              >
                <PhoneOff size={16} aria-hidden="true" />
                {t("assistant.end_call", "End call")}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showTranscript && (
              <motion.div
                key="call-transcript"
                role="region"
                aria-label={t("assistant.call_transcript", "Conversation transcript")}
                className="absolute inset-x-0 bottom-0 z-10 max-h-[60vh] rounded-t-3xl border-t border-white/10 bg-black/95 backdrop-blur-xl px-5 pt-4 pb-6 flex flex-col"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
                transition={transition}
              >
                <div className="flex items-center justify-between pb-3">
                  <span className="text-xs font-mono uppercase tracking-wide text-gray-400">
                    {t("assistant.call_transcript", "Transcript")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTranscript(false)}
                    aria-label={t("assistant.close", "Close")}
                    className="interactive p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="overflow-y-auto flex flex-col gap-3 text-sm">
                  {messages.map((m, i) => (
                    <p key={i} className={m.role === "user" ? "text-gray-300" : "text-white"}>
                      <span className="font-medium text-gray-500">
                        {m.role === "user" ? t("assistant.you", "You") : t("assistant.name", "Assistant")}:{" "}
                      </span>
                      {m.content}
                    </p>
                  ))}
                  {youSaid && (
                    <p className="text-gray-300 italic">
                      <span className="font-medium text-gray-500">{t("assistant.you", "You")}: </span>
                      {youSaid}
                    </p>
                  )}
                  {caption && (
                    <p className="text-white">
                      <span className="font-medium text-gray-500">{t("assistant.name", "Assistant")}: </span>
                      {caption}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
