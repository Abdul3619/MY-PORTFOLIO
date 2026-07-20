import { motion } from "motion/react";
import { Download, Briefcase, GraduationCap, Award, FileText } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";
import { useProfile, useResumeExperience, useResumeEducation } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: experienceData } = useResumeExperience();
  const { data: educationData } = useResumeEducation();
  
  const displayExperience = experienceData && experienceData.length > 0 ? experienceData : experience;
  const displayEducation = educationData && educationData.length > 0 ? educationData : education;
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
              {t("resume.title_part1", "MY")} <span className="text-gradient">{t("resume.title_part2", "RESUME")}</span>
            </h1>
            <p className="text-xl text-gray-400">
              {t("resume.subtitle", "A track record of building and learning.")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <a href={profile?.resume_url || '#'} target="_blank" rel="noopener noreferrer">
              <MagneticButton variant="primary" className="py-4 px-8 text-lg">
                <Download size={20} />
                <span>{t("resume.download_pdf", "Download PDF")}</span>
              </MagneticButton>
            </a>
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
              <h2 className="text-3xl font-display font-bold text-white">{t("resume.experience", "Experience")}</h2>
            </div>

            <div className="space-y-8">
              {displayExperience.map((exp, i) => (
                <GlassCard key={i} className="p-6 border-l-4 border-l-gold">
                  <span className="text-gold text-sm font-bold tracking-wider mb-2 block">
                    {t(`resume.period_${i}`, exp.period) as string}
                  </span>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {t(`resume.role_${i}`, exp.role) as string}
                  </h3>
                  <p className="text-gray-400 mb-4">
                    {t(`resume.company_${i}`, exp.company) as string}
                  </p>
                  <p className="text-gray-300 leading-relaxed text-sm">
                    {t(`resume.desc_${i}`, exp.description) as string}
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
              <h2 className="text-3xl font-display font-bold text-white">{t("resume.education", "Education")}</h2>
            </div>

            <div className="space-y-8">
              {displayEducation.map((edu, i) => (
                <GlassCard key={i} className="p-6 border-l-4 border-l-bronze">
                  <span className="text-bronze text-sm font-bold tracking-wider mb-2 block">
                    {t(`resume.edu_period_${i}`, edu.period) as string}
                  </span>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {t(`resume.edu_degree_${i}`, edu.degree) as string}
                  </h3>
                  <p className="text-gray-400 mb-4">
                    {t(`resume.edu_inst_${i}`, edu.institution) as string}
                  </p>
                  <p className="text-gray-300 leading-relaxed text-sm">
                    {t(`resume.edu_desc_${i}`, edu.description) as string}
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
