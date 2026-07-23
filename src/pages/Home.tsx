import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { 
  ArrowRight, 
  Code, 
  Sun, 
  Cpu, 
  Download, 
  FolderOpen, 
  Mail, 
  Award, 
  Star, 
  ExternalLink, 
  Zap, 
  Heart, 
  ShieldCheck, 
  CheckCircle,
  Linkedin,
  Github,
  MessageSquare,
  Sparkles,
  BookOpen
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";
import { projectsData } from "@/data/projects";
import * as Icons from "lucide-react";
import { useProfile, useServices, useTestimonials, useCertificates, useContactInfo, useProjects, useSkills } from "@/hooks/useApi";

gsap.registerPlugin(ScrollTrigger);

const roles = [
  "Web Developer",
  "Frontend Engineer",
  "Full Stack Learner",
  "Solar Technician",
  "Creative Builder"
];

let differentCards = [
  {
    icon: Cpu,
    title: "Problem Solver",
    description: "My background in solar engineering trained me to approach complex problems systematically. In physical electrical grids, troubleshooting requires absolute precision; I apply that exact same methodical diagnostics flow to debugging code and resolving backend logic bottlenecks.",
    tag: "Systematic Approach"
  },
  {
    icon: BookOpen,
    title: "Self-Taught",
    description: "Without a formal computer science degree, I learned to code by reading documentation, parsing source code, and building real-world software from scratch. This self-reliance has given me the ability to quickly master new technologies and adapt to any stack with ease.",
    tag: "High Initiative"
  },
  {
    icon: ShieldCheck,
    title: "Attention to Detail",
    description: "In solar tech, one misaligned connection can compromise an entire array. I bring this level of perfectionism to software engineering, ensuring pixel-perfect layout spacing, type-safe robust codebases, clean components, and highly optimized web assets.",
    tag: "Pristine Execution"
  },
  {
    icon: Zap,
    title: "Continuous Learning",
    description: "The tech industry never stands still, and neither do I. I dedicate time every single day to researching modern development patterns, mastering state management, and playing with new tools. I treat learning as a professional lifestyle.",
    tag: "Never Stagnant"
  },
  {
    icon: Sparkles,
    title: "Clean Design Philosophy",
    description: "A truly premium application must be as intuitive as it is powerful. I believe in minimalism, readable typography, generous white space, and subtle, purposeful micro-animations that guide users naturally without visual clutter.",
    tag: "Premium Aesthetics"
  }
];

const homeCertificates = [
  {
    title: "Advanced React Patterns",
    issuer: "Frontend Masters",
    year: "2023"
  },
  {
    title: "Solar Energy Systems Design",
    issuer: "Renewable Energy Institute",
    year: "2022"
  },
  {
    title: "Full Stack Web Development",
    issuer: "Udacity",
    year: "2024"
  }
];

const homeTestimonials = [
  {
    name: "Sarah Jenkins",
    role: "Creative Director",
    review: "Abdul has a rare combination of technical precision and an eye for high-end design. The website he built didn't just meet our expectations; it completely redefined our digital presence.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop"
  },
  {
    name: "Michael Chang",
    role: "Founder, Apex Solar",
    review: "Having someone who understands both the physical engineering of solar systems and the digital architecture of our internal tools was a game-changer.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop"
  }
];

export default function Home() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { data: services } = useServices();
  const { data: testimonials } = useTestimonials();
  const { data: certificates } = useCertificates();
  const { data: projects } = useProjects();
  const { data: contact } = useContactInfo();
  const { data: skillsData } = useSkills();

  const dynamicRoles = profile?.title ? profile.title.split(',').map((s: string) => s.trim()) : roles;
  const displayServices = services && services.length > 0 ? services : differentCards;
  const displayTestimonials = testimonials && testimonials.length > 0 ? testimonials : homeTestimonials;
  const displayCertificates = certificates && certificates.length > 0 ? certificates : homeCertificates;
  const displayProjects = projects && projects.length > 0 ? projects.slice(0,4) : projectsData.slice(0,4);
  const socialLinks = {
    github: contact?.github_url || "#",
    linkedin: contact?.linkedin_url || "#",
    twitter: contact?.twitter_url || "#",
    instagram: contact?.instagram_url || "#",
    email: contact?.email || "abdulwahababdullah3619@gmail.com",
    whatsapp: contact?.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` : "#"
  };

  const [currentRoleIndex, setCurrentRoleIndex] = useState(0);
  const aboutSectionRef = useRef<HTMLDivElement>(null);
  const skillsSectionRef = useRef<HTMLDivElement>(null);
  const projectsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Silently preload project images as soon as the data is available
    // to ensure they are instantly visible when the user scrolls down
    if (projects && projects.length > 0) {
      projects.slice(0, 4).forEach((p: any) => {
        const src = p.thumbnail_url || p.hero_image_url || p.image;
        if (src) {
          const img = new Image();
          img.src = src;
        }
      });
    }
  }, [projects]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRoleIndex((prev) => (prev + 1) % dynamicRoles.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // About Section Animation
      gsap.fromTo(
        ".gsap-about-animate",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: aboutSectionRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          }
        }
      );
      
      // Skills Section Animation
      gsap.fromTo(
        ".gsap-skills-animate",
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: skillsSectionRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          }
        }
      );

      // Projects Section Animation
      gsap.fromTo(
        ".gsap-projects-animate",
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: projectsSectionRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          }
        }
      );
    });

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <PageTransition className="space-y-32 md:space-y-48">
      
      {/* 1. HERO SECTION */}
      <section className="min-h-[80vh] flex flex-col justify-center items-center py-12 relative">
        <div className="w-full max-w-5xl mx-auto">
          <GlassCard className="p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-12 border-gold/15" glowOnHover>
            
            {/* Gen-Z Modern Image Container */}
            <motion.div 
              className="w-56 h-64 md:w-72 md:h-80 rounded-[2.5rem] overflow-hidden border border-white/10 shrink-0 relative shadow-[0_0_40px_rgba(212,175,55,0.15)] bg-black/40 backdrop-blur-md cursor-pointer"
              whileHover={{ scale: 1.02, rotateY: 5, rotateX: -5 }}
              animate={{ 
                y: [-8, 8, -8],
              }}
              transition={{
                y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                scale: { duration: 0.4, ease: "easeOut" },
                rotateY: { duration: 0.4, ease: "easeOut" },
                rotateX: { duration: 0.4, ease: "easeOut" }
              }}
              style={{ transformPerspective: 1000 }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-gold/20 via-transparent to-blue-500/10 mix-blend-overlay z-10 pointer-events-none" />
              <img 
                src={profile?.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop"} 
                alt={profile?.name || "Abdul Wahab"} 
                className="w-full h-full object-cover grayscale-[30%] contrast-110 hover:grayscale-0 hover:scale-110 transition-all duration-700"
              />
            </motion.div>

            {/* Hero Main Content */}
            <div className="flex-1 text-center lg:text-left flex flex-col items-center lg:items-start">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-semibold tracking-wider uppercase mb-6"
              >
                <Zap size={12} className="animate-pulse" />
                <span>{t("home.status_tag", "Now Open for Select Commissions")}</span>
              </motion.div>
              
              <motion.p 
                className="text-gold/80 font-display font-medium tracking-widest text-base mb-2 uppercase"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
              >
                {profile?.name || "Abdul Wahab"}
              </motion.p>
              
              <motion.h1 
                className="text-4xl md:text-5xl lg:text-7xl font-display font-bold tracking-tight mb-4 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                {t("home.self_taught_label", "SELF-TAUGHT")}
                <br />
                <span className="text-gradient font-extrabold">{t("home.developer_label", "DEVELOPER")}</span>
              </motion.h1>

              {/* Typing/Rotating Roles */}
              <motion.div 
                className="h-10 mb-8 overflow-hidden relative w-full flex justify-center lg:justify-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={currentRoleIndex}
                    initial={{ y: 30, opacity: 0, filter: "blur(5px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: -30, opacity: 0, filter: "blur(5px)" }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}
                    className="text-xl md:text-2xl text-gray-400 font-display font-medium absolute text-center lg:text-left"
                  >
                    {dynamicRoles[currentRoleIndex]}
                  </motion.span>
                </AnimatePresence>
              </motion.div>

              {/* Sub-description */}
              <motion.p
                className="text-gray-400 max-w-lg mb-8 text-sm md:text-base leading-relaxed text-center lg:text-left"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
              >
                {profile?.bio || t("home.hero_subtitle", "I build fast, responsive, and reliable websites that combine clean, modern design with practical functionality. From custom business platforms to management systems, my focus is on delivering premium web experiences that perform exceptionally and solve real problems.")}
              </motion.p>
              
              <motion.div 
                className="flex flex-wrap gap-4 justify-center lg:justify-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <Link to="/projects" className="interactive">
                  <MagneticButton variant="primary">
                    <FolderOpen size={18} />
                    <span>{t("home.cta_projects", "View Projects")}</span>
                  </MagneticButton>
                </Link>
                
                <Link to="/resume" className="interactive">
                  <MagneticButton variant="secondary">
                    <Download size={18} />
                    <span>{t("home.cta_resume", "Download Resume")}</span>
                  </MagneticButton>
                </Link>
                
                <Link to="/contact" className="interactive">
                  <MagneticButton variant="outline">
                    <Mail size={18} />
                    <span>{t("home.cta_hire", "Get In Touch")}</span>
                  </MagneticButton>
                </Link>
              </motion.div>
            </div>
            
          </GlassCard>
        </div>
      </section>

      {/* 2. ABOUT PREVIEW SECTION */}
      <section ref={aboutSectionRef} className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left intro details */}
            <div className="lg:col-span-5 space-y-6">
              <div className="gsap-about-animate inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase opacity-0">
                <span>{t("about.storyteller_tag", "The Storyteller")}</span>
              </div>
              <h2 className="gsap-about-animate text-4xl md:text-5xl font-display font-bold text-white tracking-tight leading-tight opacity-0">
                {t("about.title_crafting_part1", "Crafting With")} <br /><span className="text-gradient font-extrabold">{t("about.title_crafting_part2", "Intent & Passion")}</span>
              </h2>
              <p className="gsap-about-animate text-gray-400 leading-relaxed text-sm md:text-base opacity-0">
                {t("about.journey_description", "From mounting physical solar arrays on the hot roofs of renewable infrastructure, to engineering clean responsive algorithms behind sleek web interfaces. Abdul's journey is one of non-traditional excellence.")}
              </p>
              <div className="gsap-about-animate pt-4 opacity-0">
                <Link to="/about" className="inline-flex items-center gap-2 group text-gold font-medium hover:text-white transition-colors duration-300 interactive">
                  <span>{t("about.read_journey", "Read the Full Journey")}</span>
                  <ArrowRight size={18} className="transform group-hover:translate-x-1.5 transition-transform duration-300" />
                </Link>
              </div>
            </div>

            {/* Right Card Panel */}
            <div className="lg:col-span-7 gsap-about-animate opacity-0">
              <GlassCard className="p-8 md:p-10 space-y-8 border-white/10" glowOnHover>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:border-gold/20 transition-colors duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                      <Code size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-white font-display">{t("about.elite_dev", "Elite Developer")}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{t("about.elite_dev_desc", "Dedicated to functional state patterns, crisp micro-interactions, and pristine Tailwind designs.")}</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:border-gold/20 transition-colors duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                      <Sun size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-white font-display">{t("about.solar_spec", "Solar Specialist")}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{t("about.solar_spec_desc", "A certified technician with experience building reliable physical off-grid systems and hybrid load layouts.")}</p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl font-bold font-display text-white">2+ Years</h4>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">{t("about.coding_exp", "Coding Experience")}</p>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold font-display text-white">100%</h4>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">{t("about.self_taught", "Self-Taught")}</p>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold font-display text-white">15+</h4>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">{t("about.completed_proj", "Completed Projects")}</p>
                  </div>
                </div>
              </GlassCard>
            </div>

          </div>
        </div>
      </section>

      {/* 3. SKILLS PREVIEW SECTION */}
      <section ref={skillsSectionRef} className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16 gsap-skills-animate opacity-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
              <span>{t("skills.expertise", "Expertise")}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              {t("skills.title_part1", "Technical")} <span className="text-gradient font-extrabold">{t("skills.title_part2", "Capability")}</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
              {t("skills.subtitle", "Meticulously curated technologies and hardware knowledge built from continuous practice.")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(() => {
              if (!skillsData || skillsData.length === 0) {
                // Fallback rendering
                return null;
              }
              
              const grouped = skillsData.reduce((acc: any, skill: any) => {
                if (!acc[skill.category]) acc[skill.category] = { iconName: skill.icon, skills: [] };
                acc[skill.category].skills.push(skill.name);
                return acc;
              }, {});

              const categories = Object.keys(grouped).slice(0, 3);
              const fallbackIcons = [Icons.Code, Icons.Database, Icons.Cpu];

              return categories.map((cat, idx) => {
                const iconName = grouped[cat].iconName;
                const IconComp = (iconName ? (Icons as any)[iconName] : null) || fallbackIcons[idx % fallbackIcons.length] || Icons.Code;
                
                return (
                  <div key={cat} className="gsap-skills-animate opacity-0">
                    <GlassCard className="p-6 md:p-8 space-y-6 h-full" glowOnHover>
                      <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                        <IconComp size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-white font-display">{cat}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Technologies and tools I actively use in production environments.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {grouped[cat].skills.slice(0, 8).map((skillName: string) => (
                          <span key={skillName} className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/5 text-gray-300">
                            {skillName}
                          </span>
                        ))}
                      </div>
                    </GlassCard>
                  </div>
                );
              });
            })()}
          </div>

          <div className="text-center mt-12 gsap-skills-animate opacity-0">
            <Link to="/skills" className="interactive">
              <MagneticButton variant="secondary">
                <span>{t("skills.explore_arsenal", "Explore Full Arsenal")}</span>
                <ArrowRight size={16} />
              </MagneticButton>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. WHAT MAKES ME DIFFERENT SECTION */}
      <section className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
              <span>{t("home.strengths_tag", "Distinctive Strengths")}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              {t("home.strengths_title_part1", "What Makes Me")} <span className="text-gradient font-extrabold">{t("home.strengths_title_part2", "Different")}</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
              {t("home.strengths_desc", "A unique fusion of systematic physical engineering discipline and modern full-stack development.")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayServices.map((card: any, index: number) => {
              const Icon = card.icon;
              return (
                <GlassCard key={index} className="p-8 flex flex-col space-y-6 border-white/10" glowOnHover>
                  <span className="text-xs font-bold text-gold/80 tracking-widest uppercase">{card.tag ? (t(`home.strengths_card_tag_${index}`, card.tag) as string) : ""}</span>
                  {Icon && (
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                      <Icon size={24} />
                    </div>
                  )}
                  <h3 className="text-2xl font-bold font-display text-white">{t(`home.strengths_card_title_${index}`, card.title) as string}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed flex-grow">{t(`home.strengths_card_desc_${index}`, card.description) as string}</p>
                </GlassCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. FEATURED PROJECTS PREVIEW SECTION */}
      <section ref={projectsSectionRef} className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 gsap-projects-animate opacity-0">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
                <span>{t("projects.selected_pieces", "Selected Pieces")}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
                {t("projects.featured_title_part1", "Featured")} <span className="text-gradient font-extrabold">{t("projects.featured_title_part2", "Engagements")}</span>
              </h2>
            </div>
            <div className="text-center">
              <Link to="/projects" className="inline-flex items-center gap-2 group text-gold font-medium hover:text-white transition-colors duration-300 interactive">
                <span>{t("projects.browse_all", "Browse All Work")}</span>
                <ArrowRight size={18} className="transform group-hover:translate-x-1.5 transition-transform duration-300" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {displayProjects.slice(0, 2).map((project) => (
              <div key={project.id || project.slug} className="gsap-projects-animate opacity-0">
                <GlassCard className="group flex flex-col h-full border-white/10" glowOnHover>
                  <div className="relative h-60 overflow-hidden rounded-t-2xl">
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-500 z-10" />
                    <img 
                      src={project.thumbnail_url || project.hero_image_url || project.image || 'https://via.placeholder.com/600x400?text=No+Image'} 
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                      {(project.tech_stack || project.techStack || []).slice(0, 2).map((stack: string) => (
                        <span key={stack} className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider bg-black/75 backdrop-blur-md text-white rounded-md border border-white/10">
                          {stack}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 md:p-8 flex flex-col flex-grow">
                    <h3 className="text-2xl font-bold font-display text-white mb-2 group-hover:text-gold transition-colors duration-300">{project.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-grow">{project.description}</p>
                    
                    <Link 
                      to={`/projects/${project.slug || project.id}`} 
                      className="mt-auto inline-flex items-center gap-2 text-sm text-gold hover:text-white transition-colors duration-300 interactive font-medium"
                    >
                      <span>{t("projects.view_specs", "View Project Specifications")}</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CERTIFICATES PREVIEW SECTION */}
      <section className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
              <span>{t("certificates.accomplishments", "Accomplishments")}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              {t("certificates.title_part1", "Verified")} <span className="text-gradient font-extrabold">{t("certificates.title_part2", "Credentials")}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {displayCertificates.map((cert, index) => (
              <GlassCard key={index} className="p-6 border-white/10 space-y-4 flex flex-col justify-between" glowOnHover>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-3">
                    <Award size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white font-display leading-snug">{cert.title}</h3>
                  <p className="text-xs text-gray-400">{cert.issuer}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-gray-500 font-mono">
                  <span>{t("certificates.issued_date", "Issued Date")}</span>
                  <span>{cert.year}</span>
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/certificates" className="interactive">
              <MagneticButton variant="outline">
                <span>{t("certificates.view_all", "View All Certificates")}</span>
                <ArrowRight size={16} />
              </MagneticButton>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. TESTIMONIALS SECTION */}
      <section className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
              <span>{t("testimonials.endorsements", "Endorsements")}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              {t("testimonials.client_title_part1", "Client")} <span className="text-gradient font-extrabold">{t("testimonials.client_title_part2", "Endorsements")}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {displayTestimonials.map((tItem, index) => (
              <GlassCard key={index} className="p-8 space-y-6 border-white/15" glowOnHover>
                <div className="flex items-center gap-1 text-gold">
                  {Array.from({ length: tItem.rating }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-300 italic text-sm md:text-base leading-relaxed">
                  "{tItem.review}"
                </p>
                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                  <img 
                    src={tItem.avatar} 
                    alt={tItem.name}
                    className="w-12 h-12 rounded-full object-cover border border-gold/30"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">{tItem.name}</h4>
                    <p className="text-xs text-gold font-medium">{tItem.role}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* 8. RESUME CTA SECTION */}
      <section className="relative py-12">
        <div className="w-full max-w-4xl mx-auto px-4">
          <GlassCard className="p-8 md:p-12 text-center space-y-6 border-gold/10 bg-gradient-to-br from-white/5 to-gold/5" glowOnHover>
            <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold mx-auto">
              <Download size={24} />
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
              {t("resume.title", "Curriculum Vitae")}
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base">
              {t("resume.subtitle", "A comprehensive view of my academic qualifications, professional journey, certifications, and complete hardware-software design history.")}
            </p>
            <div className="pt-4 flex justify-center gap-4">
              <Link to="/resume" className="interactive">
                <MagneticButton variant="primary">
                  <span>{t("resume.explore_interactive", "Explore Interactive Resume")}</span>
                </MagneticButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 9. CONTACT CTA SECTION */}
      <section className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <GlassCard className="p-8 md:p-16 border-white/10" glowOnHover>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
                  <span>{t("contact.title", "Get In Touch")}</span>
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white tracking-tight leading-tight">
                  {t("contact.lets_build_part1", "LET'S BUILD")} <br />{t("contact.lets_build_part2", "SOMETHING")} <span className="text-gradient font-extrabold">{t("contact.lets_build_part3", "GREAT.")}</span>
                </h2>
                <p className="text-gray-400 max-w-lg mx-auto lg:mx-0 text-sm md:text-base">
                  {t("contact.subtitle", "Have an outstanding digital software project, an off-grid solar installation design, or a complex technical problem that needs a reliable solver? Let's cooperate.")}
                </p>
              </div>

              <div className="lg:col-span-5 flex flex-col justify-center items-center lg:items-end gap-4">
                <Link to="/contact" className="w-full interactive">
                  <MagneticButton variant="primary" className="w-full py-4 text-base">
                    <Mail size={18} />
                    <span>{t("contact.initiate_conv", "Initiate Conversation")}</span>
                  </MagneticButton>
                </Link>
                <a 
                  href={`mailto:${socialLinks.email}`}
                  className="px-6 py-3 text-sm text-gray-400 hover:text-white transition-colors duration-300 font-mono interactive"
                >
                  {socialLinks.email}
                </a>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 10. LUXURY FOOTER */}
      <footer className="border-t border-white/5 pt-16 pb-8">
        <div className="max-w-5xl mx-auto px-4 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-xl font-display font-bold text-white">
                {profile?.name ? profile.name.split(' ')[0] : 'Abdul'} <span className="text-gradient font-extrabold">{profile?.name ? profile.name.split(' ').slice(1).join(' ') : 'Wahab'}</span>
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                {profile?.bio || t("common.footer_bio", "Self-taught full-stack developer with a background in solar engineering, dedicated to building fast, reliable, and premium web experiences.")}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-gold font-bold">{t("common.showroom_links", "Showroom Links")}</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link to="/about" className="hover:text-white transition-colors">{t("nav.about", "About Story")}</Link></li>
                <li><Link to="/skills" className="hover:text-white transition-colors">{t("nav.skills", "Skills Library")}</Link></li>
                <li><Link to="/projects" className="hover:text-white transition-colors">{t("nav.projects", "Projects Showroom")}</Link></li>
                <li><Link to="/certificates" className="hover:text-white transition-colors">{t("nav.certificates", "Certificates")}</Link></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-gold font-bold">{t("common.connect_directly", "Connect Directly")}</h4>
              <div className="flex gap-4">
                {socialLinks.github !== "#" && (
                  <a href={socialLinks.github} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Github size={18} />
                  </a>
                )}
                {socialLinks.linkedin !== "#" && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Linkedin size={18} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between text-[11px] text-gray-500 font-mono gap-4">
            <span>© {new Date().getFullYear()} {profile?.name || "Abdul Wahab"}. {t("common.all_rights_reserved", "All Rights Reserved.")}</span>
            <div className="flex gap-4">
              <span>{t("common.designed_with_intent", "Designed with Intent")}</span>
              <span>•</span>
              <span>{t("common.clean_energy_software", "Clean Energy & Software")}</span>
            </div>
          </div>

        </div>
      </footer>

    </PageTransition>
  );
}
