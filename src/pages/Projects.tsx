import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ExternalLink, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { useProjects } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { data: projectsData, isLoading, error } = useProjects();

  if (isLoading) {
    return (
      <PageTransition className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="text-xl text-gray-400">{t("common.loading", "Loading projects...")}</div>
      </PageTransition>
    );
  }

  if (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    let diagnosticTitle = t("projects.failed_load", "Failed to load projects.");
    let diagnosticHelp = "The server returned an error when fetching project records from Supabase.";

    if (errorMsg.includes("404")) {
      diagnosticTitle = "API Route Not Found (404)";
      diagnosticHelp = "The projects API endpoint could not be reached. This usually indicates a routing issue or serverless configuration error on Vercel.";
    } else if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
      diagnosticTitle = "Network Connection Failed";
      diagnosticHelp = "Unable to connect to the backend server. The backend might be offline, restarting, or blocked by CORS/security policies.";
    } else if (errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("Unauthorized") || errorMsg.includes("JWT")) {
      diagnosticTitle = "Access Denied / Permission Error";
      diagnosticHelp = "The server refused access. Please verify your Supabase API keys and ensure that Row Level Security (RLS) policies allow public SELECT queries.";
    } else if (errorMsg.includes("database") || errorMsg.includes("relation") || errorMsg.includes("table") || errorMsg.includes("column")) {
      diagnosticTitle = "Database Table Not Found";
      diagnosticHelp = "The 'projects' table or its columns could not be found. Please ensure your Supabase database migrations have been executed successfully.";
    }

    return (
      <PageTransition className="w-full min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center space-y-5 max-w-md w-full bg-red-950/10 border border-red-900/20 rounded-2xl p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(239,68,68,0.05)]">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
            <span className="text-red-400 text-lg font-mono">!</span>
          </div>
          <h2 className="text-xl font-display font-semibold text-red-400">{diagnosticTitle}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{diagnosticHelp}</p>
          <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-left text-[11px] font-mono text-gray-400 overflow-x-auto max-h-32">
            <span className="text-red-400/80 font-bold block mb-1">Diagnostic Log:</span>
            {errorMsg}
          </div>
          <p className="text-[11px] text-gray-500">
            Please check your Vercel Environment Variables and local database logs.
          </p>
        </div>
      </PageTransition>
    );
  }

  if (!projectsData || projectsData.length === 0) {
    return (
      <PageTransition className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="text-xl text-gray-400 font-display font-semibold">{t("projects.no_projects", "No Published Projects Found")}</div>
          <p className="text-sm text-gray-500 leading-relaxed">
            There are no projects currently published to the live site. 
            Log in to your admin panel and change a project's status to <strong>Published</strong> to show it here.
          </p>
        </div>
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
            {t("projects.title_part1", "FEATURED")} <span className="text-gradient">{t("projects.title_part2", "PROJECTS")}</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("projects.subtitle", "A curated selection of digital experiences built with precision and intent.")}
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
                  
                  {/* Tech stack floating tags */}
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5 z-20">
                    {(project.tech_stack || project.techStack || []).slice(0, 3).map((stack: string) => (
                      <span key={stack} className="px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-black/75 backdrop-blur-md text-white rounded border border-white/10">
                        {stack}
                      </span>
                    ))}
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
                      <span>{t("projects.view_details", "View Details")}</span>
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
