import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "motion/react";
import { 
  ArrowLeft, 
  ExternalLink, 
  Github, 
  Calendar, 
  User, 
  Activity, 
  Layers, 
  CheckCircle2, 
  ImageIcon,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";
import { useProject } from "@/hooks/useApi";
import { projectsData } from "@/data/projects";
import { useTranslation } from "react-i18next";

export default function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: apiProject, isLoading, error } = useProject(id || "");

  const [activeImgIndex, setActiveImgIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Locate fallback static project if database is not fully populated yet
  const fallbackProject = projectsData.find(p => p.id === id);
  const project = apiProject || fallbackProject;

  if (isLoading && !fallbackProject) {
    return (
      <PageTransition className="w-full min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400 font-mono tracking-wider animate-pulse">{t("project_detail.loading", "Loading project specifications...")}</div>
      </PageTransition>
    );
  }

  if (!project) {
    return (
      <PageTransition className="w-full min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="text-xl text-red-400 font-mono">{t("project_detail.not_found", "PROJECT NOT FOUND")}</div>
        <Link to="/projects" className="text-gold hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> {t("project_detail.back_showroom", "Back to Projects Showroom")}
        </Link>
      </PageTransition>
    );
  }

  // Safe data mappings
  const title = project.title || "";
  const description = project.description || "";
  const longDescription = project.long_description || project.longDescription || null;
  const techStack = project.tech_stack || project.techStack || [];
  const clientName = project.client_name || (project.id === 'luxury-hotel' ? 'Grand Imperial Hotels' : null);
  const completionDate = project.completion_date || (project.id === 'luxury-hotel' ? 'Sept 2023' : null);
  const status = project.status || 'Completed';
  const galleryImages = project.gallery_images || project.gallery || [];
  const heroImage = project.hero_image_url || project.thumbnail_url || project.image || 'https://via.placeholder.com/1200x800?text=No+Image';

  const parsedGallery = galleryImages.map((item: any) => {
    if (typeof item === 'string') {
      return { url: item, caption: '' };
    }
    return { url: item?.url || '', caption: item?.caption || '' };
  }).filter((item: any) => !!item.url);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeImgIndex === null) return;
    setActiveImgIndex((activeImgIndex - 1 + parsedGallery.length) % parsedGallery.length);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeImgIndex === null) return;
    setActiveImgIndex((activeImgIndex + 1) % parsedGallery.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    setTouchStartX(null);
  };

  return (
    <PageTransition className="w-full">
      <div className="max-w-5xl mx-auto mt-8 px-4">
        
        <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-gold transition-colors mb-8 interactive group font-mono text-sm">
          <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" />
          <span>{t("project_detail.back_to_projects", "Back to Projects")}</span>
        </Link>

        {/* Hero Banner Showcase */}
        <div className="relative w-full h-[40vh] md:h-[50vh] rounded-3xl overflow-hidden mb-12 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-transparent to-transparent z-10" />
          <motion.img 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            src={heroImage} 
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-8 left-8 right-8 z-20">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-4 tracking-tight uppercase"
            >
              {title}
            </motion.h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-12">
            <motion.section
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-display font-semibold text-gold tracking-wide uppercase border-b border-white/5 pb-2">
                {t("project_detail.overview_pitch", "Overview Pitch")}
              </h2>
              <p className="text-gray-300 leading-relaxed text-lg">
                {description}
              </p>
            </motion.section>

            {/* In-Depth Story Details (Dynamic long description column) */}
            {longDescription && (
              <motion.section
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="space-y-4"
              >
                <h2 className="text-2xl font-display font-semibold text-gold tracking-wide uppercase border-b border-white/5 pb-2">
                  {t("project_detail.story_details", "Project Story & Details")}
                </h2>
                <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed space-y-4 whitespace-pre-wrap">
                  {longDescription}
                </div>
              </motion.section>
            )}

            {/* Dynamic Gallery Showcase */}
            {parsedGallery && parsedGallery.length > 0 && (
              <motion.section
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-display font-semibold text-gold tracking-wide uppercase border-b border-white/5 pb-2 flex items-center gap-2">
                  <ImageIcon size={20} className="text-gold" />
                  <span>{t("project_detail.interactive_gallery", "Interactive Gallery")}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {parsedGallery.map((item: any, idx: number) => (
                    <motion.div 
                      key={idx} 
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setActiveImgIndex(idx)}
                      className="rounded-2xl overflow-hidden border border-white/10 aspect-video relative group cursor-pointer"
                    >
                      <img 
                        src={item.url} 
                        alt={item.caption || `${title} Gallery ${idx + 1}`} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                      {item.caption && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-4 z-25">
                          <p className="text-xs font-mono text-white tracking-wide truncate">{item.caption}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </div>

          {/* Sidebar Specifications Grid */}
          <motion.div 
            className="space-y-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {/* Meta Specifications Box */}
            <GlassCard className="p-6 border-white/10">
              <h3 className="text-sm font-mono uppercase text-[#00F0FF] mb-6 tracking-widest border-b border-white/10 pb-4 flex items-center gap-2">
                <Layers size={16} />
                <span>{t("project_detail.specifications", "SPECIFICATIONS")}</span>
              </h3>
              
              <ul className="space-y-4 font-mono text-xs">
                {clientName && (
                  <li className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <User size={14} className="text-[#00F0FF]" /> {t("project_detail.client", "Client:")}
                    </span>
                    <span className="text-white text-right font-medium">{clientName}</span>
                  </li>
                )}
                {completionDate && (
                  <li className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Calendar size={14} className="text-[#00F0FF]" /> {t("project_detail.completed", "Completed:")}
                    </span>
                    <span className="text-white text-right">{completionDate}</span>
                  </li>
                )}
                <li className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Activity size={14} className="text-[#00F0FF]" /> {t("project_detail.status_label", "Status:")}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">
                    <CheckCircle2 size={10} />
                    <span>{status}</span>
                  </span>
                </li>
              </ul>
            </GlassCard>

            {/* Technologies Used Box */}
            {techStack && techStack.length > 0 && (
              <GlassCard className="p-6 border-white/10">
                <h3 className="text-sm font-mono uppercase text-[#00F0FF] mb-4 tracking-widest flex items-center gap-2">
                  <Layers size={16} />
                  <span>{t("project_detail.tech_codename", "TECH CODENAME")}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {techStack.map((tech: string) => (
                    <span 
                      key={tech}
                      className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-white/5 border border-white/10 text-gray-300 rounded-md hover:border-[#00F0FF]/30 hover:text-white transition-colors"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Links Box */}
            <GlassCard className="p-6 border-white/10">
              <h3 className="text-sm font-mono uppercase text-[#00F0FF] mb-6 tracking-widest border-b border-white/10 pb-4">
                {t("project_detail.access_points", "Access Points")}
              </h3>
              <div className="flex flex-col gap-4">
                {project.live_url && (
                  <a href={project.live_url} target="_blank" rel="noreferrer" className="w-full interactive">
                    <MagneticButton variant="primary" className="w-full flex justify-center py-2">
                      <ExternalLink size={16} />
                      <span className="ml-2">{t("project_detail.live_deployment", "Live Deployment")}</span>
                    </MagneticButton>
                  </a>
                )}
                
                {project.github_url && (
                  <a href={project.github_url} target="_blank" rel="noreferrer" className="w-full interactive">
                    <MagneticButton variant="outline" className="w-full flex justify-center py-2">
                      <Github size={16} />
                      <span className="ml-2">{t("project_detail.source_code", "Source Code")}</span>
                    </MagneticButton>
                  </a>
                )}
                {!project.live_url && !project.github_url && (
                  <p className="text-gray-500 font-mono text-center text-xs py-2">{t("project_detail.restricted_codebase", "Restricted codebase.")}</p>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {activeImgIndex !== null && parsedGallery[activeImgIndex] && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setActiveImgIndex(null)}
        >
          {/* Close button */}
          <button 
            onClick={() => setActiveImgIndex(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-[110]"
          >
            <X size={24} />
          </button>

          {/* Navigation Controls */}
          {parsedGallery.length > 1 && (
            <>
              <button 
                onClick={handlePrev}
                className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-[110]"
              >
                <ChevronLeft size={28} />
              </button>

              <button 
                onClick={handleNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-[110]"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          {/* Active Image */}
          <div 
            className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center gap-4 z-[105]"
            onClick={(e) => e.stopPropagation()} // Prevent close on image click
          >
            <motion.img 
              key={activeImgIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              src={parsedGallery[activeImgIndex].url} 
              alt={parsedGallery[activeImgIndex].caption || "Gallery fullscreen"}
              className="max-w-full max-h-[70vh] object-contain rounded-lg border border-white/10 shadow-2xl"
              referrerPolicy="no-referrer"
            />
            
            {parsedGallery[activeImgIndex].caption && (
              <p className="text-sm font-mono text-gray-300 text-center max-w-lg px-4 bg-white/5 py-2 rounded-lg border border-white/5">
                {parsedGallery[activeImgIndex].caption}
              </p>
            )}

            <div className="text-xs font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
              {activeImgIndex + 1} / {parsedGallery.length}
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
