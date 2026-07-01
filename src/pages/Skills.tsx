import { motion } from "motion/react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { 
  Code2, 
  Sun, 
  Wrench,
  Palette,
  Terminal,
  Cpu,
  Monitor,
  Database
} from "lucide-react";

const skillCategories = [
  {
    title: "Web Development",
    icon: Code2,
    skills: ["HTML5", "CSS3", "JavaScript (ES6+)", "TypeScript", "React", "Next.js", "Tailwind CSS", "Framer Motion"]
  },
  {
    title: "Solar & Electrical",
    icon: Sun,
    skills: ["Solar Installation", "Battery Systems", "Inverter Setup", "Load Calculation", "Maintenance", "Troubleshooting", "System Design"]
  },
  {
    title: "Tools & Software",
    icon: Wrench,
    skills: ["Git & GitHub", "VS Code", "Figma", "AI Tools (Cursor, Copilot)", "Vercel", "npm/yarn", "Postman"]
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
            TECHNICAL <span className="text-gradient">ARSENAL</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A diverse toolkit combining digital engineering with physical energy systems.
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {skillCategories.map((category) => (
            <motion.div key={category.title} variants={itemVariants}>
              <GlassCard className="h-full p-8 flex flex-col" glowOnHover>
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 text-gold shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                  <category.icon size={28} />
                </div>
                
                <h3 className="text-2xl font-display font-semibold mb-6 text-white">
                  {category.title}
                </h3>
                
                <div className="flex flex-wrap gap-2 mt-auto">
                  {category.skills.map((skill, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-gold hover:border-gold/30 hover:bg-gold/5 transition-all cursor-default"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          ))}
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
