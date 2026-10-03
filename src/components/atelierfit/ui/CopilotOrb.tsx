import React, { Suspense, lazy, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';
import OrbVisual, { type AssistantState } from '@/components/assistant/OrbVisual';
import useOrbWobble from '@/components/assistant/useOrbWobble';
import '@/components/assistant/assistant.css';

// This used to be a hand-rolled plasma-ball graphic -- the user pointed out it looked "generic" next to the
// real AI assistant orb elsewhere on the portfolio and asked for that one instead, not a lookalike. So this is
// now the SAME orb: AssistantOrb/OrbVisual (the breathing glass sphere with its real wobble physics), just
// recolored to AtelierFit's pink palette via a CSS override scoped to `.atelierfit-root .ai-assistant`
// (see atelierfit-glass.css) instead of the main site's gold -- same mechanism everywhere, not a second copy.
const AssistantOrb = lazy(() => import('@/components/assistant/AssistantOrb'));

export interface CopilotOrbProps {
  size?: 'mini' | 'sm' | 'md' | 'lg' | 'hero';
  state?: AssistantState;
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

const ORB_PX: Record<NonNullable<CopilotOrbProps['size']>, number> = {
  mini: 32,
  sm: 46,
  md: 68,
  lg: 96,
  hero: 140,
};

export const CopilotOrb: React.FC<CopilotOrbProps> = ({
  size = 'sm',
  state = 'idle',
  statusText,
  speechBubble,
  showWaveform = false,
  className = '',
  onClick,
  interactive = false,
}) => {
  const reduceMotion = useReducedMotion() ?? false;
  const energy = useRef(0);
  const orbPx = ORB_PX[size];
  const wobbleRef = useOrbWobble(energy, state, orbPx, reduceMotion);

  const orbGraphic = (
    <div
      onClick={onClick}
      data-state={state}
      className={`ai-assistant relative flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      }`}
      style={{ width: orbPx, height: orbPx }}
    >
      <div ref={wobbleRef} style={{ display: 'inline-flex' }}>
        <Suspense fallback={<OrbVisual size={orbPx} energy={energy} reduceMotion={reduceMotion} />}>
          <AssistantOrb state={state} size={orbPx} energy={energy} reduceMotion={reduceMotion} />
        </Suspense>
      </div>
    </div>
  );

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {speechBubble ? (
        <div className="flex flex-col items-end gap-1.5 max-w-[270px]">
          <div className="flex items-center gap-2">
            <div className="relative glass-card px-3.5 py-2.5 rounded-2xl border border-pink-500/25 bg-purple-950/45 shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_15px_rgba(217,38,136,0.15)] text-right">
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
            <div className="mt-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-pink-500/25 text-[11px] text-pink-200">
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
