import * as Icons from "lucide-react";
import { useSkills } from "@/hooks/useApi";
import { motion } from "motion/react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { useTranslation } from "react-i18next";
import { 
  Code2, 
  Sun, 
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
  Brain
} from "lucide-react";

const skillCategories = [
  {
    title: "Frontend Development",
    icon: Monitor,
    skills: [
      "HTML5",
      "CSS3",
      "JavaScript (ES6+)",
      "TypeScript",
      "React",
      "Next.js",
      "Tailwind CSS",
      "Framer Motion",
      "Responsive Design",
      "Accessibility",
      "Component Architecture",
      "Modern CSS"
    ]
  },
  {
    title: "Backend Development",
    icon: Server,
    skills: [
      "Node.js",
      "Express.js",
      "REST APIs",
      "Authentication",
      "Authorization",
      "JWT",
      "CRUD Operations",
      "API Integration",
      "Server-side Logic"
    ]
  },
  {
    title: "Database",
    icon: Database,
    skills: [
      "Supabase",
      "PostgreSQL",
      "Firebase",
      "Database Design",
      "Relational Databases",
      "Storage",
      "Row Level Security"
    ]
  },
  {
    title: "Dashboard & CMS",
    icon: BarChart3,
    skills: [
      "Admin Dashboards",
      "Role Management",
      "Booking Management",
      "Content Management",
      "Analytics",
      "Tables",
      "Filtering",
      "Search",
      "Pagination",
      "Reporting"
    ]
  },
  {
    title: "Deployment",
    icon: Cloud,
    skills: [
      "Git",
      "GitHub",
      "GitHub Pages",
      "Vercel",
      "Netlify",
      "Environment Variables",
      "Deployment Pipelines"
    ]
  },
  {
    title: "Design",
    icon: Palette,
    skills: [
      "Figma",
      "Canva",
      "UI Design",
      "UX Design",
      "Wireframing",
      "Glassmorphism",
      "Typography",
      "Color Systems",
      "Design Systems",
      "Responsive Layout"
    ]
  },
  {
    title: "Animation & Motion",
    icon: Sparkles,
    skills: [
      "Framer Motion",
      "CSS Animations",
      "Micro Interactions",
      "Hover Effects",
      "Page Transitions",
      "Loading Animations",
      "Scroll Animations",
      "3D UI Elements",
      "Interactive Components",
      "Smooth Motion Design"
    ]
  },
  {
    title: "Development Tools",
    icon: Terminal,
    skills: [
      "VS Code",
      "Cursor AI",
      "Claude",
      "ChatGPT",
      "Gemini",
      "GitHub Copilot",
      "Chrome DevTools",
      "npm",
      "Vite"
    ]
  },
  {
    title: "AI Assisted Development",
    icon: Cpu,
    skills: [
      "Prompt Engineering",
      "AI-assisted Coding",
      "Rapid Prototyping",
      "Code Review",
      "Debugging with AI",
      "UI Generation",
      "Workflow Optimization"
    ]
  },
  {
    title: "Professional Skills",
    icon: Brain,
    skills: [
      "Problem Solving",
      "Communication",
      "Project Planning",
      "Attention to Detail",
      "Continuous Learning",
      "Client Collaboration",
      "Requirement Analysis",
      "Time Management"
    ]
  },
  {
    title: "Solar & Electrical",
    icon: Sun,
    skills: [
      "Solar Installation",
      "Battery Systems",
      "Inverter Setup",
      "Load Calculation",
      "Maintenance",
      "Troubleshooting",
      "System Design"
    ]
  }
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
  const { data: skillsData } = useSkills();
  
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

  return (
    <PageTransition className="w-full">
      <div className="max-w-6xl mx-auto">
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
            {t("skills.arsenal_subtitle", "A diverse toolkit combining digital engineering with physical energy systems.")}
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
