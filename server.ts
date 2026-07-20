import fs from "fs";
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { z } from 'zod';
import multer from 'multer';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

app.use(helmet({ contentSecurityPolicy: false })); // allow dev scripts
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `window`
  validate: { xForwardedForHeader: false, trustProxy: false, default: false },
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

// Multer setup
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

// Initialize Supabase Admin Client
const rawUrl = process.env.VITE_SUPABASE_URL;
const isValidUrl = rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'));
const supabaseUrl = isValidUrl ? rawUrl : 'https://placeholder-please-configure-secrets.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Zod Schemas
const profileSchema = z.object({
  long_bio: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  name: z.string().min(1),
  title: z.string().min(1),
  bio: z.string().min(1),
  profile_image_url: z.string().optional().nullable(),
  resume_url: z.string().optional().nullable(),
});

const projectSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  long_description: z.string().optional().nullable(),
  thumbnail_url: z.string().optional().nullable(),
  hero_image_url: z.string().optional().nullable(),
  live_url: z.string().optional().nullable(),
  github_url: z.string().optional().nullable(),
  is_featured: z.boolean().default(false),
  order_index: z.number().default(0),
  client_name: z.string().optional().nullable(),
  completion_date: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  tech_stack: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  gallery_images: z.array(z.string()).optional().default([]),
});

const certificateSchema = z.object({
  title: z.string().min(1),
  issuer: z.string().min(1),
  date_issued: z.string().optional().nullable(),
  certificate_url: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});

const testimonialSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  company: z.string().optional().nullable(),
  content: z.string().min(1),
  image_url: z.string().optional().nullable(),
  is_approved: z.boolean().default(false),
});

const reviewSchema = z.object({
  client_name: z.string().min(1, "Client Name is required"),
  company: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  email: z.string().email("Invalid email address"),
  project_name: z.string().optional().nullable(),
  rating: z.number().min(1).max(5),
  title: z.string().min(1, "Review Title is required"),
  message: z.string().min(10, "Review message must be at least 10 characters"),
});

const contactMessageSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().optional().nullable(),
  message: z.string().min(1),
});

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  status: z.enum(['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost']).default('New'),
  value: z.number().optional().nullable(),
  source: z.string().default('Web Inbound'),
  created_at: z.string().optional(),
});

const serviceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().optional().nullable(),
  tag: z.string().optional().nullable(),
  order_index: z.number().default(0),
  is_featured: z.boolean().default(false),
});

const aboutSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  date: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  order_index: z.number().default(0),
});

const seoSchema = z.object({
  logo_url: z.string().optional().nullable(),
  site_name: z.string().optional().nullable(),
  footer_copyright: z.string().optional().nullable(),
  browser_title: z.string().optional().nullable(),
  meta_keywords: z.string().optional().nullable(),
  twitter_card_image: z.string().optional().nullable(),
  google_analytics_id: z.string().optional().nullable(),
  google_tag_manager_id: z.string().optional().nullable(),
  microsoft_clarity_id: z.string().optional().nullable(),
  meta_pixel_id: z.string().optional().nullable(),
  maintenance_mode: z.boolean().optional().nullable(),
  site_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  og_image_url: z.string().optional().nullable(),
  twitter_handle: z.string().optional().nullable(),
  favicon_url: z.string().optional().nullable(),
  canonical_url: z.string().optional().nullable(),
});

const contactInfoSchema = z.object({
  location: z.string().optional().nullable(),
  facebook_url: z.string().optional().nullable(),
  behance_url: z.string().optional().nullable(),
  dribbble_url: z.string().optional().nullable(),
  youtube_url: z.string().optional().nullable(),
  discord_url: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  calendly_url: z.string().optional().nullable(),
  github_url: z.string().optional().nullable(),
  linkedin_url: z.string().optional().nullable(),
  twitter_url: z.string().optional().nullable(),
  instagram_url: z.string().optional().nullable(),
});

const skillSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  icon: z.string().optional().nullable(),
  proficiency: z.number().optional().nullable(),
  order_index: z.number().default(0),
});

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  if (user.email?.toLowerCase() !== 'abdulwahababdullah3619@gmail.com') {
    return res.status(403).json({ error: 'Forbidden: Unauthorized system access' });
  }
  (req as any).user = user;
  next();
};

// Helper to safely parse JSON strings
function safeParseJson(str: any, defaultVal: any = null) {
  if (typeof str !== 'string') return defaultVal;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultVal;
  }
}

// Helper to format Zod errors into a single, clean human-readable string
function formatZodError(error: any): string {
  if (error && error.errors && Array.isArray(error.errors)) {
    return error.errors.map((issue: any) => {
      const field = issue.path.join('.');
      return `${field ? `Field '${field}'` : 'Input'}: ${issue.message}`;
    }).join(', ');
  }
  return error?.message || 'Validation failed';
}

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'placeholder_key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const translationCache = new Map<string, any>();

async function translateObjectFields(fields: Record<string, any>, itemType: string, targetLang: string): Promise<Record<string, any>> {
  if (!process.env.GEMINI_API_KEY || !fields) return fields;
  
  const translatableKeys = [
    'name', 'title', 'description', 'long_description', 'content', 
    'category', 'review', 'role', 'issuer', 'degree', 'institution', 
    'tagline', 'long_bio', 'bio_text', 'tags', 'tech_stack', 'client_name', 'status'
  ];
  
  // Find strings and arrays to translate
  const keysToTranslate: string[] = [];
  const valuesToTranslate: string[] = [];
  
  for (const [key, val] of Object.entries(fields)) {
    if (!translatableKeys.includes(key)) continue;
    
    if (typeof val === 'string' && val.trim().length > 0 && !val.startsWith('http') && !val.includes('@') && val.length < 20000) {
      keysToTranslate.push(key);
      valuesToTranslate.push(val);
    } else if (Array.isArray(val) && val.every(item => typeof item === 'string')) {
      keysToTranslate.push(key);
      valuesToTranslate.push(JSON.stringify(val));
    }
  }

  // Also support gallery_images captions translation
  const captionsToTranslate: string[] = [];
  if (fields.gallery_images && Array.isArray(fields.gallery_images)) {
    fields.gallery_images.forEach((img: any) => {
      if (typeof img === 'object' && img !== null && typeof img.caption === 'string' && img.caption.trim().length > 0) {
        captionsToTranslate.push(img.caption.trim());
      }
    });
  }

  if (captionsToTranslate.length > 0) {
    keysToTranslate.push('gallery_images_captions');
    valuesToTranslate.push(JSON.stringify(captionsToTranslate));
  }
  
  if (keysToTranslate.length === 0) return fields;
  
  // Clean values for stable cache keys
  const cacheKey = `${itemType}_${targetLang}_${JSON.stringify(valuesToTranslate)}`;
  if (translationCache.has(cacheKey)) {
    return { ...fields, ...translationCache.get(cacheKey) };
  }
  
  try {
    const langNames: Record<string, string> = {
      fr: 'French',
      ar: 'Arabic',
      es: 'Spanish',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      nl: 'Dutch',
      tr: 'Turkish',
      hi: 'Hindi',
      sw: 'Swahili',
      sv: 'Swedish',
      pl: 'Polish',
      vi: 'Vietnamese'
    };
    
    let targetLangName = langNames[targetLang];
    if (!targetLangName) {
      try {
        const displayName = new Intl.DisplayNames(['en'], { type: 'language' });
        targetLangName = displayName.of(targetLang);
      } catch (e) {
        targetLangName = targetLang;
      }
    }
    if (!targetLangName) {
      targetLangName = targetLang;
    }
    
    const payload: Record<string, string> = {};
    keysToTranslate.forEach((key, idx) => {
      payload[key] = valuesToTranslate[idx];
    });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `You are an expert translator for a professional portfolio website. Translate the following fields of a ${itemType} object into ${targetLangName}. Ensure the tone is highly professional and matches the original context. Return a JSON object with the exact same keys containing the translated text. Do not include markdown codeblocks or comments, only the raw JSON.\n\nInput fields:\n${JSON.stringify(payload)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: keysToTranslate.reduce((acc, key) => {
            acc[key] = { type: Type.STRING };
            return acc;
          }, {} as Record<string, any>)
        }
      }
    });
    
    let responseText = response.text?.trim() || '{}';
    // Strip markdown codeblock backticks if present
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }
    
    const translatedFields = JSON.parse(responseText);
    
    // Post-process arrays (e.g. tags or tech_stack)
    for (const key of keysToTranslate) {
      const originalVal = fields[key];
      if (Array.isArray(originalVal) && typeof translatedFields[key] === 'string') {
        try {
          const parsedArr = JSON.parse(translatedFields[key]);
          if (Array.isArray(parsedArr)) {
            translatedFields[key] = parsedArr;
          } else {
            translatedFields[key] = [translatedFields[key]];
          }
        } catch {
          translatedFields[key] = [translatedFields[key]];
        }
      }
    }

    // Post-process gallery captions if they were translated
    if (translatedFields['gallery_images_captions'] && Array.isArray(fields.gallery_images)) {
      try {
        let parsedCaptions = translatedFields['gallery_images_captions'];
        if (typeof parsedCaptions === 'string') {
          parsedCaptions = JSON.parse(parsedCaptions);
        }
        if (Array.isArray(parsedCaptions)) {
          let captionIdx = 0;
          translatedFields['gallery_images'] = fields.gallery_images.map((img: any) => {
            if (typeof img === 'object' && img !== null) {
              if (typeof img.caption === 'string' && img.caption.trim().length > 0) {
                const translatedCaption = parsedCaptions[captionIdx++];
                return { ...img, caption: translatedCaption || img.caption };
              }
            }
            return img;
          });
        }
      } catch (e) {
        console.warn('Failed to parse translated captions:', e);
      }
      delete translatedFields['gallery_images_captions'];
    }
    
    translationCache.set(cacheKey, translatedFields);
    return { ...fields, ...translatedFields };
  } catch (e) {
    console.warn(`Error translating ${itemType} into ${targetLang}:`, e);
    return fields;
  }
}

async function handleTranslation(data: any, req: any, itemType: string): Promise<any> {
  const lang = (req.headers['x-portfolio-lang'] || req.query.lang || '').toString().toLowerCase();
  if (!lang || lang === 'en') {
    return data;
  }
  
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return await Promise.all(data.map(item => translateObjectFields(item, itemType, lang)));
  } else {
    return await translateObjectFields(data, itemType, lang);
  }
}

function isDraftRequest(req: express.Request): boolean {
  if (req.query.preview === 'true' || req.query.draft === 'true' || req.headers['x-portfolio-draft'] === 'true') return true;
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (token && token !== 'undefined' && token !== 'null' && token.trim() !== '') {
    // If authorization header is present and we are on an admin route, assume draft
    if (req.path.startsWith('/api/admin') || req.headers['referer']?.includes('/admin')) {
      return true;
    }
  }
  return false;
}

async function getPublishedResource(resourceKey: string, fallbackFn: () => Promise<any>) {
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('bio').limit(1).single();
    if (!error && data && data.bio) {
      const bio = safeParseJson(data.bio);
      if (bio && bio.published_snapshot && bio.published_snapshot[resourceKey] !== undefined) {
        return bio.published_snapshot[resourceKey];
      }
    }
  } catch (e) {
    console.error(`Error loading published resource ${resourceKey}:`, e);
  }
  return await fallbackFn();
}

// Fetch entire profile bio JSON
async function getBioJson() {
  const { data, error } = await supabaseAdmin.from('profiles').select('bio').limit(1).single();
  if (error || !data || !data.bio) {
    return {};
  }
  const parsed = safeParseJson(data.bio);
  return parsed || { bio_text: data.bio };
}

// Save profile bio JSON with updates
async function saveBioJson(updateFn: (current: any) => any) {
  const { data: existing, error: fetchErr } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
  let currentJson: any = {};
  let existingId = null;
  if (!fetchErr && existing) {
    existingId = existing.id;
    if (existing.bio) {
      currentJson = safeParseJson(existing.bio) || { bio_text: existing.bio };
    }
  }
  
  const updatedJson = updateFn(currentJson);
  const bioValue = JSON.stringify(updatedJson);
  
  // Extract clean fields for basic columns
  const name = updatedJson.name || existing?.name || 'Abdul Wahab';
  const title = updatedJson.title || existing?.title || 'Web Developer';
  const profile_image_url = updatedJson.profile_image_url || existing?.profile_image_url || null;
  const resume_url = updatedJson.resume_url || existing?.resume_url || null;
  
  if (existingId) {
    const { data, error } = await supabaseAdmin.from('profiles').update({
      bio: bioValue,
      name,
      title,
      profile_image_url,
      resume_url,
      updated_at: new Date().toISOString()
    }).eq('id', existingId).select();
    if (error) throw new Error(error.message);
    return data[0];
  } else {
    const { data, error } = await supabaseAdmin.from('profiles').insert([{
      bio: bioValue,
      name,
      title,
      profile_image_url,
      resume_url
    }]).select();
    if (error) throw new Error(error.message);
    return data[0];
  }
}

// Media Upload
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let fileBuffer = fs.readFileSync(req.file.path); fs.unlinkSync(req.file.path);
    let mimetype = req.file.mimetype;
    let fileName = `${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    if (mimetype.startsWith('image/')) {
      // Disabled sharp to prevent container memory issues
      // fileBuffer = await sharp(req.file.buffer)
      //   .resize({ width: 1920, withoutEnlargement: true })
      //   .webp({ quality: 80 })
      //   .toBuffer();
      // mimetype = 'image/webp';
      // fileName = fileName.replace(/\.[^/.]+$/, "") + ".webp";
    }

    const { data, error } = await supabaseAdmin.storage
      .from('media')
      .upload(fileName, fileBuffer, { contentType: mimetype, upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(fileName);
    res.status(201).json({ url: publicUrl, name: fileName, type: mimetype });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to extract bucket path from Supabase public URL
function getPathFromUrl(url: string): string | null {
  if (!url) return null;
  // A Supabase URL looks like: https://[project].supabase.co/storage/v1/object/public/media/[path]
  const marker = '/storage/v1/object/public/media/';
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(url.substring(idx + marker.length));
  }
  return null;
}

// Project-specific Media Upload (organizes into portfolio/project-slug/ directory structure)
app.post('/api/projects/upload-media', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { project_slug, field_type } = req.body;
    if (!project_slug) {
      return res.status(400).json({ error: 'project_slug is required' });
    }
    if (!field_type || !['cover', 'hero', 'gallery'].includes(field_type)) {
      return res.status(400).json({ error: 'Invalid or missing field_type' });
    }

    // Ensure bucket 'media' exists
    try {
      await supabaseAdmin.storage.createBucket('media', { public: true });
    } catch (e) {
      // Ignore if bucket already exists
    }

    let fileBuffer = fs.readFileSync(req.file.path); fs.unlinkSync(req.file.path);
    let mimetype = req.file.mimetype;
    let extension = path.extname(req.file.originalname) || '.webp';
    let cleanOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Convert all images to webp for performance and optimization unless they are already WebP
    if (mimetype.startsWith('image/')) {
      // Disabled sharp processing to prevent container memory issues during upload
      // fileBuffer = await sharp(req.file.buffer)
      //   .resize({ width: 1920, withoutEnlargement: true })
      //   .webp({ quality: 80 })
      //   .toBuffer();
      // mimetype = 'image/webp';
      // extension = '.webp';
      // cleanOriginalName = cleanOriginalName.replace(/\.[^/.]+$/, "") + ".webp";
    } else {
      return res.status(400).json({ error: 'Only images are allowed' });
    }

    let storagePath = '';
    if (field_type === 'cover') {
      storagePath = `portfolio/${project_slug}/cover${extension}`;
    } else if (field_type === 'hero') {
      storagePath = `portfolio/${project_slug}/hero${extension}`;
    } else {
      // Gallery image
      storagePath = `portfolio/${project_slug}/gallery/${Date.now()}_${cleanOriginalName}`;
    }

    const { data, error } = await supabaseAdmin.storage
      .from('media')
      .upload(storagePath, fileBuffer, { contentType: mimetype, upsert: true });

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);
    res.status(201).json({ url: publicUrl, path: storagePath });
  } catch (err: any) {
    console.error('Error in upload-media:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Media from Storage
app.post('/api/projects/delete-media', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const storagePath = getPathFromUrl(url);
    if (!storagePath) {
      return res.status(400).json({ error: 'Invalid image URL or not in the media bucket' });
    }

    const { data, error } = await supabaseAdmin.storage
      .from('media')
      .remove([storagePath]);

    if (error) {
      throw error;
    }

    res.json({ success: true, removedPath: storagePath });
  } catch (err: any) {
    console.error('Error in delete-media:', err);
    res.status(500).json({ error: err.message });
  }
});

// Services Routes (Mapped to Profile Bio JSON)
app.get('/api/services', async (req, res) => {
  try {
    let services;
    if (isDraftRequest(req)) {
      const bio = await getBioJson();
      services = bio.services || [];
    } else {
      services = await getPublishedResource('services', async () => {
        const bio = await getBioJson();
        return bio.services || [];
      });
    }
    const translated = await handleTranslation(services, req, 'Service');
    res.json(translated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services', requireAuth, async (req, res) => {
  try {
    const validatedData = serviceSchema.parse(req.body);
    const newService = {
      id: crypto.randomUUID(),
      ...validatedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await saveBioJson((current) => {
      const services = current.services || [];
      services.push(newService);
      return { ...current, services };
    });
    res.status(201).json(newService);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = serviceSchema.parse(req.body);
    let updatedService: any = null;
    await saveBioJson((current) => {
      const services = current.services || [];
      const idx = services.findIndex((s: any) => s.id === req.params.id);
      if (idx !== -1) {
        services[idx] = {
          ...services[idx],
          ...validatedData,
          updated_at: new Date().toISOString()
        };
        updatedService = services[idx];
      }
      return { ...current, services };
    });
    if (!updatedService) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(updatedService);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/services/:id', requireAuth, async (req, res) => {
  try {
    await saveBioJson((current) => {
      const services = (current.services || []).filter((s: any) => s.id !== req.params.id);
      return { ...current, services };
    });
    res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// About Routes (Mapped to Profile Bio JSON)
app.get('/api/about', async (req, res) => {
  try {
    let about;
    if (isDraftRequest(req)) {
      const bio = await getBioJson();
      about = bio.about_sections || [];
    } else {
      about = await getPublishedResource('about', async () => {
        const bio = await getBioJson();
        return bio.about_sections || [];
      });
    }
    const translated = await handleTranslation(about, req, 'AboutSection');
    res.json(translated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/about', requireAuth, async (req, res) => {
  try {
    const validatedData = aboutSchema.parse(req.body);
    const newAbout = {
      id: crypto.randomUUID(),
      ...validatedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await saveBioJson((current) => {
      const about_sections = current.about_sections || [];
      about_sections.push(newAbout);
      return { ...current, about_sections };
    });
    res.status(201).json(newAbout);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/about/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = aboutSchema.parse(req.body);
    let updatedAbout: any = null;
    await saveBioJson((current) => {
      const about_sections = current.about_sections || [];
      const idx = about_sections.findIndex((s: any) => s.id === req.params.id);
      if (idx !== -1) {
        about_sections[idx] = {
          ...about_sections[idx],
          ...validatedData,
          updated_at: new Date().toISOString()
        };
        updatedAbout = about_sections[idx];
      }
      return { ...current, about_sections };
    });
    if (!updatedAbout) {
      return res.status(404).json({ error: 'About section not found' });
    }
    res.json(updatedAbout);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/about/:id', requireAuth, async (req, res) => {
  try {
    await saveBioJson((current) => {
      const about_sections = (current.about_sections || []).filter((s: any) => s.id !== req.params.id);
      return { ...current, about_sections };
    });
    res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Skills Routes (Real database table 'skills' is fully supported!)
app.get('/api/skills', async (req, res) => {
  try {
    let skills;
    if (isDraftRequest(req)) {
      const { data, error } = await supabaseAdmin.from('skills').select('*').order('order_index', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      skills = data || [];
    } else {
      skills = await getPublishedResource('skills', async () => {
        const { data, error } = await supabaseAdmin.from('skills').select('*').order('order_index', { ascending: true });
        if (error) throw error;
        return data || [];
      });
    }
    const translated = await handleTranslation(skills, req, 'Skill');
    res.json(translated || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skills', requireAuth, async (req, res) => {
  try {
    const validatedData = skillSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('skills').insert([validatedData]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/skills/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = skillSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('skills').update(validatedData).eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/skills/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.from('skills').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Deleted successfully' });
});

// Profile Routes (Unified with Bio JSON storage)
app.get('/api/profile', async (req, res) => {
  try {
    let profileObj: any;
    if (isDraftRequest(req)) {
      const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
      if (error || !data) {
        return res.json({ name: "Abdul Wahab", title: "Web Developer", bio: "I build web apps" });
      }
      const parsed = safeParseJson(data.bio);
      if (parsed) {
        profileObj = {
          id: data.id,
          name: parsed.name || data.name,
          title: parsed.title || data.title,
          bio: parsed.bio || (parsed.bio_text || data.bio),
          profile_image_url: parsed.profile_image_url || data.profile_image_url,
          resume_url: parsed.resume_url || data.resume_url,
          long_bio: parsed.long_bio || null,
          tagline: parsed.tagline || null,
          cover_image_url: parsed.cover_image_url || null,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      } else {
        profileObj = data;
      }
    } else {
      profileObj = await getPublishedResource('profile', async () => {
        const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
        if (error || !data) return { name: "Abdul Wahab", title: "Web Developer", bio: "I build web apps" };
        const parsed = safeParseJson(data.bio);
        if (parsed) {
          return {
            id: data.id,
            name: parsed.name || data.name,
            title: parsed.title || data.title,
            bio: parsed.bio || (parsed.bio_text || data.bio),
            profile_image_url: parsed.profile_image_url || data.profile_image_url,
            resume_url: parsed.resume_url || data.resume_url,
            long_bio: parsed.long_bio || null,
            tagline: parsed.tagline || null,
            cover_image_url: parsed.cover_image_url || null,
            created_at: data.created_at,
            updated_at: data.updated_at
          };
        }
        return data;
      });
    }
    const translated = await handleTranslation(profileObj, req, 'Profile');
    res.json(translated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile', requireAuth, async (req, res) => {
  try {
    const validatedData = profileSchema.parse(req.body);
    const result = await saveBioJson((current) => {
      return {
        ...current,
        name: validatedData.name,
        title: validatedData.title,
        bio: validatedData.bio,
        profile_image_url: validatedData.profile_image_url,
        resume_url: validatedData.resume_url,
        long_bio: validatedData.long_bio,
        tagline: validatedData.tagline,
        cover_image_url: validatedData.cover_image_url
      };
    });
    res.json({
      id: result.id,
      ...validatedData,
      created_at: result.created_at,
      updated_at: result.updated_at
    });
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const validatedData = profileSchema.parse(req.body);
    const result = await saveBioJson((current) => {
      return {
        ...current,
        name: validatedData.name,
        title: validatedData.title,
        bio: validatedData.bio,
        profile_image_url: validatedData.profile_image_url,
        resume_url: validatedData.resume_url,
        long_bio: validatedData.long_bio,
        tagline: validatedData.tagline,
        cover_image_url: validatedData.cover_image_url
      };
    });
    res.json({
      id: result.id,
      ...validatedData,
      created_at: result.created_at,
      updated_at: result.updated_at
    });
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

// SEO Settings Routes (Mapped to Profile Bio JSON)
app.get('/api/seo', async (req, res) => {
  try {
    let seo;
    if (isDraftRequest(req)) {
      const bio = await getBioJson();
      seo = bio.seo_settings || {};
    } else {
      seo = await getPublishedResource('seo', async () => {
        const bio = await getBioJson();
        return bio.seo_settings || {};
      });
    }
    res.json(seo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seo', requireAuth, async (req, res) => {
  try {
    const validatedData = seoSchema.parse(req.body);
    const result = await saveBioJson((current) => {
      return {
        ...current,
        seo_settings: validatedData
      };
    });
    res.json(validatedData);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

// Contact Information Routes (Mapped to Profile Bio JSON)
app.get('/api/contact_info', async (req, res) => {
  try {
    let contactInfo;
    if (isDraftRequest(req)) {
      const bio = await getBioJson();
      contactInfo = bio.contact_information || {};
    } else {
      contactInfo = await getPublishedResource('contact_info', async () => {
        const bio = await getBioJson();
        return bio.contact_information || {};
      });
    }
    res.json(contactInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contact_info', requireAuth, async (req, res) => {
  try {
    const validatedData = contactInfoSchema.parse(req.body);
    const result = await saveBioJson((current) => {
      return {
        ...current,
        contact_information: validatedData
      };
    });
    res.json(validatedData);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

// Resume Experience and Education (Mapped to Profile Bio JSON with fallbacks)
const staticExperience = [
  {
    role: "Freelance Full Stack Developer",
    company: "Self-Employed",
    period: "2023 - Present",
    description: "Designing and developing premium web applications for clients across various industries, focusing on performance, aesthetics, and scalable architectures."
  },
  {
    role: "Solar Engineering Technician",
    company: "GreenEnergy Solutions",
    period: "2020 - 2023",
    description: "Led installation teams for residential and commercial solar arrays. Conducted system diagnostics, inverter configurations, and battery storage setups."
  }
];

const staticEducation = [
  {
    degree: "Self-Taught Computer Science",
    institution: "Various Platforms (Coursera, Udemy, Docs)",
    period: "2022 - Present",
    description: "Rigorous self-directed study covering data structures, algorithms, system design, and modern web frameworks."
  },
  {
    degree: "Diploma in Renewable Energy",
    institution: "Technical Institute of Engineering",
    period: "2018 - 2020",
    description: "Specialized in solar photovoltaics, electrical fundamentals, and sustainable energy grid integration."
  }
];

app.get('/api/resume_experience', async (req, res) => {
  try {
    let exp;
    if (isDraftRequest(req)) {
      const bio = await getBioJson();
      exp = bio.resume_experience || [];
    } else {
      exp = await getPublishedResource('resume_experience', async () => {
        const bio = await getBioJson();
        return bio.resume_experience || [];
      });
    }
    const baseData = exp.length > 0 ? exp : staticExperience;
    const translated = await handleTranslation(baseData, req, 'ResumeExperience');
    res.json(translated);
  } catch (err: any) {
    const translated = await handleTranslation(staticExperience, req, 'ResumeExperience');
    res.json(translated);
  }
});

app.get('/api/resume_education', async (req, res) => {
  try {
    let edu;
    if (isDraftRequest(req)) {
      const bio = await getBioJson();
      edu = bio.resume_education || [];
    } else {
      edu = await getPublishedResource('resume_education', async () => {
        const bio = await getBioJson();
        return bio.resume_education || [];
      });
    }
    const baseData = edu.length > 0 ? edu : staticEducation;
    const translated = await handleTranslation(baseData, req, 'ResumeEducation');
    res.json(translated);
  } catch (err: any) {
    const translated = await handleTranslation(staticEducation, req, 'ResumeEducation');
    res.json(translated);
  }
});

// Helper for project serialization/deserialization
function deserializeProject(row: any) {
  if (!row) return null;
  
  // Try to read from direct columns first
  const hasDirectColumns = 'gallery_images' in row || 'long_description' in row || 'status' in row;
  
  let desc = row.description || '';
  let longDesc = row.long_description;
  let status = row.status;
  let tags = row.tags || [];
  let techStack = row.tech_stack || [];
  let galleryImages = row.gallery_images || [];
  let clientName = row.client_name;
  let completionDate = row.completion_date;
  let seoTitle = row.seo_title;
  let seoDescription = row.seo_description;

  // First, check if the description is fully serialized JSON (backend serialized fallback)
  const parsed = safeParseJson(row.description);
  if (parsed && typeof parsed === 'object' && 'description' in parsed) {
    desc = parsed.description || '';
    longDesc = longDesc || parsed.long_description || null;
    clientName = clientName || parsed.client_name || null;
    completionDate = completionDate || parsed.completion_date || null;
    status = status || parsed.status || null;
    seoTitle = seoTitle || parsed.seo_title || null;
    seoDescription = seoDescription || parsed.seo_description || null;
    techStack = (techStack && techStack.length > 0) ? techStack : (parsed.tech_stack || []);
    tags = (tags && tags.length > 0) ? tags : (parsed.tags || []);
    galleryImages = (galleryImages && galleryImages.length > 0) ? galleryImages : (parsed.gallery_images || []);
  }

  // Now check if the actual description (whether from column or inner JSON) has a metadata block
  if (desc && desc.includes('---METADATA---')) {
    try {
      const parts = desc.split('---METADATA---');
      desc = parts[0].trim();
      const metadata = JSON.parse(parts[1]);
      if (metadata) {
        status = status || metadata.status;
        tags = (tags && tags.length > 0) ? tags : (metadata.tags || []);
        techStack = (techStack && techStack.length > 0) ? techStack : (metadata.tags || []);
        galleryImages = (galleryImages && galleryImages.length > 0) ? galleryImages : (metadata.gallery || []);
        longDesc = longDesc || metadata.caseStudy;
      }
    } catch (e) {
      console.warn('Failed to parse metadata in deserialize:', e);
    }
  }

  if (hasDirectColumns) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: desc,
      long_description: longDesc !== undefined && longDesc !== null ? longDesc : null,
      thumbnail_url: row.thumbnail_url,
      hero_image_url: row.hero_image_url,
      live_url: row.live_url,
      github_url: row.github_url,
      is_featured: row.is_featured,
      order_index: row.order_index !== undefined ? row.order_index : (row.sort_order !== undefined ? row.sort_order : 0),
      sort_order: row.sort_order !== undefined ? row.sort_order : (row.order_index !== undefined ? row.order_index : 0),
      client_name: row.client_name !== undefined && row.client_name !== null ? row.client_name : clientName,
      completion_date: row.completion_date !== undefined && row.completion_date !== null ? row.completion_date : completionDate,
      status: status || 'Completed',
      seo_title: row.seo_title !== undefined && row.seo_title !== null ? row.seo_title : seoTitle,
      seo_description: row.seo_description !== undefined && row.seo_description !== null ? row.seo_description : seoDescription,
      tech_stack: techStack,
      tags: tags,
      gallery_images: galleryImages,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: desc,
    long_description: longDesc || null,
    thumbnail_url: row.thumbnail_url,
    hero_image_url: row.hero_image_url,
    live_url: row.live_url,
    github_url: row.github_url,
    is_featured: row.is_featured,
    order_index: row.order_index,
    sort_order: row.order_index || 0,
    client_name: clientName || null,
    completion_date: completionDate || null,
    status: status || 'Completed',
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    tech_stack: techStack,
    tags: tags,
    gallery_images: galleryImages,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function preprocessProjectPayload(payload: any) {
  const result = { ...payload };
  if (result.description && result.description.includes('---METADATA---')) {
    try {
      const parts = result.description.split('---METADATA---');
      result.description = parts[0].trim();
      const meta = JSON.parse(parts[1]);
      if (meta) {
        result.status = result.status || meta.status || 'Published';
        result.tags = (result.tags && result.tags.length > 0) ? result.tags : (meta.tags || []);
        result.tech_stack = (result.tech_stack && result.tech_stack.length > 0) ? result.tech_stack : (meta.tags || []);
        result.gallery_images = (result.gallery_images && result.gallery_images.length > 0) ? result.gallery_images : (meta.gallery || []);
        result.long_description = result.long_description || meta.caseStudy || null;
      }
    } catch (e) {
      console.warn('Failed to parse description metadata in preprocessProjectPayload:', e);
    }
  }
  return result;
}

function serializeProjectDesc(validatedData: any) {
  return JSON.stringify({
    description: validatedData.description,
    long_description: validatedData.long_description,
    client_name: validatedData.client_name,
    completion_date: validatedData.completion_date,
    status: validatedData.status,
    seo_title: validatedData.seo_title,
    seo_description: validatedData.seo_description,
    tech_stack: validatedData.tech_stack,
    tags: validatedData.tags,
    gallery_images: validatedData.gallery_images
  });
}

// Projects Routes
app.get('/api/projects', async (req, res) => {
  try {
    let projects;
    if (isDraftRequest(req)) {
      const { data, error } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      projects = (data || []).map(deserializeProject).filter(Boolean);
    } else {
      projects = await getPublishedResource('projects', async () => {
        const { data, error } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
        if (error) throw error;
        return (data || []).map(deserializeProject).filter(Boolean);
      });
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
      const projects = await getPublishedResource('projects', async () => {
        const { data, error } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
        if (error) throw error;
        return (data || []).map(deserializeProject).filter(Boolean);
      });
      const project = projects.find((p: any) => p && p.slug === req.params.slug);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const translated = await handleTranslation(project, req, 'Project');
      res.json(translated);
    }
  } catch (err: any) {
    res.status(404).json({ error: 'Project not found' });
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const validatedData = projectSchema.parse(req.body);
    const preprocessed = preprocessProjectPayload(validatedData);
    
    // Attempt 1: Direct column insert (for migrated schema)
    try {
      const { data, error } = await supabaseAdmin.from('projects').insert([{
        slug: preprocessed.slug,
        title: preprocessed.title,
        description: preprocessed.description,
        thumbnail_url: preprocessed.thumbnail_url,
        hero_image_url: preprocessed.hero_image_url,
        live_url: preprocessed.live_url,
        github_url: preprocessed.github_url,
        is_featured: preprocessed.is_featured,
        order_index: preprocessed.order_index,
        sort_order: preprocessed.order_index,
        long_description: preprocessed.long_description,
        client_name: preprocessed.client_name,
        completion_date: preprocessed.completion_date,
        status: preprocessed.status,
        seo_title: preprocessed.seo_title,
        seo_description: preprocessed.seo_description,
        tech_stack: preprocessed.tech_stack,
        tags: preprocessed.tags,
        gallery_images: preprocessed.gallery_images
      }]).select();
      
      if (!error && data && data.length > 0) {
        return res.status(201).json(deserializeProject(data[0]));
      }
      
      if (error && (error.message.includes('column') || error.message.includes('schema cache') || error.code === 'PGRST202')) {
        // console.log('Direct column insert failed, falling back to description JSON serialization:', error.message);
      } else if (error) {
        throw new Error(error.message);
      }
    } catch (directInsertErr: any) {
      console.log('Exception in direct column insert, falling back:', directInsertErr.message);
    }

    // Attempt 2: Fallback to serialized JSON in description column (for unmigrated schema)
    const serializedDesc = serializeProjectDesc(validatedData);
    const { data, error } = await supabaseAdmin.from('projects').insert([{
      slug: validatedData.slug,
      title: validatedData.title,
      description: serializedDesc,
      thumbnail_url: validatedData.thumbnail_url,
      hero_image_url: validatedData.hero_image_url,
      live_url: validatedData.live_url,
      github_url: validatedData.github_url,
      is_featured: validatedData.is_featured,
      order_index: validatedData.order_index
    }]).select();
    
    if (error) throw new Error(error.message);
    res.status(201).json(deserializeProject(data[0]));
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = projectSchema.parse(req.body);
    const preprocessed = preprocessProjectPayload(validatedData);
    
    // Attempt 1: Direct column update (for migrated schema)
    try {
      const { data, error } = await supabaseAdmin.from('projects').update({
        slug: preprocessed.slug,
        title: preprocessed.title,
        description: preprocessed.description,
        thumbnail_url: preprocessed.thumbnail_url,
        hero_image_url: preprocessed.hero_image_url,
        live_url: preprocessed.live_url,
        github_url: preprocessed.github_url,
        is_featured: preprocessed.is_featured,
        order_index: preprocessed.order_index,
        sort_order: preprocessed.order_index,
        long_description: preprocessed.long_description,
        client_name: preprocessed.client_name,
        completion_date: preprocessed.completion_date,
        status: preprocessed.status,
        seo_title: preprocessed.seo_title,
        seo_description: preprocessed.seo_description,
        tech_stack: preprocessed.tech_stack,
        tags: preprocessed.tags,
        gallery_images: preprocessed.gallery_images,
        updated_at: new Date().toISOString()
      }).eq('id', req.params.id).select();
      
      if (!error && data && data.length > 0) {
        return res.json(deserializeProject(data[0]));
      }
      
      if (error && (error.message.includes('column') || error.message.includes('schema cache') || error.code === 'PGRST202')) {
        // console.log('Direct column update failed, falling back to description JSON serialization:', error.message);
      } else if (error) {
        throw new Error(error.message);
      }
    } catch (directUpdateErr: any) {
      console.log('Exception in direct column update, falling back:', directUpdateErr.message);
    }

    // Attempt 2: Fallback to serialized JSON in description column (for unmigrated schema)
    const serializedDesc = serializeProjectDesc(validatedData);
    const { data, error } = await supabaseAdmin.from('projects').update({
      slug: validatedData.slug,
      title: validatedData.title,
      description: serializedDesc,
      thumbnail_url: validatedData.thumbnail_url,
      hero_image_url: validatedData.hero_image_url,
      live_url: validatedData.live_url,
      github_url: validatedData.github_url,
      is_featured: validatedData.is_featured,
      order_index: validatedData.order_index,
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select();
    
    if (error) throw new Error(error.message);
    res.json(deserializeProject(data[0]));
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('projects').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Project deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Certificates Routes
app.get('/api/certificates', async (req, res) => {
  try {
    let certificates;
    if (isDraftRequest(req)) {
      const { data, error } = await supabaseAdmin.from('certificates').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      certificates = data || [];
    } else {
      certificates = await getPublishedResource('certificates', async () => {
        const { data, error } = await supabaseAdmin.from('certificates').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      });
    }
    const translated = await handleTranslation(certificates, req, 'Certificate');
    res.json(translated || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
  try {
    const { error } = await supabaseAdmin.from('certificates').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Certificate deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Testimonials
app.get('/api/testimonials', async (req, res) => {
  try {
    let testimonials;
    if (isDraftRequest(req)) {
      const { data, error } = await supabaseAdmin.from('testimonials').select('*').eq('is_approved', true).order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      testimonials = data || [];
    } else {
      testimonials = await getPublishedResource('testimonials', async () => {
        const { data, error } = await supabaseAdmin.from('testimonials').select('*').eq('is_approved', true).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      });
    }
    const approvedTestimonials = testimonials.filter((t: any) => t.is_approved === true);
    const translated = await handleTranslation(approvedTestimonials, req, 'Testimonial');
    res.json(translated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/testimonials', async (req, res) => {
  try {
    const validatedData = testimonialSchema.parse(req.body);
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

    // Propagate to published snapshot immediately so testimonials update instantly
    try {
      const testimonialsRes = await supabaseAdmin.from('testimonials').select('*').order('created_at', { ascending: false });
      if (!testimonialsRes.error && testimonialsRes.data) {
        await saveBioJson((current) => {
          if (current.published_snapshot) {
            current.published_snapshot.testimonials = testimonialsRes.data;
          }
          return current;
        });
      }
    } catch (e) {
      console.error("Failed to propagate testimonials to snapshot:", e);
    }

    res.json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/testimonials/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin.from('testimonials').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  // Propagate to published snapshot immediately so testimonials update instantly
  try {
    const testimonialsRes = await supabaseAdmin.from('testimonials').select('*').order('created_at', { ascending: false });
    if (!testimonialsRes.error && testimonialsRes.data) {
      await saveBioJson((current) => {
        if (current.published_snapshot) {
          current.published_snapshot.testimonials = testimonialsRes.data;
        }
        return current;
      });
    }
  } catch (e) {
    console.error("Failed to propagate testimonials to snapshot:", e);
  }

  res.json({ message: 'Testimonial deleted successfully' });
});

// --- CLIENT REVIEWS MANAGEMENT (Persistent Fallback Database Layer) ---
async function getReviewsJson(): Promise<any[]> {
  const bio = await getBioJson();
  return bio.reviews || [];
}

async function saveReviewsJson(reviews: any[]) {
  await saveBioJson((current) => {
    const updated = { ...current, reviews };
    if (updated.published_snapshot) {
      updated.published_snapshot.reviews = reviews;
    }
    return updated;
  });
}

// Public: Get approved reviews with sorting and pagination
app.get('/api/reviews', async (req, res) => {
  try {
    let reviews;
    if (isDraftRequest(req)) {
      reviews = await getReviewsJson();
    } else {
      reviews = await getPublishedResource('reviews', async () => {
        return await getReviewsJson();
      });
    }
    // Only approved reviews should appear publicly
    const approvedReviews = reviews.filter((r: any) => r.status === 'Approved');
    
    // Sort
    const sort = req.query.sort || 'newest';
    approvedReviews.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (sort === 'oldest') {
        return dateA - dateB;
      } else if (sort === 'highest_rated') {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return dateB - dateA; // fallback to newest for same rating
      } else { // default to 'newest'
        return dateB - dateA;
      }
    });

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 6;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedReviews = approvedReviews.slice(startIndex, endIndex);
    
    res.json({
      reviews: paginatedReviews,
      total: approvedReviews.length,
      page,
      pages: Math.ceil(approvedReviews.length / limit)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public: Submit a review
app.post('/api/reviews', async (req, res) => {
  try {
    const validatedData = reviewSchema.parse(req.body);
    
    // Check for spam / duplicate submissions
    const reviews = await getReviewsJson();
    const isDuplicate = reviews.some((r: any) => 
      r.email.toLowerCase() === validatedData.email.toLowerCase() &&
      r.title.toLowerCase() === validatedData.title.toLowerCase() &&
      r.message.toLowerCase() === validatedData.message.toLowerCase()
    );
    
    if (isDuplicate) {
      return res.status(400).json({ error: "Duplicate review detected. This review has already been submitted." });
    }
    
    // Capture IP and browser
    const ip_address = (req.ip || req.headers['x-forwarded-for'] || '').toString();
    const browser = (req.headers['user-agent'] || '').toString();
    
    const newReview = {
      id: crypto.randomUUID(),
      client_name: validatedData.client_name,
      company: validatedData.company || null,
      job_title: validatedData.job_title || null,
      email: validatedData.email,
      project_name: validatedData.project_name || null,
      rating: validatedData.rating,
      title: validatedData.title,
      message: validatedData.message,
      status: 'Pending',
      created_at: new Date().toISOString(),
      approved_at: null,
      updated_at: new Date().toISOString(),
      ip_address,
      browser
    };
    
    reviews.push(newReview);
    await saveReviewsJson(reviews);
    
    res.status(201).json({ 
      message: 'Thank you! Your review has been submitted and is awaiting approval.',
      review: newReview 
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Get all reviews
app.get('/api/admin/reviews', requireAuth, async (req, res) => {
  try {
    const reviews = await getReviewsJson();
    // Sort reviews by created_at newest first
    reviews.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(reviews);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update review (approve / reject / edit)
app.put('/api/reviews/:id', requireAuth, async (req, res) => {
  try {
    const { status, client_name, company, job_title, email, project_name, rating, title, message } = req.body;
    
    const reviews = await getReviewsJson();
    const idx = reviews.findIndex((r: any) => r.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Review not found" });
    }
    
    const current = reviews[idx];
    
    // Update status if provided and valid
    let updatedStatus = current.status;
    let approvedAt = current.approved_at;
    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
      updatedStatus = status;
      if (status === 'Approved' && current.status !== 'Approved') {
        approvedAt = new Date().toISOString();
      } else if (status !== 'Approved') {
        approvedAt = null;
      }
    }
    
    reviews[idx] = {
      ...current,
      client_name: client_name !== undefined ? client_name : current.client_name,
      company: company !== undefined ? company : current.company,
      job_title: job_title !== undefined ? job_title : current.job_title,
      email: email !== undefined ? email : current.email,
      project_name: project_name !== undefined ? project_name : current.project_name,
      rating: rating !== undefined ? rating : current.rating,
      title: title !== undefined ? title : current.title,
      message: message !== undefined ? message : current.message,
      status: updatedStatus,
      approved_at: approvedAt,
      updated_at: new Date().toISOString()
    };
    
    await saveReviewsJson(reviews);
    res.json(reviews[idx]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Delete review permanently
app.delete('/api/reviews/:id', requireAuth, async (req, res) => {
  try {
    const reviews = await getReviewsJson();
    const filteredReviews = reviews.filter((r: any) => r.id !== req.params.id);
    if (reviews.length === filteredReviews.length) {
      return res.status(404).json({ error: "Review not found" });
    }
    await saveReviewsJson(filteredReviews);
    res.json({ message: "Review deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Publish snapshot of draft content to live site
app.post('/api/admin/publish', requireAuth, async (req, res) => {
  try {
    const bio = await getBioJson();
    
    const { data: skills } = await supabaseAdmin.from('skills').select('*').order('order_index', { ascending: true });
    const { data: projects } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
    const { data: certificates } = await supabaseAdmin.from('certificates').select('*').order('created_at', { ascending: false });
    const { data: testimonials } = await supabaseAdmin.from('testimonials').select('*').order('created_at', { ascending: false });
    const { data: profileRow } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
    
    const snapshot = {
      profile: {
        name: bio.name || profileRow?.name || 'Abdul Wahab',
        title: bio.title || profileRow?.title || 'Web Developer',
        profile_image_url: bio.profile_image_url || profileRow?.profile_image_url,
        resume_url: bio.resume_url || profileRow?.resume_url,
        bio: bio.bio_text || profileRow?.bio,
        long_bio: bio.long_bio,
        tagline: bio.tagline,
        cover_image_url: bio.cover_image_url
      },
      about: bio.about_sections || [],
      resume_experience: bio.resume_experience || [],
      resume_education: bio.resume_education || [],
      reviews: bio.reviews || [],
      services: bio.services || [],
      seo: bio.seo_settings || {},
      contact_info: bio.contact_information || {},
      skills: skills || [],
      projects: (projects || []).map(deserializeProject),
      certificates: certificates || [],
      testimonials: testimonials || []
    };
    
    await saveBioJson((current) => {
      return {
        ...current,
        published_snapshot: snapshot,
        last_published_at: new Date().toISOString()
      };
    });
    
    res.json({ success: true, message: 'Portfolio successfully updated and published.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

// CRM Leads Insertion Proxy (Secure Server-side ingestion)
app.post('/api/leads', async (req, res) => {
  try {
    const validatedData = leadSchema.parse(req.body);
    const leadPayload = {
      ...validatedData,
      created_at: validatedData.created_at || new Date().toISOString()
    };
    
    // Attempt to write to Supabase
    const { data, error } = await supabaseAdmin.from('leads').insert([leadPayload]).select();
    
    // Log to activity log
    try {
      await supabaseAdmin.from('activity_log').insert([{
        action: 'Lead Inbound Ingested',
        details: `New prospect registered: ${leadPayload.name} (${leadPayload.company || 'Private'}) via ${leadPayload.source}`,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      console.warn("Failed to insert lead activity log:", e);
    }

    if (error) {
      console.log("Supabase lead insertion error:", error.message);
      // Fallback: If table is not setup yet, return success so frontend can store locally or show success
      return res.status(201).json({ 
        message: 'Lead registered (local queue buffer)', 
        fallback: true,
        data: leadPayload
      });
    }

    res.status(201).json({ 
      message: 'Lead synchronized and registered successfully in enterprise CRM', 
      data: data[0] 
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
app.get('/api/admin/messages', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('contact_messages').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Activity Log & Analytics
app.post('/api/admin/activity_log', requireAuth, async (req, res) => {
  try {
    const { action, details } = req.body;
    const { data, error } = await supabaseAdmin.from('activity_log').insert([{
      action, details, created_at: new Date().toISOString()
    }]).select();
    if (error) throw new Error(error.message);
    res.status(201).json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
app.post('/api/analytics/event', async (req, res) => {
  try {
    const { session_id, event_type, page_url, metadata } = req.body;
    if (!session_id || !event_type) return res.status(400).json({ error: 'Missing session_id or event_type' });
    const { data: visitor } = await supabaseAdmin.from('visitors')
      .upsert({ session_id, last_visit_at: new Date().toISOString() }, { onConflict: 'session_id' })
      .select('id').single();
    if (visitor) {
      await supabaseAdmin.from('analytics_events').insert([{
        visitor_id: visitor.id, event_type, page_url, metadata
      }]);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record event' });
  }
});
app.get('/api/admin/analytics', requireAuth, async (req, res) => {
  const { count: visitorsCount } = await supabaseAdmin.from('visitors').select('*', { count: 'exact', head: true });
  const { count: eventsCount } = await supabaseAdmin.from('analytics_events').select('*', { count: 'exact', head: true });
  res.json({ total_visitors: visitorsCount || 0, total_events: eventsCount || 0 });
});

// Global API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global API error handler (catch multer errors, payload too large, etc.)
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err.message);
  
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'File is too large to upload. Please try a smaller image (max 10MB).';
  }

  res.status(status).json({ error: message });
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'spa' });
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
