export interface Project {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  image: string;
  techStack: string[];
  liveUrl?: string;
  githubUrl?: string;
  features: string[];
}

export const projectsData: Project[] = [
  {
    id: "luxury-hotel",
    title: "Luxury Hotel Website",
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
    id: "salon-website",
    title: "Premium Salon Website",
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
    id: "car-rental",
    title: "Car Rental Platform",
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
    id: "mechanic",
    title: "Mechanic Services",
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
