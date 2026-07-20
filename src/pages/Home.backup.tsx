import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
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
  const [currentRoleIndex, setCurrentRoleIndex] = useState(0);
  const aboutSectionRef = useRef<HTMLDivElement>(null);
  const skillsSectionRef = useRef<HTMLDivElement>(null);
  const projectsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRoleIndex((prev) => (prev + 1) % roles.length);
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
            
            {/* Image Container with Float and Subtle Rotate */}
            <motion.div 
              className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-2 border-gold/20 shrink-0 relative shadow-[0_0_30px_rgba(212,175,55,0.15)]"
              animate={{ 
                y: [-12, 12, -12],
                rotateZ: [-3, 3, -3]
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-gold/30 via-transparent to-transparent mix-blend-overlay z-10" />
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop" 
                alt="Abdul Wahab" 
                className="w-full h-full object-cover grayscale contrast-110 hover:grayscale-0 transition-all duration-700"
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
                <span>Now Open for Select Commissions</span>
              </motion.div>
              
              <motion.p 
                className="text-gold/80 font-display font-medium tracking-widest text-base mb-2 uppercase"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
              >
                Abdul Wahab
              </motion.p>
              
              <motion.h1 
                className="text-4xl md:text-5xl lg:text-7xl font-display font-bold tracking-tight mb-4 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                SELF-TAUGHT
                <br />
                <span className="text-gradient font-extrabold">DEVELOPER</span>
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
                    {roles[currentRoleIndex]}
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
                I build fast, responsive, and reliable websites that combine clean, modern design with practical functionality. From custom business platforms to management systems, my focus is on delivering premium web experiences that perform exceptionally and solve real problems.
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
                    <span>View Projects</span>
                  </MagneticButton>
                </Link>
                
                <Link to="/resume" className="interactive">
                  <MagneticButton variant="secondary">
                    <Download size={18} />
                    <span>Download Resume</span>
                  </MagneticButton>
                </Link>
                
                <Link to="/contact" className="interactive">
                  <MagneticButton variant="outline">
                    <Mail size={18} />
                    <span>Get In Touch</span>
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
                <span>The Storyteller</span>
              </div>
              <h2 className="gsap-about-animate text-4xl md:text-5xl font-display font-bold text-white tracking-tight leading-tight opacity-0">
                Crafting With <br /><span className="text-gradient font-extrabold">Intent & Passion</span>
              </h2>
              <p className="gsap-about-animate text-gray-400 leading-relaxed text-sm md:text-base opacity-0">
                From mounting physical solar arrays on the hot roofs of renewable infrastructure, to engineering clean responsive algorithms behind sleek web interfaces. Abdul's journey is one of non-traditional excellence.
              </p>
              <div className="gsap-about-animate pt-4 opacity-0">
                <Link to="/about" className="inline-flex items-center gap-2 group text-gold font-medium hover:text-white transition-colors duration-300 interactive">
                  <span>Read the Full Journey</span>
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
                    <h3 className="text-lg font-bold text-white font-display">Elite Developer</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">Dedicated to functional state patterns, crisp micro-interactions, and pristine Tailwind designs.</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:border-gold/20 transition-colors duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                      <Sun size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-white font-display">Solar Specialist</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">A certified technician with experience building reliable physical off-grid systems and hybrid load layouts.</p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-6 flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl font-bold font-display text-white">2+ Years</h4>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Coding Experience</p>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold font-display text-white">100%</h4>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Self-Taught</p>
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold font-display text-white">15+</h4>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Completed Projects</p>
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
              <span>Expertise</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              Technical <span className="text-gradient font-extrabold">Capability</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
              Meticulously curated technologies and hardware knowledge built from continuous practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="gsap-skills-animate opacity-0">
              <GlassCard className="p-6 md:p-8 space-y-6 h-full" glowOnHover>
                <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                  <Code size={24} />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Frontend Engineering</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Developing pristine modular client solutions with high performance scoring.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {["React", "TypeScript", "Tailwind CSS", "Framer Motion", "Next.js"].map((skill) => (
                    <span key={skill} className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/5 text-gray-300">{skill}</span>
                  ))}
                </div>
              </GlassCard>
            </div>

            <div className="gsap-skills-animate opacity-0">
              <GlassCard className="p-6 md:p-8 space-y-6 h-full" glowOnHover>
                <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                  <Sun size={24} />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Solar & Electrical</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Robust practical setups, smart monitoring telemetry, diagnostics, and component selection.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {["Inverters", "Lithium Battery", "Sizing", "Solar Arrays", "Diagnostics"].map((skill) => (
                    <span key={skill} className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/5 text-gray-300">{skill}</span>
                  ))}
                </div>
              </GlassCard>
            </div>

            <div className="gsap-skills-animate opacity-0">
              <GlassCard className="p-6 md:p-8 space-y-6 h-full" glowOnHover>
                <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                  <Cpu size={24} />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Developer Ecosystem</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Utilizing top industry-standard environments to manage deployment pipelines cleanly.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {["Git & GitHub", "Figma", "VS Code", "Vercel", "AI Copilot"].map((skill) => (
                    <span key={skill} className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/5 text-gray-300">{skill}</span>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>

          <div className="text-center mt-12 gsap-skills-animate opacity-0">
            <Link to="/skills" className="interactive">
              <MagneticButton variant="secondary">
                <span>Explore Full Arsenal</span>
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
              <span>Distinctive Strengths</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              What Makes Me <span className="text-gradient font-extrabold">Different</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
              A unique fusion of systematic physical engineering discipline and modern full-stack development.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {differentCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <GlassCard key={index} className="p-8 flex flex-col space-y-6 border-white/10" glowOnHover>
                  <span className="text-xs font-bold text-gold/80 tracking-widest uppercase">{card.tag}</span>
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-2xl font-bold font-display text-white">{card.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed flex-grow">{card.description}</p>
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
                <span>Selected Pieces</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
                Featured <span className="text-gradient font-extrabold">Engagements</span>
              </h2>
            </div>
            <div className="text-center">
              <Link to="/projects" className="inline-flex items-center gap-2 group text-gold font-medium hover:text-white transition-colors duration-300 interactive">
                <span>Browse All Work</span>
                <ArrowRight size={18} className="transform group-hover:translate-x-1.5 transition-transform duration-300" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {projectsData.slice(0, 2).map((project) => (
              <div key={project.id} className="gsap-projects-animate opacity-0">
                <GlassCard className="group flex flex-col h-full border-white/10" glowOnHover>
                  <div className="relative h-60 overflow-hidden rounded-t-2xl">
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-500 z-10" />
                    <img 
                      src={project.image} 
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                      {project.techStack.slice(0, 2).map((stack) => (
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
                      to={`/projects/${project.id}`} 
                      className="mt-auto inline-flex items-center gap-2 text-sm text-gold hover:text-white transition-colors duration-300 interactive font-medium"
                    >
                      <span>View Project Specifications</span>
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
              <span>Accomplishments</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              Verified <span className="text-gradient font-extrabold">Credentials</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {homeCertificates.map((cert, index) => (
              <GlassCard key={index} className="p-6 border-white/10 space-y-4 flex flex-col justify-between" glowOnHover>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-3">
                    <Award size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white font-display leading-snug">{cert.title}</h3>
                  <p className="text-xs text-gray-400">{cert.issuer}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-gray-500 font-mono">
                  <span>Issued Date</span>
                  <span>{cert.year}</span>
                </div>
              </GlassCard>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/certificates" className="interactive">
              <MagneticButton variant="outline">
                <span>View All Certificates</span>
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
              <span>Endorsements</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white">
              Client <span className="text-gradient font-extrabold">Endorsements</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {homeTestimonials.map((t, index) => (
              <GlassCard key={index} className="p-8 space-y-6 border-white/15" glowOnHover>
                <div className="flex items-center gap-1 text-gold">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-300 italic text-sm md:text-base leading-relaxed">
                  "{t.review}"
                </p>
                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                  <img 
                    src={t.avatar} 
                    alt={t.name}
                    className="w-12 h-12 rounded-full object-cover border border-gold/30"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white font-display">{t.name}</h4>
                    <p className="text-xs text-gold font-medium">{t.role}</p>
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
              Curriculum Vitae
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base">
              A comprehensive view of my academic qualifications, professional journey, certifications, and complete hardware-software design history.
            </p>
            <div className="pt-4 flex justify-center gap-4">
              <Link to="/resume" className="interactive">
                <MagneticButton variant="primary">
                  <span>Explore Interactive Resume</span>
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
                  <span>Get In Touch</span>
                </div>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white tracking-tight leading-tight">
                  LET'S BUILD <br />SOMETHING <span className="text-gradient font-extrabold">GREAT.</span>
                </h2>
                <p className="text-gray-400 max-w-lg mx-auto lg:mx-0 text-sm md:text-base">
                  Have an outstanding digital software project, an off-grid solar installation design, or a complex technical problem that needs a reliable solver? Let's cooperate.
                </p>
              </div>

              <div className="lg:col-span-5 flex flex-col justify-center items-center lg:items-end gap-4">
                <Link to="/contact" className="w-full interactive">
                  <MagneticButton variant="primary" className="w-full py-4 text-base">
                    <Mail size={18} />
                    <span>Initiate Conversation</span>
                  </MagneticButton>
                </Link>
                <a 
                  href="mailto:abdulwahababdullah3619@gmail.com"
                  className="px-6 py-3 text-sm text-gray-400 hover:text-white transition-colors duration-300 font-mono interactive"
                >
                  abdulwahababdullah3619@gmail.com
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
                Abdul <span className="text-gradient font-extrabold">Wahab</span>
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                Self-taught full-stack developer with a background in solar engineering, dedicated to building fast, reliable, and premium web experiences.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-gold font-bold">Showroom Links</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><Link to="/about" className="hover:text-white transition-colors">About Story</Link></li>
                <li><Link to="/skills" className="hover:text-white transition-colors">Skills Library</Link></li>
                <li><Link to="/projects" className="hover:text-white transition-colors">Projects Showroom</Link></li>
                <li><Link to="/certificates" className="hover:text-white transition-colors">Certificates</Link></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-gold font-bold">Connect Directly</h4>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                  <Github size={18} />
                </a>
                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-gold/50 transition-colors interactive">
                  <Linkedin size={18} />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between text-[11px] text-gray-500 font-mono gap-4">
            <span>© {new Date().getFullYear()} Abdul Wahab. All Rights Reserved.</span>
            <div className="flex gap-4">
              <span>Designed with Intent</span>
              <span>•</span>
              <span>Clean Energy & Software</span>
            </div>
          </div>

        </div>
      </footer>

    </PageTransition>
  );
}
