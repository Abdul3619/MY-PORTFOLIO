const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const staticSkillsBlock = `
const staticSkills = [
  // Frontend
  { id: '1', name: 'HTML5', category: 'Frontend Development', icon: 'Monitor', proficiency: 100, order_index: 0 },
  { id: '2', name: 'CSS3', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 1 },
  { id: '3', name: 'JavaScript (ES6+)', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 2 },
  { id: '4', name: 'TypeScript', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 3 },
  { id: '5', name: 'React', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 4 },
  { id: '6', name: 'Next.js', category: 'Frontend Development', icon: 'Monitor', proficiency: 85, order_index: 5 },
  { id: '7', name: 'Tailwind CSS', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 6 },
  { id: '8', name: 'Framer Motion', category: 'Frontend Development', icon: 'Monitor', proficiency: 85, order_index: 7 },
  { id: '9', name: 'Vite', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 8 },
  // Backend
  { id: '10', name: 'Node.js', category: 'Backend Development', icon: 'Server', proficiency: 90, order_index: 0 },
  { id: '11', name: 'Express.js', category: 'Backend Development', icon: 'Server', proficiency: 95, order_index: 1 },
  { id: '12', name: 'REST APIs', category: 'Backend Development', icon: 'Server', proficiency: 95, order_index: 2 },
  { id: '13', name: 'GraphQL', category: 'Backend Development', icon: 'Server', proficiency: 75, order_index: 3 },
  // Database
  { id: '14', name: 'PostgreSQL', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 0 },
  { id: '15', name: 'Supabase', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 1 },
  { id: '16', name: 'Prisma', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 2 },
  { id: '17', name: 'Drizzle', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 3 },
  { id: '18', name: 'MongoDB', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 4 },
  { id: '19', name: 'Firebase', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 5 },
  // Tools
  { id: '20', name: 'Git', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 95, order_index: 0 },
  { id: '21', name: 'GitHub Actions', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 85, order_index: 1 },
  { id: '22', name: 'Docker', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 80, order_index: 2 },
  { id: '23', name: 'Cloud Run', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 85, order_index: 3 },
  { id: '24', name: 'Vercel', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 90, order_index: 4 }
];

app.get('/api/skills', async (req, res) => {
`;

content = content.replace(
  "app.get('/api/skills', async (req, res) => {",
  staticSkillsBlock
);

// Fallback to staticSkills if skills.length === 0
content = content.replace(
  "const translated = await handleTranslation(skills, req, 'Skill');",
  "const finalSkills = skills.length > 0 ? skills : staticSkills;\n    const translated = await handleTranslation(finalSkills, req, 'Skill');"
);

fs.writeFileSync('server.ts', content);
