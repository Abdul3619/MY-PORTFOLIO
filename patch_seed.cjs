const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  "app.get('/api/skills', async (req, res) => {",
  `app.get('/api/seed-skills', async (req, res) => {
    try {
      const { data } = await supabaseAdmin.from('skills').select('*');
      if (!data || data.length === 0) {
        const toInsert = staticSkills.map(s => {
          const { id, ...rest } = s;
          return rest;
        });
        await supabaseAdmin.from('skills').insert(toInsert);
        res.json({ message: 'Seeded skills!' });
      } else {
        res.json({ message: 'Already seeded.' });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });\n\napp.get('/api/skills', async (req, res) => {`
);

fs.writeFileSync('server.ts', content);
