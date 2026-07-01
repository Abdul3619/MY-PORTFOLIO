import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, ExternalLink, Github, CheckCircle2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";
import { useProject } from "@/hooks/useApi";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, error } = useProject(id || "");

  if (isLoading) {
    return (
      <PageTransition className="w-full min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading project...</div>
      </PageTransition>
    );
  }

  if (error || !project) {
    return (
      <PageTransition className="w-full min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="text-xl text-red-400">Project not found</div>
        <Link to="/projects" className="text-gold hover:underline">Back to Projects</Link>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="w-full">
      <div className="max-w-5xl mx-auto mt-8">
        
        <Link to="/projects" className="inline-flex items-center gap-2 text-gray-400 hover:text-gold transition-colors mb-8 interactive">
          <ArrowLeft size={20} />
          <span>Back to Projects</span>
        </Link>

        {/* Hero Section */}
        <div className="relative w-full h-[40vh] md:h-[50vh] rounded-3xl overflow-hidden mb-12 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-transparent to-transparent z-10" />
          <motion.img 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            src={project.hero_image_url || project.thumbnail_url || 'https://via.placeholder.com/1200x800?text=No+Image'} 
            alt={project.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-8 left-8 right-8 z-20">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-4"
            >
              {project.title}
            </motion.h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Main Content */}
          <div className="md:col-span-2 space-y-12">
            <motion.section
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-2xl font-display font-semibold mb-6 text-gold">Project Story</h2>
              <div className="prose prose-invert prose-lg max-w-none whitespace-pre-wrap">
                <p className="text-gray-300 leading-relaxed">
                  {project.description}
                </p>
              </div>
            </motion.section>
            
            {/* Tech stack and features would need to be stored as JSON/array in the DB if you want to keep them. */}
          </div>

          {/* Sidebar */}
          <motion.div 
            className="space-y-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <GlassCard className="p-8">
              <h3 className="text-xl font-display font-semibold mb-6 text-white border-b border-white/10 pb-4">
                Links
              </h3>
              <div className="flex flex-col gap-4">
                {project.live_url && (
                  <a href={project.live_url} target="_blank" rel="noreferrer" className="w-full">
                    <MagneticButton variant="primary" className="w-full flex justify-center">
                      <ExternalLink size={18} />
                      <span className="ml-2">Live Demo</span>
                    </MagneticButton>
                  </a>
                )}
                
                {project.github_url && (
                  <a href={project.github_url} target="_blank" rel="noreferrer" className="w-full">
                    <MagneticButton variant="outline" className="w-full flex justify-center">
                      <Github size={18} />
                      <span className="ml-2">Source Code</span>
                    </MagneticButton>
                  </a>
                )}
                {!project.live_url && !project.github_url && (
                  <p className="text-gray-400 text-sm">No links available for this project.</p>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
