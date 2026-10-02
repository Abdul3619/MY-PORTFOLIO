// Shared helper for the browser's own speech-to-text, used by both the text-input mic button and the full
// voice-call mode -- free, no server or API key involved. Where no browser support exists (e.g. Firefox), callers
// check getSpeechRecognitionCtor() and simply don't offer the feature.
export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export function getSpeechSynthesis(): SpeechSynthesis | undefined {
  if (typeof window === "undefined") return undefined;
  return window.speechSynthesis;
}
