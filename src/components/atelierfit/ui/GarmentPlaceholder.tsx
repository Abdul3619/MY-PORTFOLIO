import React from 'react';
import { Sparkles } from 'lucide-react';

interface GarmentPlaceholderProps {
  type?: 'gown' | 'suit' | 'tuxedo' | 'fabric' | 'swatch' | 'model-male' | 'model-female' | 'workshop';
  color?: 'magenta' | 'purple' | 'navy' | 'rose' | 'amber' | 'neutral' | 'cashmere';
  className?: string;
  badge?: string;
  ratio?: 'square' | 'portrait' | 'wide' | 'tall';
}

export const GarmentPlaceholder: React.FC<GarmentPlaceholderProps> = ({
  type = 'suit',
  color = 'magenta',
  className = '',
  badge,
  ratio = 'portrait',
}) => {
  const getGradient = () => {
    switch (color) {
      case 'rose':
        return 'from-[#701A45] via-[#4A0E2E] to-[#1F0715]';
      case 'purple':
        return 'from-[#581C87] via-[#3B0764] to-[#1E0B36]';
      case 'navy':
        return 'from-[#1E293B] via-[#0F172A] to-[#090D16]';
      case 'amber':
        return 'from-[#78350F] via-[#451A03] to-[#1C0A02]';
      case 'cashmere':
        return 'from-[#574136] via-[#3D2C24] to-[#1A130F]';
      case 'neutral':
        return 'from-[#334155] via-[#1E293B] to-[#0F172A]';
      case 'magenta':
      default:
        return 'from-[#831843] via-[#4C0519] to-[#1F0712]';
    }
  };

  const getRatioClass = () => {
    switch (ratio) {
      case 'square':
        return 'aspect-square';
      case 'wide':
        return 'aspect-[16/10]';
      case 'tall':
        return 'aspect-[3/4]';
      case 'portrait':
      default:
        return 'aspect-[4/5]';
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] bg-gradient-to-br ${getGradient()} border border-white/15 shadow-inner flex items-center justify-center group ${getRatioClass()} ${className}`}
    >
      {/* Specular lighting wave mesh */}
      <svg
        className="absolute inset-0 w-full h-full opacity-35 mix-blend-overlay pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="silkSheen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#FF2E93" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path
          d="M -20,20 Q 80,120 180,40 T 380,140"
          fill="none"
          stroke="url(#silkSheen)"
          strokeWidth="38"
          strokeLinecap="round"
        />
        <path
          d="M -30,100 Q 120,40 220,180 T 420,90"
          fill="none"
          stroke="url(#silkSheen)"
          strokeWidth="24"
          strokeLinecap="round"
        />
        <path
          d="M 10,220 Q 140,160 260,280 T 460,200"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="45"
        />
      </svg>

      {/* Subtle geometric couture silhouette */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-3">
        {type === 'gown' ? (
          <svg className="w-16 h-20 text-pink-300/40 drop-shadow-[0_0_12px_rgba(244,114,182,0.5)]" viewBox="0 0 64 80" fill="none" stroke="currentColor">
            <path d="M22 10 L32 24 L42 10 L48 18 L40 32 L46 72 L18 72 L24 32 L16 18 Z" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M28 32 L36 32" strokeWidth="1.5" />
            <path d="M26 44 Q32 48 38 44" strokeWidth="1.2" opacity="0.6" />
          </svg>
        ) : type === 'suit' || type === 'tuxedo' ? (
          <svg className="w-16 h-20 text-purple-200/40 drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]" viewBox="0 0 64 80" fill="none" stroke="currentColor">
            <path d="M18 12 L32 26 L46 12 L50 24 L46 68 L18 68 L14 24 Z" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M32 26 L32 68" strokeWidth="1.2" strokeDasharray="3 3" />
            <path d="M24 16 L32 26 L40 16" strokeWidth="1.5" />
            <path d="M30 20 L34 20" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : type === 'model-male' ? (
          <div className="w-16 h-24 rounded-t-full border border-pink-400/30 flex flex-col items-center pt-2 relative">
            <div className="w-7 h-8 rounded-full border border-pink-300/40" />
            <div className="w-12 h-14 mt-1 border-t-2 border-x border-pink-300/30 rounded-t-xl" />
          </div>
        ) : type === 'model-female' ? (
          <div className="w-16 h-24 rounded-t-full border border-pink-400/30 flex flex-col items-center pt-2 relative">
            <div className="w-6 h-7 rounded-full border border-pink-300/40" />
            <div className="w-14 h-16 mt-1 border-t-2 border-x border-pink-300/30 rounded-t-2xl" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full border border-white/25 flex items-center justify-center bg-white/5">
            <Sparkles className="w-5 h-5 text-pink-300/60" />
          </div>
        )}

        <div className="mt-2 text-[10px] font-mono tracking-wider text-pink-200/50 uppercase">
          Studio Archive
        </div>
      </div>

      {/* Glass border reflection badge */}
      {badge && (
        <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] text-pink-200 font-medium">
          {badge}
        </div>
      )}

      {/* Corner lighting bloom */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-pink-500/25 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
      <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-purple-500/20 blur-xl pointer-events-none" />
    </div>
  );
};
