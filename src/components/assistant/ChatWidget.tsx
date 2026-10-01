import { Suspense, lazy, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import OrbVisual, { type AssistantState } from "./OrbVisual";
import TypedText from "./TypedText";
import Waveform from "./Waveform";
import "./assistant.css";
import { getActiveSection, subscribeActiveSection } from "../../lib/activeSection";

// orb-ui touches window/matchMedia, so it loads in the browser only; until then the same CSS orb renders directly.
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

interface Suggestion {
  key: string;
  label: string;
  prompt: string;
}

// One relevant, tappable suggestion per page, never pushed automatically. Keyed by the start of the path, most
// specific first. `prompt` is what actually gets sent; `label` is the short pitch shown on the chip.
const PAGE_SUGGESTIONS: { match: (path: string) => boolean; build: () => Omit<Suggestion, "key"> }[] = [
  {
    match: (p) => p.startsWith("/testimonials"),
    build: () => ({
      label: "Want to know more about one of these projects?",
      prompt: "Can you tell me more about one of these client projects?",
    }),
  },
  {
    match: (p) => /^\/projects\/[^/]+/.test(p),
    build: () => {
      const title = document.querySelector("h1")?.textContent?.trim();
      return {
        label: title ? `Want to know more about ${title}?` : "Want to know more about this project?",
        prompt: title ? `Tell me more about the ${title} project.` : "Tell me more about this project.",
      };
    },
  },
  {
    match: (p) => p.startsWith("/projects"),
    build: () => ({
      label: "Looking for something specific? I can point you to the closest demo.",
      prompt: "Which of these projects is closest to what I need?",
    }),
  },
  {
    match: (p) => p.startsWith("/solar-estimator"),
    build: () => ({
      label: "Have a solar or off-grid power question?",
      prompt: "Can you help with a question about a solar or off-grid power system?",
    }),
  },
  {
    match: (p) => p.startsWith("/skills"),
    build: () => ({
      label: "Want to know if his stack fits your project?",
      prompt: "Does his tech stack fit the kind of project I have in mind?",
    }),
  },
  {
    match: (p) => p.startsWith("/certificates"),
    build: () => ({
      label: "Curious about his background and qualifications?",
      prompt: "What's Abdulwahab's background and qualifications?",
    }),
  },
  {
    match: (p) => p.startsWith("/resume"),
    build: () => ({
      label: "Want a quick summary of his experience?",
      prompt: "Can you summarize Abdulwahab's work experience?",
    }),
  },
  {
    match: (p) => p.startsWith("/contact"),
    build: () => ({
      label: "Not sure what to include in your message?",
      prompt: "What should I include when I reach out about a project?",
    }),
  },
  {
    match: (p) => p.startsWith("/about"),
    build: () => ({
      label: "Curious how he got into software?",
      prompt: "How did Abdulwahab get into software development?",
    }),
  },
];

// On the homepage, the route never changes as the visitor scrolls, so suggestions are keyed by which
// data-assistant-section is currently on screen (see src/components/SectionObserver.tsx) instead of the path.
// This is the "showroom guide" behaviour: the offer changes as the visitor moves from room to room.
const HOME_SECTION_SUGGESTIONS: Record<string, Omit<Suggestion, "key">> = {
  hero: { label: "Want a quick tour of what he builds?", prompt: "What kind of websites and apps does he build?" },
  about: { label: "Curious how he got into software?", prompt: "How did Abdulwahab get into software development?" },
  skills: { label: "Want to know if his stack fits your project?", prompt: "Does his tech stack fit the kind of project I have in mind?" },
  differentiators: { label: "Want to know what sets his work apart?", prompt: "What makes working with Abdulwahab different from other developers?" },
  projects: { label: "Looking for something specific? I can point you to the closest demo.", prompt: "Which of these projects is closest to what I need?" },
  certificates: { label: "Curious about his background and qualifications?", prompt: "What's Abdulwahab's background and qualifications?" },
  testimonials: { label: "Want to know more about one of these projects?", prompt: "Can you tell me more about one of these client projects?" },
  "resume-cta": { label: "Want a quick summary of his experience?", prompt: "Can you summarize Abdulwahab's work experience?" },
  "contact-cta": { label: "Not sure what to include in your message?", prompt: "What should I include when I reach out about a project?" },
};

// Resolves the one suggestion to offer right now, given the route and (on the homepage) the section in view.
function resolveSuggestion(path: string, section: string | null): Suggestion | null {
  if (path === "/") {
    if (section && HOME_SECTION_SUGGESTIONS[section]) {
      return { key: `/#${section}`, ...HOME_SECTION_SUGGESTIONS[section] };
    }
    return { key: "/#hero", ...HOME_SECTION_SUGGESTIONS.hero };
  }
  const match = PAGE_SUGGESTIONS.find((s) => s.match(path));
  return match ? { key: path, ...match.build() } : null;
}

const SUGGESTION_SEEN_KEY = "portfolio-assistant-suggestion-seen";

function suggestionSeenSet(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SUGGESTION_SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markSuggestionSeen(key: string) {
  try {
    const seen = suggestionSeenSet();
    seen.add(key);
    sessionStorage.setItem(SUGGESTION_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // ignore
  }
}

const INTERNAL_LABELS: Record<string, string> = {
  "/contact": "Open the contact form",
  "/projects": "Browse all projects",
  "/about": "Open About",
  "/skills": "Open Skills",
  "/resume": "Open the resume",
  "/certificates": "Open Certificates",
  "/testimonials": "Open Testimonials",
  "/solar-estimator": "Open the solar estimator",
};

interface ChatAction {
  href: string;
  label: string;
  internal: boolean;
}

// Pulls the links out of a finished assistant reply and turns them into one-tap "open this" buttons, so the
// guide can actually take the visitor there instead of just mentioning it in a sentence. Dedupes by target.
function extractActions(text: string): ChatAction[] {
  const seen = new Set<string>();
  const actions: ChatAction[] = [];
  for (const match of text.matchAll(LINK_PATTERN)) {
    const href = match[0].replace(/[.,;:!?)]+$/, "");
    if (seen.has(href)) continue;
    seen.add(href);
    if (href.startsWith("/")) {
      if (/^\/projects\/[^/]+/.test(href)) {
        actions.push({ href, label: "Open this project", internal: true });
      } else if (INTERNAL_LABELS[href]) {
        actions.push({ href, label: INTERNAL_LABELS[href], internal: true });
      }
    } else {
      try {
        const host = new URL(href).hostname.replace(/^www\./, "");
        actions.push({ href, label: `Open live demo (${host})`, internal: false });
      } catch {
        // malformed URL, skip rather than show a dead button
      }
    }
  }
  return actions.slice(0, 3);
}

function ChatActions({ content }: { content: string }) {
  const actions = extractActions(content);
  if (actions.length === 0) return null;
  return (
    <span className="mt-3 flex flex-wrap gap-2 not-italic">
      {actions.map((a) =>
        a.internal ? (
          <Link
            key={a.href}
            to={a.href}
            className="interactive inline-flex items-center gap-1 text-xs font-medium text-black bg-gold hover:bg-gold/90 rounded-full px-3 py-1.5 transition-colors"
          >
            {a.label} →
          </Link>
        ) : (
          <a
            key={a.href}
            href={a.href}
            target="_blank"
            rel="noopener noreferrer"
            className="interactive inline-flex items-center gap-1 text-xs font-medium text-black bg-gold hover:bg-gold/90 rounded-full px-3 py-1.5 transition-colors"
          >
            {a.label} →
          </a>
        ),
      )}
    </span>
  );
}

function Orb({ state, size }: { state: AssistantState; size: number }) {
  return (
    <Suspense fallback={<OrbVisual size={size} />}>
      <AssistantOrb state={state} size={size} />
    </Suspense>
  );
}

// Panel size for the compact and expanded views, kept inside the viewport
function panelSize(expanded: boolean) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = vw < 640;
  const width = mobile ? vw - 32 : Math.min(expanded ? 760 : 368, vw - 48);
  // Desktop: stay clear of the site's floating navbar at the top
  const height = Math.min(expanded ? 820 : 540, vh - (mobile ? 32 : 136));
  return { width, height };
}

type Phase = "idle" | "thinking" | "speaking";

export default function ChatWidget() {
  const { t } = useTranslation();
  const location = useLocation();
  const reduceMotion = useReducedMotion() ?? false;
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ width: 368, height: 540 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Index of the assistant message currently being typed out, and whether more of it is still streaming in
  const [live, setLive] = useState<{ index: number; streaming: boolean } | null>(null);
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [pageSuggestion, setPageSuggestion] = useState<Suggestion | null>(null);
  const [activeSection, setActiveSectionState] = useState<string | null>(() => getActiveSection());
  const [hasUnseenCue, setHasUnseenCue] = useState(false);
  const energy = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wasOpen = useRef(false);
  const busy = phase !== "idle";

  // What the orb, waveform and label show
  const state: AssistantState = phase !== "idle" ? phase : open && inputFocused && input.trim() ? "listening" : "idle";

  useEffect(() => {
    setMounted(true);
    setMessages(loadMessages());
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => setSize(panelSize(expanded));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted, expanded]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      inputRef.current?.focus();
      const onKey = (e: globalThis.KeyboardEvent) => {
        if (e.key === "Escape") close();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    // Back to the launcher when the panel closes
    if (wasOpen.current) requestAnimationFrame(() => launcherRef.current?.focus());
  }, [open, close]);

  const scrollToEnd = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(scrollToEnd, [messages, error, open, expanded, scrollToEnd]);

  // Track which part of the page the visitor is currently looking at (homepage only; other pages just use the
  // route). See src/lib/activeSection.ts and SectionObserver.tsx.
  useEffect(() => subscribeActiveSection(setActiveSectionState), []);

  // One contextual suggestion at a time, like a showroom guide noticing which part of the shop you're in. It
  // changes as the visitor scrolls the homepage or moves between pages, but each one is only ever offered once
  // per tab — tapped or not, it never repeats, and it never appears while a conversation is already underway.
  useEffect(() => {
    if (messages.length > 0) {
      setPageSuggestion(null);
      setHasUnseenCue(false);
      return;
    }
    const suggestion = resolveSuggestion(location.pathname, activeSection);
    if (!suggestion || suggestionSeenSet().has(suggestion.key)) {
      if (!open) setHasUnseenCue(false);
      return;
    }
    if (open) {
      setPageSuggestion(suggestion);
      markSuggestionSeen(suggestion.key);
      setHasUnseenCue(false);
    } else {
      // Widget is closed: just a quiet cue on the launcher (it "turns" toward the visitor) — never a popup.
      setHasUnseenCue(true);
    }
  }, [open, location.pathname, activeSection, messages.length]);

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
    setPhase("thinking");

    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";
    const fallbackError = t("assistant.error", "Something went wrong. Please try again, or use the contact form at /contact.");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || fallbackError);
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
            setMessages([...next, { role: "assistant", content: answer }]);
            setLive({ index: next.length, streaming: true });
          } else if (data.type === "error") {
            failed = data.message;
          }
        }
      }
      if (failed && !answer) throw new Error(failed);
      if (!answer) throw new Error(fallbackError);
      saveMessages([...next, { role: "assistant", content: answer }]);
      // The phase returns to idle once the typing catches up (TypedText onDone)
      setLive({ index: next.length, streaming: false });
    } catch (err: any) {
      if (controller.signal.aborted) return;
      // Drop the unanswered question so the conversation still alternates, and offer it back in the input
      setMessages(next.slice(0, -1));
      saveMessages(next.slice(0, -1));
      setLive(null);
      setInput(message);
      setError(err?.message || fallbackError);
      setPhase("idle");
    } finally {
      abortRef.current = null;
    }
  };

  const onTyped = useCallback((count: number) => {
    energy.current = Math.min(1.4, energy.current + count * 0.12);
    setPhase((p) => (p === "thinking" ? "speaking" : p));
    scrollToEnd();
  }, [scrollToEnd]);

  const onTypedDone = useCallback(() => {
    setLive(null);
    setPhase("idle");
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
      return;
    }
    // Keystrokes drive the waveform while listening
    energy.current = Math.min(1.2, energy.current + 0.35);
  };

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
    saveMessages([]);
    setLive(null);
    setPhase("idle");
    setError("");
    inputRef.current?.focus();
  };

  if (!mounted) return null;

  const stateLabel: Record<AssistantState, string> = {
    idle: t("assistant.state_ready", "Ready"),
    listening: t("assistant.state_listening", "Listening"),
    thinking: t("assistant.state_thinking", "Thinking"),
    speaking: t("assistant.state_speaking", "Speaking"),
  };
  const intro = t("assistant.intro", "Hi. I can answer questions about Abdulwahab's projects, skills and how he works. What are you looking to build?");
  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 320, damping: 32 };

  return (
    <div data-state={state} className="ai-assistant fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end">
      <AnimatePresence mode="popLayout">
        {open ? (
          <motion.section
            key="panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="assistant-title"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96, width: size.width, height: size.height }}
            animate={{ opacity: 1, y: 0, scale: 1, width: size.width, height: size.height }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
            transition={transition}
            style={{ transformOrigin: "bottom right" }}
            className="ai-panel bg-bg-darker/85 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.55)] rounded-3xl flex flex-col overflow-hidden"
          >
            <header className="px-4 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Orb state={state} size={expanded ? 52 : 40} />
                <div className="flex-1 min-w-0">
                  <h2 id="assistant-title" className="font-display text-white text-sm font-semibold truncate">
                    {t("assistant.title", "Portfolio assistant")}
                  </h2>
                  <div className="flex items-center gap-1.5 h-4 font-mono text-[11px] text-gray-400" aria-live="polite">
                    <span className="ai-dot w-1.5 h-1.5 rounded-full shrink-0" aria-hidden="true" />
                    {/* New label fades up in place; no exit wait, so it never lags behind the state */}
                    <motion.span
                      key={state}
                      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      {stateLabel[state]}
                    </motion.span>
                  </div>
                </div>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clear}
                    aria-label={t("assistant.clear", "Clear")}
                    title={t("assistant.clear", "Clear")}
                    className="interactive p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? t("assistant.shrink", "Smaller view") : t("assistant.expand", "Larger view")}
                  aria-pressed={expanded}
                  className="interactive hidden sm:inline-flex p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {expanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("assistant.close", "Close the assistant")}
                  className="interactive p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className={`mt-3 ${expanded ? "h-9" : "h-6"}`}>
                <Waveform state={state} energy={energy} bars={expanded ? 56 : 36} active={open} reduceMotion={reduceMotion} />
              </div>
            </header>

            <div
              ref={listRef}
              data-lenis-prevent
              role="log"
              aria-busy={busy}
              className={`flex-1 overflow-y-auto overscroll-contain py-4 space-y-4 ${expanded ? "px-6 text-[15px]" : "px-4 text-sm"}`}
            >
              {messages.length === 0 && (
                <div className="space-y-4">
                  <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                    <TypedText key={intro} text={intro} streaming={false} render={(s) => s} />
                  </p>
                  {pageSuggestion && (
                    <button
                      type="button"
                      onClick={() => send(pageSuggestion.prompt)}
                      className="interactive text-left text-xs text-gray-300 border border-gold/30 bg-gold/5 hover:border-gold/60 hover:text-white rounded-xl px-3 py-2 transition-colors w-full"
                    >
                      {pageSuggestion.label}
                    </button>
                  )}
                </div>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 bg-gold/10 border border-gold/20 text-gray-100 whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <p key={i} className="text-gray-200 leading-relaxed whitespace-pre-wrap break-words pr-2">
                    {live?.index === i ? (
                      <TypedText text={m.content} streaming={live.streaming} render={renderWithLinks} onType={onTyped} onDone={onTypedDone} />
                    ) : (
                      <>
                        {renderWithLinks(m.content)}
                        <ChatActions content={m.content} />
                      </>
                    )}
                  </p>
                ),
              )}
              {/* Before the first character arrives: just the caret, where the answer will appear */}
              {phase === "thinking" && live === null && (
                <p className="leading-relaxed"><span className="ai-caret" aria-hidden="true" /></p>
              )}
              {error && (
                <p role="alert" className="text-xs text-red-300 border border-red-500/20 bg-red-500/5 rounded-xl px-4 py-2.5">
                  {renderWithLinks(error)}
                </p>
              )}
            </div>

            <form onSubmit={onSubmit} className="p-3 border-t border-white/5">
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
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder={t("assistant.placeholder", "Ask a question...")}
                  className="flex-1 resize-none max-h-28 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label={t("assistant.send", "Send")}
                  className="interactive glass-button bg-gold text-black rounded-xl h-[46px] w-[46px] flex items-center justify-center shrink-0 disabled:opacity-50"
                >
                  <ArrowUp size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 font-mono text-[10px] text-gray-500 text-center">
                {t("assistant.disclaimer", "AI answers can be wrong. For anything important, use the contact form.")}
              </p>
            </form>
          </motion.section>
        ) : (
          <motion.button
            key="launcher"
            ref={launcherRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={
              hasUnseenCue
                ? t("assistant.open_with_tip", "Ask the AI assistant — it has a suggestion for this part of the site")
                : t("assistant.open", "Ask the AI assistant about Abdulwahab's work")
            }
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={transition}
            className="interactive group relative flex items-center gap-3 rounded-full bg-bg-darker/70 backdrop-blur-xl border border-white/10 hover:border-gold/40 p-1.5 pr-5 shadow-[0_10px_40px_rgba(0,0,0,0.45)] transition-colors"
          >
            {hasUnseenCue && (
              <span
                aria-hidden="true"
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gold border border-bg-darker ${reduceMotion ? "" : "animate-pulse"}`}
              />
            )}
            <Orb state={state} size={48} />
            <span className="text-left leading-tight">
              <span className="block font-display text-sm text-white">{t("assistant.launcher", "Ask AI")}</span>
              <span className="block font-mono text-[10px] text-gray-400">{t("assistant.launcher_hint", "About my work")}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
