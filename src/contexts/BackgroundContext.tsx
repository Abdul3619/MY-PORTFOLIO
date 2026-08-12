import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { motion } from 'motion/react';

interface BackgroundContextType {
  isInitialized: boolean;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const BackgroundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const scrollRef = useRef(window.scrollY);

  useEffect(() => {
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // E.I.D.X. high-performance neural matrix particles
    const particleCount = Math.min(width < 768 ? 40 : 85, 90);
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        baseAlpha: Math.random() * 0.6 + 0.2,
      });
    }

    let lastTime = performance.now();

    const render = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      const currentScroll = scrollRef.current;
      const scrollSpeedFactor = currentScroll * 0.12;

      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy + (currentScroll * 0.0004);

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Mouse proximity repulsion / attraction
        const dx = mouseRef.current.x - p.x;
        const dy = mouseRef.current.y - (p.y - (scrollSpeedFactor % height));
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
          const force = (160 - dist) / 160;
          p.x -= (dx / dist) * force * 1.8;
          p.y -= (dy / dist) * force * 1.8;
        }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${p.baseAlpha})`;
        ctx.fill();

        // Connect nearby nodes
        for (let j = index + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const distance = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (distance < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.18 * (1 - distance / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <BackgroundContext.Provider value={{ isInitialized: true }}>
      {/* Persistent Canvas Background Layer */}
      <div className="fixed inset-0 z-[-1] bg-[#050505] overflow-hidden pointer-events-none">
        <canvas ref={canvasRef} className="absolute inset-0 opacity-70 pointer-events-none" />

        {/* E.I.D.X. Breathing Gradient Orbs */}
        <motion.div 
          className="absolute top-[10%] left-[5%] w-[550px] h-[550px] bg-red-600/18 rounded-full blur-[140px] pointer-events-none mix-blend-screen will-change-transform"
          animate={{ scale: [1, 1.35, 1], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        <motion.div 
          className="absolute bottom-[10%] right-[10%] w-[650px] h-[650px] bg-emerald-500/16 rounded-full blur-[160px] pointer-events-none mix-blend-screen will-change-transform"
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        
        <motion.div 
          className="absolute top-[30%] right-[20%] w-[500px] h-[500px] bg-blue-600/18 rounded-full blur-[130px] pointer-events-none mix-blend-screen will-change-transform"
          animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        <motion.div 
          className="absolute bottom-[20%] left-[15%] w-[520px] h-[520px] bg-amber-500/15 rounded-full blur-[140px] pointer-events-none mix-blend-screen will-change-transform"
          animate={{ scale: [1, 1.32, 1], opacity: [0.12, 0.28, 0.12] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />

        {/* Deep Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#050505_95%)] pointer-events-none" />
      </div>

      {children}
    </BackgroundContext.Provider>
  );
};

export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
};
