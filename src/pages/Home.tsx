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
  Twitter,
  Instagram,
  Briefcase,
  Handshake,
  MessageSquare,
  Sparkles,
  BookOpen,
  Smartphone
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";
import { PLACEHOLDER_IMAGE } from "@/lib/placeholders";
import { GHOST_PROJECTS, GHOST_CERTS, GHOST_TESTIMONIALS } from "@/lib/skeletonGhosts";
import { isPublicProject } from "@/lib/projectStatus";
import * as Icons from "lucide-react";
import { useProfile, useTestimonials, useCertificates, useContactInfo, useProjects } from "@/hooks/useApi";

gsap.registerPlugin(ScrollTrigger);

// The three things on offer, in plain words. Each has a live example in the projects section.
const offerCards = [
  {
    key: "sites",
    icon: Code,
    title: "Business websites",
    description: "Fast, mobile-first sites for hotels, salons, shops and service firms, in one or more languages.",
    example: "Example: Azure Hotel, Voltway Electrical",
  },
  {
    key: "stores",
    icon: ShieldCheck,
    title: "Online stores and booking",
    description: "Catalogues, carts, appointment calendars and payments, with order and booking emails.",
    example: "Example: Atelier Noir, Shin Orne",
  },
  {
    key: "dashboards",
    icon: Cpu,
    title: "Dashboards and internal tools",
    description: "Admin panels to run the business: orders, stock, bookings, customers and reports.",
    example: "Example: StitchBook, H'orizon admin",
  },
];

export default function Home() {
  const { t } = useTranslation();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const { data: testimonials, isLoading: isTestimonialsLoading } = useTestimonials();
  const { data: certificates, isLoading: isCertificatesLoading } = useCertificates();
  const { data: projects, isLoading: isProjectsLoading } = useProjects();
  const { data: contact } = useContactInfo();

  // Only real CMS entries are shown; there is no placeholder content presented as genuine
  const displayTestimonials: any[] = Array.isArray(testimonials) ? testimonials : [];
  const displayCertificates: any[] = Array.isArray(certificates) ? certificates : [];
  const publicProjects = Array.isArray(projects) ? projects.filter(isPublicProject) : [];
  const displayProjects = publicProjects.length > 0 ? publicProjects.slice(0, 4) : [];
  // While a section is loading it renders its REAL cards with ghost content; the auto-skeleton CSS shimmers every part.
  const projectsToShow: any[] = isProjectsLoading ? GHOST_PROJECTS : displayProjects;
  const certsToShow: any[] = isCertificatesLoading ? GHOST_CERTS : displayCertificates;
  const testimonialsToShow: any[] = isTestimonialsLoading
    ? [GHOST_TESTIMONIALS[0], { ...GHOST_TESTIMONIALS[0], id: "ghost-testimonial-2" }].map((g) => ({ ...g, rating: 5 }))
    : displayTestimonials;
  // Counted from the CMS so the stat always matches what is actually published (admin previews include drafts, so filter here too)
  const completedProjectsLabel = Array.isArray(projects) ? `${projects.filter(isPublicProject).length}+` : "—";
  const socialLinks = {
    github: contact?.github_url || "#",
    linkedin: contact?.linkedin_url || "#",
    twitter: contact?.twitter_url || "#",
    instagram: contact?.instagram_url || "#",
    upwork: contact?.upwork_url || "#",
    contra: contact?.contra_url || "#",
    email: contact?.email || "abdulwahababdullah3619@gmail.com",
    whatsapp: contact?.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` : "#"
  };

  const projectsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Silently preload project images as soon as the data is available
    // to ensure they are instantly visible when the user scrolls down
    if (projects && projects.length > 0) {
      projects.filter(isPublicProject).slice(0, 4).forEach((p: any) => {
        const src = p.thumbnail_url || p.hero_image_url || p.image;
        if (src) {
          const img = new Image();
          img.src = src;
        }
      });
    }
  }, [projects]);

  useEffect(() => {
    const ctx = gsap.context(() => {
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
      <section data-assistant-section="hero" className="min-h-[80vh] flex flex-col justify-center items-center py-12 relative">
        <div className="w-full max-w-5xl mx-auto">
          <GlassCard className={`p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-12 border-gold/15${isProfileLoading ? " auto-skeleton" : ""}`} glowOnHover>
            
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
              {profile?.profile_image_url || profile?.avatar_url ? (
                <div className="w-full h-full relative">
                  <div className="absolute inset-0 silver-shimmer flex items-center justify-center text-gold/50 font-display font-bold text-3xl">
                    AW
                  </div>
                  <img 
                    src={profile.profile_image_url || profile.avatar_url} 
                    alt={profile?.name || "Abdul Wahab"} 
                    loading="eager"
                    // @ts-ignore
                    fetchPriority="high"
                    className="w-full h-full object-cover grayscale-[30%] contrast-110 hover:grayscale-0 hover:scale-110 transition-all duration-700 relative z-0 opacity-100"
                  />
                </div>
              ) : isProfileLoading ? (
                <div className="w-full h-full silver-shimmer" aria-hidden="true" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-black/90 via-black/70 to-zinc-900 flex items-center justify-center text-gold font-display font-bold text-5xl tracking-widest">
                  AW
                </div>
              )}
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
                <span>{t("home.available_tag", "Open to jobs, contracts and client projects")}</span>
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
                className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-5 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                {t("home.headline_part1", "Front-end developer")}{" "}
                <span className="text-gradient font-extrabold">{t("home.headline_part2", "who ships real products")}</span>
              </motion.h1>

              <motion.p
                className="text-gray-400 max-w-lg mb-8 text-base md:text-lg leading-relaxed text-center lg:text-left"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                {t("home.hero_offer", "I'm Abdulwahab, a front-end developer building React and TypeScript products: booking systems, online stores, dashboards and installable apps. I'm open to full-time roles, contracts and client work. Every project below is live for you to try.")}
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
                    <span>{t("home.cta_see_work", "See my work")}</span>
                  </MagneticButton>
                </Link>
                <Link to="/contact" className="interactive">
                  <MagneticButton variant="outline">
                    <Mail size={18} />
                    <span>{t("home.cta_start", "Start a project")}</span>
                  </MagneticButton>
                </Link>
              </motion.div>
            </div>
            
          </GlassCard>
        </div>
      </section>

      {/* 2. WHAT I OFFER */}
      <section data-assistant-section="services" className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              {t("home.offer_title_part1", "What I")} <span className="text-gradient font-extrabold">{t("home.offer_title_part2", "offer")}</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
              {t("home.offer_desc", "I handle the whole build myself: design, frontend, database, payments and hosting.")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {offerCards.map((card, index) => (
              <GlassCard key={card.key} className="p-8 flex flex-col space-y-4 border-white/10" glowOnHover>
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gold">
                  <card.icon size={24} />
                </div>
                <h3 className="text-xl font-bold font-display text-white">{t(`home.offer_${card.key}_title`, card.title)}</h3>
                <p className="text-sm text-gray-400 leading-relaxed flex-grow">{t(`home.offer_${card.key}_desc`, card.description)}</p>
                <span className="text-xs text-gold/80">{t(`home.offer_${card.key}_example`, card.example)}</span>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FEATURED PROJECTS */}
      <section ref={projectsSectionRef} data-assistant-section="projects" className="relative py-12">
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

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8${isProjectsLoading ? " auto-skeleton" : ""}`}>
            {(
              projectsToShow.slice(0, 4).map((project, index) => (
                <div key={project.id || project.slug} className={isProjectsLoading ? "" : "gsap-projects-animate opacity-0"}>
                  <GlassCard className="group flex flex-col h-full border-white/10" glowOnHover>
                    <div className="relative h-60 overflow-hidden rounded-t-2xl">
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-500 z-10" />
                      <img 
                        src={project.thumbnail_url || project.hero_image_url || project.image || PLACEHOLDER_IMAGE} 
                        alt={project.title}
                        loading={index === 0 ? "eager" : "lazy"}
                        {...(index === 0 ? { fetchPriority: "high" } : {})}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      {(project.tech_stack || project.techStack || []).some((s: string) => s.includes("Mobile App")) && (
                        <div className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/15 backdrop-blur-md border border-gold/40 text-gold text-[10px] font-bold uppercase tracking-wider">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
                          </span>
                          <Smartphone size={12} aria-hidden="true" />
                          {t("projects.try_it_live", "Live app -- try it")}
                        </div>
                      )}
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
              ))
            )}
          </div>
        </div>
      </section>

      {/* 6. CERTIFICATES PREVIEW SECTION (shown while loading too, hidden only once confirmed empty) */}
      {(isCertificatesLoading || displayCertificates.length > 0) && (
      <section data-assistant-section="certificates" className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
              <span>{t("certificates.accomplishments", "Accomplishments")}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              {t("certificates.title_part1", "Verified")} <span className="text-gradient font-extrabold">{t("certificates.title_part2", "Credentials")}</span>
            </h2>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6${isCertificatesLoading ? " auto-skeleton" : ""}`}>
            {certsToShow.map((cert, index) => (
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
                  <span>{cert.year || cert.date_issued || cert.date}</span>
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
      )}

      {/* 7. TESTIMONIALS SECTION (shown while loading too, hidden only once confirmed empty) */}
      {(isTestimonialsLoading || displayTestimonials.length > 0) && (
      <section data-assistant-section="testimonials" className="relative py-12">
        <div className="w-full max-w-5xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs tracking-wider uppercase">
              <span>{t("testimonials.endorsements", "Endorsements")}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              {t("testimonials.client_title_part1", "Client")} <span className="text-gradient font-extrabold">{t("testimonials.client_title_part2", "Endorsements")}</span>
            </h2>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8${isTestimonialsLoading ? " auto-skeleton" : ""}`}>
            {testimonialsToShow.map((tItem, index) => {
              // CMS testimonials use content/image_url/company; the built-in ones use review/avatar
              const reviewText = tItem.review || tItem.content;
              const avatar = tItem.avatar || tItem.image_url || tItem.photo;
              const roleLine = [tItem.role || tItem.position, tItem.company].filter(Boolean).join(", ");
              return (
              <GlassCard key={index} className="p-8 space-y-6 border-white/15" glowOnHover>
                <div className="flex items-center gap-1 text-gold">
                  {Array.from({ length: Number(tItem.rating) || 0 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-300 italic text-sm md:text-base leading-relaxed">
                  "{reviewText}"
                </p>
                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                  {avatar ? (
                    <img 
                      src={avatar} 
                      alt={tItem.name}
                      loading="lazy"
                      className="w-12 h-12 rounded-full object-cover border border-gold/30"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full border border-gold/30 bg-white/5 flex items-center justify-center text-gold font-display font-bold" aria-hidden="true">
                      {(tItem.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">{tItem.name}</h4>
                    <p className="text-xs text-gold font-medium">{roleLine}</p>
                  </div>
                </div>
              </GlassCard>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* 9. CONTACT CTA SECTION */}
      <section data-assistant-section="contact-cta" className="relative py-12">
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
                  {t("contact.subtitle", "Have a website, a booking system, an online store or a web app in mind? Tell me about it and let's work together.")}
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
                {profile?.bio || t("common.footer_bio", "Self-taught web developer building fast, reliable, and polished websites and web apps for real businesses.")}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-gold font-bold">{t("common.showroom_links", "Showroom Links")}</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link to="/about" className="hover:text-white transition-colors">{t("nav.about", "About Story")}</Link></li>
                <li><Link to="/skills" className="hover:text-white transition-colors">{t("nav.skills", "Skills Library")}</Link></li>
                <li><Link to="/projects" className="hover:text-white transition-colors">{t("nav.projects", "Projects Showroom")}</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">{t("nav.contact", "Contact")}</Link></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-gold font-bold">{t("common.connect_directly", "Connect Directly")}</h4>
              <div className="flex gap-4">
                {socialLinks.github !== "#" && (
                  <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Github size={18} />
                  </a>
                )}
                {socialLinks.linkedin !== "#" && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Linkedin size={18} />
                  </a>
                )}
                {socialLinks.twitter !== "#" && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter / X" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Twitter size={18} />
                  </a>
                )}
                {socialLinks.instagram !== "#" && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Instagram size={18} />
                  </a>
                )}
                {socialLinks.upwork !== "#" && (
                  <a href={socialLinks.upwork} target="_blank" rel="noopener noreferrer" aria-label="Upwork" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Briefcase size={18} />
                  </a>
                )}
                {socialLinks.contra !== "#" && (
                  <a href={socialLinks.contra} target="_blank" rel="noopener noreferrer" aria-label="Contra" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                    <Handshake size={18} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between text-[11px] text-gray-500 font-mono gap-4">
            <span>© {new Date().getFullYear()} {profile?.name || "Abdul Wahab"}. {t("common.all_rights_reserved", "All Rights Reserved.")}</span>
            <div className="flex gap-4">
              <span>{t("common.built_by", "Built by Abdulwahab Abdullahi")}</span>
              <span>•</span>
              <Link to="/contact" className="text-gold hover:text-white transition-colors">{t("common.get_in_touch", "Get in touch")}</Link>
            </div>
          </div>

        </div>
      </footer>

    </PageTransition>
  );
}
