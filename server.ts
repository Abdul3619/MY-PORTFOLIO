import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Supabase Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Zod Schemas for Validation
const profileSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  bio: z.string().min(1),
  profile_image_url: z.string().url().optional().nullable(),
  resume_url: z.string().url().optional().nullable(),
});

const projectSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  thumbnail_url: z.string().url().optional().nullable(),
  hero_image_url: z.string().url().optional().nullable(),
  live_url: z.string().url().optional().nullable(),
  github_url: z.string().url().optional().nullable(),
  is_featured: z.boolean().default(false),
  order_index: z.number().default(0),
});

const certificateSchema = z.object({
  title: z.string().min(1),
  issuer: z.string().min(1),
  date_issued: z.string().optional().nullable(),
  certificate_url: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
});

const testimonialSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  company: z.string().optional().nullable(),
  content: z.string().min(1),
  image_url: z.string().url().optional().nullable(),
  is_approved: z.boolean().default(false),
});

const contactMessageSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().optional().nullable(),
  message: z.string().min(1),
});

// Middleware to verify auth (simple check for Bearer token for now)
// In a real app, you'd verify the JWT from Supabase Auth
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  (req as any).user = user;
  next();
};

// --- API ROUTES ---

// Profiles
app.get('/api/profile', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const validatedData = profileSchema.parse(req.body);
    const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').limit(1).single();
    
    let result;
    if (existingProfile) {
      result = await supabaseAdmin.from('profiles').update(validatedData).eq('id', existingProfile.id).select();
    } else {
      result = await supabaseAdmin.from('profiles').insert([validatedData]).select();
    }
    
    if (result.error) throw new Error(result.error.message);
    res.json(result.data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Projects
app.get('/api/projects', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/projects/:slug', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('projects').select('*').eq('slug', req.params.slug).single();
  if (error) return res.status(404).json({ error: 'Project not found' });
  res.json(data);
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const validatedData = projectSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('projects').insert([validatedData]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = projectSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('projects').update(validatedData).eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.from('projects').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Project deleted successfully' });
});

// Certificates
app.get('/api/certificates', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('certificates').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/certificates', requireAuth, async (req, res) => {
  try {
    const validatedData = certificateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('certificates').insert([validatedData]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/certificates/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = certificateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('certificates').update(validatedData).eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/certificates/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.from('certificates').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Certificate deleted successfully' });
});

// Testimonials
app.get('/api/testimonials', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('testimonials').select('*').eq('is_approved', true).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/testimonials', async (req, res) => {
  // Public route
  try {
    const validatedData = testimonialSchema.parse(req.body);
    // Force is_approved to false for public submissions
    validatedData.is_approved = false; 
    const { data, error } = await supabaseAdmin.from('testimonials').insert([validatedData]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/testimonials', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('testimonials').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/testimonials/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = testimonialSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('testimonials').update(validatedData).eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/testimonials/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.from('testimonials').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Testimonial deleted successfully' });
});

// Contact Messages
app.post('/api/contact', async (req, res) => {
  try {
    const validatedData = contactMessageSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('contact_messages').insert([validatedData]).select();
    if (error) throw new Error(error.message);
    res.status(201).json({ message: 'Message sent successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/messages', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('contact_messages').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Analytics
app.post('/api/analytics/event', async (req, res) => {
  try {
    const { session_id, event_type, page_url, metadata } = req.body;
    
    if (!session_id || !event_type) {
      return res.status(400).json({ error: 'Missing session_id or event_type' });
    }

    // 1. Ensure visitor exists
    const { data: visitor } = await supabaseAdmin.from('visitors')
      .upsert({ session_id, last_visit_at: new Date().toISOString() }, { onConflict: 'session_id' })
      .select('id').single();

    // 2. Track event
    if (visitor) {
      await supabaseAdmin.from('analytics_events').insert([{
        visitor_id: visitor.id,
        event_type,
        page_url,
        metadata
      }]);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    console.error("Analytics Error:", err);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

app.get('/api/admin/analytics', requireAuth, async (req, res) => {
  // Simple summary for dashboard
  const { count: visitorsCount } = await supabaseAdmin.from('visitors').select('*', { count: 'exact', head: true });
  const { count: eventsCount } = await supabaseAdmin.from('analytics_events').select('*', { count: 'exact', head: true });
  
  res.json({
    total_visitors: visitorsCount || 0,
    total_events: eventsCount || 0
  });
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
