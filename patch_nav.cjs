const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');

// Add Route
content = content.replace(
  "{ name: 'Projects Manager', path: '/admin/projects', icon: <FolderKanban size={18} /> },",
  "{ name: 'Projects Manager', path: '/admin/projects', icon: <FolderKanban size={18} /> },\n        { name: 'Skills Manager', path: '/admin/skills', icon: <FolderKanban size={18} /> },"
);

fs.writeFileSync('src/components/admin/AdminLayout.tsx', content);
