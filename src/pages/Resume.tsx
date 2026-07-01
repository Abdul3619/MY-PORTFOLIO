import { motion } from "motion/react";
import { Download, Briefcase, GraduationCap, Award, FileText } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";

const experience = [
  {
    role: "Freelance Full Stack Developer",
    company: "Self-Employed",
    period: "2023 - Present",
    description: "Designing and developing premium web applications for clients across various industries, focusing on performance, aesthetics, and scalable architectures."
  },
  {
    role: "Solar Engineering Technician",
    company: "GreenEnergy Solutions",
    period: "2020 - 2023",
    description: "Led installation teams for residential and commercial solar arrays. Conducted system diagnostics, inverter configurations, and battery storage setups."
  }
];

const education = [
  {
    degree: "Self-Taught Computer Science",
    institution: "Various Platforms (Coursera, Udemy, Docs)",
    period: "2022 - Present",
    description: "Rigorous self-directed study covering data structures, algorithms, system design, and modern web frameworks."
  },
  {
    degree: "Diploma in Renewable Energy",
    institution: "Technical Institute of Engineering",
    period: "2018 - 2020",
    description: "Specialized in solar photovoltaics, electrical fundamentals, and sustainable energy grid integration."
  }
];

export default function Resume() {
  return (
    <PageTransition className="w-full">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 md:mb-24 mt-12 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-2">
              MY <span className="text-gradient">RESUME</span>
            </h1>
            <p className="text-xl text-gray-400">
              A track record of building and learning.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <MagneticButton variant="primary" className="py-4 px-8 text-lg">
              <Download size={20} />
              <span>Download PDF</span>
            </MagneticButton>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          
          {/* Experience Column */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
              <div className="p-2 bg-white/5 rounded-lg text-gold border border-gold/20">
                <Briefcase size={24} />
              </div>
              <h2 className="text-3xl font-display font-bold text-white">Experience</h2>
            </div>

            <div className="space-y-8">
              {experience.map((exp, i) => (
                <GlassCard key={i} className="p-6 border-l-4 border-l-gold">
                  <span className="text-gold text-sm font-bold tracking-wider mb-2 block">{exp.period}</span>
                  <h3 className="text-xl font-bold text-white mb-1">{exp.role}</h3>
                  <p className="text-gray-400 mb-4">{exp.company}</p>
                  <p className="text-gray-300 leading-relaxed text-sm">
                    {exp.description}
                  </p>
                </GlassCard>
              ))}
            </div>
          </motion.div>

          {/* Education Column */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
              <div className="p-2 bg-white/5 rounded-lg text-gold border border-gold/20">
                <GraduationCap size={24} />
              </div>
              <h2 className="text-3xl font-display font-bold text-white">Education</h2>
            </div>

            <div className="space-y-8">
              {education.map((edu, i) => (
                <GlassCard key={i} className="p-6 border-l-4 border-l-bronze">
                  <span className="text-bronze text-sm font-bold tracking-wider mb-2 block">{edu.period}</span>
                  <h3 className="text-xl font-bold text-white mb-1">{edu.degree}</h3>
                  <p className="text-gray-400 mb-4">{edu.institution}</p>
                  <p className="text-gray-300 leading-relaxed text-sm">
                    {edu.description}
                  </p>
                </GlassCard>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </PageTransition>
  );
}
