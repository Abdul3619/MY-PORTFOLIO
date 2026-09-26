import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "motion/react";
import { useTheme } from "@/contexts/ThemeContext";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
  glowColor?: "gold" | "cyan";
  liftOnHover?: boolean;
}

export function GlassCard({
  children,
  className,
  glowOnHover = false,
  glowColor = "gold",
  liftOnHover = false,
  whileHover,
  transition,
  ...props
}: GlassCardProps) {
  const isCyan = glowColor === "cyan";
  const { isDark } = useTheme();

  // Build smooth Framer Motion hover state
  const computedWhileHover = whileHover !== undefined
    ? whileHover
    : liftOnHover
    ? {
        y: -8,
        ...(glowOnHover && isCyan
          ? {
              boxShadow: isDark 
                ? "0 20px 40px -12px rgba(0, 240, 255, 0.22), 0 0 28px 2px rgba(0, 240, 255, 0.15)"
                : "0 20px 35px -10px rgba(2, 132, 199, 0.12), 0 4px 12px rgba(15, 23, 42, 0.05)",
              borderColor: isDark ? "rgba(0, 240, 255, 0.45)" : "rgba(2, 132, 199, 0.35)"
            }
          : glowOnHover
          ? {
              boxShadow: isDark 
                ? "0 20px 35px -10px rgba(212, 175, 55, 0.2), 0 0 25px 2px rgba(212, 175, 55, 0.12)"
                : "0 20px 30px -10px rgba(180, 130, 25, 0.12), 0 4px 12px rgba(15, 23, 42, 0.05)",
              borderColor: isDark ? "rgba(212, 175, 55, 0.4)" : "rgba(180, 130, 25, 0.3)"
            }
          : {
              boxShadow: isDark
                ? "0 20px 35px -10px rgba(0, 0, 0, 0.4)"
                : "0 20px 30px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)"
            })
      }
    : glowOnHover
    ? isCyan
      ? {
          boxShadow: isDark 
            ? "0 15px 35px -10px rgba(0, 240, 255, 0.2), 0 0 25px 2px rgba(0, 240, 255, 0.12)"
            : "0 15px 30px -10px rgba(2, 132, 199, 0.1), 0 4px 12px rgba(15, 23, 42, 0.04)",
          borderColor: isDark ? "rgba(0, 240, 255, 0.45)" : "rgba(2, 132, 199, 0.3)"
        }
      : {
          boxShadow: isDark 
            ? "0 0 30px rgba(212, 175, 55, 0.15)"
            : "0 15px 25px -8px rgba(180, 130, 25, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)",
          borderColor: isDark ? "rgba(212, 175, 55, 0.3)" : "rgba(180, 130, 25, 0.25)"
        }
    : undefined;

  return (
    <motion.div
      className={cn(
        "glass-panel rounded-2xl relative overflow-hidden group",
        className
      )}
      whileHover={computedWhileHover}
      transition={
        transition || {
          type: "spring",
          stiffness: 350,
          damping: 25
        }
      }
      {...props}
    >
      {glowOnHover && (
        <>
          {/* Subtle ambient internal gradient wash */}
          <div
            className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500",
              isCyan
                ? isDark
                  ? "bg-gradient-to-b from-[#00F0FF]/12 via-[#00F0FF]/[0.02] to-transparent"
                  : "bg-gradient-to-b from-cyan-500/8 via-transparent to-transparent"
                : isDark
                  ? "bg-gradient-to-br from-gold/5 to-transparent"
                  : "bg-gradient-to-br from-amber-500/6 to-transparent"
            )}
          />
          {/* Futuristic top-edge hairline glow */}
          {isCyan && (
            <div className={cn(
              "absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#00F0FF]/85 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
              isDark ? "shadow-[0_0_12px_#00F0FF]" : "shadow-[0_0_8px_rgba(2,132,199,0.5)]"
            )} />
          )}
        </>
      )}
      {children}
    </motion.div>
  );
}
