/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export function AtelierScreen({ orientation = 'portrait' }: { orientation?: 'portrait' | 'landscape' }) {
  const [signedIn, setSignedIn] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const isLandscape = orientation === 'landscape';

  return (
    <div
      className={`relative w-full h-full bg-[#0d0408] text-white overflow-hidden font-sans select-none flex ${
        isLandscape
          ? 'flex-row items-center justify-between pl-20 pr-10 pt-10 pb-8'
          : 'flex-col justify-between px-6 pt-16 pb-8'
      }`}
    >
      {/* =========================================================================
          ATMOSPHERIC AMBIENT BACKGROUND GLOWS (Matching reference rose-pink silk atmosphere)
          ========================================================================= */}
      <div
        className="absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[300px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(168, 50, 90, 0.35) 0%, rgba(94, 20, 48, 0.18) 45%, transparent 70%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(235, 78, 128, 0.32) 0%, rgba(120, 22, 60, 0.2) 50%, transparent 75%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[320px] h-[220px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(200, 75, 110, 0.25) 0%, transparent 70%)',
          filter: 'blur(35px)',
        }}
      />

      {/* =========================================================================
          LEFT ZONE (in landscape: Celestial Orb; in portrait: Top Brand Header)
          ========================================================================= */}
      {!isLandscape ? (
        /* PORTRAIT: TOP BRAND HEADER */
        <div className="relative z-10 flex flex-col items-center text-center mt-2">
          {/* Monogram A with Crossed Lines and Star Glint */}
          <div className="relative mb-3 flex items-center justify-center">
            <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
              <path d="M24 6L11 40M24 6L37 40M15.5 28.5H32.5" stroke="#fbeae5" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M8 34H40" stroke="#f472b6" strokeWidth="0.8" strokeOpacity="0.5" />
              <path d="M24 4V8M22 6H26" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>

          <h2 className="text-sm font-light tracking-[0.2em] uppercase text-rose-200/80 mb-0.5">Welcome to</h2>
          <h1
            className="text-3xl font-serif tracking-wide font-normal mb-2"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #fed7cc 60%, #f4a290 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Atelier
          </h1>
          <p className="text-[12.5px] leading-relaxed text-rose-100/70 max-w-[240px] font-light">
            Your AI tailoring companion for a wardrobe that understands you.
          </p>
        </div>
      ) : null}

      {/* =========================================================================
          CENTER CELESTIAL GLOWING SPHERE & ORBITAL RINGS
          ========================================================================= */}
      <div className={`relative z-10 flex items-center justify-center ${isLandscape ? 'w-[45%] h-full' : 'my-auto py-2'}`}>
        <div className={`relative flex items-center justify-center ${isLandscape ? 'w-44 h-44' : 'w-48 h-48'}`}>
          {/* Orbital rings */}
          <motion.div
            className="absolute inset-0 rounded-full border border-pink-400/30"
            style={{
              transform: 'rotateX(68deg) rotateY(15deg)',
              boxShadow: '0 0 15px rgba(244, 114, 182, 0.4), inset 0 0 15px rgba(244, 114, 182, 0.2)',
            }}
            animate={{ rotateZ: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          />

          <motion.div
            className="absolute -inset-2 rounded-full border border-rose-300/25"
            style={{
              transform: 'rotateX(55deg) rotateY(-35deg)',
              boxShadow: '0 0 12px rgba(251, 113, 133, 0.3)',
            }}
            animate={{ rotateZ: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />

          {/* Glowing central orb */}
          <div
            className={`relative rounded-full flex items-center justify-center ${isLandscape ? 'w-28 h-28' : 'w-32 h-32'}`}
            style={{
              background: 'radial-gradient(circle at 35% 35%, #ffd4cb 0%, #f472b6 25%, #be185d 55%, #4c0519 85%, #180208 100%)',
              boxShadow: `
                0 0 30px 8px rgba(244, 63, 94, 0.5),
                0 0 60px 18px rgba(219, 39, 119, 0.3),
                inset -6px -6px 16px rgba(0, 0, 0, 0.8),
                inset 6px 6px 16px rgba(255, 255, 255, 0.5)
              `,
            }}
          >
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)',
              }}
            />

            {/* Radiant Four-Point Starburst Center */}
            <motion.div
              className="relative z-10 flex items-center justify-center text-white"
              animate={{ scale: [0.95, 1.08, 0.95] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg className={`${isLandscape ? 'w-11 h-11' : 'w-14 h-14'}`} viewBox="0 0 64 64" fill="none">
                <path
                  d="M32 4 C32 18 36 28 50 32 C36 36 32 46 32 60 C32 46 28 36 14 32 C28 28 32 18 32 4Z"
                  fill="url(#starGlow)"
                  filter="drop-shadow(0 0 8px rgba(255, 255, 255, 0.9))"
                />
                <circle cx="32" cy="32" r="4" fill="#ffffff" filter="drop-shadow(0 0 6px #ffffff)" />
                <defs>
                  <linearGradient id="starGlow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#ffe4e6" />
                    <stop offset="100%" stopColor="#f472b6" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </div>

          <div className="absolute -top-2 left-6 w-1 h-1 bg-white rounded-full animate-ping opacity-75" />
          <div className="absolute top-12 -right-3 w-1.5 h-1.5 bg-rose-200 rounded-full animate-pulse" />
          <div className="absolute bottom-4 -left-2 w-1.5 h-1.5 bg-pink-100 rounded-full animate-pulse" />
        </div>
      </div>

      {/* =========================================================================
          ACTIONS & BRAND IN LANDSCAPE (or Bottom Actions in Portrait)
          ========================================================================= */}
      <div
        className={`relative z-10 flex flex-col justify-center ${
          isLandscape
            ? 'w-[52%] max-w-[360px] gap-2.5 my-auto'
            : 'w-full max-w-[320px] mx-auto gap-3 mb-2'
        }`}
      >
        {/* In landscape: Brand header sits above the buttons on right column */}
        {isLandscape && (
          <div className="mb-1 text-left">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none">
                <path d="M24 6L11 40M24 6L37 40M15.5 28.5H32.5" stroke="#fbeae5" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M8 34H40" stroke="#f472b6" strokeWidth="0.8" strokeOpacity="0.5" />
              </svg>
              <h2 className="text-xs font-light tracking-[0.2em] uppercase text-rose-200/80">Welcome to Atelier</h2>
            </div>
            <p className="text-[11.5px] text-rose-100/70 font-light">
              Your AI tailoring companion for a wardrobe that understands you.
            </p>
          </div>
        )}

        {/* Primary CTA: Continue with Google */}
        <button
          type="button"
          onClick={() => {
            setSignedIn(!signedIn);
            setGuestMode(false);
          }}
          className={`group relative w-full rounded-full transition-all duration-200 active:scale-[0.98] flex items-center justify-between px-5 text-sm font-medium cursor-pointer ${
            isLandscape ? 'h-[44px]' : 'h-[52px]'
          }`}
          style={{
            background: signedIn
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(21, 128, 61, 0.35) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.06) 100%)',
            border: signedIn ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(255, 255, 255, 0.22)',
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            {signedIn ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
              </svg>
            )}
          </div>

          <span className="text-white/95 tracking-wide text-[13px]">
            {signedIn ? 'Connected as Abdul' : 'Continue with Google'}
          </span>
          <ArrowRight className="w-4 h-4 text-white/70 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Secondary CTA: Explore as Guest */}
        <button
          type="button"
          onClick={() => {
            setGuestMode(!guestMode);
            setSignedIn(false);
          }}
          className={`group relative w-full rounded-full transition-all duration-200 active:scale-[0.98] flex items-center justify-between px-6 text-sm font-light cursor-pointer ${
            isLandscape ? 'h-[42px]' : 'h-[50px]'
          }`}
          style={{
            background: guestMode ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span className="w-4" />
          <span className="text-white/80 tracking-wide text-[13px]">
            {guestMode ? 'Exploring as Guest' : 'Explore as Guest'}
          </span>
          <ArrowRight className="w-4 h-4 text-white/50 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Biometric & Privacy note in single compact line in landscape */}
        <div className={`flex items-center justify-center gap-2 text-white/45 ${isLandscape ? 'pt-1 text-[10px]' : 'pt-2 text-[10px] pb-2'}`}>
          <ShieldCheck className="w-3.5 h-3.5 text-rose-300/60" />
          <span>Your privacy matters. We never share your data.</span>
        </div>
      </div>
    </div>
  );
}
