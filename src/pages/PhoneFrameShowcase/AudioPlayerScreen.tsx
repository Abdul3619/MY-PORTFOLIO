/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Volume2 } from 'lucide-react';

export function AudioPlayerScreen({ orientation = 'portrait' }: { orientation?: 'portrait' | 'landscape' }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(true);
  const [progress, setProgress] = useState(38);
  const isLandscape = orientation === 'landscape';

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-b from-[#1e1e24] via-[#121216] to-[#09090b] text-white font-sans select-none overflow-hidden ${
        isLandscape
          ? 'flex flex-row items-center justify-between pl-20 pr-10 pt-10 pb-6 gap-6'
          : 'flex flex-col justify-between px-6 pt-16 pb-8'
      }`}
    >
      {/* Top Header (Portrait) or Left Section (Landscape) */}
      {!isLandscape ? (
        <div className="flex items-center justify-between text-xs text-white/50 pt-2">
          <span className="uppercase tracking-widest text-[10px]">Playing from Playlist</span>
          <span className="font-semibold text-white/90">Midnight Mood</span>
          <button
            type="button"
            onClick={() => setIsLiked(!isLiked)}
            className="text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>
      ) : null}

      {/* Album Artwork */}
      <div className={`flex flex-col items-center justify-center ${isLandscape ? 'w-[42%] h-full' : 'my-auto py-2'}`}>
        <div
          className={`rounded-3xl p-1 relative shadow-2xl overflow-hidden group ${
            isLandscape ? 'w-44 h-44' : 'w-56 h-56'
          }`}
          style={{
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 30px rgba(244, 63, 94, 0.25)',
          }}
        >
          <div className="w-full h-full rounded-[22px] bg-gradient-to-tr from-rose-950 via-purple-900 to-indigo-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/30 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/30 rounded-full blur-2xl" />
            
            <div className="relative z-10 text-center">
              <span className="text-[10px] font-mono tracking-widest text-pink-300/80 uppercase">Atelier Session</span>
              <h3 className={`${isLandscape ? 'text-lg' : 'text-xl'} font-serif font-light text-white mt-0.5`}>Celestial Silk</h3>
              <p className="text-[11px] text-white/60 mt-0.5">Symphony in Pink & Gold</p>
            </div>
          </div>
        </div>

        {/* Track Title in portrait */}
        {!isLandscape && (
          <div className="w-full mt-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">Ethereal Loom</h2>
              <p className="text-xs text-white/60">Aura & The AI Collective</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-mono">LOSSLESS</span>
          </div>
        )}

        {/* Scrubber in portrait */}
        {!isLandscape && (
          <div className="w-full mt-5">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-rose-400"
            />
            <div className="flex justify-between text-[11px] text-white/40 font-mono mt-1.5">
              <span>1:28</span>
              <span>-2:44</span>
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls & Track Details (Right Column in Landscape, Bottom in Portrait) */}
      <div className={`flex flex-col justify-center ${isLandscape ? 'w-[54%] max-w-[380px] gap-3 my-auto' : 'gap-5 mb-2'}`}>
        {/* Track Title in Landscape */}
        {isLandscape && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white">Ethereal Loom</h2>
                <p className="text-xs text-white/60">Aura & The AI Collective</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLiked(!isLiked)}
                className="text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            </div>

            {/* Scrubber in landscape */}
            <div className="w-full mt-2.5">
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-rose-400"
              />
              <div className="flex justify-between text-[10px] text-white/40 font-mono mt-1">
                <span>1:28</span>
                <span>-2:44</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-2">
          <button type="button" className="text-white/40 hover:text-white transition-colors cursor-pointer">
            <Shuffle className="w-4 h-4" />
          </button>
          <button type="button" className="text-white/80 hover:text-white transition-colors cursor-pointer">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 rounded-full bg-white text-slate-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current translate-x-0.5" />
            )}
          </button>
          <button type="button" className="text-white/80 hover:text-white transition-colors cursor-pointer">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button type="button" className="text-white/40 hover:text-white transition-colors cursor-pointer">
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Volume Output Device */}
        <div className="flex items-center justify-between text-[11px] text-white/50 px-2 pt-2 border-t border-white/5">
          <span className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-rose-400" />
            <span>AirPods Max (Spatial)</span>
          </span>
          <span className="text-rose-400 font-medium">Dolby Atmos</span>
        </div>
      </div>
    </div>
  );
}

export function LightProductScreen({ orientation = 'portrait' }: { orientation?: 'portrait' | 'landscape' }) {
  const [selectedSize, setSelectedSize] = useState('M');
  const isLandscape = orientation === 'landscape';

  return (
    <div
      className={`relative w-full h-full bg-[#faf9f8] text-slate-900 font-sans select-none overflow-hidden ${
        isLandscape
          ? 'flex flex-row items-center justify-between pl-20 pr-10 pt-10 pb-6 gap-6'
          : 'flex flex-col justify-between px-6 pt-16 pb-8'
      }`}
    >
      {/* Product Visual Card */}
      <div className={`flex flex-col ${isLandscape ? 'w-[45%] h-full justify-center' : 'my-auto py-2'}`}>
        <div
          className={`w-full rounded-2xl bg-gradient-to-b from-stone-100 to-stone-200/80 flex items-center justify-center p-6 relative overflow-hidden border border-stone-200/60 shadow-sm ${
            isLandscape ? 'h-48' : 'h-56'
          }`}
        >
          <div className="text-center">
            <span className="text-[10px] tracking-[0.25em] text-stone-500 uppercase">Cashmere Silk</span>
            <h4 className="text-xl font-serif text-slate-800 mt-1">Sculpted Kimono Coat</h4>
            <p className="text-xs text-stone-600 mt-1">Sand Drift · Kyoto</p>
          </div>
        </div>
      </div>

      {/* Right Column in Landscape / Bottom in Portrait */}
      <div className={`flex flex-col justify-center ${isLandscape ? 'w-[52%] max-w-[360px] gap-3 my-auto' : ''}`}>
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-xl font-medium text-slate-900">$840</h3>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Complimentary atelier fitting</p>
          </div>
          <span className="text-xs text-slate-500 font-mono">REF #084-26</span>
        </div>

        {/* Size Selector */}
        <div className="mt-2">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Select Size</span>
          <div className="flex gap-2 mt-1.5">
            {['XS', 'S', 'M', 'L', 'XL'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedSize === size
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200/70'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Order Button */}
        <button
          type="button"
          className="w-full h-11 rounded-xl bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2"
        >
          <span>Reserve Fitting</span>
          <span className="text-stone-400">·</span>
          <span>$840</span>
        </button>
      </div>
    </div>
  );
}
