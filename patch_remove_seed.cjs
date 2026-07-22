const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /app\.get\('\/api\/seed-skills'[\s\S]*?app\.get\('\/api\/skills'/m,
  "app.get('/api/skills'"
);

fs.writeFileSync('server.ts', content);
