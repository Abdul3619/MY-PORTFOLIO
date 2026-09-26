import { motion } from "motion/react";
import { Code2, SunMedium, Layers, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CategoryFilterId } from "@/lib/projectCategories";
import { useTheme } from "@/contexts/ThemeContext";

interface ProjectsMetricsBarProps {
  webCount: number;
  solarCount: number;
  totalCount: number;
  activeCategory: CategoryFilterId;
  onSelectCategory: (category: CategoryFilterId) => void;
}

export function ProjectsMetricsBar({
  webCount,
  solarCount,
  totalCount,
  activeCategory,
  onSelectCategory
}: ProjectsMetricsBarProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const webPercentage = totalCount > 0 ? Math.round((webCount / totalCount) * 100) : 0;
  const solarPercentage = totalCount > 0 ? Math.round((solarCount / totalCount) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="mb-10 p-5 md:p-6 rounded-2xl glass-panel relative overflow-hidden shadow-xl transition-all"
    >
      {/* Subtle background ambient gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-[#00F0FF]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Context Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/5 dark:border-white/5 border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-white/5 dark:bg-white/5 bg-slate-100 border border-white/10 dark:border-white/10 border-slate-200 text-white/90 dark:text-white/90 text-slate-800">
            <Layers size={18} className="text-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wider uppercase text-white dark:text-white text-slate-900 font-mono flex items-center gap-2">
              <span>{t("projects.metrics_title", "Portfolio Distribution")}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono normal-case flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                {t("projects.metrics_live", "Verified Works")}
              </span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-400 text-slate-600">
              {t("projects.metrics_subtitle", "Cross-disciplinary output spanning full-stack web platforms and renewable energy systems")}
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-gray-400 dark:text-gray-400 text-slate-600 flex items-center gap-2 self-end sm:self-center">
          <TrendingUp size={14} className="text-gold" />
          <span>{t("projects.metrics_total_label", "Total Projects:")}</span>
          <span className="text-base font-bold text-white dark:text-white text-slate-900 tabular-nums">{totalCount}</span>
        </div>
      </div>

      {/* Metric Visual Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        
        {/* Web Projects Metric Card */}
        <button
          type="button"
          onClick={() => onSelectCategory(activeCategory === "web" ? "all" : "web")}
          className={`relative p-4 rounded-xl text-left transition-all duration-300 border interactive group ${
            activeCategory === "web"
              ? isDark 
                ? "bg-[#00F0FF]/10 border-[#00F0FF]/50 shadow-[0_0_25px_rgba(0,240,255,0.18)]"
                : "bg-cyan-500/10 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30"
              : isDark
                ? "bg-white/[0.02] border-white/5 hover:border-[#00F0FF]/30 hover:bg-[#00F0FF]/[0.03]"
                : "bg-white/80 border-slate-200/90 hover:border-cyan-500/40 hover:bg-cyan-500/[0.04] shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-[#00F0FF] dark:text-[#00F0FF] text-cyan-600">
                <Code2 size={18} />
              </div>
              <div>
                <span className="text-xs font-mono font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400 text-slate-600 block group-hover:text-slate-900 dark:group-hover:text-gray-200 transition-colors">
                  {t("projects.metrics_web_label", "Web Projects")}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  {t("projects.metrics_web_sub", "Full-stack apps, SaaS & client solutions")}
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-2xl md:text-3xl font-display font-bold text-white dark:text-white text-slate-900 group-hover:text-cyan-600 dark:group-hover:text-[#00F0FF] transition-colors tabular-nums">
                {webCount}
              </span>
              <span className="text-xs font-mono text-cyan-600 dark:text-[#00F0FF] ml-1.5 font-semibold">
                ({webPercentage}%)
              </span>
            </div>
          </div>

          {/* Miniature Track Bar */}
          <div className="w-full h-1.5 bg-white/5 dark:bg-white/5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00F0FF] to-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${webPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </button>

        {/* Solar Installations Metric Card */}
        <button
          type="button"
          onClick={() => onSelectCategory(activeCategory === "solar" ? "all" : "solar")}
          className={`relative p-4 rounded-xl text-left transition-all duration-300 border interactive group ${
            activeCategory === "solar"
              ? isDark 
                ? "bg-amber-500/10 border-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.18)]"
                : "bg-amber-500/10 border-amber-500/60 shadow-md ring-1 ring-amber-500/30"
              : isDark
                ? "bg-white/[0.02] border-white/5 hover:border-amber-400/30 hover:bg-amber-500/[0.03]"
                : "bg-white/80 border-slate-200/90 hover:border-amber-500/40 hover:bg-amber-500/[0.04] shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400">
                <SunMedium size={18} />
              </div>
              <div>
                <span className="text-xs font-mono font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400 text-slate-600 block group-hover:text-slate-900 dark:group-hover:text-gray-200 transition-colors">
                  {t("projects.metrics_solar_label", "Solar Installations")}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                  {t("projects.metrics_solar_sub", "PV arrays, battery storage & microgrids")}
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-2xl md:text-3xl font-display font-bold text-white dark:text-white text-slate-900 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors tabular-nums">
                {solarCount}
              </span>
              <span className="text-xs font-mono text-amber-600 dark:text-amber-400 ml-1.5 font-semibold">
                ({solarPercentage}%)
              </span>
            </div>
          </div>

          {/* Miniature Track Bar */}
          <div className="w-full h-1.5 bg-white/5 dark:bg-white/5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${solarPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            />
          </div>
        </button>

      </div>

      {/* Unified Comparison Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 dark:text-gray-400 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" />
            <span className="text-white dark:text-white text-slate-900">{t("projects.metrics_web_label", "Web Projects")}</span>
            <span className="text-gray-400 dark:text-gray-400 text-slate-500 font-semibold">{webPercentage}%</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-gray-400 dark:text-gray-400 text-slate-500 font-semibold">{solarPercentage}%</span>
            <span className="text-white dark:text-white text-slate-900">{t("projects.metrics_solar_label", "Solar Installations")}</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
          </span>
        </div>

        {/* Segmented ratio bar */}
        <div className="relative w-full h-2.5 bg-black/60 dark:bg-black/60 bg-slate-200/90 rounded-full p-0.5 border border-white/10 dark:border-white/10 border-slate-300/80 flex overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#00F0FF] via-cyan-400 to-blue-500 rounded-l-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${webPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 rounded-r-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${solarPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
