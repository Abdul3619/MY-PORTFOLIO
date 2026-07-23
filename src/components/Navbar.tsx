import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

const navLinks = [
  { name: "Home", key: "home", path: "/" },
  { name: "About", key: "about", path: "/about" },
  { name: "Skills", key: "skills", path: "/skills" },
  { name: "Projects", key: "projects", path: "/projects" },
  { name: "Certificates", key: "certificates", path: "/certificates" },
  { name: "Solar Sizer", key: "solarSizer", path: "/solar-estimator" },
  { name: "Testimonials", key: "testimonials", path: "/testimonials" },
  { name: "Resume", key: "resume", path: "/resume" },
  { name: "Contact", key: "contact", path: "/contact" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const currentLang = (i18n.language || "en").split("-")[0].toLowerCase();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  const languages = [
    { code: "en", label: "EN" },
    { code: "fr", label: "FR" },
    { code: "ar", label: "AR" }
  ];

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
              key={link.key}
              to={link.path}
              className="relative px-3 py-2 rounded-full text-sm font-medium transition-colors interactive whitespace-nowrap"
            >
              <span className={cn("relative z-10", isActive ? "text-white" : "text-gray-400 hover:text-gray-200")}>
                {t(`nav.${link.key}`, link.name)}
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

        {/* Dynamic Admin Dashboard Access Link */}
        <div className="h-4 w-[1px] bg-white/10 mx-2 flex-shrink-0 self-center" />
        <Link
          to="/admin"
          className={cn(
            "relative px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 whitespace-nowrap flex items-center gap-1.5",
            location.pathname.startsWith("/admin")
              ? "bg-[#00F0FF]/20 text-white border border-[#00F0FF]/40 shadow-[0_0_12px_rgba(0,240,255,0.3)]"
              : "bg-[#00F0FF]/5 text-[#00F0FF] hover:bg-[#00F0FF]/15 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40 hover:shadow-[0_0_10px_rgba(0,240,255,0.25)]"
          )}
        >
          <Lock size={12} className="text-[#00F0FF]" />
          <span>{t("nav.dashboard", "Dashboard")}</span>
        </Link>

        {/* Dynamic Language Switcher Group */}
        <div className="h-4 w-[1px] bg-white/10 mx-2 flex-shrink-0 self-center" />
        <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5 border border-white/5 flex-shrink-0">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                localStorage.setItem('app_manual_lang', lang.code);
                i18n.changeLanguage(lang.code);
              }}
              className={cn(
                "px-2 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all duration-300 cursor-pointer",
                currentLang === lang.code
                  ? "bg-gold text-bg-dark shadow-[0_0_8px_rgba(212,175,55,0.4)]"
                  : "text-gray-400 hover:text-white"
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </motion.nav>
    </motion.header>
  );
}
