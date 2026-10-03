/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export type PhoneColor = 'rose-gold' | 'natural-titanium' | 'silver' | 'space-black' | 'desert-gold';
export type PhoneOrientation = 'portrait' | 'landscape';

export interface PhoneFrameProps {
  /** Screen content rendered inside the iPhone display */
  children: React.ReactNode;
  /** Width of the phone frame in pixels (default: 390). In portrait, height scales proportionally (~19.5:9). In landscape, width and height swap. */
  width?: number | string;
  /** Device orientation: 'portrait' (default) or 'landscape' */
  orientation?: PhoneOrientation;
  /** Overall scale multiplier (default: 1) */
  scale?: number;
  /** Metallic bezel finish color preset (default: 'rose-gold' matching reference) */
  color?: PhoneColor;
  /** Custom glowing neon color for camera lens reflection halo (default: '#ff4e88' / rose neon) */
  glowColor?: string;
  /** Enable pulsing camera neon light-ring glow (default: true) */
  enableGlow?: boolean;
  /** Enable glossy diagonal glass highlight reflection sweep (default: true) */
  enableGlassReflect?: boolean;
  /** Color theme for status bar & home indicator: 'light' (white for dark wallpapers), 'dark' (slate-900 for light wallpapers), or custom string */
  statusBarColor?: 'light' | 'dark' | string;
  /** Clock time shown on the left of status bar (default: '9:41') */
  time?: string;
  /** Battery percentage level (0 to 100, default: 92) */
  batteryLevel?: number;
  /** Cellular signal strength (1 to 4, default: 4) */
  cellularLevel?: 1 | 2 | 3 | 4;
  /** Wi-Fi signal strength (1 to 3, default: 3) */
  wifiLevel?: 1 | 2 | 3;
  /** Whether to show Dynamic Island pill cutout (default: true) */
  showDynamicIsland?: boolean;
  /** Whether to show status bar (time, cellular, wifi, battery) (default: true) */
  showStatusBar?: boolean;
  /** Whether to show iOS bottom home indicator gesture bar (default: true) */
  showHomeIndicator?: boolean;
  /** Enable subtle, randomized flickering effect simulating OLED refresh/PWM characteristic (default: true) */
  enableOledFlicker?: boolean;
  /** OLED refresh flicker intensity level (default: 'subtle') */
  oledFlickerIntensity?: 'minimal' | 'subtle' | 'medium';
  /** Optional interactive dynamic island click expand */
  interactiveIsland?: boolean;
  /** Optional custom class name applied to outermost frame container */
  className?: string;
  /** Callbacks for physical side buttons */
  onPowerClick?: () => void;
  onVolumeUpClick?: () => void;
  onVolumeDownClick?: () => void;
  onActionClick?: () => void;
}

/**
 * Metallic Chassis Color Schemes
 * Uses multi-stop angled gradients to simulate brushed metallic & titanium specular reflections.
 */
export const COLOR_SCHEMES: Record<PhoneColor, {
  bezelGradient: string;
  outerRing: string;
  innerBevel: string;
  buttonGradient: string;
  antennaColor: string;
  defaultGlow: string;
  name: string;
}> = {
  'rose-gold': {
    name: 'Rose Gold Titanium',
    bezelGradient: 'linear-gradient(135deg, #e4b5a6 0%, #fbede7 12%, #caa091 24%, #6e4034 38%, #a16e61 48%, #f7ded4 58%, #8d5d51 72%, #5a2e24 84%, #d8aba0 94%, #f1d3c8 100%)',
    outerRing: 'rgba(255, 230, 222, 0.45)',
    innerBevel: 'inset 0 0 0 1px rgba(255, 220, 210, 0.25), inset 0 2px 4px rgba(0,0,0,0.7), inset 0 -2px 4px rgba(0,0,0,0.5)',
    buttonGradient: 'linear-gradient(to bottom, #d9aba0, #f6ded5 40%, #8c5d51 80%, #6d3f34 100%)',
    antennaColor: 'rgba(110, 64, 52, 0.65)',
    defaultGlow: '#f43f5e',
  },
  'natural-titanium': {
    name: 'Natural Titanium',
    bezelGradient: 'linear-gradient(135deg, #b0ada8 0%, #ebe8e2 12%, #9f9c96 24%, #585550 38%, #88847e 48%, #e4e1db 58%, #76736d 72%, #42403c 84%, #a5a29c 94%, #dfdbd5 100%)',
    outerRing: 'rgba(240, 238, 232, 0.4)',
    innerBevel: 'inset 0 0 0 1px rgba(235, 232, 226, 0.2), inset 0 2px 4px rgba(0,0,0,0.7), inset 0 -2px 4px rgba(0,0,0,0.5)',
    buttonGradient: 'linear-gradient(to bottom, #b4b1ab, #e2dfd9 40%, #75726c 80%, #52504b 100%)',
    antennaColor: 'rgba(88, 85, 80, 0.65)',
    defaultGlow: '#38bdf8',
  },
  'silver': {
    name: 'Silver / White Titanium',
    bezelGradient: 'linear-gradient(135deg, #d8dbe0 0%, #ffffff 12%, #b4b9c1 24%, #6a717c 38%, #9ca3af 48%, #ffffff 58%, #858d99 72%, #4b525d 84%, #cbd0d8 94%, #f3f4f6 100%)',
    outerRing: 'rgba(255, 255, 255, 0.65)',
    innerBevel: 'inset 0 0 0 1px rgba(255, 255, 255, 0.35), inset 0 2px 4px rgba(0,0,0,0.7), inset 0 -2px 4px rgba(0,0,0,0.5)',
    buttonGradient: 'linear-gradient(to bottom, #d1d5db, #f9fafb 40%, #9ca3af 80%, #6b7280 100%)',
    antennaColor: 'rgba(107, 114, 128, 0.65)',
    defaultGlow: '#60a5fa',
  },
  'space-black': {
    name: 'Space Black Titanium',
    bezelGradient: 'linear-gradient(135deg, #3d4046 0%, #6b7079 12%, #2d3036 24%, #121316 38%, #282a2f 48%, #5d626c 58%, #222428 72%, #0e0f11 84%, #3a3d43 94%, #535760 100%)',
    outerRing: 'rgba(148, 163, 184, 0.25)',
    innerBevel: 'inset 0 0 0 1px rgba(100, 116, 139, 0.15), inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -2px 4px rgba(0,0,0,0.7)',
    buttonGradient: 'linear-gradient(to bottom, #3b3e44, #5a5f68 40%, #202226 80%, #151618 100%)',
    antennaColor: 'rgba(15, 17, 20, 0.85)',
    defaultGlow: '#a855f7',
  },
  'desert-gold': {
    name: 'Desert Gold Titanium',
    bezelGradient: 'linear-gradient(135deg, #dfc6a2 0%, #faecd7 12%, #bfa47d 24%, #6e5839 38%, #a0855c 48%, #f8ebd5 58%, #8e734c 72%, #554125 84%, #d1b791 94%, #f0dec5 100%)',
    outerRing: 'rgba(250, 236, 215, 0.45)',
    innerBevel: 'inset 0 0 0 1px rgba(250, 236, 215, 0.25), inset 0 2px 4px rgba(0,0,0,0.7), inset 0 -2px 4px rgba(0,0,0,0.5)',
    buttonGradient: 'linear-gradient(to bottom, #d4bca0, #f8ecd9 40%, #8f7551 80%, #6a5336 100%)',
    antennaColor: 'rgba(110, 88, 57, 0.65)',
    defaultGlow: '#fbbf24',
  },
};

/**
 * Inline vector Wi-Fi Icon (crisp iOS 3-arc style)
 */
export function WifiIcon({ className = 'w-[15px] h-[12px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 12" fill="currentColor">
      <path d="M8 9.9a1.35 1.35 0 1 1 0 2.7 1.35 1.35 0 0 1 0-2.7z" />
      <path
        d="M4.6 7.6a4.8 4.8 0 0 1 6.8 0 .85.85 0 0 0 1.2-1.2 6.5 6.5 0 0 0-9.2 0 .85.85 0 1 0 1.2 1.2z"
        fillRule="evenodd"
      />
      <path
        d="M2 5a8.5 8.5 0 0 1 12 0 .85.85 0 0 0 1.2-1.2 10.2 10.2 0 0 0-14.4 0 .85.85 0 0 0 1.2 1.2z"
        fillRule="evenodd"
      />
    </svg>
  );
}

/**
 * Inline vector Cellular Signal Bars (4 staircase bars)
 */
export function CellularIcon({
  level = 4,
  className = 'w-[17px] h-[11px]',
}: {
  level?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 18 12" fill="currentColor">
      <rect x="0.5" y="8.5" width="3" height="3.5" rx="0.75" opacity={level >= 1 ? 1 : 0.3} />
      <rect x="5" y="6" width="3" height="6" rx="0.75" opacity={level >= 2 ? 1 : 0.3} />
      <rect x="9.5" y="3.5" width="3" height="8.5" rx="0.75" opacity={level >= 3 ? 1 : 0.3} />
      <rect x="14" y="1" width="3" height="11" rx="0.75" opacity={level >= 4 ? 1 : 0.3} />
    </svg>
  );
}

/**
 * Inline vector Battery Icon (crisp iOS pill outline with dynamic fill and nub)
 */
export function BatteryIcon({
  level = 92,
  className = 'w-[25px] h-[12px]',
}: {
  level?: number;
  className?: string;
}) {
  const clampedLevel = Math.max(0, Math.min(100, level));
  const fillWidth = Math.max(2, (clampedLevel / 100) * 16.5);
  const isLow = clampedLevel <= 20;

  return (
    <svg className={className} viewBox="0 0 26 12" fill="none">
      {/* Outer rounded rectangle outline */}
      <rect
        x="0.75"
        y="0.75"
        width="21.5"
        height="10.5"
        rx="3.25"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.9"
      />
      {/* Inner battery charge level fill */}
      <rect
        x="2.5"
        y="2.5"
        width={fillWidth}
        height="7"
        rx="1.75"
        fill={isLow ? '#ef4444' : 'currentColor'}
      />
      {/* Battery terminal positive nub on right */}
      <path
        d="M23.5 4C24.3 4 24.8 4.6 24.8 5.3V6.7C24.8 7.4 24.3 8 23.5 8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

/**
 * PhoneFrame Component
 * A photorealistic, pure CSS & SVG iPhone mockup component.
 */
export function PhoneFrame({
  children,
  width = 390,
  orientation = 'portrait',
  scale = 1,
  color = 'rose-gold',
  glowColor,
  enableGlow = true,
  enableGlassReflect = true,
  statusBarColor = 'light',
  time = '9:41',
  batteryLevel = 92,
  cellularLevel = 4,
  wifiLevel = 3,
  showDynamicIsland = true,
  showStatusBar = true,
  showHomeIndicator = true,
  enableOledFlicker = true,
  oledFlickerIntensity = 'subtle',
  interactiveIsland = false,
  className = '',
  onPowerClick,
  onVolumeUpClick,
  onVolumeDownClick,
  onActionClick,
}: PhoneFrameProps) {
  const [islandExpanded, setIslandExpanded] = useState(false);
  const scheme = COLOR_SCHEMES[color] || COLOR_SCHEMES['rose-gold'];
  const activeGlow = glowColor || scheme.defaultGlow;
  const isLandscape = orientation === 'landscape';

  // Randomized OLED refresh flicker simulation
  const [flickerBrightness, setFlickerBrightness] = useState<number>(1);
  const [flickerOpacity, setFlickerOpacity] = useState<number>(1);

  useEffect(() => {
    if (!enableOledFlicker) {
      setFlickerBrightness(1);
      setFlickerOpacity(1);
      return;
    }

    let isMounted = true;
    let timeoutId: any;

    const scheduleNextFlicker = () => {
      // Random interval between 1.5s and 4.2s for organic OLED refresh simulation
      const nextDelay = 1500 + Math.random() * 2700;
      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        const multiplier =
          oledFlickerIntensity === 'minimal'
            ? 0.45
            : oledFlickerIntensity === 'medium'
            ? 1.75
            : 1.0;

        // Subtle randomized micro-delta (±0.7% - 1.3% brightness, ±0.3% - 0.7% opacity)
        const sign = Math.random() > 0.5 ? 1 : -1;
        const deltaB = sign * (0.007 + Math.random() * 0.007) * multiplier;
        const deltaO = (0.003 + Math.random() * 0.005) * multiplier;

        setFlickerBrightness(1 + deltaB);
        setFlickerOpacity(Math.max(0.985, 1 - deltaO));

        // Quick micro-pulse duration before returning to baseline (65ms - 125ms)
        const pulseDuration = 65 + Math.random() * 60;
        setTimeout(() => {
          if (!isMounted) return;
          // Organic secondary micro-settle for phosphor/OLED decay
          if (Math.random() > 0.45) {
            setFlickerBrightness(1 - deltaB * 0.35);
            setTimeout(() => {
              if (isMounted) {
                setFlickerBrightness(1);
                setFlickerOpacity(1);
              }
            }, 45);
          } else {
            setFlickerBrightness(1);
            setFlickerOpacity(1);
          }
        }, pulseDuration);

        scheduleNextFlicker();
      }, nextDelay);
    };

    scheduleNextFlicker();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enableOledFlicker, oledFlickerIntensity]);

  // Determine status bar text/icon color
  const statusColorClass =
    statusBarColor === 'light'
      ? 'text-white'
      : statusBarColor === 'dark'
      ? 'text-slate-900'
      : '';
  const statusCustomColor =
    statusBarColor !== 'light' && statusBarColor !== 'dark' ? statusBarColor : undefined;

  // Numeric width handling for proportional calculations
  const parsedWidth = typeof width === 'number' ? width : parseInt(String(width), 10) || 390;
  // Standard iPhone aspect ratio is ~19.5:9 -> height is approx width * 2.164
  const calculatedHeight = Math.round(parsedWidth * 2.164);

  // In landscape, swap outer dimensions
  const frameWidth = isLandscape ? calculatedHeight : parsedWidth;
  const frameHeight = isLandscape ? parsedWidth : calculatedHeight;

  return (
    <div
      className={`relative select-none inline-block transition-all duration-300 ${className}`}
      style={{
        width: frameWidth,
        height: frameHeight,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
      }}
    >
      {/* =========================================================================
          1. PHYSICAL SIDE BUTTONS (Adjusted for portrait vs landscape)
          ========================================================================= */}
      {!isLandscape ? (
        <>
          {/* PORTRAIT: LEFT SIDE - Action Button */}
          <button
            type="button"
            aria-label="Action Button"
            onClick={onActionClick}
            className="group absolute -left-[3.5px] top-[108px] w-[4px] h-[28px] rounded-l-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '-1.5px 0 2px 0 rgba(0,0,0,0.45), inset 1px 0 0.5px rgba(255,255,255,0.4)',
            }}
            title="Action Button"
          >
            <span className="sr-only">Action Button</span>
          </button>

          {/* PORTRAIT: LEFT SIDE - Volume Up Button */}
          <button
            type="button"
            aria-label="Volume Up"
            onClick={onVolumeUpClick}
            className="group absolute -left-[3.5px] top-[152px] w-[4px] h-[52px] rounded-l-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '-1.5px 0 2px 0 rgba(0,0,0,0.45), inset 1px 0 0.5px rgba(255,255,255,0.4)',
            }}
            title="Volume Up"
          >
            <span className="sr-only">Volume Up</span>
          </button>

          {/* PORTRAIT: LEFT SIDE - Volume Down Button */}
          <button
            type="button"
            aria-label="Volume Down"
            onClick={onVolumeDownClick}
            className="group absolute -left-[3.5px] top-[216px] w-[4px] h-[52px] rounded-l-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '-1.5px 0 2px 0 rgba(0,0,0,0.45), inset 1px 0 0.5px rgba(255,255,255,0.4)',
            }}
            title="Volume Down"
          >
            <span className="sr-only">Volume Down</span>
          </button>

          {/* PORTRAIT: RIGHT SIDE - Power / Side Button */}
          <button
            type="button"
            aria-label="Power Button"
            onClick={onPowerClick}
            className="group absolute -right-[3.5px] top-[172px] w-[4px] h-[78px] rounded-r-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '1.5px 0 2px 0 rgba(0,0,0,0.45), inset -1px 0 0.5px rgba(255,255,255,0.4)',
            }}
            title="Power / Side Button"
          >
            <span className="sr-only">Power / Lock Button</span>
          </button>
        </>
      ) : (
        <>
          {/* LANDSCAPE: TOP EDGE - Power Button (rotated 90° CCW) */}
          <button
            type="button"
            aria-label="Power Button"
            onClick={onPowerClick}
            className="group absolute -top-[3.5px] right-[172px] h-[4px] w-[78px] rounded-t-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '0 -1.5px 2px 0 rgba(0,0,0,0.45), inset 0 1px 0.5px rgba(255,255,255,0.4)',
            }}
            title="Power / Side Button"
          >
            <span className="sr-only">Power / Lock Button</span>
          </button>

          {/* LANDSCAPE: BOTTOM EDGE - Action Button */}
          <button
            type="button"
            aria-label="Action Button"
            onClick={onActionClick}
            className="group absolute -bottom-[3.5px] left-[108px] h-[4px] w-[28px] rounded-b-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '0 1.5px 2px 0 rgba(0,0,0,0.45), inset 0 -1px 0.5px rgba(255,255,255,0.4)',
            }}
            title="Action Button"
          >
            <span className="sr-only">Action Button</span>
          </button>

          {/* LANDSCAPE: BOTTOM EDGE - Volume Up Button */}
          <button
            type="button"
            aria-label="Volume Up"
            onClick={onVolumeUpClick}
            className="group absolute -bottom-[3.5px] left-[152px] h-[4px] w-[52px] rounded-b-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '0 1.5px 2px 0 rgba(0,0,0,0.45), inset 0 -1px 0.5px rgba(255,255,255,0.4)',
            }}
            title="Volume Up"
          >
            <span className="sr-only">Volume Up</span>
          </button>

          {/* LANDSCAPE: BOTTOM EDGE - Volume Down Button */}
          <button
            type="button"
            aria-label="Volume Down"
            onClick={onVolumeDownClick}
            className="group absolute -bottom-[3.5px] left-[216px] h-[4px] w-[52px] rounded-b-[2px] transition-all cursor-pointer z-0 focus:outline-none"
            style={{
              background: scheme.buttonGradient,
              boxShadow: '0 1.5px 2px 0 rgba(0,0,0,0.45), inset 0 -1px 0.5px rgba(255,255,255,0.4)',
            }}
            title="Volume Down"
          >
            <span className="sr-only">Volume Down</span>
          </button>
        </>
      )}

      {/* =========================================================================
          2. OUTER METALLIC BEZEL (Brushed metal / titanium frame catching light)
          ========================================================================= */}
      <div
        className="relative w-full h-full rounded-[56px] p-[4px] shadow-2xl transition-all duration-300"
        style={{
          background: scheme.bezelGradient,
          boxShadow: `
            0 0 0 1px ${scheme.outerRing},
            0 24px 60px -12px rgba(0, 0, 0, 0.65),
            0 8px 24px -6px rgba(0, 0, 0, 0.45)
          `,
        }}
      >
        {/* Antenna break lines (adjusted for orientation) */}
        {!isLandscape ? (
          <>
            <div className="absolute -left-[1px] top-[90px] w-[5px] h-[2px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
            <div className="absolute -left-[1px] bottom-[90px] w-[5px] h-[2px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
            <div className="absolute -right-[1px] top-[90px] w-[5px] h-[2px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
            <div className="absolute -right-[1px] bottom-[90px] w-[5px] h-[2px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
          </>
        ) : (
          <>
            <div className="absolute top-[-1px] left-[90px] w-[2px] h-[5px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
            <div className="absolute top-[-1px] right-[90px] w-[2px] h-[5px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
            <div className="absolute bottom-[-1px] left-[90px] w-[2px] h-[5px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
            <div className="absolute bottom-[-1px] right-[90px] w-[2px] h-[5px] rounded-xs pointer-events-none" style={{ background: scheme.antennaColor }} />
          </>
        )}

        {/* =======================================================================
            3. INNER BEVEL & BLACK SCREEN BORDER (Real depth/thickness)
            ======================================================================= */}
        <div
          className="relative w-full h-full rounded-[52px] p-[9px] bg-black"
          style={{
            boxShadow: scheme.innerBevel,
          }}
        >
          {/* Earpiece speaker micro-slit */}
          {!isLandscape ? (
            <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-[52px] h-[3px] rounded-full bg-[#18181b] shadow-inner pointer-events-none z-30" />
          ) : (
            <div className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[52px] rounded-full bg-[#18181b] shadow-inner pointer-events-none z-30" />
          )}

          {/* =====================================================================
              4. SCREEN OLED DISPLAY CONTAINER
              ===================================================================== */}
          <div className="relative w-full h-full rounded-[43px] overflow-hidden bg-black flex flex-col isolation">
            {/* Screen Content (Children Prop) with Subtle Randomized OLED Refresh Flickering */}
            <div
              className="relative w-full h-full z-10 flex flex-col overflow-hidden will-change-[filter,opacity]"
              style={{
                filter: enableOledFlicker
                  ? `brightness(${flickerBrightness}) contrast(1.002)`
                  : undefined,
                opacity: flickerOpacity,
                transition: 'filter 60ms ease-out, opacity 60ms ease-out',
              }}
            >
              {children}
            </div>

            {/* Subtle OLED sub-pixel refresh sweep overlay */}
            {enableOledFlicker && (
              <div
                className="absolute inset-0 pointer-events-none z-15 overflow-hidden mix-blend-screen"
                style={{ opacity: 0.6 }}
              >
                <div
                  className="w-full h-full absolute top-0 left-0 animate-oled-sweep pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.03) 48%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.03) 52%, transparent 100%)',
                  }}
                />
              </div>
            )}

            {/* ===================================================================
                5. STATUS BAR (iOS 17/18 style - adapts to landscape/portrait)
                =================================================================== */}
            {showStatusBar && (
              <div
                className={`absolute top-0 left-0 right-0 flex items-center justify-between pointer-events-none z-30 ${statusColorClass} ${
                  !isLandscape
                    ? 'h-[48px] px-7 pt-3'
                    : 'h-[36px] pl-16 pr-8 pt-2'
                }`}
                style={{ color: statusCustomColor }}
              >
                {/* Time (rounded sans-serif, matching reference 9:41) */}
                <span className="text-[14px] font-semibold tracking-tight font-sans pl-1.5 tabular-nums">
                  {time}
                </span>

                {/* Right Status Cluster: Cellular, Wi-Fi, Battery */}
                <div className="flex items-center gap-1.5 pr-1">
                  <CellularIcon level={cellularLevel} />
                  <WifiIcon />
                  <BatteryIcon level={batteryLevel} />
                </div>
              </div>
            )}

            {/* ===================================================================
                6. DYNAMIC ISLAND WITH ANIMATED CAMERA GLOW HALO
                (Horizontal at top in portrait, Vertical on left bezel in landscape)
                =================================================================== */}
            {showDynamicIsland && (
              !isLandscape ? (
                /* PORTRAIT DYNAMIC ISLAND */
                <div
                  className="absolute top-[11px] left-1/2 -translate-x-1/2 z-40 transition-all duration-300"
                  onClick={() => interactiveIsland && setIslandExpanded(!islandExpanded)}
                  style={{ cursor: interactiveIsland ? 'pointer' : 'default' }}
                >
                  <div
                    className={`bg-black rounded-full transition-all duration-300 flex items-center justify-between px-3 shadow-lg ${
                      islandExpanded
                        ? 'w-[240px] h-[52px] px-4'
                        : 'w-[114px] h-[30px]'
                    }`}
                    style={{
                      boxShadow: '0 2px 8px rgba(0,0,0,0.8), inset 0 0 1px rgba(255,255,255,0.1)',
                    }}
                  >
                    {/* Left: Sensor Dot / Expanded Left Slot */}
                    {!islandExpanded ? (
                      <div className="w-[10px] h-[10px] rounded-full bg-[#0a0a0c] shadow-inner ml-0.5 border border-white/5" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-white text-xs font-medium">Active</span>
                      </div>
                    )}

                    {/* Right: Camera Lens with Animated Neon Glowing Light-Ring */}
                    <div className="relative flex items-center justify-center mr-0.5">
                      {enableGlow && (
                        <motion.div
                          className="absolute rounded-full pointer-events-none"
                          style={{
                            width: '24px',
                            height: '24px',
                            background: `radial-gradient(circle, ${activeGlow}55 0%, ${activeGlow}22 55%, transparent 75%)`,
                            boxShadow: `0 0 10px 2px ${activeGlow}66, 0 0 18px 4px ${activeGlow}33`,
                          }}
                          animate={{
                            scale: [0.92, 1.18, 0.92],
                            opacity: [0.65, 1, 0.65],
                          }}
                          transition={{
                            duration: 3.2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                      )}

                      <div
                        className="relative w-[11px] h-[11px] rounded-full flex items-center justify-center"
                        style={{
                          background: 'radial-gradient(circle, #08101e 30%, #030712 100%)',
                          boxShadow: 'inset 0 0 2px rgba(255,255,255,0.25), 0 0 1px rgba(0,0,0,0.9)',
                        }}
                      >
                        <div
                          className="w-[5px] h-[5px] rounded-full relative"
                          style={{
                            background: 'radial-gradient(circle at 35% 35%, #1e3a5f 0%, #0a101d 85%)',
                          }}
                        >
                          <div className="absolute top-[1px] right-[1px] w-[1.2px] h-[1.2px] rounded-full bg-white opacity-85 shadow-[0_0_2px_#ffffff]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* LANDSCAPE DYNAMIC ISLAND (Pill on left edge of the horizontal screen) */
                <div
                  className="absolute left-[11px] top-1/2 -translate-y-1/2 z-40 transition-all duration-300"
                  onClick={() => interactiveIsland && setIslandExpanded(!islandExpanded)}
                  style={{ cursor: interactiveIsland ? 'pointer' : 'default' }}
                >
                  <div
                    className={`bg-black rounded-full transition-all duration-300 flex flex-col items-center justify-between py-3 shadow-lg ${
                      islandExpanded
                        ? 'w-[52px] h-[220px] py-4'
                        : 'w-[30px] h-[114px]'
                    }`}
                    style={{
                      boxShadow: '0 2px 8px rgba(0,0,0,0.8), inset 0 0 1px rgba(255,255,255,0.1)',
                    }}
                  >
                    {/* Top: Sensor Dot / Expanded Top Slot */}
                    {!islandExpanded ? (
                      <div className="w-[10px] h-[10px] rounded-full bg-[#0a0a0c] shadow-inner mt-0.5 border border-white/5" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-white text-[10px] font-medium rotate-90 my-2">Active</span>
                      </div>
                    )}

                    {/* Bottom: Camera Lens with Animated Neon Glowing Light-Ring */}
                    <div className="relative flex items-center justify-center mb-0.5">
                      {enableGlow && (
                        <motion.div
                          className="absolute rounded-full pointer-events-none"
                          style={{
                            width: '24px',
                            height: '24px',
                            background: `radial-gradient(circle, ${activeGlow}55 0%, ${activeGlow}22 55%, transparent 75%)`,
                            boxShadow: `0 0 10px 2px ${activeGlow}66, 0 0 18px 4px ${activeGlow}33`,
                          }}
                          animate={{
                            scale: [0.92, 1.18, 0.92],
                            opacity: [0.65, 1, 0.65],
                          }}
                          transition={{
                            duration: 3.2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                      )}

                      <div
                        className="relative w-[11px] h-[11px] rounded-full flex items-center justify-center"
                        style={{
                          background: 'radial-gradient(circle, #08101e 30%, #030712 100%)',
                          boxShadow: 'inset 0 0 2px rgba(255,255,255,0.25), 0 0 1px rgba(0,0,0,0.9)',
                        }}
                      >
                        <div
                          className="w-[5px] h-[5px] rounded-full relative"
                          style={{
                            background: 'radial-gradient(circle at 35% 35%, #1e3a5f 0%, #0a101d 85%)',
                          }}
                        >
                          <div className="absolute top-[1px] right-[1px] w-[1.2px] h-[1.2px] rounded-full bg-white opacity-85 shadow-[0_0_2px_#ffffff]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ===================================================================
                7. SCREEN GLASS SPECULAR HIGHLIGHT
                (Subtle diagonal glossy sweep near top without obscuring content)
                =================================================================== */}
            {enableGlassReflect && (
              <div
                className="absolute inset-0 rounded-[43px] pointer-events-none z-20 overflow-hidden"
                style={{
                  background:
                    'linear-gradient(130deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 22%, rgba(255, 255, 255, 0) 45%)',
                }}
              >
                {/* Secondary gentle curved specular rim */}
                <div
                  className="absolute -top-[120px] -right-[120px] w-[320px] h-[320px] rounded-full pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 70%)',
                  }}
                />
              </div>
            )}

            {/* ===================================================================
                8. HOME INDICATOR (iOS bottom gesture bar)
                =================================================================== */}
            {showHomeIndicator && (
              <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 pointer-events-none z-30">
                <div
                  className={`h-[4.5px] rounded-full transition-all ${
                    !isLandscape ? 'w-[136px]' : 'w-[200px]'
                  } ${statusBarColor === 'dark' ? 'bg-slate-900/60' : 'bg-white/70'}`}
                  style={{
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhoneFrame;
