/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// PhoneFrame component showcase -- this is the Google-AI-Studio-generated configurator app, copied in as-is
// (only the import paths and the default export's name changed so it fits as a page in this site; every piece
// of UI, every control, every interaction below is exactly what was generated). Lives as its own full-screen
// route, same treatment as AtelierFit/StitchBook, so it reads as its own project rather than a page skinned
// into the main site's layout.

import React, { useState } from 'react';
import { PhoneFrame, type PhoneColor } from '@/components/project/PhoneFrame';
import { AtelierScreen } from './AtelierScreen';
import { AudioPlayerScreen, LightProductScreen } from './AudioPlayerScreen';
import {
  Smartphone,
  Sliders,
  Sparkles,
  Volume2,
  Code2,
  Copy,
  Check,
  RotateCcw,
  Palette,
  Eye,
  Bell,
  Lock,
} from 'lucide-react';

export default function PhoneFrameShowcase() {
  // Mockup Configuration States
  const [color, setColor] = useState<PhoneColor>('rose-gold');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [activeScreen, setActiveScreen] = useState<'atelier' | 'audio' | 'light'>('atelier');
  const [width, setWidth] = useState<number>(390);
  const [scale, setScale] = useState<number>(1);
  const [enableGlow, setEnableGlow] = useState<boolean>(true);
  const [glowColor, setGlowColor] = useState<string>('#f43f5e');
  const [enableGlass, setEnableGlass] = useState<boolean>(true);
  const [statusTheme, setStatusTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [showIsland, setShowIsland] = useState<boolean>(true);
  const [showHomeIndicator, setShowHomeIndicator] = useState<boolean>(true);
  const [enableOledFlicker, setEnableOledFlicker] = useState<boolean>(true);
  const [oledIntensity, setOledIntensity] = useState<'minimal' | 'subtle' | 'medium'>('subtle');
  const [copied, setCopied] = useState<boolean>(false);
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);

  // Interactive phone hardware simulation states
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(65);
  const [showVolumeHud, setShowVolumeHud] = useState<boolean>(false);
  const [volumeHudTimeout, setVolumeHudTimeout] = useState<any>(null);
  const [silentMode, setSilentMode] = useState<boolean>(false);
  const [showSilentBanner, setShowSilentBanner] = useState<boolean>(false);

  // Trigger volume HUD on side button click
  const handleVolumeChange = (delta: number) => {
    setVolumeLevel((prev) => {
      const next = Math.max(0, Math.min(100, prev + delta));
      return next;
    });
    setShowVolumeHud(true);
    if (volumeHudTimeout) clearTimeout(volumeHudTimeout);
    const t = setTimeout(() => setShowVolumeHud(false), 1800);
    setVolumeHudTimeout(t);
  };

  // Trigger Action button (mute toggle banner)
  const handleActionClick = () => {
    setSilentMode((prev) => !prev);
    setShowSilentBanner(true);
    setTimeout(() => setShowSilentBanner(false), 2000);
  };

  // Toggle Power / Sleep Lock
  const handlePowerClick = () => {
    setIsLocked((prev) => !prev);
  };

  // Resolve status bar color
  const resolvedStatusBarColor =
    statusTheme === 'auto'
      ? activeScreen === 'light'
        ? 'dark'
        : 'light'
      : statusTheme;

  const colorPresets: { id: PhoneColor; label: string; bg: string; border: string }[] = [
    { id: 'rose-gold', label: 'Rose Gold', bg: 'linear-gradient(135deg, #e4b5a6, #6e4034)', border: '#f7ded4' },
    { id: 'natural-titanium', label: 'Natural', bg: 'linear-gradient(135deg, #b0ada8, #585550)', border: '#ebe8e2' },
    { id: 'silver', label: 'Silver', bg: 'linear-gradient(135deg, #d8dbe0, #6a717c)', border: '#ffffff' },
    { id: 'space-black', label: 'Space Black', bg: 'linear-gradient(135deg, #3d4046, #121316)', border: '#6b7079' },
    { id: 'desert-gold', label: 'Desert Gold', bg: 'linear-gradient(135deg, #dfc6a2, #6e5839)', border: '#faecd7' },
  ];

  const glowPresets = [
    { color: '#f43f5e', name: 'Rose Pink (Ref)' },
    { color: '#38bdf8', name: 'Sky Cyan' },
    { color: '#a855f7', name: 'Violet Neon' },
    { color: '#fbbf24', name: 'Champagne' },
    { color: '#10b981', name: 'Emerald' },
  ];

  const copyCode = () => {
    const snippet = `import PhoneFrame from './components/PhoneFrame';

export function MyPreview() {
  return (
    <PhoneFrame
      color="${color}"
      orientation="${orientation}"
      width={${width}}
      enableGlow={${enableGlow}}
      glowColor="${glowColor}"
      enableGlassReflect={${enableGlass}}
      enableOledFlicker={${enableOledFlicker}}
      oledFlickerIntensity="${oledIntensity}"
      statusBarColor="${resolvedStatusBarColor}"
    >
      {/* Any React app or screen content here */}
      <div className="w-full h-full bg-slate-950 text-white p-6">
        <h1>Your App Content</h1>
      </div>
    </PhoneFrame>
  );
}`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col font-sans selection:bg-rose-500/30">
      {/* Top Header */}
      <header className="w-full border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-300 p-[1.5px] flex items-center justify-center shadow-lg shadow-rose-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-rose-300" />
              </div>
            </div>
            <div>
              <span className="font-semibold text-white tracking-tight text-sm">PhoneFrame</span>
              <span className="text-white/40 text-xs ml-2 font-mono">v1.0 · Pure CSS & SVG</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Orientation Toggle Button */}
            <button
              type="button"
              onClick={() => setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                orientation === 'landscape'
                  ? 'bg-rose-500/25 border-rose-500/60 text-rose-200'
                  : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
              }`}
              title={`Switch to ${orientation === 'portrait' ? 'Landscape' : 'Portrait'}`}
            >
              <RotateCcw className={`w-3.5 h-3.5 transition-transform duration-300 ${orientation === 'landscape' ? '-rotate-90 text-rose-400' : ''}`} />
              <span className="font-sans">{orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCodeModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Code2 className="w-3.5 h-3.5 text-rose-300" />
              <span>Export Component</span>
            </button>
            <button
              type="button"
              onClick={copyCode}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Control Workbench */}
        <section className="lg:col-span-4 bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
          {/* Section 1: Screen Content Presets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-rose-400" />
                Screen Content
              </span>
              <span className="text-[11px] text-white/40">3 Presets</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveScreen('atelier')}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                  activeScreen === 'atelier'
                    ? 'bg-rose-500/20 border border-rose-500/60 text-rose-200 shadow-sm'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                Atelier (Ref)
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('audio')}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                  activeScreen === 'audio'
                    ? 'bg-rose-500/20 border border-rose-500/60 text-rose-200 shadow-sm'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                Music Player
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('light')}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-center ${
                  activeScreen === 'light'
                    ? 'bg-rose-500/20 border border-rose-500/60 text-rose-200 shadow-sm'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                Light Store
              </button>
            </div>
          </div>

          {/* Section 1.5: Device Orientation Toggle */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                Device Orientation
              </span>
              <span className="text-[11px] text-rose-300 font-medium capitalize">{orientation}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  orientation === 'portrait'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  orientation === 'landscape'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 -rotate-90" />
                <span>Landscape</span>
              </button>
            </div>
          </div>

          {/* Section 2: Metallic Chassis Finish */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-rose-400" />
                Metallic Bezel Finish
              </span>
              <span className="text-[11px] text-rose-300 font-medium">
                {colorPresets.find((c) => c.id === color)?.label}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {colorPresets.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  title={c.label}
                  className={`h-12 rounded-xl transition-all relative flex items-center justify-center cursor-pointer ${
                    color === c.id
                      ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900 scale-105'
                      : 'hover:opacity-90 opacity-70'
                  }`}
                  style={{
                    background: c.bg,
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.5)',
                  }}
                >
                  {color === c.id && <Check className="w-4 h-4 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Pulsing Camera Lens Glow */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-2 cursor-pointer">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                Camera Lens Glow
              </label>
              <button
                type="button"
                onClick={() => setEnableGlow(!enableGlow)}
                className={`text-[11px] px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                  enableGlow ? 'bg-rose-500/30 text-rose-200' : 'bg-white/10 text-white/40'
                }`}
              >
                {enableGlow ? 'Active Pulsing' : 'Off'}
              </button>
            </div>

            {enableGlow && (
              <div className="flex items-center gap-2 mt-2">
                {glowPresets.map((g) => (
                  <button
                    key={g.color}
                    type="button"
                    onClick={() => setGlowColor(g.color)}
                    title={g.name}
                    className={`w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                      glowColor === g.color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: g.color,
                      boxShadow: `0 0 10px ${g.color}88`,
                    }}
                  >
                    {glowColor === g.color && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Proportions & Geometry */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-rose-400" />
              Dimensions & Scale
            </span>

            {/* Width Slider */}
            <div>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>Phone Width</span>
                <span className="font-mono text-white/90">{width}px</span>
              </div>
              <input
                type="range"
                min="340"
                max="440"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            {/* Scale Slider */}
            <div>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>Viewport Scale</span>
                <span className="font-mono text-white/90">{scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.15"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
          </div>

          {/* Section 5: Hardware & Toggles */}
          <div className="border-t border-white/10 pt-4 flex flex-col gap-2.5">
            {/* Specular Glass highlight toggle */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80">Glass Specular Highlight</span>
              <button
                type="button"
                onClick={() => setEnableGlass(!enableGlass)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  enableGlass ? 'bg-rose-600' : 'bg-white/15'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all ${
                    enableGlass ? 'left-4.5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Dynamic Island toggle */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80">Dynamic Island Cutout</span>
              <button
                type="button"
                onClick={() => setShowIsland(!showIsland)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  showIsland ? 'bg-rose-600' : 'bg-white/15'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all ${
                    showIsland ? 'left-4.5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Home indicator toggle */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80">Home Gesture Bar</span>
              <button
                type="button"
                onClick={() => setShowHomeIndicator(!showHomeIndicator)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  showHomeIndicator ? 'bg-rose-600' : 'bg-white/15'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all ${
                    showHomeIndicator ? 'left-4.5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* OLED Refresh Characteristic Toggle */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
              <div>
                <span className="text-white/80 block">OLED Refresh Flicker</span>
                <span className="text-[10px] text-white/40">Subtle randomized PWM characteristic</span>
              </div>
              <button
                type="button"
                onClick={() => setEnableOledFlicker(!enableOledFlicker)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  enableOledFlicker ? 'bg-rose-600' : 'bg-white/15'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all ${
                    enableOledFlicker ? 'left-4.5' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* OLED Flicker Intensity Selector */}
            {enableOledFlicker && (
              <div className="flex items-center justify-between text-xs pl-2">
                <span className="text-white/60 text-[11px]">Intensity</span>
                <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                  {(['minimal', 'subtle', 'medium'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setOledIntensity(lvl)}
                      className={`px-2 py-0.5 rounded text-[10px] capitalize transition-colors cursor-pointer ${
                        oledIntensity === lvl ? 'bg-rose-600/40 text-rose-200 font-medium' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Status Bar Theme toggle */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-white/80">Status Bar Theme</span>
              <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                {(['auto', 'light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setStatusTheme(t)}
                    className={`px-2 py-1 rounded text-[11px] capitalize transition-colors cursor-pointer ${
                      statusTheme === t ? 'bg-white/20 text-white font-medium' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Hardware Hints */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-xs text-white/70">
            <span className="font-semibold text-rose-300 block mb-1">Interactive Side Buttons:</span>
            <ul className="space-y-1 text-[11.5px] text-white/60">
              <li>• Click <strong className="text-white/80">Volume Up/Down</strong> on the left side to trigger iOS volume HUD.</li>
              <li>• Click <strong className="text-white/80">Power Button</strong> on the right side to lock/wake screen.</li>
              <li>• Click <strong className="text-white/80">Action Button</strong> (top left) to toggle Silent Mode.</li>
            </ul>
          </div>
        </section>

        {/* Right Column: Phone Mockup Showcase Canvas */}
        <section className="lg:col-span-8 flex flex-col items-center justify-center min-h-[850px] relative">
          {/* Subtle Ambient Studio Light Behind Device */}
          <div
            className="absolute w-[500px] h-[500px] rounded-full pointer-events-none -z-10"
            style={{
              background: `radial-gradient(circle, ${glowColor}25 0%, transparent 65%)`,
              filter: 'blur(80px)',
            }}
          />

          {/* THE REUSABLE PHONEFRAME COMPONENT */}
          <div className="relative">
            <PhoneFrame
              width={width}
              orientation={orientation}
              scale={scale}
              color={color}
              glowColor={glowColor}
              enableGlow={enableGlow}
              enableGlassReflect={enableGlass}
              statusBarColor={resolvedStatusBarColor}
              showDynamicIsland={showIsland}
              showHomeIndicator={showHomeIndicator}
              enableOledFlicker={enableOledFlicker}
              oledFlickerIntensity={oledIntensity}
              interactiveIsland={true}
              onPowerClick={handlePowerClick}
              onVolumeUpClick={() => handleVolumeChange(6)}
              onVolumeDownClick={() => handleVolumeChange(-6)}
              onActionClick={handleActionClick}
            >
              {/* Screen Sleep / Lock State Overlay */}
              <div
                className={`absolute inset-0 bg-black z-50 transition-opacity duration-300 pointer-events-none flex flex-col items-center justify-center ${
                  isLocked ? 'opacity-100 pointer-events-auto' : 'opacity-0'
                }`}
              >
                {isLocked && (
                  <div className="flex flex-col items-center text-center p-6 select-none">
                    <Lock className="w-8 h-8 text-white/50 mb-3" />
                    <span className="text-3xl font-light tracking-tight text-white mb-1">9:41</span>
                    <span className="text-xs text-white/50 mb-8">Saturday, October 3</span>
                    <button
                      type="button"
                      onClick={() => setIsLocked(false)}
                      className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium cursor-pointer transition-colors backdrop-blur-md"
                    >
                      Tap or Press Power to Wake
                    </button>
                  </div>
                )}
              </div>

              {/* Physical iOS Volume Slider HUD (Appears when clicking volume buttons) */}
              {showVolumeHud && (
                <div
                  className={`absolute z-50 bg-black/75 backdrop-blur-md rounded-2xl p-1 flex justify-end border border-white/20 shadow-xl transition-all pointer-events-none animate-in fade-in ${
                    orientation === 'portrait'
                      ? 'left-2.5 top-[165px] w-7 h-24 flex-col'
                      : 'bottom-2.5 left-[165px] h-7 w-24 flex-row'
                  }`}
                >
                  <div
                    className="bg-white rounded-xl transition-all"
                    style={{
                      height: orientation === 'portrait' ? `${volumeLevel}%` : '100%',
                      width: orientation === 'portrait' ? '100%' : `${volumeLevel}%`,
                    }}
                  />
                  <div className={`absolute ${orientation === 'portrait' ? 'top-2 left-1/2 -translate-x-1/2' : 'left-2 top-1/2 -translate-y-1/2'}`}>
                    <Volume2 className="w-3.5 h-3.5 text-white/70" />
                  </div>
                </div>
              )}

              {/* Physical Silent Mode Banner (Appears when clicking Action button) */}
              {showSilentBanner && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-2 text-xs text-white pointer-events-none animate-in fade-in">
                  <Bell className={`w-3.5 h-3.5 ${silentMode ? 'text-rose-400' : 'text-emerald-400'}`} />
                  <span className="font-medium text-[11.5px]">
                    {silentMode ? 'Silent Mode On' : 'Silent Mode Off'}
                  </span>
                </div>
              )}

              {/* Actual App Screen Content */}
              {activeScreen === 'atelier' && <AtelierScreen orientation={orientation} />}
              {activeScreen === 'audio' && <AudioPlayerScreen orientation={orientation} />}
              {activeScreen === 'light' && <LightProductScreen orientation={orientation} />}
            </PhoneFrame>
          </div>
        </section>
      </main>

      {/* Code Export Drawer / Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/20 rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-semibold text-white">Using PhoneFrame in your app</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                className="text-white/50 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto my-4 space-y-4 text-xs">
              <p className="text-white/70">
                Import <code className="text-rose-300 font-mono">PhoneFrame</code> from{' '}
                <code className="text-rose-300 font-mono">./components/PhoneFrame</code> and pass any screen content as
                children:
              </p>

              <pre className="bg-black/70 p-4 rounded-xl text-white/90 font-mono text-[11.5px] overflow-x-auto border border-white/10">
{`import { PhoneFrame } from './components/PhoneFrame';

export function App() {
  return (
    <div className="flex justify-center p-12">
      <PhoneFrame
        color="${color}"
        orientation="${orientation}"
        width={${width}}
        scale={${scale}}
        glowColor="${glowColor}"
        enableGlow={${enableGlow}}
        enableGlassReflect={${enableGlass}}
        enableOledFlicker={${enableOledFlicker}}
        oledFlickerIntensity="${oledIntensity}"
        statusBarColor="${resolvedStatusBarColor}"
      >
        {/* Your mobile web app, iframe, or mockup screen */}
        <div className="w-full h-full bg-slate-950 text-white p-6">
          <h1>Hello World</h1>
        </div>
      </PhoneFrame>
    </div>
  );
}`}
              </pre>

              <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-white/80 space-y-2">
                <h4 className="font-semibold text-rose-300">Props Reference:</h4>
                <ul className="space-y-1 text-[11px] list-disc pl-4 text-white/60">
                  <li><strong className="text-white">children</strong> (React.ReactNode): Screen content to render inside the display</li>
                  <li><strong className="text-white">orientation</strong> ('portrait' | 'landscape'): Device orientation (default: 'portrait')</li>
                  <li><strong className="text-white">width</strong> (number | string): Chassis width in px (default: 390)</li>
                  <li><strong className="text-white">scale</strong> (number): CSS scale transform (default: 1)</li>
                  <li><strong className="text-white">color</strong> ('rose-gold' | 'natural-titanium' | 'silver' | 'space-black' | 'desert-gold')</li>
                  <li><strong className="text-white">glowColor</strong> (string): Custom neon lens halo hex or CSS color</li>
                  <li><strong className="text-white">enableGlow</strong> (boolean): Animate camera neon ring (default: true)</li>
                  <li><strong className="text-white">enableGlassReflect</strong> (boolean): Diagonal glass specular sweep (default: true)</li>
                  <li><strong className="text-white">enableOledFlicker</strong> (boolean): Subtle randomized OLED refresh/PWM flicker (default: true)</li>
                  <li><strong className="text-white">oledFlickerIntensity</strong> ('minimal' | 'subtle' | 'medium')</li>
                  <li><strong className="text-white">statusBarColor</strong> ('light' | 'dark' | string): Text & icon theme</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={copyCode}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Code Copied!' : 'Copy Code Snippet'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
