import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "motion/react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
}

export function GlassCard({ children, className, glowOnHover = false, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "glass-panel rounded-2xl relative overflow-hidden group",
        glowOnHover && "hover:border-gold/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all duration-500",
        className
      )}
      {...props}
    >
      {glowOnHover && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-gold/5 to-transparent pointer-events-none transition-opacity duration-500" />
      )}
      {children}
    </motion.div>
  );
}
