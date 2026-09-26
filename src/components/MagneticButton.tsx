import { useRef, useState } from "react";
import { motion, useAnimation } from "motion/react";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
}

export function MagneticButton({ children, className, variant = "primary", onClick, disabled }: MagneticButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const controls = useAnimation();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!buttonRef.current) return;
    
    const { clientX, clientY } = e;
    const { height, width, left, top } = buttonRef.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    controls.start({ x: 0, y: 0 });
  };

  const variantClasses = {
    primary: "bg-gold text-black hover:bg-gold/90 font-medium",
    secondary: "bg-white/10 text-white hover:bg-white/20 backdrop-blur-md",
    outline: "border border-gold/50 text-gold hover:bg-gold/10",
  };

  return (
    <motion.div
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      onClick={disabled ? undefined : onClick}
      // Only act as a standalone button when it has its own click handler; when it is the visual inside a
      // link, the link is the single focusable, accessible control.
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? (disabled ? -1 : 0) : undefined}
      aria-disabled={disabled || undefined}
      onKeyDown={
        onClick && !disabled
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent<HTMLElement>);
              }
            }
          : undefined
      }
      className={cn(
        "px-6 py-3 rounded-full flex items-center justify-center gap-2 transition-colors duration-300",
        variantClasses[variant],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
