// Ghost content for auto-skeleton loading states (see `.auto-skeleton` in index.css). These objects are never
// shown as real content: the pages render their real layout with them, and the skeleton CSS turns every text
// block, chip, button and image into a shimmering block of its true size. They only have to be the right shape.

const words = (n: number) => Array.from({ length: n }, () => "lorem").join(" ");

export const GHOST_PROJECTS: any[] = Array.from({ length: 6 }, (_, i) => ({
  id: `ghost-${i}`,
  slug: `ghost-${i}`,
  status: "Published",
  title: "Project title here",
  description: `${words(26)}`,
  thumbnail_url: "",
  tech_stack: ["React", "TypeScript", "Tailwind"],
  live_url: "#",
  has_dashboard: false,
}));

export const GHOST_CERTS: any[] = Array.from({ length: 3 }, (_, i) => ({
  id: `ghost-cert-${i}`,
  title: "Certificate title goes here",
  issuer: "Issuing organisation",
  date_issued: "Jan 2026",
  image_url: "",
}));

export const GHOST_TESTIMONIALS: any[] = [
  {
    id: "ghost-testimonial",
    name: "Client name",
    role: "Role",
    company: "Company",
    content: `${words(30)}`,
  },
];

export const GHOST_SKILL_CATEGORIES = Array.from({ length: 6 }, (_, i) => ({
  title: `Category ${i + 1}`,
  icon: null as any,
  skills: ["Skill one", "Skill two", "Skill", "Skill name", "Skill two", "Skill"],
}));

export const GHOST_PROJECT_DETAIL: any = {
  id: "ghost-detail",
  slug: "ghost-detail",
  status: "Published",
  title: "Project title goes here",
  description: words(28),
  long_description: `${words(70)}\n\n${words(60)}`,
  tech_stack: ["React", "TypeScript", "Tailwind", "Supabase", "Vite"],
  client_name: "Client",
  completion_date: "2026",
  gallery_images: [],
  hero_image_url: "",
};

export const GHOST_REVIEWS: any[] = Array.from({ length: 3 }, (_, i) => ({
  id: `ghost-review-${i}`,
  client_name: "Client name",
  job_title: "Role",
  company: "Company",
  rating: 5,
  project_name: "Project",
  title: "Review title here",
  message: words(28),
  created_at: "2026-01-01T00:00:00Z",
}));
