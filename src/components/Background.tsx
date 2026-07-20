import { useEffect, useState } from "react";
import { motion } from "motion/react";

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
    <div className="fixed inset-0 pointer-events-none z-[-1] bg-[#050505] overflow-hidden">
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle 800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(212, 175, 55, 0.15), transparent 40%)`
        }}
      />
      
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[100px] opacity-30 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[120px] opacity-20" />
      
      {/* Static Vignette overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#050505_100%)] pointer-events-none" />
    </div>
  );
}
