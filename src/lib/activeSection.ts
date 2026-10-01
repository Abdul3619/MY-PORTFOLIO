// A tiny shared "what is the visitor looking at right now" store.
//
// The chat widget lives in the layout, outside any one page's component tree, so it can't read a page's local
// scroll state directly. Pages mark the parts worth noticing with a data-assistant-section attribute; a single
// IntersectionObserver (mounted once, see SectionObserver.tsx) watches them and publishes whichever one is most
// in view here. The widget subscribes to get the "which room is the visitor standing in" signal for its
// showroom-guide suggestions, without either side needing to know about the other.

type Listener = (sectionId: string | null) => void;

let current: string | null = null;
const listeners = new Set<Listener>();

export function setActiveSection(id: string | null) {
  if (id === current) return;
  current = id;
  listeners.forEach((l) => l(current));
}

export function getActiveSection(): string | null {
  return current;
}

export function subscribeActiveSection(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
