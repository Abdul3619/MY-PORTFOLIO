import { motion } from "motion/react";
import { Settings, Wrench } from "lucide-react";
import { GlassCard } from "../components/GlassCard";
import { useTranslation } from "react-i18next";

export default function Maintenance() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0a]">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-[#00F0FF]/10 to-transparent rounded-full blur-[120px] pointer-events-none" />
      
      <GlassCard className="max-w-lg w-full p-12 text-center relative z-10 border-[#00F0FF]/20 shadow-[0_0_50px_rgba(0,240,255,0.05)]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#00F0FF] mb-8 shadow-[inset_0_0_20px_rgba(0,240,255,0.1)]"
        >
          <Settings size={36} />
        </motion.div>
        
        <h1 className="text-3xl font-display font-bold text-white mb-4 tracking-tight">
          {t("maintenance.title", "System Update")}
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto font-mono mb-8">
          {t("maintenance.subtitle", "The portfolio platform is currently undergoing scheduled maintenance and core system upgrades.")}
        </p>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-[#00F0FF] text-xs font-mono uppercase tracking-wider">
          <Wrench size={14} />
          <span>{t("maintenance.returning_shortly", "Returning Shortly")}</span>
        </div>
      </GlassCard>
    </div>
  );
}
