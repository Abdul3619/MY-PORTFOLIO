import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { motion } from 'motion/react';

interface BackgroundContextType {
  isInitialized: boolean;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const BackgroundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streakCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const scrollRef = useRef(0);

  useEffect(() => {
    mouseRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    scrollRef.current = window.scrollY;

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

  // Warp-speed light streak layer, radiating outward toward the viewer
  useEffect(() => {
    const canvas = streakCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const PALETTE = [
      [255, 150, 70],   // warm orange
      [255, 255, 255],  // white
      [90, 170, 255],   // electric blue
      [190, 125, 255],  // violet
    ];

    const streakCount = reduceMotion ? 0 : width < 768 ? 36 : 75;

    type Streak = {
      angle: number;
      radius: number;
      prevRadius: number;
      speed: number;
      color: number[];
      alpha: number;
    };

    const maxRadius = () => Math.hypot(width, height) / 2 + 60;

    const spawn = (s: Partial<Streak> = {}): Streak => ({
      angle: s.angle ?? Math.random() * Math.PI * 2,
      radius: s.radius ?? Math.random() * 40,
      prevRadius: s.radius ?? Math.random() * 40,
      speed: s.speed ?? Math.random() * 1.2 + 0.6,
      color: s.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alpha: s.alpha ?? 0,
    });

    const streaks: Streak[] = Array.from({ length: streakCount }, () => spawn());

    let lastTime = performance.now();
    const originRef = { x: width / 2, y: height / 2 };

    const render = (currentTime: number) => {
      const delta = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      // Vanishing point drifts gently toward the cursor for a reactive, parallax feel
      const targetX = width / 2 + (mouseRef.current.x - width / 2) * 0.08;
      const targetY = height / 2 + (mouseRef.current.y - height / 2) * 0.08;
      originRef.x += (targetX - originRef.x) * 0.04;
      originRef.y += (targetY - originRef.y) * 0.04;

      ctx.globalCompositeOperation = 'lighter';

      const limit = maxRadius();

      for (const s of streaks) {
        s.prevRadius = s.radius;
        // Accelerating outward motion, fast, like streaking past the viewer
        s.speed += delta * 55;
        s.radius += s.speed * delta * 60;

        // Fade in near the center, fade out just before despawn
        const progress = s.radius / limit;
        s.alpha = progress < 0.08
          ? progress / 0.08
          : progress > 0.82
            ? Math.max(0, (1 - progress) / 0.18)
            : 1;

        const cosA = Math.cos(s.angle);
        const sinA = Math.sin(s.angle);
        const x1 = originRef.x + s.prevRadius * cosA;
        const y1 = originRef.y + s.prevRadius * sinA;
        const x2 = originRef.x + s.radius * cosA;
        const y2 = originRef.y + s.radius * sinA;

        const [r, g, b] = s.color;
        const lineWidth = 0.6 + progress * 2.6;
        const alpha = s.alpha * 0.85;

        if (alpha > 0.01) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        if (s.radius > limit) {
          const fresh = spawn({ radius: Math.random() * 30 });
          s.angle = fresh.angle;
          s.radius = fresh.radius;
          s.prevRadius = fresh.radius;
          s.speed = fresh.speed;
          s.color = fresh.color;
          s.alpha = 0;
        }
      }

      ctx.globalCompositeOperation = 'source-over';

      animationFrameId = requestAnimationFrame(render);
    };

    if (streakCount > 0) {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
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

        {/* Warp-speed light streak layer, shooting outward over the breathing color orbs */}
        <canvas ref={streakCanvasRef} className="absolute inset-0 opacity-80 pointer-events-none" />

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
