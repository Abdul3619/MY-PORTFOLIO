import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface CopilotOrbProps {
  size?: 'mini' | 'sm' | 'md' | 'lg' | 'hero';
  statusText?: string;
  speechBubble?: {
    title?: string;
    text: string;
    ctaText?: string;
    onCtaClick?: () => void;
  };
  showWaveform?: boolean;
  pulseSpeed?: 'normal' | 'fast';
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export const CopilotOrb: React.FC<CopilotOrbProps> = ({
  size = 'sm',
  statusText,
  speechBubble,
  showWaveform = false,
  className = '',
  onClick,
  interactive = false,
}) => {
  const [blink, setBlink] = useState(false);

  // Periodic natural eye blink
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  // Size dimensions
  const getDimensions = () => {
    switch (size) {
      case 'mini':
        return { orbSize: 32, eyeSize: 3, eyeSpacing: 7 };
      case 'sm':
        return { orbSize: 46, eyeSize: 3.5, eyeSpacing: 10 };
      case 'md':
        return { orbSize: 68, eyeSize: 5, eyeSpacing: 14 };
      case 'lg':
        return { orbSize: 96, eyeSize: 7, eyeSpacing: 20 };
      case 'hero':
        return { orbSize: 180, eyeSize: 10, eyeSpacing: 34 };
      default:
        return { orbSize: 46, eyeSize: 3.5, eyeSpacing: 10 };
    }
  };

  const { orbSize, eyeSize, eyeSpacing } = getDimensions();

  const orbGraphic = (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      }`}
      style={{ width: orbSize + 24, height: orbSize + 24 }}
    >
      {/* Outer ambient glow */}
      <div
        className="absolute rounded-full blur-[16px] pointer-events-none"
        style={{
          width: orbSize * 1.3,
          height: orbSize * 1.3,
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.6) 0%, rgba(168, 85, 247, 0.4) 50%, rgba(0,0,0,0) 80%)',
        }}
      />

      {/* Swirling celestial orbit rings (outer) */}
      <div
        className="absolute inset-0 rounded-full border border-pink-400/35 pointer-events-none animate-spin-slow"
        style={{
          transform: 'rotateX(68deg) rotateY(18deg)',
          boxShadow: '0 0 12px rgba(244, 114, 182, 0.4)',
        }}
      />
      <div
        className="absolute inset-0 rounded-full border border-purple-400/25 pointer-events-none animate-spin-reverse-slow"
        style={{
          transform: 'rotateX(72deg) rotateY(-24deg)',
        }}
      />

      {/* Plasma Core */}
      <div
        className="relative rounded-full flex items-center justify-center overflow-hidden shadow-[0_0_25px_rgba(236,72,153,0.7),inset_0_2px_4px_rgba(255,255,255,0.7)]"
        style={{
          width: orbSize,
          height: orbSize,
          background: 'radial-gradient(circle at 35% 30%, #FFE4F3 0%, #F43F5E 25%, #A855F7 60%, #4C1D95 95%)',
        }}
      >
        {/* Swirling fluid light overlay */}
        <div
          className="absolute inset-0 opacity-70 mix-blend-color-dodge animate-spin-slow pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(255, 255, 255, 0.8) 70deg, transparent 150deg, rgba(251, 113, 133, 0.9) 260deg, transparent 360deg)',
          }}
        />

        {/* Specular glass reflection */}
        <div
          className="absolute top-1.5 left-2 rounded-full bg-white/60 blur-[1px] pointer-events-none"
          style={{
            width: orbSize * 0.38,
            height: orbSize * 0.22,
            transform: 'rotate(-25deg)',
          }}
        />

        {/* Two dot eyes */}
        <div
          className="relative z-10 flex items-center justify-center transition-all duration-150"
          style={{ gap: eyeSpacing }}
        >
          {/* Left eye */}
          <div
            className="rounded-full bg-white transition-all duration-150"
            style={{
              width: eyeSize,
              height: blink ? 1 : eyeSize,
              boxShadow: '0 0 6px #FFFFFF, 0 0 10px #F472B6',
            }}
          />
          {/* Right eye */}
          <div
            className="rounded-full bg-white transition-all duration-150"
            style={{
              width: eyeSize,
              height: blink ? 1 : eyeSize,
              boxShadow: '0 0 6px #FFFFFF, 0 0 10px #F472B6',
            }}
          />
        </div>

        {/* Hero starburst center if in hero mode */}
        {size === 'hero' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-white/20 blur-md animate-ping" />
            <Sparkles className="w-8 h-8 text-pink-100 opacity-80" />
          </div>
        )}
      </div>

      {/* Tiny companion sparkle satellite */}
      {size !== 'mini' && (
        <div
          className="absolute top-1 right-2 w-2 h-2 rounded-full bg-pink-200 shadow-[0_0_8px_#FFF] animate-pulse"
        />
      )}
    </div>
  );

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Speech bubble / suggestion container if provided */}
      {speechBubble ? (
        <div className="flex flex-col items-end gap-1.5 max-w-[270px]">
          <div className="flex items-center gap-2">
            <div className="relative glass-card px-3.5 py-2.5 rounded-2xl border border-pink-500/25 bg-purple-950/45 shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_15px_rgba(217,38,136,0.15)] text-right">
              {/* Little triangle tail */}
              <div className="absolute -right-1.5 top-3.5 w-3 h-3 bg-[#1e132b] rotate-45 border-t border-r border-pink-500/25" />

              {speechBubble.title && (
                <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-pink-300 tracking-wide uppercase">
                  <Sparkles className="w-3 h-3 text-pink-400" />
                  <span>{speechBubble.title}</span>
                </div>
              )}
              <p className="text-[12px] text-slate-200 font-light leading-snug mt-0.5">
                {speechBubble.text}
              </p>
              {speechBubble.ctaText && (
                <button
                  type="button"
                  onClick={speechBubble.onCtaClick}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-pink-300 hover:text-pink-100 transition-colors cursor-pointer"
                >
                  <span>{speechBubble.ctaText}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            {orbGraphic}
          </div>

          {/* Audio waveform / subtext */}
          {(showWaveform || statusText) && (
            <div className="flex items-center gap-2 pr-3 text-[11px] text-pink-300/80 font-medium">
              {showWaveform && (
                <div className="flex items-center gap-0.5 h-3">
                  <span className="w-0.5 h-2 bg-pink-400 rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-pink-300 rounded-full animate-pulse [animation-delay:150ms]" />
                  <span className="w-0.5 h-1.5 bg-pink-400 rounded-full animate-pulse [animation-delay:300ms]" />
                  <span className="w-0.5 h-2.5 bg-pink-300 rounded-full animate-pulse [animation-delay:450ms]" />
                </div>
              )}
              {statusText && <span>{statusText}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {orbGraphic}
          {statusText && (
            <div className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-pink-500/25 text-[11px] text-pink-200">
              {showWaveform && (
                <div className="flex items-center gap-0.5 h-2.5">
                  <span className="w-0.5 h-2 bg-pink-400 rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-pink-300 rounded-full animate-pulse [animation-delay:150ms]" />
                  <span className="w-0.5 h-1.5 bg-pink-400 rounded-full animate-pulse [animation-delay:300ms]" />
                </div>
              )}
              <span>{statusText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
