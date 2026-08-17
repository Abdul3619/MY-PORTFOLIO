import { ReactNode } from "react";
import { motion } from "motion/react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        filter: "blur(0px)",
        transition: {
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1], // Cinematic smooth easing
        }
      }}
      exit={{ 
        opacity: 0, 
        scale: 1.02, 
        filter: "blur(8px)",
        transition: {
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1]
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
