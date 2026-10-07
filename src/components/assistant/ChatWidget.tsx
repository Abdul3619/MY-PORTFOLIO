import { Suspense, lazy, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MutableRefObject, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Maximize2, Mic, Minimize2, Phone, RotateCcw, Sparkles, Square, X } from "lucide-react";
import OrbVisual, { type AssistantState } from "./OrbVisual";
import TypedText from "./TypedText";
import Waveform from "./Waveform";
import useOrbWobble from "./useOrbWobble";
import VoiceCallOverlay from "./VoiceCallOverlay";
import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from "./speechRecognition";
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

// Full URLs and known site paths (/contact, /projects/<slug>, etc) inside assistant replies. Used to find
// destinations for the ChatActions buttons below, and (for plain error strings only) to keep them clickable.
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

// Assistant replies: every destination should reach the visitor as a tap-able button (ChatActions below), never
// as a clickable (or even just visible) raw link sitting in the sentence. This renders the same prose with every
// matched link/path removed from view -- extractActions() still reads the untouched original text separately, so
// the button always appears even though its URL no longer prints inline.
function renderForDisplay(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts
    .map((p) => (typeof p === "string" ? p.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,;:!?])/g, "$1") : p))
    .filter((p) => p !== "");
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
      label: "You can also just tell me what you need right here.",
      prompt: "I'd like to leave my details here instead of the form -- what do you need from me?",
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
  "contact-cta": { label: "You can also just tell me what you need right here.", prompt: "I'd like to leave my details here instead of the form -- what do you need from me?" },
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
  // External project demos open in an in-page panel instead of a new tab, so asking to "see" or "open" something
  // feels like it happens right there rather than leaving the site. Other external links (WhatsApp, GitHub) still
  // open normally -- a panel makes no sense for those.
  openInPanel: boolean;
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
        actions.push({ href, label: "Open this project", internal: true, openInPanel: false });
      } else if (INTERNAL_LABELS[href]) {
        actions.push({ href, label: INTERNAL_LABELS[href], internal: true, openInPanel: false });
      }
    } else {
      try {
        const host = new URL(href).hostname.replace(/^www\./, "");
        const isWhatsApp = host === "wa.me";
        const label = isWhatsApp ? "Message on WhatsApp" : `Open live demo (${host})`;
        actions.push({ href, label, internal: false, openInPanel: !isWhatsApp });
      } catch {
        // malformed URL, skip rather than show a dead button
      }
    }
  }
  return actions.slice(0, 3);
}

function ChatActions({
  content,
  onOpenDemo,
  onNavigate,
}: {
  content: string;
  onOpenDemo: (url: string, label: string) => void;
  onNavigate: () => void;
}) {
  const actions = extractActions(content);
  if (actions.length === 0) return null;
  const buttonClass =
    "interactive inline-flex items-center gap-1 text-xs font-medium text-black bg-gold hover:bg-gold/90 rounded-full px-3 py-1.5 transition-colors";
  return (
    <span className="mt-3 flex flex-wrap gap-2 not-italic">
      {actions.map((a) => {
        if (a.internal) {
          // Taking the visitor to another page/section is the guide's job done -- the widget tucks itself back
          // into its launcher so it doesn't sit over the very thing it just pointed them to. The conversation
          // itself is untouched (see STORAGE_KEY/loadMessages), so reopening picks up right where it left off.
          return (
            <Link key={a.href} to={a.href} onClick={onNavigate} className={buttonClass}>
              {a.label} →
            </Link>
          );
        }
        if (a.openInPanel) {
          return (
            <button key={a.href} type="button" onClick={() => onOpenDemo(a.href, a.label)} className={buttonClass}>
              {a.label} →
            </button>
          );
        }
        return (
          <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
            {a.label} →
          </a>
        );
      })}
    </span>
  );
}

// The small header/launcher orb. It now actually moves with what's happening -- a gentle multi-directional
// wobble while listening, faster and more energetic while speaking -- driven by the same `energy` ref the
// waveform already uses (bumped on keystrokes, typed characters, mic volume and, in a voice call, TTS word
// boundaries), instead of just sitting there and changing colour.
function Orb({ state, size, energy, reduceMotion }: { state: AssistantState; size: number; energy: MutableRefObject<number>; reduceMotion: boolean }) {
  const wobbleRef = useOrbWobble(energy, state, size, reduceMotion);
  return (
    <div ref={wobbleRef} style={{ display: "inline-flex" }}>
      <Suspense fallback={<OrbVisual size={size} energy={energy} reduceMotion={reduceMotion} />}>
        <AssistantOrb state={state} size={size} energy={energy} reduceMotion={reduceMotion} />
      </Suspense>
    </div>
  );
}

// Panel size for the compact and expanded views, kept inside the viewport. Reads window.visualViewport when it's
// available: on mobile, that's the actual visible area above the on-screen keyboard (innerHeight doesn't shrink
// on iOS Safari when the keyboard opens, and over-shrinks inconsistently on other mobile browsers), so this keeps
// the size calculation stable across devices instead of guessing from whichever quirk a given browser has.
function panelSize(expanded: boolean) {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const mobile = vw < 640;
  const width = mobile ? vw - 32 : Math.min(expanded ? 760 : 368, vw - 48);
  // Desktop: stay clear of the site's floating navbar at the top. A floor keeps the panel usable (header + a
  // couple of messages + the input) even when a keyboard eats most of a small phone screen, instead of letting
  // it get squeezed down to near nothing.
  const height = Math.max(mobile ? 280 : 320, Math.min(expanded ? 820 : 540, vh - (mobile ? 32 : 136)));
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
  // Index of the assistant message that was cut short by the stop button, so a "Continue" pill can be offered
  // right under it -- cleared the moment any new message (including the continue itself) starts sending.
  const [stoppedIndex, setStoppedIndex] = useState<number | null>(null);
  const [pageSuggestion, setPageSuggestion] = useState<Suggestion | null>(null);
  const [speechSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const [listeningSpeech, setListeningSpeech] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // The full voice-call mode -- a separate thing from the mic button above: that one speaks-to-fill-the-textbox,
  // this one is an actual back-and-forth call (listens, replies out loud, keeps listening).
  const [callOpen, setCallOpen] = useState(false);
  const [activeSection, setActiveSectionState] = useState<string | null>(() => getActiveSection());
  const [hasUnseenCue, setHasUnseenCue] = useState(false);
  // A small speech bubble that steps up next to the collapsed launcher on its own, like a showroom guide
  // noticing you've wandered into a new area -- not just a silent dot, so a first-time visitor who never
  // thinks to open the chat still gets offered something relevant.
  const [bubble, setBubble] = useState<Suggestion | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A demo opened right here, in a panel over the current page, instead of a new tab -- so asking to see a
  // booking system (or any other demo) feels like it opens in place, with its own way back, not like leaving.
  const [demoPanel, setDemoPanel] = useState<{ url: string; label: string } | null>(null);
  const energy = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Set right before clear() aborts an in-flight request, so the catch block below knows to throw the partial
  // answer away instead of treating it as a user-requested stop (which keeps and offers to continue it).
  const discardAbortRef = useRef(false);
  const wasOpen = useRef(false);
  const busy = phase !== "idle";

  // What the orb, waveform and label show
  const state: AssistantState =
    phase !== "idle" ? phase : open && (listeningSpeech || (inputFocused && input.trim())) ? "listening" : "idle";

  useEffect(() => {
    setMounted(true);
    setMessages(loadMessages());
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => setSize(panelSize(expanded));
    update();
    // visualViewport fires its own resize when the on-screen keyboard opens/closes, ahead of (or instead of)
    // window's -- listening to both keeps the panel's size current on every mobile browser.
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [mounted, expanded]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      inputRef.current?.focus();
      const onKey = (e: globalThis.KeyboardEvent) => {
        // The demo panel sits above the chat, so its own handler (below) takes the first Escape press.
        if (e.key === "Escape" && !demoPanel) close();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    // Back to the launcher when the panel closes
    if (wasOpen.current) requestAnimationFrame(() => launcherRef.current?.focus());
  }, [open, close, demoPanel]);

  // The demo panel's own Escape handling and body-scroll lock, independent of whether the chat is open.
  useEffect(() => {
    if (!demoPanel) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setDemoPanel(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [demoPanel]);

  const scrollToEnd = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(scrollToEnd, [messages, error, open, expanded, scrollToEnd]);

  // Track which part of the page the visitor is currently looking at (homepage only; other pages just use the
  // route). See src/lib/activeSection.ts and SectionObserver.tsx.
  useEffect(() => subscribeActiveSection(setActiveSectionState), []);

  // One contextual suggestion at a time, like a showroom guide noticing which part of the shop you're in. It
  // changes as the visitor scrolls the homepage or moves between pages, and steps back up again every time they
  // pass through a section -- including a section they've already seen -- so wandering back into "Projects"
  // after looking at "Skills" offers the Projects suggestion again rather than staying silent. It only ever
  // defers to an active conversation, never to history.
  useEffect(() => {
    if (messages.length > 0) {
      setPageSuggestion(null);
      setHasUnseenCue(false);
      setBubble(null);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      return;
    }
    const suggestion = resolveSuggestion(location.pathname, activeSection);
    if (!suggestion) {
      if (!open) setHasUnseenCue(false);
      setBubble(null);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      return;
    }
    if (open) {
      setPageSuggestion(suggestion);
      setHasUnseenCue(false);
    } else {
      // Do not pop up uninvited mockup suggestion bubbles on the screen
      setHasUnseenCue(false);
      setBubble(null);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    }
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [open, location.pathname, activeSection, messages.length]);

  // The bubble doesn't linger forever, and it steps aside the moment the visitor opens the chat themselves.
  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => setBubble(null), 14_000);
    return () => clearTimeout(timer);
  }, [bubble]);

  useEffect(() => {
    if (open) setBubble(null);
  }, [open]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setError("");
    setStoppedIndex(null);
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
      if (controller.signal.aborted) {
        const discard = discardAbortRef.current;
        discardAbortRef.current = false;
        if (discard) return; // clear() already reset everything itself
        if (answer) {
          // Stopped mid-reply: keep what was generated so far as a real message (TypedText finishes animating
          // the already-buffered text and fires onDone, same as a normal completion) and offer to pick it back up.
          saveMessages([...next, { role: "assistant", content: answer }]);
          setLive({ index: next.length, streaming: false });
          setStoppedIndex(next.length);
        } else {
          // Stopped before anything came back at all: nothing to keep, behave like any other failed turn.
          setMessages(next.slice(0, -1));
          saveMessages(next.slice(0, -1));
          setLive(null);
          setPhase("idle");
        }
        return;
      }
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

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const toggleSpeech = useCallback(() => {
    if (!speechSupported) return;
    if (listeningSpeech) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0]?.transcript ?? "";
      setInput(transcript);
      energy.current = Math.min(1.2, energy.current + 0.4);
    };
    recognition.onerror = () => setListeningSpeech(false);
    recognition.onend = () => setListeningSpeech(false);
    recognitionRef.current = recognition;
    inputRef.current?.focus();
    recognition.start();
    setListeningSpeech(true);
  }, [speechSupported, listeningSpeech]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

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
    discardAbortRef.current = true;
    abortRef.current?.abort();
    setMessages([]);
    saveMessages([]);
    setLive(null);
    setPhase("idle");
    setError("");
    setStoppedIndex(null);
    inputRef.current?.focus();
  };

  if (!mounted) return null;

  const stateLabel: Record<AssistantState, string> = {
    idle: t("assistant.state_ready", "Ready"),
    listening: t("assistant.state_listening", "Listening"),
    thinking: t("assistant.state_thinking", "Thinking"),
    speaking: t("assistant.state_speaking", "Speaking"),
    reconnecting: t("assistant.state_reconnecting", "Reconnecting..."),
  };
  const intro = t("assistant.intro", "Hi. I can answer questions about Abdulwahab's projects, skills and how he works. What are you looking to build?");
  const transition = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 320, damping: 32 };

  return (
    <>
      <AnimatePresence>
        {demoPanel && (
          <motion.div
            key="demo-panel"
            role="dialog"
            aria-modal="true"
            aria-label={demoPanel.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-bg-darker/95 border-b border-white/10">
              <span className="text-sm font-display text-white truncate">{demoPanel.label}</span>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={demoPanel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="interactive text-xs font-mono text-gray-400 hover:text-gold underline underline-offset-2 transition-colors"
                >
                  {t("assistant.open_new_tab", "Open in new tab")}
                </a>
                <button
                  type="button"
                  onClick={() => setDemoPanel(null)}
                  aria-label={t("assistant.back_to_site", "Close this demo and go back")}
                  className="interactive inline-flex items-center gap-1.5 text-xs font-medium text-black bg-gold hover:bg-gold/90 rounded-full px-3 py-1.5 transition-colors"
                >
                  <X size={12} aria-hidden="true" />
                  {t("assistant.back", "Back")}
                </button>
              </div>
            </div>
            <iframe
              key={demoPanel.url}
              src={demoPanel.url}
              title={demoPanel.label}
              className="flex-1 w-full bg-white"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-new-window"
            />
            <p className="px-4 py-2 font-mono text-[10px] text-gray-500 bg-bg-darker/95 border-t border-white/10 text-center">
              {t("assistant.demo_panel_note", 'This is a live demo, open right here. If it doesn\'t load, use "Open in new tab" above.')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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
            transition={{ ...transition, width: { duration: 0 }, height: { duration: 0 } }}
            style={{ transformOrigin: "bottom right" }}
            className="ai-panel ai-glow-edge bg-bg-darker/85 backdrop-blur-2xl border rounded-3xl flex flex-col overflow-hidden"
          >
            <header className="px-4 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Orb state={state} size={expanded ? 52 : 40} energy={energy} reduceMotion={reduceMotion} />
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
                      <TypedText text={m.content} streaming={live.streaming} render={renderForDisplay} onType={onTyped} onDone={onTypedDone} />
                    ) : (
                      <>
                        {renderForDisplay(m.content)}
                        <ChatActions content={m.content} onOpenDemo={(url, label) => setDemoPanel({ url, label })} onNavigate={close} />
                        {stoppedIndex === i && !busy && (
                          <span className="mt-3 flex flex-wrap not-italic">
                            <button
                              type="button"
                              onClick={() => send(t("assistant.continue_prompt", "Please continue your answer from exactly where you left off."))}
                              className="interactive inline-flex items-center gap-1 text-xs font-medium text-gold border border-gold/40 hover:bg-gold/10 rounded-full px-3 py-1.5 transition-colors"
                            >
                              {t("assistant.continue", "Continue")}
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </p>
                ),
              )}
              {/* Before the first character arrives: a shimmering placeholder sits exactly where the reply will
                  land, so the space never looks frozen or broken while the model is still working. */}
              {phase === "thinking" && live === null && (
                <div className="ai-skeleton-row" role="status" aria-label={t("assistant.state_thinking", "Thinking")}>
                  <span className="ai-skeleton-bar" style={{ width: "46%" }} />
                  <span className="ai-skeleton-bar" style={{ width: "22%" }} />
                  <span className="ai-skeleton-bar" style={{ width: "14%" }} />
                </div>
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
                {speechSupported && (
                  <motion.button
                    type="button"
                    onClick={toggleSpeech}
                    disabled={busy}
                    aria-pressed={listeningSpeech}
                    aria-label={listeningSpeech ? t("assistant.stop_voice", "Stop voice input") : t("assistant.start_voice", "Speak your question instead of typing")}
                    title={listeningSpeech ? t("assistant.stop_voice", "Stop voice input") : t("assistant.start_voice", "Speak your question instead of typing")}
                    whileHover={reduceMotion || busy ? undefined : { scale: 1.07 }}
                    whileTap={reduceMotion || busy ? undefined : { scale: 0.91 }}
                    className={`interactive glass-button rounded-xl h-[46px] w-[46px] flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-50 ${
                      listeningSpeech
                        ? "bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.45)]"
                        : "bg-white/10 text-gray-300 hover:text-white hover:bg-white/15 hover:shadow-[0_0_14px_rgba(255,255,255,0.15)]"
                    }`}
                  >
                    <Mic size={17} aria-hidden="true" className={listeningSpeech ? "animate-pulse" : undefined} />
                  </motion.button>
                )}
                {speechSupported && (
                  <motion.button
                    type="button"
                    onClick={() => setCallOpen(true)}
                    disabled={busy}
                    aria-label={t("assistant.start_call", "Start a voice call")}
                    title={t("assistant.start_call", "Start a voice call")}
                    whileHover={reduceMotion || busy ? undefined : { scale: 1.07 }}
                    whileTap={reduceMotion || busy ? undefined : { scale: 0.91 }}
                    className="interactive glass-button rounded-xl h-[46px] w-[46px] flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-50 bg-white/10 text-gray-300 hover:text-white hover:bg-white/15 hover:shadow-[0_0_14px_rgba(255,255,255,0.15)]"
                  >
                    <Phone size={17} aria-hidden="true" />
                  </motion.button>
                )}
                <motion.button
                  type={busy ? "button" : "submit"}
                  onClick={busy ? stop : undefined}
                  disabled={!busy && !input.trim()}
                  aria-label={busy ? t("assistant.stop", "Stop the reply") : t("assistant.send", "Send")}
                  whileHover={reduceMotion || (!busy && !input.trim()) ? undefined : { scale: 1.07 }}
                  whileTap={reduceMotion || (!busy && !input.trim()) ? undefined : { scale: 0.9 }}
                  className={`interactive glass-button rounded-xl h-[46px] w-[46px] flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-40 disabled:shadow-none ${
                    busy
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-gradient-to-br from-gold to-bronze text-black shadow-[0_4px_18px_rgba(212,175,55,0.35)] hover:shadow-[0_4px_26px_rgba(212,175,55,0.55)]"
                  }`}
                >
                  {busy ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <ArrowUp size={18} aria-hidden="true" />}
                </motion.button>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 font-mono text-[11px] text-gray-400 text-center">
                <Sparkles size={11} className="text-gold/70 shrink-0" aria-hidden="true" />
                {t("assistant.disclaimer", "AI can make mistakes -- double-check anything important.")}
              </p>
            </form>
          </motion.section>
        ) : (
          <motion.div key="launcher-group" className="flex flex-col items-end">
            {bubble && (
              <motion.div
                key="bubble"
                role="status"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
                transition={transition}
                className="interactive relative mb-3 max-w-[230px] rounded-2xl rounded-br-sm bg-bg-darker/90 backdrop-blur-xl border border-gold/30 shadow-[0_10px_40px_rgba(0,0,0,0.45)] pl-4 pr-6 py-3"
              >
                <button
                  type="button"
                  onClick={() => setBubble(null)}
                  aria-label={t("assistant.dismiss_tip", "Dismiss suggestion")}
                  className="interactive absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                >
                  <X size={11} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prompt = bubble.prompt;
                    setBubble(null);
                    setOpen(true);
                    send(prompt);
                  }}
                  className="interactive block w-full text-left text-xs text-gray-200 leading-snug"
                >
                  {bubble.label}
                </button>
              </motion.div>
            )}
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
              className="ai-glow-edge interactive group relative flex items-center gap-3 rounded-full bg-bg-darker/70 backdrop-blur-xl border p-1.5 pr-5"
            >
              {hasUnseenCue && (
                <span
                  aria-hidden="true"
                  className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gold border border-bg-darker ${reduceMotion ? "" : "animate-pulse"}`}
                />
              )}
              <Orb state={state} size={48} energy={energy} reduceMotion={reduceMotion} />
              <span className="text-left leading-tight">
                <span className="block font-display text-sm text-white">{t("assistant.launcher", "Ask AI")}</span>
                <span className="block font-mono text-[10px] text-gray-400">{t("assistant.launcher_hint", "About my work")}</span>
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      <VoiceCallOverlay
        open={callOpen}
        onClose={() => setCallOpen(false)}
        messages={messages}
        onExchange={(userText, assistantText) => {
          const next: ChatMessage[] = [...messages, { role: "user", content: userText }, { role: "assistant", content: assistantText }];
          setMessages(next);
          saveMessages(next);
        }}
        reduceMotion={reduceMotion}
      />
    </>
  );
}
