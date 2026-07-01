import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Skills", path: "/skills" },
  { name: "Projects", path: "/projects" },
  { name: "Certificates", path: "/certificates" },
  { name: "Testimonials", path: "/testimonials" },
  { name: "Resume", path: "/resume" },
  { name: "Contact", path: "/contact" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex justify-center py-6 px-4"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.nav
        className={cn(
          "glass-panel rounded-full px-6 py-3 flex items-center gap-1 md:gap-2 transition-all duration-500 overflow-x-auto no-scrollbar",
          isScrolled ? "scale-95 bg-white/10" : "scale-100"
        )}
      >
        {navLinks.map((link) => {
          const isActive = 
            location.pathname === link.path || 
            (link.path !== "/" && location.pathname.startsWith(link.path));

          return (
            <Link
              key={link.name}
              to={link.path}
              className="relative px-3 py-2 rounded-full text-sm font-medium transition-colors interactive whitespace-nowrap"
            >
              <span className={cn("relative z-10", isActive ? "text-white" : "text-gray-400 hover:text-gray-200")}>
                {link.name}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-white/10 rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </motion.nav>
    </motion.header>
  );
}
