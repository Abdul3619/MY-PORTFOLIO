import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { Sun, Code, Target, Rocket, Lightbulb } from "lucide-react";

const timelineEvents = [
  {
    id: "start",
    title: "How I Started",
    icon: Lightbulb,
    content: "My journey began with a deep curiosity for how things work. Whether it was dismantling old electronics or tinkering with software, I always wanted to understand the mechanics behind the magic. This curiosity evolved into a passion for digital problem-solving.",
    date: "The Beginning",
  },
  {
    id: "solar",
    title: "Solar Engineering Experience",
    icon: Sun,
    content: "Before diving deep into code, I worked hands-on as a Solar Technician. I mastered solar installations, battery systems, and inverter setups. This experience taught me practical problem-solving, precision, and the importance of sustainable energy solutions.",
    date: "Foundation",
  },
  {
    id: "web",
    title: "Learning Web Development",
    icon: Code,
    content: "Driven by the desire to build, I transitioned into tech. I am entirely self-taught, spending countless nights learning HTML, CSS, JavaScript, and eventually React and Tailwind. I learned to translate complex problems into elegant, scalable digital experiences.",
    date: "The Pivot",
  },
  {
    id: "goals",
    title: "Current Goals",
    icon: Target,
    content: "Today, I focus on crafting premium, high-performance web applications. I bridge the gap between aesthetic design and robust engineering, ensuring every project I touch feels like a luxury digital experience.",
    date: "Present",
  },
  {
    id: "vision",
    title: "Future Vision",
    icon: Rocket,
    content: "I aim to become a master Full Stack Engineer, combining my technical background with cutting-edge web technologies to build products that not only function flawlessly but inspire awe.",
    date: "Beyond",
  }
];

function TimelineItem({ event, index }: { event: typeof timelineEvents[0]; index: number }) {
  const cardRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["0 1", "1.2 1"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const isEven = index % 2 === 0;

  return (
    <div className="relative flex items-center justify-center min-h-[40vh] py-12" ref={cardRef}>
      {/* Center Line connecting icons */}
      <div className="absolute top-0 bottom-0 left-[28px] md:left-1/2 w-[2px] bg-white/10 -translate-x-1/2" />
      
      <div className={`w-full flex flex-col md:flex-row items-center justify-between z-10 ${isEven ? 'md:flex-row-reverse' : ''}`}>
        
        {/* Timeline Icon */}
        <div className="absolute left-[28px] md:left-1/2 -translate-x-1/2 bg-bg-dark border border-gold/50 rounded-full p-3 text-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]">
          <event.icon size={24} />
        </div>

        {/* Empty space for the other side on desktop */}
        <div className="hidden md:block md:w-1/2" />

        {/* Content Card */}
        <motion.div 
          style={{ y, opacity }}
          className={`w-full pl-16 pr-4 md:w-1/2 md:px-12 flex ${isEven ? 'justify-end' : 'justify-start'}`}
        >
          <GlassCard className="p-6 md:p-8 w-full max-w-lg" glowOnHover>
            <span className="text-gold text-sm font-bold tracking-wider uppercase mb-2 block">
              {event.date}
            </span>
            <h3 className="text-2xl font-display font-semibold mb-4 text-white">
              {event.title}
            </h3>
            <p className="text-gray-400 leading-relaxed">
              {event.content}
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

export default function About() {
  return (
    <PageTransition className="w-full">
      <div className="max-w-5xl mx-auto">
        <motion.div 
          className="text-center mb-24 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6">
            MY <span className="text-gradient">JOURNEY</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            The path from hardware to software, from solar arrays to digital experiences.
          </p>
        </motion.div>

        <div className="relative pb-24">
          {timelineEvents.map((event, index) => (
            <TimelineItem key={event.id} event={event} index={index} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
