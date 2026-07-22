import { useEffect, useState, lazy, Suspense } from "react";
import { motion } from "motion/react";

const Spline = lazy(() => import("@splinetool/react-spline"));

export default function Background() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] bg-[#050505] overflow-hidden">
      {/* 3D Spline Metallic AI Background */}
      <div className="absolute inset-0 opacity-40">
        <Suspense fallback={null}>
          <Spline scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" />
        </Suspense>
      </div>

      {/* Multi-Colored Living AI Energy Light Strokes & Pulsing Orbs (Red, Blue, Green, Gold) */}
      <motion.div 
        className="absolute top-[12%] left-[8%] w-[450px] h-[450px] bg-red-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen will-change-transform"
        animate={{ 
          scale: [1, 1.3, 1], 
          opacity: [0.15, 0.35, 0.15],
          filter: ["blur(110px)", "blur(130px)", "blur(110px)"]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <motion.div 
        className="absolute bottom-[18%] right-[12%] w-[550px] h-[550px] bg-emerald-500/18 rounded-full blur-[140px] pointer-events-none mix-blend-screen will-change-transform"
        animate={{ 
          scale: [1, 1.25, 1], 
          opacity: [0.18, 0.38, 0.18] 
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      
      <motion.div 
        className="absolute top-[35%] right-[25%] w-[420px] h-[420px] bg-blue-600/20 rounded-full blur-[110px] pointer-events-none mix-blend-screen will-change-transform"
        animate={{ 
          scale: [1, 1.35, 1], 
          opacity: [0.15, 0.32, 0.15] 
        }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <motion.div 
        className="absolute bottom-[25%] left-[20%] w-[480px] h-[480px] bg-gold/18 rounded-full blur-[125px] pointer-events-none mix-blend-screen will-change-transform"
        animate={{ 
          scale: [1, 1.28, 1], 
          opacity: [0.15, 0.3, 0.15] 
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      {/* Blinking Neon Energy Nodes / Sparks */}
      <motion.div 
        className="absolute top-[28%] left-[32%] w-3 h-3 bg-red-500 rounded-full blur-[1px] pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.9)]"
        animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-[65%] right-[35%] w-3 h-3 bg-emerald-400 rounded-full blur-[1px] pointer-events-none shadow-[0_0_15px_rgba(52,211,153,0.9)]"
        animate={{ opacity: [0.1, 1, 0.1], scale: [0.7, 1.3, 0.7] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
      />
      <motion.div 
        className="absolute top-[45%] left-[65%] w-2.5 h-2.5 bg-blue-400 rounded-full blur-[1px] pointer-events-none shadow-[0_0_15px_rgba(96,165,250,0.9)]"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.5, 0.9] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />

      {/* Dynamic Interactive Mouse Radial Gradient */}
      <div 
        className="absolute inset-0 opacity-25 pointer-events-none mix-blend-screen transition-all duration-300"
        style={{
          background: `radial-gradient(circle 900px at ${mousePosition.x}px ${mousePosition.y}px, rgba(52, 211, 153, 0.12), rgba(96, 165, 250, 0.1) 40%, rgba(239, 68, 68, 0.08) 70%, transparent 85%)`
        }}
      />
      
      {/* Static Vignette overlay for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_#050505_90%)] pointer-events-none" />
    </div>
  );
}


