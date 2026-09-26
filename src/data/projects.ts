export interface Project {
  id: string;
  title: string;
  category?: 'Web Development' | 'Solar Energy';
  description: string;
  longDescription: string;
  image: string;
  techStack: string[];
  liveUrl?: string;
  githubUrl?: string;
  features: string[];
  startDate?: string;
  completionDate?: string;
}

export const projectsData: Project[] = [
  {
    id: "luxury-hotel",
    title: "Luxury Hotel Website",
    category: "Web Development",
    startDate: "Jan 2024",
    completionDate: "Apr 2024",
    description: "A premium, high-performance website for a luxury hotel chain.",
    longDescription: "Designed to reflect the opulence of a five-star stay, this luxury hotel website features immersive full-screen imagery, smooth scroll animations, and a seamless booking interface. Built with performance in mind to ensure high conversion rates.",
    image: "https://images.unsplash.com/photo-1542314831-c6a4d7429362?q=80&w=1200&auto=format&fit=crop",
    techStack: ["React", "TypeScript", "Tailwind CSS", "Framer Motion"],
    features: [
      "Smooth GSAP-powered scrolling",
      "Interactive room exploration",
      "Dynamic booking widget",
      "Optimized high-res image loading"
    ]
  },
  {
    id: "hotel-booking",
    title: "Hotel Booking Platform",
    category: "Web Development",
    startDate: "Aug 2023",
    completionDate: "Dec 2023",
    description: "A robust platform for finding and booking accommodations worldwide.",
    longDescription: "A comprehensive booking platform that handles complex search queries, availability checking, and secure payment processing. The UI focuses on clarity and trust, crucial for a booking application.",
    image: "https://images.unsplash.com/photo-1551882547-ff40eb0d1e73?q=80&w=1200&auto=format&fit=crop",
    techStack: ["Next.js", "React", "Node.js", "Stripe API"],
    features: [
      "Real-time availability search",
      "Secure payment integration",
      "User dashboard for managing bookings",
      "Admin panel for property management"
    ]
  },
  {
    id: "residential-solar-storage",
    title: "Residential Solar & Battery Storage Array",
    category: "Solar Energy",
    startDate: "Mar 2024",
    completionDate: "May 2024",
    description: "Turnkey 8.5 kW rooftop photovoltaic installation paired with a 10 kWh lithium-ion battery backup system for grid resilience.",
    longDescription: "Designed and engineered to provide clean, reliable energy for a modern residential estate. The installation integrates high-efficiency monocrystalline solar modules, a smart hybrid inverter with dual MPPT trackers, and a 10 kWh lithium iron phosphate battery bank with automated sub-second grid-failover capabilities.",
    image: "https://images.unsplash.com/photo-1509391365360-2e959784a276?q=80&w=1200&auto=format&fit=crop",
    techStack: ["Solar PV Array", "Hybrid Inverter", "LiFePO4 Storage", "Load Balancing", "Grid Failover"],
    features: [
      "8.5 kW monocrystalline rooftop solar array",
      "10 kWh high-efficiency LiFePO4 battery storage bank",
      "Smart hybrid inverter with automated sub-second transfer switch",
      "Mobile energy yield telemetry and battery health monitoring"
    ]
  },
  {
    id: "salon-website",
    title: "Premium Salon Website",
    category: "Web Development",
    startDate: "May 2023",
    completionDate: "Jul 2023",
    description: "An elegant digital storefront for a high-end hair and beauty salon.",
    longDescription: "Capturing the aesthetic of a premium beauty brand, this website offers service menus, stylist profiles, and an integrated appointment scheduling system. The design uses soft gradients and elegant typography.",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop",
    techStack: ["React", "Tailwind CSS", "React Router"],
    features: [
      "Service and pricing menu",
      "Interactive stylist portfolio",
      "Online appointment request form",
      "Instagram feed integration"
    ]
  },
  {
    id: "commercial-solar-microgrid",
    title: "Commercial Solar PV Sizing & Microgrid",
    category: "Solar Energy",
    startDate: "Sep 2023",
    completionDate: "Jan 2024",
    description: "Industrial three-phase solar microgrid system designed for peak-demand shaving and mission-critical backup power.",
    longDescription: "Engineered for an industrial commercial facility, this solar microgrid incorporates multi-string PV arrays, three-phase grid-tied inverters, and modular battery storage cabinets. The system reduces grid utility reliance by 82% while delivering seamless backup for sensitive manufacturing and server equipment.",
    image: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?q=80&w=1200&auto=format&fit=crop",
    techStack: ["Microgrid Design", "Three-Phase Inverters", "Industrial Battery Racks", "PV Syst Modeling"],
    features: [
      "35 kW multi-string industrial solar PV system",
      "Three-phase hybrid inverter with automated synchronization",
      "Modular scalable lithium battery cabinet architecture",
      "Surge suppression, DC disconnects, and utility-grade metering"
    ]
  },
  {
    id: "car-rental",
    title: "Car Rental Platform",
    category: "Web Development",
    startDate: "Jan 2023",
    completionDate: "Apr 2023",
    description: "A sleek interface for browsing and renting premium vehicles.",
    longDescription: "This platform allows users to browse a fleet of luxury cars, check availability, and process rentals. The UI uses dark mode to emphasize the sleekness of the vehicles.",
    image: "https://images.unsplash.com/photo-1562141989-c5c79ac8f576?q=80&w=1200&auto=format&fit=crop",
    techStack: ["React", "TypeScript", "Tailwind CSS"],
    features: [
      "Advanced vehicle filtering",
      "Date-based availability calculation",
      "Detailed vehicle specification pages",
      "Responsive mobile booking flow"
    ]
  },
  {
    id: "crouchend-electrical",
    title: "CrouchEnd Electrical Installation",
    category: "Solar Energy",
    startDate: "Oct 2023",
    completionDate: "Dec 2023",
    description: "Certified commercial and residential electrical infrastructure, distribution board upgrades, and solar-ready cabling.",
    longDescription: "A full-scale electrical engineering and compliance overhaul for residential and light-commercial premises. Included upgraded consumer units with RCBOs, surge protection devices (SPDs), dedicated circuit separation for high-draw appliances, and pre-wiring for solar inverter and EV charger integration.",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200&auto=format&fit=crop",
    techStack: ["Distribution Panels", "RCBO Protection", "Solar Pre-wiring", "Surge Suppression"],
    features: [
      "Consumer unit overhaul with dual RCD/RCBO protection",
      "Solar inverter and EV charging pre-wiring conduits",
      "Full electrical safety testing and certification",
      "Sub-panel load balancing for balanced three-phase operation"
    ]
  },
  {
    id: "mechanic",
    title: "Mechanic Services",
    category: "Web Development",
    startDate: "Nov 2022",
    completionDate: "Jan 2023",
    description: "A trustworthy, straightforward website for an automotive repair shop.",
    longDescription: "Designed for a local mechanic shop, this site focuses on clear communication of services, building trust through reviews, and making it easy to schedule a diagnostic appointment.",
    image: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1200&auto=format&fit=crop",
    techStack: ["HTML", "CSS", "JavaScript", "Tailwind CSS"],
    features: [
      "Service breakdown",
      "Customer testimonials section",
      "Emergency contact CTA",
      "Location and hours display"
    ]
  },
  {
    id: "fashion-designer",
    title: "Fashion Designer Portfolio",
    category: "Web Development",
    startDate: "Jun 2022",
    completionDate: "Sep 2022",
    description: "An avant-garde digital portfolio for a modern fashion designer.",
    longDescription: "A highly visual, minimalist portfolio designed to put the clothing collections front and center. Features unique layout structures and subtle reveal animations to mimic the reveal of a runway show.",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop",
    techStack: ["React", "Framer Motion", "Tailwind CSS"],
    features: [
      "Masonry grid collection display",
      "Full-screen lookbook viewer",
      "Custom cursor interactions",
      "Editorial typography pairing"
    ]
  }
];
