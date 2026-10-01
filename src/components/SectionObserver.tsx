import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { setActiveSection } from "../lib/activeSection";

// Watches every [data-assistant-section] element on the current page and publishes whichever one currently
// takes up the most of the viewport, so the chat widget can offer a suggestion relevant to what's on screen
// right now — not just which route the visitor is on. Re-scans on every route change, since pages mount their
// sections after this component does.
export default function SectionObserver() {
  const location = useLocation();

  useEffect(() => {
    // Give the page a tick to render its sections after the route swap.
    const timer = window.setTimeout(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-assistant-section]"));
      if (nodes.length === 0) {
        setActiveSection(null);
        return;
      }

      const ratios = new Map<string, number>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.getAttribute("data-assistant-section");
            if (!id) continue;
            ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
          let best: string | null = null;
          let bestRatio = 0;
          for (const [id, ratio] of ratios) {
            if (ratio > bestRatio) {
              best = id;
              bestRatio = ratio;
            }
          }
          // Require a reasonable amount of the section to be visible before it "counts", so the guide doesn't
          // flicker between two sections at the seam.
          setActiveSection(bestRatio > 0.35 ? best : null);
        },
        { threshold: [0, 0.35, 0.5, 0.75, 1] },
      );
      nodes.forEach((n) => observer.observe(n));
      (window as any).__assistantSectionObserver = observer;
    }, 50);

    return () => {
      window.clearTimeout(timer);
      const observer = (window as any).__assistantSectionObserver as IntersectionObserver | undefined;
      observer?.disconnect();
      setActiveSection(null);
    };
  }, [location.pathname]);

  return null;
}
