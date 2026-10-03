import React from 'react';
import { Check } from 'lucide-react';

export interface ProgressStep {
  label: string;
  sublabel?: string;
}

interface ProgressStepperProps {
  steps: (string | ProgressStep)[];
  currentStep: number; // 0-indexed or 1-indexed (we can handle 0-indexed or 1-indexed)
  variant?: 'dots' | 'numbered' | 'full';
  className?: string;
  onStepClick?: (stepIndex: number) => void;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStep,
  variant = 'full',
  className = '',
  onStepClick,
}) => {
  // Normalize currentStep to 0-indexed
  const activeIndex = currentStep >= 1 && currentStep <= steps.length ? currentStep - 1 : currentStep;

  if (variant === 'dots') {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        {steps.map((_, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;
          return (
            <div
              key={idx}
              onClick={() => onStepClick && onStepClick(idx + 1)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isActive
                  ? 'w-7 bg-gradient-to-r from-pink-500 to-purple-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]'
                  : isDone
                  ? 'w-3 bg-pink-400/60'
                  : 'w-2 bg-white/20'
              } ${onStepClick ? 'cursor-pointer' : ''}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className={`w-full py-2 ${className}`}>
      <div className="relative flex items-center justify-between">
        {/* Connecting line */}
        <div className="absolute top-3.5 left-4 right-4 h-[2px] bg-white/10 -translate-y-1/2 z-0" />
        
        {/* Active progress fill line */}
        <div
          className="absolute top-3.5 left-4 h-[2px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 -translate-y-1/2 z-0 shadow-[0_0_8px_rgba(236,72,153,0.6)] transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, (activeIndex / (steps.length - 1)) * 100))}%`,
          }}
        />

        {steps.map((step, idx) => {
          const label = typeof step === 'string' ? step : step.label;
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;

          return (
            <div
              key={idx}
              onClick={() => onStepClick && onStepClick(idx + 1)}
              className={`relative z-10 flex flex-col items-center group ${
                onStepClick ? 'cursor-pointer' : ''
              }`}
            >
              {/* Step indicator circle */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-[0_0_16px_rgba(236,72,153,0.85)] scale-110 ring-2 ring-pink-300/40'
                    : isDone
                    ? 'bg-pink-950/80 border border-pink-500/60 text-pink-300'
                    : 'bg-[#181124] border border-white/15 text-slate-400'
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-pink-300 stroke-[2.5]" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Label */}
              {variant === 'full' && (
                <span
                  className={`mt-1.5 text-[10px] text-center max-w-[62px] leading-tight font-medium transition-colors ${
                    isActive
                      ? 'text-pink-200 font-semibold'
                      : isDone
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
