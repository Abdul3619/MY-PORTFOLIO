import { motion } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative rounded-full p-2 flex items-center justify-center transition-all duration-300 cursor-pointer group interactive",
        isDark
          ? "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 hover:border-gold/40 shadow-[0_0_12px_rgba(255,255,255,0.02)]"
          : "bg-slate-900/5 hover:bg-slate-900/10 text-slate-700 hover:text-slate-900 border border-slate-900/10 hover:border-gold/50 shadow-sm",
        className
      )}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, scale: 0.7, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 90, scale: 0.7, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 20 }}
        className="flex items-center justify-center"
      >
        {isDark ? (
          <Sun size={15} className="text-amber-400 group-hover:text-amber-300 transition-colors" />
        ) : (
          <Moon size={15} className="text-slate-700 group-hover:text-indigo-600 transition-colors" />
        )}
      </motion.div>
    </button>
  );
}
