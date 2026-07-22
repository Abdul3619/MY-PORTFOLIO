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

      {/* Additional animated colored lights for "living AI" effect */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] opacity-20 pointer-events-none mix-blend-screen animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="absolute bottom-1/4 left-1/2 w-[500px] h-[500px] bg-[#00F0FF]/15 rounded-full blur-[120px] opacity-30 pointer-events-none mix-blend-screen animate-[pulse_6s_ease-in-out_infinite_alternate]" />
      <div className="absolute top-1/2 right-1/4 w-[450px] h-[450px] bg-purple-500/10 rounded-full blur-[100px] opacity-20 pointer-events-none mix-blend-screen animate-[pulse_10s_ease-in-out_infinite]" />

      <div 
        className="absolute inset-0 opacity-20 pointer-events-none mix-blend-screen"
        style={{
          background: `radial-gradient(circle 800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 240, 255, 0.12), transparent 40%)`
        }}
      />
      
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[100px] opacity-30 animate-[pulse_5s_ease-in-out_infinite] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px] opacity-20 animate-[pulse_7s_ease-in-out_infinite] pointer-events-none" />
      
      {/* Static Vignette overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#050505_100%)] pointer-events-none" />
    </div>
  );
}
