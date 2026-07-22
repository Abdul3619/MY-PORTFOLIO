require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const skillsToInsert = [
  // Frontend
  { name: 'HTML5', category: 'Frontend Development', icon: 'Monitor', proficiency: 100, order_index: 0 },
  { name: 'CSS3', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 1 },
  { name: 'JavaScript (ES6+)', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 2 },
  { name: 'TypeScript', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 3 },
  { name: 'React', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 4 },
  { name: 'Next.js', category: 'Frontend Development', icon: 'Monitor', proficiency: 85, order_index: 5 },
  { name: 'Tailwind CSS', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 6 },
  { name: 'Framer Motion', category: 'Frontend Development', icon: 'Monitor', proficiency: 85, order_index: 7 },
  { name: 'Vite', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 8 },
  // Backend
  { name: 'Node.js', category: 'Backend Development', icon: 'Server', proficiency: 90, order_index: 0 },
  { name: 'Express.js', category: 'Backend Development', icon: 'Server', proficiency: 95, order_index: 1 },
  { name: 'REST APIs', category: 'Backend Development', icon: 'Server', proficiency: 95, order_index: 2 },
  { name: 'GraphQL', category: 'Backend Development', icon: 'Server', proficiency: 75, order_index: 3 },
  // Database
  { name: 'PostgreSQL', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 0 },
  { name: 'Supabase', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 1 },
  { name: 'Prisma', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 2 },
  { name: 'Drizzle', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 3 },
  { name: 'MongoDB', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 4 },
  { name: 'Firebase', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 5 },
  // Tools
  { name: 'Git', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 95, order_index: 0 },
  { name: 'GitHub Actions', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 85, order_index: 1 },
  { name: 'Docker', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 80, order_index: 2 },
  { name: 'Cloud Run', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 85, order_index: 3 },
  { name: 'Vercel', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 90, order_index: 4 }
];

async function run() {
  const { data: existing } = await supabase.from('skills').select('*');
  if (existing && existing.length === 0) {
    await supabase.from('skills').insert(skillsToInsert);
    console.log("Seeded skills!");
  } else {
    // Delete existing and re-seed to ensure all are there
    await supabase.from('skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('skills').insert(skillsToInsert);
    console.log("Re-seeded skills!");
  }
}
run();
