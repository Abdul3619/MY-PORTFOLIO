import React, { useState, useMemo } from "react";
import {
  WORLD_COLLECTION,
  type WorldGarment,
  type SupportedCurrency,
  formatPrice,
} from "@/lib/atelierfit/worldCollection";
import {
  Globe,
  X,
  Sparkles,
  Ruler,
  Check,
  Search,
  LayoutGrid,
  Columns,
  Compass,
  ArrowRight,
  ShieldCheck,
  Truck,
  Eye,
  Maximize2,
  Calendar,
} from "lucide-react";

interface WorldCollectionBookProps {
  onSelectGarment: (garment: WorldGarment) => void;
  onBeginFitting: () => void;
}

type FilterCategory = "all" | "women" | "men" | "children" | "modern";
type ViewMode = "spread" | "grid" | "continent";

export function WorldCollectionBook({ onSelectGarment, onBeginFitting }: WorldCollectionBookProps) {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("spread");
  const [searchQuery, setSearchQuery] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>("NGN");
  const [inspectingItem, setInspectingItem] = useState<WorldGarment | null>(null);
  const [zoomImage, setZoomImage] = useState(false);

  const filteredItems = useMemo(() => {
    return WORLD_COLLECTION.filter((item) => {
      const matchesCategory =
        activeFilter === "all" || item.category === activeFilter;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        item.culturalHeritage.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [activeFilter, searchQuery]);

  const counts: Record<FilterCategory, number> = {
    all: WORLD_COLLECTION.length,
    women: WORLD_COLLECTION.filter((i) => i.category === "women").length,
    men: WORLD_COLLECTION.filter((i) => i.category === "men").length,
    children: WORLD_COLLECTION.filter((i) => i.category === "children").length,
    modern: WORLD_COLLECTION.filter((i) => i.category === "modern").length,
  };

  // Grouped by continent for Continental Journey mode
  const continentGroups = useMemo(() => {
    const groups: Record<string, { label: string; icon: string; items: WorldGarment[] }> = {
      Africa: { label: "West & North Africa", icon: "🌍", items: [] },
      Asia: { label: "South & East Asia", icon: "🌏", items: [] },
      Europe: { label: "Europe & Savile Row", icon: "🏛️", items: [] },
      Americas: { label: "The Americas", icon: "🌎", items: [] },
      Contemporary: { label: "Modern & Generation Accents", icon: "✨", items: [] },
    };

    filteredItems.forEach((item) => {
      const c = item.continent || "Contemporary";
      if (groups[c]) {
        groups[c].items.push(item);
      } else {
        groups.Contemporary.items.push(item);
      }
    });

    return Object.entries(groups).filter(([_, g]) => g.items.length > 0);
  }, [filteredItems]);

  return (
    <section className="space-y-6 pb-28 text-white select-none">
      {/* Editorial Header & Brand Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D6397D]/15 border border-[#D6397D]/35 text-[#F8A0C8] text-[10px] font-mono uppercase tracking-widest font-semibold">
            <Globe size={12} className="text-[#D6397D]" />
            <span>Atelier World Collection · Issue N° 04</span>
          </div>

          {/* International Currency Switcher */}
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-full border border-white/10">
            {(["NGN", "USD", "EUR", "GBP"] as SupportedCurrency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all ${
                  currency === c
                    ? "bg-[#D6397D] text-black font-bold shadow-sm"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {c === "NGN" ? "₦ NGN" : c === "USD" ? "$ USD" : c === "EUR" ? "€ EUR" : "£ GBP"}
              </button>
            ))}
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white leading-tight">
          Global Craftsmanship &amp; Modern Tailoring
        </h1>
        <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-xl">
          An editorial lookbook published by Atelier, uniting traditional dress and contemporary tailored silhouettes from across the globe. Each garment is treated with equal dignity, handloom reverence, and millimetric AI precision.
        </p>

        {/* Lookbook Weighting Banner (60% Women, 30% Men, 10% Children/Modern) */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl glass-card-subtle text-[11px] text-white/65 font-mono border border-white/10">
          <span className="text-[#F8A0C8] font-bold">Curator's Weighting:</span>
          <span className="bg-white/5 px-2 py-0.5 rounded-full border border-white/10">60% Women's Couture</span>
          <span className="bg-white/5 px-2 py-0.5 rounded-full border border-white/10">30% Men's Tailoring</span>
          <span className="bg-white/5 px-2 py-0.5 rounded-full border border-white/10">10% Children &amp; Modern</span>
        </div>
      </div>

      {/* Control Bar: Search + Category Filter + View Mode */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search garments, countries, craftsmanship..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl glass-input text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-black/50 border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("spread")}
              aria-label="Editorial Spread Mode"
              title="Editorial Spread"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "spread"
                  ? "bg-[#D6397D] text-black shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Columns size={15} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Runway Grid Mode"
              title="Runway Grid"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-[#D6397D] text-black shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("continent")}
              aria-label="Continental Journey Mode"
              title="Continental Journey"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "continent"
                  ? "bg-[#D6397D] text-black shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Compass size={15} />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {(
            [
              { key: "all", label: "All Looks" },
              { key: "women", label: "Women's Couture" },
              { key: "men", label: "Men's Tailoring" },
              { key: "children", label: "Children's Accent" },
              { key: "modern", label: "Modern Fusion" },
            ] as const
          ).map((tab) => {
            const active = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                  active
                    ? "bg-gradient-to-r from-[#D6397D] to-[#F06BA6] text-black font-semibold border-transparent shadow-[0_2px_12px_rgba(214,57,125,0.4)]"
                    : "glass-card-subtle text-white/60 hover:text-white border-white/10 hover:border-white/20"
                }`}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          MODE 1: EDITORIAL MAGAZINE SPREAD (Creative Asymmetrical Collage)
          ========================================================================= */}
      {viewMode === "spread" && (
        <div className="space-y-6">
          {/* Spotlight Hero Card for First Piece */}
          {filteredItems[0] && (
            <div
              onClick={() => setInspectingItem(filteredItems[0])}
              className="group relative cursor-pointer overflow-hidden rounded-[26px] border border-pink-400/35 bg-[#140513] shadow-[0_16px_40px_rgba(214,57,125,0.25)] transition-all duration-500 hover:border-[#D6397D]/60"
            >
              <div className="relative aspect-[4/5] sm:aspect-[16/10] w-full overflow-hidden">
                <img
                  src={filteredItems[0].imageUrl}
                  alt={filteredItems[0].label}
                  loading="eager"
                  className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10030f] via-[#10030f]/35 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#10030f]/80 via-transparent to-transparent hidden sm:block" />

                {/* Badges */}
                <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-[10px] font-mono uppercase tracking-wider text-white font-medium flex items-center gap-1.5">
                    <span>{filteredItems[0].flagEmoji}</span>
                    <span>{filteredItems[0].region}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#D6397D]/90 text-black text-[10px] font-mono font-bold tracking-wider uppercase">
                    Curator's Spotlight
                  </span>
                </div>

                {/* Bottom Overlay Content */}
                <div className="absolute bottom-4 left-4 right-4 space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#F8A0C8] font-bold">
                    {filteredItems[0].categoryLabel}
                  </span>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-white drop-shadow-md leading-tight">
                    {filteredItems[0].label}
                  </h2>
                  <p className="text-xs text-white/80 line-clamp-2 max-w-md">
                    {filteredItems[0].culturalHeritage}
                  </p>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="font-mono text-sm text-[#F8A0C8] font-bold">
                      {formatPrice(filteredItems[0].basePriceNaira, currency)}{" "}
                      <span className="text-[10px] text-white/50 font-normal">base bespoke</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectGarment(filteredItems[0]);
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Ruler size={13} />
                      <span>Fit This Look</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Secondary 2-Column Editorial Grid for Remaining Items */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {filteredItems.slice(1).map((item) => (
              <div
                key={item.id}
                onClick={() => setInspectingItem(item)}
                className="group relative cursor-pointer overflow-hidden rounded-[22px] border border-white/10 bg-[#120510] glass-card-subtle transition-all duration-300 hover:border-[#D6397D]/50 hover:shadow-[0_10px_30px_rgba(214,57,125,0.22)] flex flex-col"
              >
                {/* 3:4 High-Fashion Editorial Photo Frame */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/40">
                  <img
                    src={item.imageUrl}
                    alt={item.label}
                    loading="lazy"
                    className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e030c] via-[#0e030c]/25 to-transparent" />

                  {/* Floating Origin Pill */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 pointer-events-none">
                    <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[9px] font-mono uppercase tracking-wider text-white/90 font-medium truncate max-w-[85%] flex items-center gap-1">
                      <span>{item.flagEmoji}</span>
                      <span>{item.region.split("·")[0].trim()}</span>
                    </span>
                  </div>
                </div>

                {/* Editorial Details */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-1.5 bg-[#140612]/95">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#F8A0C8]/80 tracking-wider">
                      {item.categoryLabel}
                    </span>
                    <h3 className="font-serif text-sm font-semibold text-white leading-snug line-clamp-2 mt-0.5">
                      {item.label}
                    </h3>
                  </div>

                  <div className="pt-1.5 flex items-center justify-between border-t border-white/10 text-xs">
                    <span className="font-mono text-white/90 font-medium">
                      {formatPrice(item.basePriceNaira, currency)}
                    </span>
                    <span className="text-[10px] text-[#F06BA6] group-hover:translate-x-0.5 transition-transform font-medium flex items-center gap-0.5">
                      Inspect &rarr;
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 2: RUNWAY GRID (Clean Uniform 3:4 Cards)
          ========================================================================= */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setInspectingItem(item)}
              className="group relative cursor-pointer overflow-hidden rounded-[22px] border border-white/10 bg-[#120510] glass-card-subtle transition-all duration-300 hover:border-[#D6397D]/50 hover:shadow-[0_10px_30px_rgba(214,57,125,0.22)] flex flex-col"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/40">
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  loading="lazy"
                  className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e030c] via-[#0e030c]/25 to-transparent" />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[9px] font-mono text-white/90 flex items-center gap-1">
                    <span>{item.flagEmoji}</span>
                    <span>{item.region.split("·")[0].trim()}</span>
                  </span>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between gap-1 bg-[#140612]/95">
                <div>
                  <span className="text-[10px] uppercase font-mono text-[#F8A0C8]/80 tracking-wider">
                    {item.categoryLabel}
                  </span>
                  <h3 className="font-serif text-sm font-semibold text-white leading-snug line-clamp-2 mt-0.5">
                    {item.label}
                  </h3>
                </div>

                <div className="pt-1.5 flex items-center justify-between border-t border-white/10 text-xs">
                  <span className="font-mono text-white/90 font-medium">
                    {formatPrice(item.basePriceNaira, currency)}
                  </span>
                  <span className="text-[10px] text-[#F06BA6] group-hover:translate-x-0.5 transition-transform font-medium">
                    Inspect &rarr;
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          MODE 3: CONTINENTAL JOURNEY (Grouped by Geographic Continents)
          ========================================================================= */}
      {viewMode === "continent" && (
        <div className="space-y-8">
          {continentGroups.map(([key, group]) => (
            <div key={key} className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{group.icon}</span>
                  <h2 className="font-serif text-lg font-bold text-white">{group.label}</h2>
                </div>
                <span className="text-xs font-mono text-[#F8A0C8]">
                  {group.items.length} {group.items.length === 1 ? "design" : "designs"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setInspectingItem(item)}
                    className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-white/10 bg-[#120510] glass-card-subtle transition-all duration-300 hover:border-[#D6397D]/50 flex flex-col"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/40">
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        loading="lazy"
                        className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0e030c] via-transparent to-transparent" />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[9px] font-mono text-white flex items-center gap-1">
                          <span>{item.flagEmoji}</span>
                          <span>{item.region.split("·")[0].trim()}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between gap-1 bg-[#140612]/95">
                      <h4 className="font-serif text-sm font-semibold text-white line-clamp-1">
                        {item.label}
                      </h4>
                      <div className="pt-1 flex items-center justify-between border-t border-white/8 text-xs font-mono text-[#F8A0C8]">
                        <span>{formatPrice(item.basePriceNaira, currency)}</span>
                        <span className="text-[10px] text-white/50">&rarr;</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Global Fitting Trigger Bar */}
      <div className="pt-4 sticky bottom-20 z-20">
        <button
          onClick={onBeginFitting}
          className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#D6397D] via-[#F06BA6] to-[#E04B8C] text-black font-bold text-sm hover:opacity-95 transition-all shadow-[0_8px_30px_rgba(214,57,125,0.45)] flex items-center justify-center gap-2"
        >
          <Ruler size={17} />
          <span>Launch AI Body Fitting for Any Garment</span>
        </button>
      </div>

      {/* =========================================================================
          INTERACTIVE LOOKBOOK MODAL / INSPECTOR SHEET
          ========================================================================= */}
      {inspectingItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => {
            setInspectingItem(null);
            setZoomImage(false);
          }}
        >
          <div
            className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-pink-400/30 bg-[#120510] p-5 sm:p-6 text-left space-y-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-[#F8A0C8] font-bold">
                  {inspectingItem.categoryLabel}
                </span>
                <span className="text-xs font-mono text-white/50">·</span>
                <span className="text-xs font-mono text-white/80 flex items-center gap-1">
                  <span>{inspectingItem.flagEmoji}</span>
                  <span>{inspectingItem.region}</span>
                </span>
              </div>
              <button
                onClick={() => {
                  setInspectingItem(null);
                  setZoomImage(false);
                }}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            {/* Editorial Photo Frame with Lightbox Zoom Toggle */}
            <div
              className={`relative ${
                zoomImage ? "aspect-[9/16]" : "aspect-[3/4]"
              } w-full rounded-2xl overflow-hidden border border-white/15 bg-black/60 transition-all duration-300 cursor-zoom-in`}
              onClick={() => setZoomImage(!zoomImage)}
              title="Tap to toggle full-portrait zoom"
            >
              <img
                src={inspectingItem.imageUrl}
                alt={inspectingItem.label}
                className="w-full h-full object-cover object-top transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomImage(!zoomImage);
                }}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/80 hover:text-white"
                title="Toggle Zoom"
              >
                <Maximize2 size={14} />
              </button>

              <div className="absolute bottom-3 left-3 right-3 text-white pointer-events-none">
                <h2 className="font-serif text-xl font-bold leading-snug">{inspectingItem.label}</h2>
                <p className="font-mono text-sm text-[#F8A0C8] font-bold mt-0.5">
                  {formatPrice(inspectingItem.basePriceNaira, currency)}{" "}
                  <span className="text-white/50 text-[10px] font-normal">base bespoke</span>
                </p>
              </div>
            </div>

            {/* Cultural Heritage & Craftsmanship Breakdown */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#F8A0C8] font-bold flex items-center gap-1.5">
                <Sparkles size={12} /> Cultural Heritage &amp; Craftsmanship
              </h4>
              <p className="text-xs text-white/80 leading-relaxed bg-white/4 p-3 rounded-xl border border-white/8">
                {inspectingItem.culturalHeritage}
              </p>
            </div>

            {/* Silhouette & Architectural Drape Notes */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-mono uppercase tracking-widest text-white/50 font-bold">
                Silhouette &amp; Architectural Drape
              </h4>
              <p className="text-xs text-white/70 leading-relaxed bg-white/2 p-3 rounded-xl border border-white/8">
                {inspectingItem.silhouetteNotes}
              </p>
            </div>

            {/* Recommended Fabrics & Turnaround */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/4 p-3 rounded-xl border border-white/8 space-y-1">
                <span className="text-[10px] uppercase font-mono text-white/45 block">Recommended Fabrics</span>
                <div className="flex flex-wrap gap-1">
                  {inspectingItem.recommendedFabrics.map((f) => (
                    <span key={f} className="text-[11px] text-white/90 font-medium bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-white/4 p-3 rounded-xl border border-white/8 space-y-1">
                <span className="text-[10px] uppercase font-mono text-white/45 block">Bespoke Turnaround</span>
                <p className="text-[11px] text-[#F8A0C8] font-medium font-mono">
                  {inspectingItem.turnaroundDays} – {inspectingItem.turnaroundDays + 2} business days
                </p>
                <p className="text-[10px] text-white/45 flex items-center gap-1">
                  <Truck size={10} /> Nationwide &amp; Global Express
                </p>
              </div>
            </div>

            {/* Action Buttons: Custom Fit This Piece */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  onSelectGarment(inspectingItem);
                  setInspectingItem(null);
                }}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#D6397D] to-[#F06BA6] text-black font-semibold text-sm hover:opacity-95 transition-all shadow-[0_4px_18px_rgba(214,57,125,0.4)] flex items-center justify-center gap-2"
              >
                <Ruler size={16} />
                <span>Custom Fit This Garment with AI</span>
              </button>
              <button
                onClick={() => setInspectingItem(null)}
                className="w-full py-2.5 rounded-xl glass-card-subtle text-white/60 hover:text-white text-xs transition-colors"
              >
                Return to Lookbook
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
