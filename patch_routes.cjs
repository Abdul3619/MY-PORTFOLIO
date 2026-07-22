const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Import AdminSkills
content = content.replace(
  "import AdminSiteSettings from \"./pages/admin/AdminSiteSettings\";",
  "import AdminSiteSettings from \"./pages/admin/AdminSiteSettings\";\nimport AdminSkills from \"./pages/admin/AdminSkills\";"
);

// Add Route
content = content.replace(
  "<Route path=\"/admin/projects\" element={<AdminProjects />} />",
  "<Route path=\"/admin/projects\" element={<AdminProjects />} />\n            <Route path=\"/admin/skills\" element={<AdminSkills />} />"
);

fs.writeFileSync('src/App.tsx', content);
