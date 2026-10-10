import * as Icons from "lucide-react";
import { useSkills } from "@/hooks/useApi";
import { motion } from "motion/react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { GHOST_SKILL_CATEGORIES } from "@/lib/skeletonGhosts";
import { useTranslation } from "react-i18next";
import { 
  Code2, 
  Wrench,
  Palette,
  Terminal,
  Cpu,
  Monitor,
  Database,
  Server,
  BarChart3,
  Cloud,
  Sparkles,
  Brain,
  Layers,
  Plug
} from "lucide-react";

const skillCategories = [
  { title: "Frontend (by hand)", icon: Monitor, skills: ["HTML5", "CSS3", "JavaScript (ES6+)", "React"] },
  {
    title: "Frontend (working knowledge)",
    icon: Layers,
    skills: ["TypeScript", "Tailwind CSS", "Vite", "Framer Motion", "Responsive Design", "PWA & Service Workers", "react-i18next (multi-language sites)"],
  },
  {
    title: "Back end & Data (with AI help)",
    icon: Server,
    skills: ["Node.js", "Express.js", "REST APIs", "Authentication", "Supabase", "PostgreSQL", "Firebase"],
  },
  {
    title: "Integrations & APIs",
    icon: Plug,
    skills: ["Paystack Payments", "Gemini API", "MediaPipe (on-device pose detection)", "OpenStreetMap"],
  },
  { title: "Tools & Hosting", icon: Wrench, skills: ["Git", "GitHub", "Vercel", "Render", "Figma", "AI coding tools"] },
  {
    title: "How I Work",
    icon: Brain,
    skills: ["Problem solving", "Learning unfamiliar domains fast", "Reading and testing what ships", "Client communication"],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100 }
  }
};

export default function Skills() {
  const { t } = useTranslation();
  const { data: skillsData, isLoading } = useSkills();
  
  let displayCategories = skillCategories;
  if (skillsData && skillsData.length > 0) {
    const grouped = skillsData.reduce((acc: any, skill: any) => {
      if (!acc[skill.category]) {
        acc[skill.category] = {
          title: skill.category,
          iconName: skill.icon || 'Code',
          skills: []
        };
      }
      acc[skill.category].skills.push({ name: skill.name, order: skill.order_index });
      return acc;
    }, {});
    
    displayCategories = Object.values(grouped).map((cat: any) => ({
      ...cat,
      icon: (Icons as any)[cat.iconName] || Icons.Code,
      skills: cat.skills.sort((a: any, b: any) => a.order - b.order).map((s: any) => s.name)
    }));
  }

  if (isLoading) displayCategories = GHOST_SKILL_CATEGORIES.map((c) => ({ ...c, icon: Monitor })) as typeof skillCategories;

  return (
    <PageTransition className={isLoading ? "w-full auto-skeleton" : "w-full"}>
      <div className="max-w-6xl mx-auto" aria-busy={isLoading || undefined}>
        <motion.div 
          className="text-center mb-16 md:mb-24 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
            {t("skills.arsenal_title_part1", "TECHNICAL")} <span className="text-gradient">{t("skills.arsenal_title_part2", "ARSENAL")}</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("skills.arsenal_subtitle", "What I use, grouped by how I really work with it: by hand, with working knowledge, or with AI help.")}
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {displayCategories.map((category) => {
            const safeKey = category.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
            return (
              <motion.div key={category.title} variants={itemVariants}>
                <GlassCard className="h-full p-8 flex flex-col" glowOnHover>
                  {category.icon && (
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 text-gold shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                      <category.icon size={28} />
                    </div>
                  )}
                  
                  <h3 className="text-2xl font-display font-semibold mb-6 text-white">
                    {t(`skills.cat_title_${safeKey}`, category.title)}
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {category.skills.map((skill, index) => {
                      const skillSafeKey = skill.toLowerCase().replace(/[^a-z0-9]/g, '_');
                      return (
                        <span 
                          key={index}
                          className="px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-gold hover:border-gold/30 hover:bg-gold/5 transition-all cursor-default"
                        >
                          {t(`skills.name_${skillSafeKey}`, skill)}
                        </span>
                      );
                    })}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
        
        {/* Abstract decorative elements */}
        <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 opacity-30">
          {[Palette, Terminal, Cpu, Monitor, Database, Code2].map((Icon, i) => (
            <motion.div 
              key={i}
              className="flex justify-center items-center p-8 border border-white/5 rounded-2xl"
              animate={{ 
                y: [0, -10, 0],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut"
              }}
            >
              <Icon size={40} className="text-gray-500" />
            </motion.div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
