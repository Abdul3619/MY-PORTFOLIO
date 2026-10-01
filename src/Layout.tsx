import { useEffect } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "motion/react";
import Lenis from "lenis";
import { trackEvent } from "./hooks/useApi";
import Background from "./components/Background";
import { Navbar } from "./components/Navbar";
import CustomCursor from "./components/CustomCursor";
import ChatWidget from "./components/assistant/ChatWidget";

export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  const { t } = useTranslation();

  useEffect(() => {
    trackEvent('page_view', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <CustomCursor />
      <Background />
      <Navbar />
      
      <main className="min-h-screen pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          <div key={location.pathname} className="w-full flex flex-col flex-1">
            {outlet}
          </div>
        </AnimatePresence>
      </main>

      {/* The homepage has its own full footer; every other page gets this credit line. */}
      {location.pathname !== "/" && (
        <footer className="relative z-10 border-t border-white/5 py-8 px-4 text-center text-[11px] font-mono text-gray-500">
          <span>© {new Date().getFullYear()} · {t("common.built_by", "Built by Abdulwahab Abdullahi")}</span>
          <span className="mx-3">•</span>
          <Link to="/contact" className="text-gold hover:text-white transition-colors">{t("common.get_in_touch", "Get in touch")}</Link>
        </footer>
      )}

      <ChatWidget />
    </>
  );
}
