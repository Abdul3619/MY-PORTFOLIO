const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  "const { data } = await supabaseAdmin.from('skills').select('*');",
  "await supabaseAdmin.from('skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');\n      const { data } = await supabaseAdmin.from('skills').select('*');"
);

fs.writeFileSync('server.ts', content);
