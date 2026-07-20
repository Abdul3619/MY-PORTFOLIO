with open('server.ts', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if line.strip() == "// Projects Routes":
        start_idx = i
    if line.startswith("app.post('/api/projects',"):
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_code = """// Projects Routes
app.get('/api/projects', async (req, res) => {
  try {
    let projects;
    if (isDraftRequest(req)) {
      const { data, error } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      projects = (data || []).map(deserializeProject).filter(Boolean);
    } else {
      const { data, error } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      projects = (data || []).map(deserializeProject).filter(Boolean);
      projects = projects.filter((p: any) => p.status === 'Published');
    }
    const translated = await handleTranslation(projects, req, 'Project');
    res.json(translated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:slug', async (req, res) => {
  try {
    if (isDraftRequest(req)) {
      const { data, error } = await supabaseAdmin.from('projects').select('*').eq('slug', req.params.slug).single();
      if (error) return res.status(404).json({ error: 'Project not found' });
      const project = deserializeProject(data);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const translated = await handleTranslation(project, req, 'Project');
      res.json(translated);
    } else {
      const { data, error } = await supabaseAdmin.from('projects').select('*').eq('slug', req.params.slug).single();
      if (error) return res.status(404).json({ error: 'Project not found' });
      const project = deserializeProject(data);
      if (!project || project.status !== 'Published') return res.status(404).json({ error: 'Project not found' });
      const translated = await handleTranslation(project, req, 'Project');
      res.json(translated);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});\n\n"""
    
    lines = lines[:start_idx] + [new_code] + lines[end_idx:]
    with open('server.ts', 'w') as f:
        f.writelines(lines)
    print("Fixed!")
else:
    print("Could not find bounds")
