const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  "skills: skills || [],",
  "skills: (skills && skills.length > 0) ? skills : staticSkills,"
);

fs.writeFileSync('server.ts', content);
