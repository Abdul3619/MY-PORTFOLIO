import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Download, Briefcase, GraduationCap, Award, FileText, Eye, ExternalLink } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";
import { useProfile, useResumeExperience, useResumeEducation, trackEvent } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";

// Fallbacks shown only if the database rows can't be loaded. They match the downloadable PDF exactly.
const experience = [
  {
    role: "Independent Developer",
    company: "Self-employed",
    period: "2024 - Present",
    description: "I build and ship websites and web apps on my own: React front ends, Supabase or Firebase back ends, deployed on Vercel. Everything so far is self-directed demo work.",
  },
  {
    role: "Shop Assistant / Technical Apprentice",
    company: "Dawah Refrigerator Shop, Cinkassé, Togo",
    period: "Jan 2026 - Present",
    description: "Serve customers, sell, help with repairs, and do practical refrigeration work.",
  },
  {
    role: "Electrical Installation Apprentice",
    company: "T-Energy, Saki, Oyo State, Nigeria",
    period: "Sep 2024 - Jan 2026",
    description: "Installations, conduit and CCTV work, plus customer questions and showroom help. Where I learned to find a fault step by step.",
  },
];

const education = [
  {
    degree: "Self-taught web development",
    institution: "Official docs, MDN, building projects",
    period: "2024 - Present",
    description: "Working toward freeCodeCamp certifications. Also learning fashion design and machine embroidery on the job.",
  },
  {
    degree: "ADS Comprehensive College, Saki",
    institution: "Secondary School Certificate",
    period: "Completed 2024",
    description: "",
  },
];

// Skills in three honest tiers. "By hand" and "Working" are things I write myself; the third tier is back-end
// work I build with AI help, then read, test and can explain.
const SKILL_TIERS = [
  { key: "hand", label: "By hand", note: "Written and debugged by me.", dots: 3, skills: ["HTML", "CSS", "JavaScript", "React"] },
  {
    key: "working",
    label: "Working knowledge",
    note: "Used in most projects.",
    dots: 2,
    skills: ["TypeScript", "Tailwind CSS", "Vite", "Responsive design", "Framer Motion", "react-i18next", "PWA", "Git", "GitHub", "Figma"],
  },
  {
    key: "ai",
    label: "With AI help",
    note: "Back end and data. I read, test and can explain what ships.",
    dots: 1,
    skills: ["Node.js", "Express", "Supabase", "PostgreSQL", "Firebase", "Authentication", "REST APIs", "Paystack", "Gemini API", "MediaPipe", "OpenStreetMap"],
  },
];

const PROJECTS = [
  {
    name: "AtelierFit",
    tag: "Demo",
    desc: "Phone app for ordering tailored clothes. Takes measurements from a camera (pose detection runs on the phone) or by hand, then handles a Paystack deposit and order tracking. Installs like an app.",
    uses: ["React", "TypeScript", "Supabase", "PWA", "Paystack", "MediaPipe", "Vite"],
    href: "/atelierfit",
  },
  {
    name: "StitchBook",
    tag: "Demo",
    desc: "Order book and fabric stock tracker for a tailor shop, as a web and desktop app. Visitors can try the manage tab, and their changes undo themselves after 24 hours.",
    uses: ["React", "TypeScript", "Express", "Supabase", "Vite"],
    href: "/stitchbook",
  },
  {
    name: "AI Outreach",
    tag: "Private tool",
    desc: "Finds local businesses with weak websites, checks them and drafts emails in the business's own language with an English copy. I read and send each one myself.",
    uses: ["TypeScript", "Node.js", "Supabase", "Gemini API", "OpenStreetMap"],
  },
  {
    name: "Atelier Noir",
    tag: "Demo",
    desc: "Menswear storefront with a catalogue, measurement bookings, a lookbook and an admin dashboard.",
    uses: ["React", "TypeScript", "Tailwind CSS", "Supabase"],
  },
  {
    name: "Amāra Beauty Lounge",
    tag: "Demo",
    desc: "Salon site in English and Arabic, with a booking calendar, Google sign-in and email alerts to the owner.",
    uses: ["React", "TypeScript", "Firebase", "react-i18next", "Authentication"],
  },
  {
    name: "Hotel sites and rentals",
    tag: "Demo",
    desc: "Azure Hotel, H'orizon Hotel, a booking platform and Velocity Rentals (bilingual, resumable booking flow).",
    uses: ["React", "TypeScript", "Tailwind CSS", "PostgreSQL", "react-i18next", "Responsive design"],
  },
  {
    name: "Smaller builds",
    tag: "Demo",
    desc: "Voltway Electrical, RedFine, Shin Orne (jewelry store) and PhoneFrame (an iPhone mockup component).",
    uses: ["React", "TypeScript", "Tailwind CSS", "Framer Motion", "Responsive design"],
  },
];

export default function Resume() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: experienceData } = useResumeExperience();
  const { data: educationData } = useResumeEducation();
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [view, setView] = useState<"quick" | "story">("story");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const usedBy = useMemo(() => {
    const map: Record<string, number> = {};
    PROJECTS.forEach((p) => p.uses.forEach((u) => { map[u] = (map[u] || 0) + 1; }));
    return map;
  }, []);
  
  const notSolar = (r: any) => !/solar|renewable/i.test(JSON.stringify(r));
  const displayExperience = experienceData && experienceData.length > 0 ? experienceData.filter(notSolar) : experience;
  const displayEducation = educationData && educationData.length > 0 ? educationData.filter(notSolar) : education;
  const resumeUrl = profile?.resume_url;

  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPreviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPreviewOpen]);

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
              {t("resume.subtitle", "Front end by hand, back end with AI help. I learn whatever the problem asks of me.")}
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

            {resumeUrl ? (
              <a 
                href={resumeUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                download="resume.pdf"
                onClick={() => trackEvent('download_resume', '/resume')}
              >
                <MagneticButton variant="primary" className="py-4 px-8 text-lg">
                  <Download size={20} />
                  <span>{t("resume.download_pdf", "Download PDF")}</span>
                </MagneticButton>
              </a>
            ) : (
              // No resume uploaded yet: show the button as unavailable instead of a dead "#" link
              <MagneticButton variant="primary" className="py-4 px-8 text-lg" disabled>
                <Download size={20} />
                <span>{t("resume.download_pdf", "Download PDF")}</span>
              </MagneticButton>
            )}
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
                  aria-label="Open resume in new tab"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
            
            <div className="w-full h-[500px] rounded-xl overflow-hidden bg-black/60 border border-white/10 relative flex items-center justify-center">
              <iframe 
                src={`https://docs.google.com/gview?url=${encodeURIComponent(resumeUrl)}&embedded=true`} 
                title="Resume Preview"
                loading="lazy"
                className="w-full h-full border-0"
              />
            </div>
          </motion.div>
        )}

        {/* A running stitch that draws itself under the title */}
        <svg viewBox="0 0 600 14" className="w-full max-w-xl h-3 -mt-10 mb-10" aria-hidden="true">
          <motion.path
            d="M2 7 Q 40 0 80 7 T 160 7 T 240 7 T 320 7 T 400 7 T 480 7 T 598 7"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="7 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        </svg>

        <div className="flex flex-wrap items-center gap-3 mb-10" role="tablist" aria-label="Resume view">
          {([
            ["story", "Full story"],
            ["quick", "Quick view"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`px-5 py-2 rounded-full text-sm font-mono border transition-colors ${
                view === key ? "bg-gold text-black border-gold" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-gray-500 font-mono">
            {view === "quick" ? "Everything a recruiter needs in one screen." : "Tap a skill to see which projects use it."}
          </span>
        </div>

        {view === "quick" && (
          <GlassCard className="p-8 mb-16 border-gold/20">
            <p className="text-gold font-mono text-xs tracking-widest mb-3">AT A GLANCE</p>
            <h2 className="text-3xl font-display font-bold text-white mb-1">Abdulwahab Abdullahi</h2>
            <p className="text-gold font-semibold mb-4">Developer. Front end by hand, back end with AI help.</p>
            <p className="text-gray-300 leading-relaxed mb-6">
              I write my front end myself in React, TypeScript and Tailwind. For back-end work I use AI to go faster, and I read and test everything before it ships.
              13 projects since 2024, all demos so far. I'm looking for my first real team: a remote front-end or junior developer role, or small client projects.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              {SKILL_TIERS.map((t) => (
                <div key={t.key} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <p className="text-gold font-mono text-[11px] tracking-widest mb-2">{t.label.toUpperCase()}</p>
                  <p className="text-gray-300">{t.skills.slice(0, 6).join(", ")}{t.skills.length > 6 ? " and more" : ""}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 font-mono mt-6">Cinkassé, Togo · remote, West Africa · GMT</p>
          </GlassCard>
        )}

        {view === "story" && (
          <>
            {/* Skills: three tiers, each one clickable */}
            <div className="mb-16">
              <h2 className="text-3xl font-display font-bold text-white mb-2">What I use</h2>
              <p className="text-gray-400 text-sm mb-8">Grouped by how I really work with them, not by how impressive they sound.</p>
              <div className="grid md:grid-cols-3 gap-6">
                {SKILL_TIERS.map((tier) => (
                  <GlassCard key={tier.key} className="p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold">{tier.label}</span>
                      <span className="flex gap-1" aria-hidden="true">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className={`block w-4 border-t-2 ${i < tier.dots ? "border-gold" : "border-white/15"}`} />
                        ))}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">{tier.note}</p>
                    <div className="flex flex-wrap gap-2">
                      {tier.skills.map((sk) => {
                        const on = activeSkill === sk;
                        return (
                          <button
                            key={sk}
                            onClick={() => setActiveSkill(on ? null : sk)}
                            aria-pressed={on}
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              on ? "bg-gold text-black border-gold" : "bg-white/5 text-gray-300 border-white/10 hover:border-gold/40"
                            }`}
                            title={usedBy[sk] ? `Used in ${usedBy[sk]} project group${usedBy[sk] > 1 ? "s" : ""}` : "Used across projects"}
                          >
                            {sk}
                          </button>
                        );
                      })}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>

            {/* Projects, dimmed unless they use the picked skill */}
            <div className="mb-16">
              <h2 className="text-3xl font-display font-bold text-white mb-2">What I've built</h2>
              <p className="text-gray-400 text-sm mb-8">
                Every project here is a demo made to learn and to show my work. None was for a paying client yet.
                {activeSkill && (
                  <button onClick={() => setActiveSkill(null)} className="ml-3 text-gold underline underline-offset-4">
                    Clear "{activeSkill}"
                  </button>
                )}
              </p>
              <div className="space-y-4">
                {PROJECTS.map((p, i) => {
                  const match = !activeSkill || p.uses.includes(activeSkill);
                  return (
                    <motion.div
                      key={p.name}
                      animate={{ opacity: match ? 1 : 0.28 }}
                      transition={{ duration: 0.25 }}
                      className="flex gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                    >
                      <span className="font-display italic text-gold text-xl w-8 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                          {p.href ? (
                            <a href={p.href} className="text-white font-bold hover:text-gold transition-colors">{p.name}</a>
                          ) : (
                            <span className="text-white font-bold">{p.name}</span>
                          )}
                          <span className="text-[10px] font-mono tracking-widest text-gold border border-gold/40 rounded px-1.5 py-0.5 uppercase">{p.tag}</span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed mb-2">{p.desc}</p>
                        <p className="text-xs text-gray-500 font-mono">{p.uses.join(" · ")}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
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
                  {edu.description && (
                    <p className="text-gray-300 leading-relaxed text-sm">
                      {edu.description}
                    </p>
                  )}
                </GlassCard>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {isPreviewOpen && resumeUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-8" role="dialog" aria-modal="true" aria-label="Resume document preview">
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
              src={`https://docs.google.com/gview?url=${encodeURIComponent(resumeUrl)}&embedded=true`} 
              title="Resume Fullscreen Preview"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </PageTransition>
  );
}
