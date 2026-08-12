import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "lenis";
import { trackEvent } from "./hooks/useApi";

import Background from "./components/Background";
import { Navbar } from "./components/Navbar";
import CustomCursor from "./components/CustomCursor";

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

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
      
      <main className="min-h-screen pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col relative z-10">
        {children}
      </main>
    </>
  );
}
