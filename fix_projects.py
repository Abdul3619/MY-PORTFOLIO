import re

with open('server.ts', 'r') as f:
    content = f.read()

# Replace the first /api/projects route
new_route1 = """// Projects Routes
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
});"""
content = re.sub(r"// Projects Routes\napp\.get\('/api/projects', async \(req, res\) => \{.*?\}\);\n", new_route1 + "\n", content, flags=re.DOTALL)

# Replace the second /api/projects/:slug route
new_route2 = """app.get('/api/projects/:slug', async (req, res) => {
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
});"""
content = re.sub(r"app\.get\('/api/projects/:slug', async \(req, res\) => \{.*?\}\);", new_route2, content, flags=re.DOTALL)

with open('server.ts', 'w') as f:
    f.write(content)
