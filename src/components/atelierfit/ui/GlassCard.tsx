import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  glowBorder?: boolean;
  variant?: 'default' | 'subtle' | 'accent' | 'highlight';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick,
  interactive = false,
  glowBorder = false,
  variant = 'default',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'subtle':
        return 'glass-card-subtle';
      case 'accent':
        return 'bg-gradient-to-b from-[#52163f]/75 via-[#320c27]/85 to-[#1a0515]/90 border-pink-400/45 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.85),inset_0_1.5px_2px_rgba(255,190,230,0.45),0_0_30px_rgba(255,46,147,0.28)]';
      case 'highlight':
        return 'bg-gradient-to-b from-[#64164c]/85 via-[#3f0d34]/90 to-[#22061c]/95 border-pink-400/55 shadow-[0_22px_50px_-10px_rgba(255,46,147,0.35),inset_0_1.5px_2px_rgba(255,210,240,0.55),0_0_40px_rgba(255,46,147,0.35)]';
      default:
        return 'glass-card';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative backdrop-blur-2xl rounded-[22px] p-4 transition-all duration-300 ${getVariantStyles()} ${
        glowBorder ? 'border-pink-400/55 shadow-[0_0_35px_-2px_rgba(255,46,147,0.35)]' : ''
      } ${
        interactive
          ? 'cursor-pointer hover:border-pink-400/70 hover:shadow-[0_22px_50px_-10px_rgba(0,0,0,0.9),0_0_42px_rgba(255,46,147,0.45)] hover:-translate-y-0.5 active:translate-y-0'
          : ''
      } ${className}`}
    >
      {/* Specular pink-tinted top inner glow line */}
      <div className="absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-pink-200/55 to-transparent pointer-events-none z-10" />
      
      {/* Ambient pink inner corner warmth */}
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-pink-500/15 blur-xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-purple-500/10 blur-xl pointer-events-none" />

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

