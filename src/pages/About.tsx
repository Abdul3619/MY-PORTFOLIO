import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { Sun, Code, Target, Rocket, Lightbulb } from "lucide-react";
import * as Icons from "lucide-react";
import { useAbout, useProfile } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";

const timelineEvents = [
  {
    id: "start",
    title: "How I Started",
    icon: Lightbulb,
    content: "I'm Abdul Wahab, a self-taught web developer who loves creating software that solves real-world problems. My path wasn't traditional—I started with hands-on hardware and physical systems, always driven by an intense curiosity to understand how things work beneath the surface and how they can be optimized to serve people better.",
    date: "Introduction",
  },
  {
    id: "solar",
    title: "Solar Engineering",
    icon: Sun,
    content: "Before writing a single line of code, I spent my days working with solar installations at Teenergy Solar Solutions. Dealing with battery storage setups, power inverters, and complex electrical troubleshooting on-site taught me how to think systematically. In solar power, there is no room for error; you learn real-world problem-solving, meticulous attention to detail, and absolute reliability under pressure.",
    date: "Background",
  },
  {
    id: "web",
    title: "Discovering Software",
    icon: Code,
    content: "My curiosity eventually led me from physical circuits to digital ones. I became fascinated by how logic structures could create fully interactive systems. I spent countless hours parsing documentation, building raw prototypes, and experimenting late into the night. Step by step, I taught myself modern technologies like HTML, CSS, JavaScript, and TypeScript, eventually moving into building powerful interfaces with React, Next.js, and Tailwind CSS.",
    date: "The Pivot",
  },
  {
    id: "goals",
    title: "Today",
    icon: Target,
    content: "Today, I focus on building complete web solutions that bridge high-end visual design with practical functionality. Whether creating robust business websites, secure hotel booking systems, admin portals, or responsive layouts, my goal is always to deliver blazing-fast performance and seamless user interfaces that feel reliable, smooth, and highly polished.",
    date: "Current Focus",
  },
  {
    id: "vision",
    title: "Looking Ahead",
    icon: Rocket,
    content: "Learning is a daily habit for me. The web evolves constantly, and I evolve with it. My ultimate goal is to become a world-class Full Stack Engineer, capable of owning the entire lifecycle of complex digital products—taking them from initial concept all the way to secure, production-ready cloud deployment.",
    date: "Future Vision",
  }
];

function TimelineItem({ event, index }: { event: any; index: number }) {
  const { t } = useTranslation();
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
          {(() => {
            const IconComponent = typeof event.icon === 'string' ? ((Icons as any)[event.icon] || Icons.Circle) : (event.icon || Icons.Circle);
            return <IconComponent size={24} />;
          })()}
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
              {t(`about.timeline_date_${event.id}`, event.date) as string}
            </span>
            <h3 className="text-2xl font-display font-semibold mb-4 text-white">
              {t(`about.timeline_title_${event.id}`, event.title) as string}
            </h3>
            <p className="text-gray-400 leading-relaxed">
              {t(`about.timeline_content_${event.id}`, event.content) as string}
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

export default function About() {
  const { data: profile } = useProfile();
  const eventsToRender = (profile?.journey_events && profile.journey_events.length > 0) ? profile.journey_events : timelineEvents;
  const { t } = useTranslation();
  const { data: aboutData } = useAbout();
  const displayEvents = aboutData && aboutData.length > 0 ? [...aboutData].sort((a: any, b: any) => a.order_index - b.order_index) : timelineEvents;
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
            {t("about.title_part1", "MY")} <span className="text-gradient">{t("about.title_part2", "JOURNEY")}</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("about.subtitle", "From solar engineering to full-stack software development—a story of self-taught learning and practical problem solving.")}
          </p>
        </motion.div>

        <div className="relative pb-24">
          {displayEvents.map((event, index) => (
            <TimelineItem key={event.id} event={event} index={index} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
