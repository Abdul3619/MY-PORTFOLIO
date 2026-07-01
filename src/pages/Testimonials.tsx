import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";

const testimonials = [
  {
    id: 1,
    name: "Sarah Jenkins",
    position: "Creative Director",
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    review: "Abdul has a rare combination of technical precision and an eye for high-end design. The website he built for our agency didn't just meet our expectations; it completely redefined our digital presence."
  },
  {
    id: 2,
    name: "Michael Chang",
    position: "Founder, Apex Solar",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    review: "Having someone who understands both the physical engineering of solar systems and the digital architecture of our internal tools was a game-changer. Abdul is brilliant and relentlessly dedicated."
  },
  {
    id: 3,
    name: "Elena Rodriguez",
    position: "Marketing Lead",
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
    review: "The level of polish Abdul brings to frontend development is astounding. His attention to micro-interactions and performance optimization sets him apart from anyone we've worked with before."
  }
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextTestimonial = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    const interval = setInterval(nextTestimonial, 8000);
    return () => clearInterval(interval);
  }, []);

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
            CLIENT <span className="text-gradient">VOICES</span>
          </h1>
        </motion.div>

        <div className="relative h-[400px] md:h-[350px] w-full flex items-center justify-center">
          
          <button 
            onClick={prevTestimonial}
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
                      "{testimonials[currentIndex].review}"
                    </p>
                    
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gold">
                        <img 
                          src={testimonials[currentIndex].photo} 
                          alt={testimonials[currentIndex].name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-white">{testimonials[currentIndex].name}</h4>
                        <p className="text-gold text-sm">{testimonials[currentIndex].position}</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </AnimatePresence>
          </div>

          <button 
            onClick={nextTestimonial}
            className="absolute right-0 md:-right-16 z-20 p-3 rounded-full bg-white/5 border border-white/10 text-gold hover:bg-gold/20 backdrop-blur-md transition-all interactive"
          >
            <ChevronRight size={24} />
          </button>

        </div>
        
        <div className="flex justify-center gap-3 mt-8">
          {testimonials.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'bg-gold w-8' : 'bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
