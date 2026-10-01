import { Fragment, Suspense, lazy, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, X } from "lucide-react";
import type { AssistantState } from "./AssistantOrb";

// orb-ui touches window/matchMedia, so it is loaded only in the browser, after the widget mounts.
const AssistantOrb = lazy(() => import("./AssistantOrb"));

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "portfolio-assistant-chat";
const MAX_INPUT = 1000;
const HISTORY_TURNS = 10;

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string") : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
  } catch {
    // Storage unavailable (private mode): the conversation just won't survive a reload
  }
}

// Plain text with clickable links: full URLs open in a new tab, site paths like /contact use the router.
// Built from React elements, never HTML, so model output can't inject markup.
const LINK_PATTERN = /(https?:\/\/[^\s<>"]+|(?<![\w/])\/(?:contact|projects|about|skills|resume|certificates|testimonials|solar-estimator)(?:\/[\w-]+)?)/g;

function renderWithLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    let link = match[0];
    const trailing = link.match(/[.,;:!?)]+$/)?.[0] ?? "";
    link = link.slice(0, link.length - trailing.length);
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const className = "text-gold underline underline-offset-2 hover:text-white transition-colors interactive";
    parts.push(
      link.startsWith("/") ? (
        <Link key={start} to={link} className={className}>{link}</Link>
      ) : (
        <a key={start} href={link} target="_blank" rel="noopener noreferrer" className={className}>{link.replace(/^https?:\/\//, "")}</a>
      ),
    );
    if (trailing) parts.push(trailing);
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function OrbSlot({ state, size }: { state: AssistantState; size: number }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <Suspense fallback={<span className="block rounded-full bg-bronze/60" style={{ width: size * 0.6, height: size * 0.6 }} />}>
        <AssistantOrb state={state} size={size} />
      </Suspense>
    </span>
  );
}

export default function ChatWidget() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<AssistantState>("idle");
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = state !== "idle";

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    setMounted(true);
    setMessages(loadMessages());
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // Escape closes the panel wherever focus is (a clicked suggestion disappears and focus falls back to the page)
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, state, open]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setError("");
    setInput("");
    inputRef.current?.focus();
    const history = messages.slice(-HISTORY_TURNS);
    // The server expects history to start with a visitor message
    while (history.length && history[0].role !== "user") history.shift();
    const next: ChatMessage[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    saveMessages(next);
    setState("thinking");

    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";
    const update = (content: string) => {
      setMessages([...next, { role: "assistant", content }]);
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
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
            setState("speaking");
            update(answer);
          } else if (data.type === "error") {
            failed = data.message;
          }
        }
      }
      if (failed && !answer) throw new Error(failed);
      if (!answer) throw new Error(t("assistant.error", "Something went wrong. Please try again, or use the contact form at /contact."));
      saveMessages([...next, { role: "assistant", content: answer }]);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      // Keep the visitor's question so the conversation still alternates, and show the problem below it
      setMessages(next.slice(0, -1));
      saveMessages(next.slice(0, -1));
      setInput(message);
      setError(err?.message || t("assistant.error", "Something went wrong. Please try again, or use the contact form at /contact."));
    } finally {
      abortRef.current = null;
      setState("idle");
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
    saveMessages([]);
    setError("");
    inputRef.current?.focus();
  };

  if (!mounted) return null;

  const suggestions = [
    t("assistant.suggest_build", "What kind of websites does he build?"),
    t("assistant.suggest_booking", "Show me a booking system demo"),
    t("assistant.suggest_pricing", "How does pricing work?"),
  ];

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-modal="false"
            aria-labelledby="assistant-title"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-bg-darker/95 backdrop-blur-xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-2xl w-[calc(100vw-2rem)] sm:w-[380px] h-[min(560px,calc(100dvh-7rem))] flex flex-col overflow-hidden origin-bottom-right"
          >
            <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <OrbSlot state={state} size={36} />
              <div className="flex-1 min-w-0">
                <h2 id="assistant-title" className="font-display text-white text-sm font-semibold truncate">
                  {t("assistant.title", "Portfolio assistant")}
                </h2>
                <p className="font-mono text-[11px] text-gray-500 truncate" aria-live="polite">
                  {state === "thinking"
                    ? t("assistant.thinking", "Thinking...")
                    : state === "speaking"
                      ? t("assistant.answering", "Answering...")
                      : t("assistant.subtitle", "AI · answers from public info only")}
                </p>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={clear} className="interactive font-mono text-[11px] text-gray-400 hover:text-gold transition-colors px-2 py-1">
                  {t("assistant.clear", "Clear")}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                aria-label={t("common.close", "Close")}
                className="interactive p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div ref={listRef} data-lenis-prevent role="log" aria-busy={busy} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {t("assistant.intro", "Hi. I can answer questions about Abdulwahab's projects, skills and how he works. What are you looking to build?")}
                  </p>
                  <div className="flex flex-col items-start gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="interactive text-left text-xs text-gray-300 border border-white/10 hover:border-gold/50 hover:text-white rounded-full px-3 py-1.5 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-gold/10 border border-gold/20 text-gray-100 whitespace-pre-wrap break-words"
                        : "max-w-[90%] rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-gray-200 leading-relaxed whitespace-pre-wrap break-words"
                    }
                  >
                    {m.role === "assistant" ? <Fragment>{renderWithLinks(m.content)}</Fragment> : m.content}
                  </div>
                </div>
              ))}
              {state === "thinking" && (
                <div className="flex justify-start" aria-hidden="true">
                  <div className="rounded-xl px-4 py-3 bg-white/5 border border-white/10 flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className={`w-1.5 h-1.5 rounded-full bg-gray-400 ${reduceMotion ? "" : "animate-pulse"}`} style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <p role="alert" className="text-xs text-red-300 border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-2.5">
                  {renderWithLinks(error)}
                </p>
              )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
                <label htmlFor="assistant-input" className="sr-only">{t("assistant.label", "Your question")}</label>
                <textarea
                  id="assistant-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={MAX_INPUT}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t("assistant.placeholder", "Ask a question...")}
                  className="flex-1 resize-none max-h-28 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label={t("assistant.send", "Send")}
                  className="interactive glass-button bg-gold text-black rounded-lg h-[46px] w-[46px] flex items-center justify-center shrink-0 disabled:opacity-50"
                >
                  <ArrowUp size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 font-mono text-[10px] text-gray-500 text-center">
                {t("assistant.disclaimer", "AI answers can be wrong. For anything important, use the contact form.")}
              </p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? t("assistant.close", "Close the assistant") : t("assistant.open", "Ask the AI assistant about Abdulwahab's work")}
        className="interactive glass-panel rounded-full p-1.5 pr-4 flex items-center gap-2 hover:border-gold/50 transition-colors"
      >
        <OrbSlot state={state} size={40} />
        <span className="font-display text-sm text-gray-200">{open ? t("common.close", "Close") : t("assistant.launcher", "Ask AI")}</span>
      </button>
    </div>
  );
}
