import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";

const certificates = [
  {
    id: 1,
    title: "Advanced React Patterns",
    issuer: "Frontend Masters",
    date: "2023",
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1200&auto=format&fit=crop"
  },
  {
    id: 2,
    title: "Solar Energy Systems Design",
    issuer: "Renewable Energy Institute",
    date: "2022",
    image: "https://images.unsplash.com/photo-1509391366360-1e6e2163ca81?q=80&w=1200&auto=format&fit=crop"
  },
  {
    id: 3,
    title: "Full Stack Web Development",
    issuer: "Udacity",
    date: "2024",
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop"
  }
];

export default function Certificates() {
  const [selectedCert, setSelectedCert] = useState<typeof certificates[0] | null>(null);

  return (
    <PageTransition className="w-full">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          className="text-center mb-16 md:mb-24 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
            ACHIEVEMENTS <span className="text-gradient">&</span> PROOF
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Verified knowledge across engineering and software development.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {certificates.map((cert, index) => (
            <motion.div
              key={cert.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, type: "spring", stiffness: 100 }}
            >
              <GlassCard 
                className="cursor-pointer group h-full flex flex-col" 
                glowOnHover
                onClick={() => setSelectedCert(cert)}
              >
                <div className="relative h-48 overflow-hidden rounded-t-2xl">
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors z-10 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-12 h-12 rounded-full bg-gold/80 flex items-center justify-center text-black shadow-[0_0_20px_rgba(212,175,55,0.5)] transform scale-50 group-hover:scale-100 transition-transform duration-300">
                      <Search size={24} />
                    </div>
                  </div>
                  <img 
                    src={cert.image} 
                    alt={cert.title} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="text-gold text-sm font-medium tracking-wider mb-2">{cert.date}</span>
                  <h3 className="text-xl font-display font-semibold text-white mb-2">{cert.title}</h3>
                  <p className="text-gray-400 text-sm mt-auto">{cert.issuer}</p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedCert && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-xl"
              onClick={() => setSelectedCert(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative max-w-4xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setSelectedCert(null)}
                  className="absolute -top-12 right-0 md:-right-12 text-gray-400 hover:text-white transition-colors bg-white/10 p-2 rounded-full backdrop-blur-md"
                >
                  <X size={24} />
                </button>
                <div className="rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_50px_rgba(212,175,55,0.2)] bg-bg-darker">
                  <img 
                    src={selectedCert.image} 
                    alt={selectedCert.title} 
                    className="w-full max-h-[80vh] object-contain"
                  />
                  <div className="p-6 bg-gradient-to-t from-bg-dark to-transparent absolute bottom-0 left-0 right-0">
                    <h2 className="text-2xl font-display font-bold text-white">{selectedCert.title}</h2>
                    <p className="text-gold">{selectedCert.issuer}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
