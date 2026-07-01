import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ExternalLink, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { useProjects } from "@/hooks/useApi";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 80, damping: 20 }
  }
};

export default function Projects() {
  const { data: projectsData, isLoading, error } = useProjects();

  if (isLoading) {
    return (
      <PageTransition className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading projects...</div>
      </PageTransition>
    );
  }

  if (error || !projectsData) {
    return (
      <PageTransition className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="text-xl text-red-400">Failed to load projects.</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="w-full">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="text-center mb-16 md:mb-24 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
            FEATURED <span className="text-gradient">PROJECTS</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A curated selection of digital experiences built with precision and intent.
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {projectsData.map((project: any) => (
            <motion.div key={project.id} variants={itemVariants} className="h-full">
              <GlassCard className="h-full flex flex-col group" glowOnHover>
                
                {/* Image Container with hover effect */}
                <div className="relative h-64 overflow-hidden rounded-t-2xl">
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors duration-500 z-10" />
                  <motion.img 
                    src={project.thumbnail_url || project.hero_image_url || 'https://via.placeholder.com/600x400?text=No+Image'} 
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  
                  {/* Tech stack floating tags - we can mock or read from another table if implemented, for now hidden if not array */}
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 z-20">
                    {/* Add tags if you extend the DB schema to support JSON array for techStack */}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-2xl font-display font-semibold mb-3 text-white group-hover:text-gold transition-colors duration-300">
                    {project.title}
                  </h3>
                  <p className="text-gray-400 mb-6 flex-1 line-clamp-3">
                    {project.description}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-auto">
                    <Link 
                      to={`/projects/${project.slug}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-gold hover:text-black hover:border-gold transition-all duration-300 interactive"
                    >
                      <span>View Details</span>
                      <ArrowRight size={16} />
                    </Link>
                    
                    {project.live_url && (
                      <a href={project.live_url} target="_blank" rel="noreferrer" className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-gold hover:border-gold/50 transition-all duration-300 interactive">
                        <ExternalLink size={20} />
                      </a>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </PageTransition>
  );
}
