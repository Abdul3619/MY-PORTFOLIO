import React, { useEffect, useRef } from 'react';

interface BackgroundGlowProps {
  glowPositions?: ('top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center')[];
  intensity?: 'subtle' | 'vibrant' | 'dramatic';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  color: string;
  glowColor: string;
  baseAlpha: number;
  alpha: number;
  breathSpeed: number;
  breathPhase: number;
  driftAngle: number;
  driftSpeed: number;
  depth: number; // Multiplier for parallax depth (0.015 to 0.075)
  isStar: boolean;
  starRotation: number;
  starRotationSpeed: number;
}

export const BackgroundGlow: React.FC<BackgroundGlowProps> = ({
  glowPositions = ['top-right', 'bottom-left'],
  intensity = 'vibrant',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getOpacity = () => {
    switch (intensity) {
      case 'subtle':
        return 'opacity-40';
      case 'dramatic':
        return 'opacity-85';
      default:
        return 'opacity-65';
    }
  };

  // Living, breathing particles canvas animation with mouse parallax
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse parallax target & current lerp positions
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const centerX = width / 2;
      const centerY = height / 2;
      targetMouseX = e.clientX - centerX;
      targetMouseY = e.clientY - centerY;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize);

    // Luxury palette matching AtelierFit: hot magenta, orchid, lilac, warm rose, diamond white
    const particleColors = [
      { core: '#FFFFFF', glow: 'rgba(255, 255, 255, 0.8)' },
      { core: '#FF4DA8', glow: 'rgba(255, 46, 147, 0.85)' },
      { core: '#F43F5E', glow: 'rgba(244, 63, 94, 0.85)' },
      { core: '#E879F9', glow: 'rgba(232, 121, 249, 0.8)' },
      { core: '#C084FC', glow: 'rgba(192, 132, 252, 0.75)' },
      { core: '#FF80BF', glow: 'rgba(255, 128, 191, 0.85)' },
      { core: '#A855F7', glow: 'rgba(168, 85, 247, 0.7)' },
    ];

    // Determine particle count based on screen area (smooth on mobile and desktop)
    const count = Math.min(65, Math.max(35, Math.floor((width * height) / 16000)));
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const colorScheme = particleColors[Math.floor(Math.random() * particleColors.length)];
      // Variety of particle sizes: tiny shimmer specks to soft floating orbs
      const isLargeOrb = Math.random() < 0.25;
      const baseRadius = isLargeOrb
        ? Math.random() * 2.8 + 2.4 // 2.4px to 5.2px floating orbs
        : Math.random() * 1.5 + 0.9; // 0.9px to 2.4px shimmer specks
      const isStar = !isLargeOrb && Math.random() < 0.3; // Starlight diamond rays

      // Deeper particles have smaller depth; larger orbs shift more with parallax
      const depth = isLargeOrb
        ? Math.random() * 0.035 + 0.035 // 0.035 to 0.070
        : Math.random() * 0.025 + 0.015; // 0.015 to 0.040

      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -Math.random() * 0.45 - 0.12, // gentle upward cosmic float
        baseRadius,
        radius: baseRadius,
        color: colorScheme.core,
        glowColor: colorScheme.glow,
        baseAlpha: Math.random() * 0.35 + 0.35,
        alpha: 0.4,
        breathSpeed: Math.random() * 0.024 + 0.014, // each has their own breathing tempo
        breathPhase: Math.random() * Math.PI * 2, // distinct phase for individual breathing
        driftAngle: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.018 + 0.006,
        depth,
        isStar,
        starRotation: Math.random() * Math.PI,
        starRotationSpeed: (Math.random() - 0.5) * 0.01,
      });
    }

    let time = 0;

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Smooth lag-free lerp interpolation for mouse parallax
      currentMouseX += (targetMouseX - currentMouseX) * 0.045;
      currentMouseY += (targetMouseY - currentMouseY) * 0.045;

      particles.forEach((p) => {
        // Individual organic breathing cycle (noticeably expanding and shrinking)
        const sinVal = Math.sin(time * p.breathSpeed + p.breathPhase);
        const breathNormalized = (sinVal + 1) / 2; // smooth 0 to 1 curve

        // Expand and shrink radius noticeably: expands up to 1.7x, shrinks down to 0.55x
        const expansionFactor = 0.55 + breathNormalized * 1.15;
        p.radius = Math.max(0.7, p.baseRadius * expansionFactor);

        // Opacity breathes synchronously: brighter when expanded, softer when contracted
        p.alpha = Math.max(0.12, Math.min(0.95, p.baseAlpha * (0.65 + breathNormalized * 0.75)));

        // Individual meandering wandering drift
        p.driftAngle += p.driftSpeed;
        p.x += p.vx + Math.sin(p.driftAngle) * 0.3;
        p.y += p.vy + Math.cos(p.driftAngle * 0.8) * 0.18;
        p.starRotation += p.starRotationSpeed;

        // Wrap around boundaries gracefully
        if (p.x < -30) p.x = width + 30;
        if (p.x > width + 30) p.x = -30;
        if (p.y < -30) p.y = height + 30;
        if (p.y > height + 30) p.y = -30;

        // Apply mouse-follow parallax shift per particle based on its depth
        const drawX = p.x + currentMouseX * p.depth;
        const drawY = p.y + currentMouseY * p.depth;

        ctx.save();
        ctx.globalAlpha = p.alpha;

        // 1. Soft radial breathing glow halo (expands with breath)
        const glowRadius = p.radius * (3.2 + breathNormalized * 2.2);
        const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, glowRadius);
        grad.addColorStop(0, p.glowColor);
        grad.addColorStop(0.35, p.glowColor.replace('0.85', '0.3').replace('0.8', '0.25').replace('0.75', '0.2'));
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(drawX, drawY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Solid glowing core (expanding and shrinking)
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // 3. Delicate 4-pointed starlight glimmer for diamond stars
        if (p.isStar && p.alpha > 0.25) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          const starLen = p.radius * (3.2 + breathNormalized * 1.8);

          ctx.translate(drawX, drawY);
          ctx.rotate(p.starRotation);

          // Vertical and horizontal delicate rays
          ctx.moveTo(-starLen, 0);
          ctx.lineTo(starLen, 0);
          ctx.moveTo(0, -starLen);
          ctx.lineTo(0, starLen);
          ctx.stroke();

          // Tiny diagonal twinkle glint
          const diagLen = starLen * 0.45;
          ctx.beginPath();
          ctx.moveTo(-diagLen, -diagLen);
          ctx.lineTo(diagLen, diagLen);
          ctx.moveTo(-diagLen, diagLen);
          ctx.lineTo(diagLen, -diagLen);
          ctx.stroke();
        }

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Deep dark canvas background */}
      <div className="absolute inset-0 bg-[#0A0A0C]" />

      {/* Top right magenta/violet ambient aura */}
      {glowPositions.includes('top-right') && (
        <div
          className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[110px] bg-gradient-to-br from-[#E0218A]/45 via-[#9D174D]/35 to-[#7B2CBF]/25 animate-breathing-glow ${getOpacity()}`}
        />
      )}

      {/* Top left soft violet glow */}
      {glowPositions.includes('top-left') && (
        <div
          className={`absolute -top-24 -left-24 w-80 h-80 rounded-full blur-[90px] bg-gradient-to-bl from-[#B829E3]/40 via-[#6B21A8]/30 to-[#DB2777]/20 animate-breathing-glow [animation-delay:2s] ${getOpacity()}`}
        />
      )}

      {/* Bottom left warm magenta glow */}
      {glowPositions.includes('bottom-left') && (
        <div
          className={`absolute -bottom-28 -left-28 w-96 h-96 rounded-full blur-[120px] bg-gradient-to-tr from-[#9333EA]/35 via-[#C026D3]/40 to-[#F43F5E]/30 animate-breathing-glow [animation-delay:4s] ${getOpacity()}`}
        />
      )}

      {/* Bottom right subtle purple bloom */}
      {glowPositions.includes('bottom-right') && (
        <div
          className={`absolute -bottom-24 -right-24 w-88 h-88 rounded-full blur-[100px] bg-gradient-to-tl from-[#E11D48]/30 via-[#A21CAF]/35 to-[#581C87]/25 animate-breathing-glow [animation-delay:1.5s] ${getOpacity()}`}
        />
      )}

      {/* Center dramatic glow for hero screens */}
      {glowPositions.includes('center') && (
        <div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full blur-[100px] bg-gradient-to-r from-[#FF2E93]/40 via-[#9333EA]/35 to-[#4F46E5]/25 animate-orb-pulse ${getOpacity()}`}
        />
      )}

      {/* Living, Moving & Breathing Ambient Celestial Particles Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />
    </div>
  );
};

