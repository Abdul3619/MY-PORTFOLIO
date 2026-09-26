import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, Award } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { CardSkeleton } from "@/components/Skeleton";
import { useCertificates } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";

export default function Certificates() {
  const { t } = useTranslation();
  const { data: certsData, isLoading } = useCertificates();
  // Hooks must run on every render, before any early return
  const [selectedCert, setSelectedCert] = useState<any | null>(null);

  useEffect(() => {
    if (!selectedCert) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCert(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedCert]);

  if (isLoading) {
    return (
      <PageTransition className="w-full">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 md:mb-24 mt-12">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
              {t("certificates.title_part1", "ACHIEVEMENTS")} <span className="text-gradient">{t("certificates.title_part2", "& PROOF")}</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto opacity-0">
              {t("certificates.subtitle", "Verified knowledge across engineering and software development.")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  // Only real CMS entries are shown; there is no placeholder content presented as genuine
  const displayCerts: any[] = Array.isArray(certsData) ? certsData : [];

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
            {t("certificates.title_part1", "ACHIEVEMENTS")} <span className="text-gradient">{t("certificates.title_part2", "& PROOF")}</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("certificates.subtitle", "Verified knowledge across engineering and software development.")}
          </p>
        </motion.div>

        {displayCerts.length === 0 && (
          <GlassCard className="p-8 text-center max-w-xl mx-auto">
            <p className="text-gray-400">
              {t("certificates.empty_state", "No certificates have been added yet.")}
            </p>
          </GlassCard>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayCerts.map((cert, index) => (
            <motion.div
              key={cert.id ?? index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2, type: "spring", stiffness: 100 }}
            >
              <GlassCard 
                className="cursor-pointer group h-full flex flex-col" 
                glowOnHover
                onClick={() => setSelectedCert(cert)}
                role="button"
                tabIndex={0}
                aria-label={`View certificate: ${cert.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedCert(cert);
                  }
                }}
              >
                <div className="relative h-48 overflow-hidden rounded-t-2xl">
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors z-10 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-12 h-12 rounded-full bg-gold/80 flex items-center justify-center text-black shadow-[0_0_20px_rgba(212,175,55,0.5)] transform scale-50 group-hover:scale-100 transition-transform duration-300">
                      <Search size={24} />
                    </div>
                  </div>
                  {(cert.image_url || cert.image) ? (
                    <img 
                      src={(cert.image_url || cert.image)} 
                      alt={cert.title} 
                      loading="lazy"
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center text-gold/40" aria-hidden="true">
                      <Award size={48} />
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="text-gold text-sm font-medium tracking-wider mb-2">{(cert.date_issued || cert.date)}</span>
                  <h3 className="text-xl font-display font-semibold text-white mb-2">
                    {t(`certificates.cert_title_${cert.id}`, cert.title) as string}
                  </h3>
                  <p className="text-gray-400 text-sm mt-auto">
                    {t(`certificates.cert_issuer_${cert.id}`, cert.issuer) as string}
                  </p>
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
                role="dialog"
                aria-modal="true"
                aria-label={selectedCert.title}
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setSelectedCert(null)}
                  aria-label="Close certificate preview"
                  className="absolute -top-12 right-0 md:-right-12 text-gray-400 hover:text-white transition-colors bg-white/10 p-2 rounded-full backdrop-blur-md"
                >
                  <X size={24} />
                </button>
                <div className="rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_50px_rgba(212,175,55,0.2)] bg-bg-darker">
                  {(selectedCert.image_url || selectedCert.image) ? (
                    <img 
                      src={selectedCert.image_url || selectedCert.image} 
                      alt={selectedCert.title} 
                      loading="lazy"
                      className="w-full max-h-[80vh] object-contain"
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center text-gold/40" aria-hidden="true">
                      <Award size={64} />
                    </div>
                  )}
                  <div className="p-6 bg-gradient-to-t from-bg-dark to-transparent absolute bottom-0 left-0 right-0">
                    <h2 className="text-2xl font-display font-bold text-white">
                      {t(`certificates.cert_title_${selectedCert.id}`, selectedCert.title) as string}
                    </h2>
                    <p className="text-gold">
                      {t(`certificates.cert_issuer_${selectedCert.id}`, selectedCert.issuer) as string}
                    </p>
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
