import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { CardSkeleton } from "@/components/Skeleton";
import { useTestimonials } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";
import { ClientReviewsSection } from "@/components/ClientReviewsSection";

export default function Testimonials() {
  const { t } = useTranslation();
  const { data: testimonialsData, isLoading } = useTestimonials();
  // Hooks must run on every render, before any early return
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Only real CMS entries are shown; there is no placeholder content presented as genuine
  const displayTestimonials: any[] = Array.isArray(testimonialsData) ? testimonialsData : [];
  const count = displayTestimonials.length;

  useEffect(() => {
    setCurrentIndex(0);
    if (count < 2) return;
    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % count);
    }, 8000);
    return () => clearInterval(interval);
  }, [count]);

  if (isLoading) {
    return (
      <PageTransition className="w-full">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 md:mb-24 mt-12">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
              {t("testimonials.title_part1", "CLIENT")} <span className="text-gradient">{t("testimonials.title_part2", "FEEDBACK")}</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto opacity-0">
              {t("testimonials.subtitle", "Words of recommendation from colleagues, clients, and collaborators.")}
            </p>
          </div>
          <CardSkeleton />
        </div>
      </PageTransition>
    );
  }

  const nextTestimonial = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % count);
  };

  const prevTestimonial = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  };

  // CMS testimonials use content/image_url/role/company; the built-in ones use review/photo/position
  const current = count > 0 ? displayTestimonials[currentIndex % count] : null;
  const currentReview = current?.review || current?.content;
  const currentPhoto = current?.photo || current?.avatar || current?.image_url;
  const currentRole = [current?.position || current?.role, current?.company].filter(Boolean).join(", ");

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0,
      scale: 0.9,
    })
  };

  return (
    <PageTransition className="w-full h-full flex flex-col justify-center min-h-[70vh]">
      <div className="max-w-4xl mx-auto w-full">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
            {t("testimonials.client_title_part1", "CLIENT")} <span className="text-gradient">{t("testimonials.client_title_part2", "VOICES")}</span>
          </h1>
        </motion.div>

        {!current ? (
          <GlassCard className="p-8 md:p-12 text-center max-w-2xl mx-auto">
            <p className="text-xl text-gray-300">
              {t("testimonials.empty_state", "No client testimonials yet.")}
            </p>
            <p className="text-gray-400 mt-3">
              {t("testimonials.empty_state_help", "Worked with me? Share your experience in the reviews section below.")}
            </p>
          </GlassCard>
        ) : (
        <>
        <div className="relative h-[400px] md:h-[350px] w-full flex items-center justify-center">
          
          <button 
            type="button"
            onClick={prevTestimonial}
            aria-label="Previous testimonial"
            className="absolute left-0 md:-left-16 z-20 p-3 rounded-full bg-white/5 border border-white/10 text-gold hover:bg-gold/20 backdrop-blur-md transition-all interactive"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="w-full max-w-2xl overflow-hidden px-4 md:px-0 relative h-full flex items-center justify-center">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="w-full absolute"
              >
                <GlassCard className="p-8 md:p-12 relative">
                  <Quote size={80} className="absolute top-6 left-6 text-white/5 -z-10 rotate-180" />
                  
                  <div className="flex flex-col items-center text-center">
                    <p className="text-xl md:text-2xl text-gray-300 leading-relaxed italic mb-8 font-serif">
                      "{t(`testimonials.review_${current.id}`, currentReview) as string}"
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gold">
                        {currentPhoto ? (
                          <img 
                            src={currentPhoto} 
                            alt={current.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center text-gold font-bold text-xl" aria-hidden="true">
                            {(current.name || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-white">
                          {t(`testimonials.name_${current.id}`, current.name) as string}
                        </h4>
                        <p className="text-gold text-sm">
                          {t(`testimonials.role_${current.id}`, currentRole) as string}
                        </p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </AnimatePresence>
          </div>

          <button 
            type="button"
            onClick={nextTestimonial}
            aria-label="Next testimonial"
            className="absolute right-0 md:-right-16 z-20 p-3 rounded-full bg-white/5 border border-white/10 text-gold hover:bg-gold/20 backdrop-blur-md transition-all interactive"
          >
            <ChevronRight size={24} />
          </button>

        </div>
        
        <div className="flex justify-center gap-3 mt-8">
          {displayTestimonials.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Show testimonial ${idx + 1}`}
              aria-current={idx === currentIndex}
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                idx === currentIndex % count ? 'bg-gold w-8' : 'bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
        </>
        )}

        {/* Brand-new Client Reviews and Star Ratings Moderation Board */}
        <ClientReviewsSection />
      </div>
    </PageTransition>
  );
}
