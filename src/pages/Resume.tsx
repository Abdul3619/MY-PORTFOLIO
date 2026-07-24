import { motion } from "motion/react";
import { useState } from "react";
import { Download, Briefcase, GraduationCap, Award, FileText, Eye, ExternalLink } from "lucide-react";
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
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const displayExperience = experienceData && experienceData.length > 0 ? experienceData : experience;
  const displayEducation = educationData && educationData.length > 0 ? educationData : education;
  const resumeUrl = profile?.resume_url;

  return (
    <PageTransition className="w-full">
      <div className="max-w-5xl mx-auto px-4 py-8">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 md:mb-24 mt-6 gap-8">
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
            className="flex flex-wrap items-center gap-4"
          >
            {resumeUrl && (
              <button 
                onClick={() => setIsPreviewOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm hover:bg-white/10 transition-all cursor-pointer"
              >
                <Eye size={18} className="text-[#00F0FF]" />
                <span>{t("resume.preview", "View PDF")}</span>
              </button>
            )}

            <a 
              href={resumeUrl || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              download={resumeUrl ? "resume.pdf" : undefined}
            >
              <MagneticButton variant="primary" className="py-4 px-8 text-lg">
                <Download size={20} />
                <span>{t("resume.download_pdf", "Download PDF")}</span>
              </MagneticButton>
            </a>
          </motion.div>
        </div>

        {/* Embedded Resume Preview Section */}
        {resumeUrl && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16 bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#00F0FF]/10 rounded-lg text-[#00F0FF]">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-white">Live Resume Document</h3>
                  <p className="text-xs text-gray-400">View document directly or download a copy for offline review</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={resumeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
            
            <div className="w-full h-[500px] rounded-xl overflow-hidden bg-black/60 border border-white/10 relative flex items-center justify-center">
              <iframe 
                src={`${resumeUrl}#toolbar=0&view=FitH`} 
                title="Resume Preview"
                className="w-full h-full border-0"
              />
            </div>
          </motion.div>
        )}

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
              {displayExperience.map((exp: any, i: number) => (
                <GlassCard key={exp.id || i} className="p-6 border-l-4 border-l-gold">
                  <span className="text-gold text-sm font-bold tracking-wider mb-2 block">
                    {exp.period}
                  </span>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {exp.role}
                  </h3>
                  <p className="text-gray-400 mb-4">
                    {exp.company}
                  </p>
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
              <h2 className="text-3xl font-display font-bold text-white">{t("resume.education", "Education")}</h2>
            </div>

            <div className="space-y-8">
              {displayEducation.map((edu: any, i: number) => (
                <GlassCard key={edu.id || i} className="p-6 border-l-4 border-l-bronze">
                  <span className="text-bronze text-sm font-bold tracking-wider mb-2 block">
                    {edu.period}
                  </span>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {edu.degree}
                  </h3>
                  <p className="text-gray-400 mb-4">
                    {edu.institution}
                  </p>
                  <p className="text-gray-300 leading-relaxed text-sm">
                    {edu.description}
                  </p>
                </GlassCard>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {isPreviewOpen && resumeUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <FileText className="text-[#00F0FF]" size={20} />
              <span>Resume Document Preview</span>
            </h3>
            <div className="flex items-center gap-4">
              <a 
                href={resumeUrl}
                download="resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#00F0FF] text-black font-semibold rounded-lg hover:bg-[#00F0FF]/80 transition-colors flex items-center gap-2 text-sm"
              >
                <Download size={16} />
                <span>Download</span>
              </a>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/25 transition-colors text-sm font-mono"
              >
                Close ✕
              </button>
            </div>
          </div>
          <div className="flex-1 w-full bg-black/50 rounded-2xl border border-white/10 overflow-hidden">
            <iframe 
              src={resumeUrl} 
              title="Resume Fullscreen Preview"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </PageTransition>
  );
}
