import fs from "fs";
import * as Sentry from '@sentry/node';
import express from 'express';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { z } from 'zod';
import multer from 'multer';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { STATIC_ROUTES } from './src/lib/seo.js';
import { normalizeSiteUrl, siteUrlFromEnv } from './src/lib/siteUrl.js';
import { createChatRouter, createVoiceLiveRouter } from './chatbot/route.js';
import { buildDigest, sendDigestEmail, digestConfigured, STALE_LEAD_DAYS, type DigestLead } from './digest.js';
import { createOutreachRouter } from './outreach/route.js';
import { createAtelierFitRouter } from './atelierfit/route.js';
import { createStitchBookRouter } from './stitchbook/route.js';
import { createGalleryRouter } from './gallery/route.js';
import { createInboxRouter } from './inbox/route.js';

dotenv.config();

// Error tracking: off by default (no SENTRY_DSN means no-op), on once the env var is set on Vercel. Without
// this, a server-side failure (like an outreach search that fails) only ever existed as a one-line message
// shown in the browser -- nothing was kept anywhere to go look up afterwards. With it, Sentry.captureException
// calls at the points that matter (see outreach/route.ts) record the full error with a stack trace and the
// request that caused it.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || (isProductionEnv() ? 'production' : 'development'),
    tracesSampleRate: 0.1,
  });
}
function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet({ contentSecurityPolicy: false })); // allow dev scripts
app.use(cors());
// AI assistant: mounted before the global body parser so it applies its own small size limit and rate limits.
// It uses the restricted chatbot_reader database login, never the service-role client below.
app.use('/api/chat', createChatRouter());
// Voice call: the browser connects straight to Gemini's Live API over its own WebSocket once it has a token from
// here -- this server is only ever in the loop for minting that short-lived token and bridging tool calls, never
// for the audio itself (see chatbot/route.ts's createVoiceLiveRouter for why).
app.use('/api/voice', createVoiceLiveRouter());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `window`
  validate: { xForwardedForHeader: false, trustProxy: false, default: false },
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

// Multer setup
const uploadDir = process.env.VERCEL ? '/tmp/uploads' : 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/pdf' || 
      file.mimetype === 'application/octet-stream' || 
      file.mimetype === 'binary/octet-stream' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

// Initialize Supabase Admin Client
const getCleanEnv = (key: string): string => {
  const val = process.env[key];
  if (val && val !== 'undefined' && val !== 'null' && val.trim() !== '') {
    return val.trim();
  }
  return '';
};

let rawUrl = getCleanEnv('SUPABASE_URL') || getCleanEnv('VITE_SUPABASE_URL');
if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = 'https://' + rawUrl;
}
const isValidUrl = rawUrl && (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'));
const supabaseUrl = isValidUrl ? rawUrl : 'https://placeholder-please-configure-secrets.supabase.co';

const supabaseServiceKey = getCleanEnv('SUPABASE_SERVICE_ROLE_KEY') || 
                           getCleanEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || 
                           getCleanEnv('SUPABASE_SERVICE_ROLE') ||
                           getCleanEnv('VITE_SUPABASE_SERVICE_ROLE') ||
                           getCleanEnv('SUPABASE_SERVICE_KEY') ||
                           getCleanEnv('SERVICE_ROLE_KEY') ||
                           getCleanEnv('SUPABASE_ANON_KEY') || 
                           getCleanEnv('VITE_SUPABASE_ANON_KEY') || 
                           'placeholder_key';

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
  journey_events: z.any().optional().nullable(),
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
  gallery_images: z.array(z.any()).optional().default([]),
  has_dashboard: z.boolean().optional().default(false),
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
  plausible_domain: z.string().optional().nullable(),
  plausible_api_key: z.string().optional().nullable(),
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
  email: z.string().email().or(z.literal('')).optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  calendly_url: z.string().optional().nullable(),
  github_url: z.string().optional().nullable(),
  linkedin_url: z.string().optional().nullable(),
  twitter_url: z.string().optional().nullable(),
  instagram_url: z.string().optional().nullable(),
  upwork_url: z.string().optional().nullable(),
  contra_url: z.string().optional().nullable(),
});

const skillSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  icon: z.string().optional().nullable(),
  proficiency: z.number().optional().nullable(),
  order_index: z.number().default(0),
});

const resumeExperienceSchema = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
  period: z.string().min(1),
  description: z.string().min(1),
  order_index: z.number().default(0),
});

const resumeEducationSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
  period: z.string().min(1),
  description: z.string().min(1),
  order_index: z.number().default(0),
});

const ADMIN_EMAIL = 'abdulwahababdullah3619@gmail.com';

function getBearerToken(req: express.Request): string | null {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token || token === 'undefined' || token === 'null' || token.trim() === '') return null;
  return token;
}

// Resolves the authenticated admin user for this request (memoized per request).
async function getAdminUser(req: express.Request): Promise<any | null> {
  const cached = (req as any)._adminUser;
  if (cached !== undefined) return cached;
  let adminUser = null;
  const token = getBearerToken(req);
  if (token) {
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user && user.email?.toLowerCase() === ADMIN_EMAIL) adminUser = user;
    } catch (e) {
      console.error('Auth verification failed:', (e as Error).message);
    }
  }
  (req as any)._adminUser = adminUser;
  return adminUser;
}

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: Unauthorized system access' });
    }
    (req as any).user = user;
    (req as any)._adminUser = user;
    next();
  } catch (err: any) {
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
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
  const issues = error?.issues || error?.errors;
  if (Array.isArray(issues)) {
    return issues.map((issue: any) => {
      const field = issue.path.join('.');
      return `${field ? `Field '${field}'` : 'Input'}: ${issue.message}`;
    }).join(', ');
  }
  return error?.message || 'Validation failed';
}

// Small, dependency-free parse of a browser's User-Agent string into something human-readable for the
// analytics dashboard -- no need for a full UA-parsing library just to answer "what are people visiting from."
function classifyUserAgent(ua: string | null | undefined): { browser: string; device: string } {
  const s = (ua || '').toLowerCase();
  if (!s) return { browser: 'Unknown', device: 'Unknown' };

  let browser = 'Other';
  if (s.includes('edg/')) browser = 'Edge';
  else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera';
  else if (s.includes('crios') || (s.includes('chrome') && !s.includes('edg/'))) browser = 'Chrome';
  else if (s.includes('fxios') || s.includes('firefox')) browser = 'Firefox';
  else if (s.includes('safari') && !s.includes('chrome')) browser = 'Safari';

  let device = 'Desktop';
  if (s.includes('ipad') || s.includes('tablet')) device = 'Tablet';
  else if (s.includes('iphone') || s.includes('android') || s.includes('mobile')) device = 'Mobile';

  return { browser, device };
}

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'placeholder_key',
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
      model: 'gemini-2.5-flash',
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

// Draft (unpublished) content is only served to the authenticated admin.
async function isDraftRequest(req: express.Request): Promise<boolean> {
  const token = getBearerToken(req);
  const wantsDraft =
    req.query.preview === 'true' ||
    req.query.draft === 'true' ||
    req.headers['x-portfolio-draft'] === 'true' ||
    (!!token && (req.path.startsWith('/api/admin') || !!req.headers['referer']?.includes('/admin')));
  if (!wantsDraft) return false;
  return !!(await getAdminUser(req));
}

// Per-request cache so a single page render doesn't re-query the profile row for every resource.
function createLoadContext() {
  let profileRowPromise: Promise<any | null> | null = null;
  return {
    profileRow(): Promise<any | null> {
      if (!profileRowPromise) {
        profileRowPromise = Promise.resolve(supabaseAdmin.from('profiles').select('*').limit(1).single())
          .then(({ data, error }) => (error || !data ? null : data))
          .catch((e) => {
            console.error('Error loading profile row:', e?.message || e);
            return null;
          });
      }
      return profileRowPromise;
    }
  };
}
type LoadContext = ReturnType<typeof createLoadContext>;

async function getPublishedResource(resourceKey: string, fallbackFn: () => Promise<any>, ctx: LoadContext = createLoadContext()) {
  const data = await ctx.profileRow();
  if (data && data.bio) {
    const bio = safeParseJson(data.bio);
    if (bio && bio.published_snapshot && bio.published_snapshot[resourceKey] !== undefined) {
      return bio.published_snapshot[resourceKey];
    }
  }
  return await fallbackFn();
}

// Fetch entire profile bio JSON
async function getBioJson(ctx: LoadContext = createLoadContext()) {
  const data = await ctx.profileRow();
  if (!data || !data.bio) {
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

    // Ensure bucket 'media' exists
    try {
      await supabaseAdmin.storage.createBucket('media', { public: true });
    } catch (e) {
      // Ignore if bucket already exists
    }

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
    const data = await loadServices(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'Service'));
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
    res.status(400).json({ error: formatZodError(err) });
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
    res.status(400).json({ error: formatZodError(err) });
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

// About Routes (Real database table 'about_sections')
app.get('/api/about', async (req, res) => {
  try {
    const data = await loadAbout(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'AboutSection'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/about', requireAuth, async (req, res) => {
  try {
    const validatedData = aboutSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('about_sections').insert([validatedData]).select().maybeSingle();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.put('/api/about/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = aboutSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('about_sections').update({ ...validatedData, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return res.status(404).json({ error: 'About section not found' });
    }
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.delete('/api/about/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('about_sections').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Skills Routes (Real database table 'skills' is fully supported!)

const staticSkills = [
  // Frontend
  { id: '1', name: 'HTML5', category: 'Frontend Development', icon: 'Monitor', proficiency: 100, order_index: 0 },
  { id: '2', name: 'CSS3', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 1 },
  { id: '3', name: 'JavaScript (ES6+)', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 2 },
  { id: '4', name: 'TypeScript', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 3 },
  { id: '5', name: 'React', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 4 },
  { id: '6', name: 'Next.js', category: 'Frontend Development', icon: 'Monitor', proficiency: 85, order_index: 5 },
  { id: '7', name: 'Tailwind CSS', category: 'Frontend Development', icon: 'Monitor', proficiency: 95, order_index: 6 },
  { id: '8', name: 'Framer Motion', category: 'Frontend Development', icon: 'Monitor', proficiency: 85, order_index: 7 },
  { id: '9', name: 'Vite', category: 'Frontend Development', icon: 'Monitor', proficiency: 90, order_index: 8 },
  // Backend
  { id: '10', name: 'Node.js', category: 'Backend Development', icon: 'Server', proficiency: 90, order_index: 0 },
  { id: '11', name: 'Express.js', category: 'Backend Development', icon: 'Server', proficiency: 95, order_index: 1 },
  { id: '12', name: 'REST APIs', category: 'Backend Development', icon: 'Server', proficiency: 95, order_index: 2 },
  { id: '13', name: 'GraphQL', category: 'Backend Development', icon: 'Server', proficiency: 75, order_index: 3 },
  // Database
  { id: '14', name: 'PostgreSQL', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 0 },
  { id: '15', name: 'Supabase', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 1 },
  { id: '16', name: 'Prisma', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 2 },
  { id: '17', name: 'Drizzle', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 3 },
  { id: '18', name: 'MongoDB', category: 'Database & ORM', icon: 'Database', proficiency: 85, order_index: 4 },
  { id: '19', name: 'Firebase', category: 'Database & ORM', icon: 'Database', proficiency: 90, order_index: 5 },
  // Tools
  { id: '20', name: 'Git', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 95, order_index: 0 },
  { id: '21', name: 'GitHub Actions', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 85, order_index: 1 },
  { id: '22', name: 'Docker', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 80, order_index: 2 },
  { id: '23', name: 'Cloud Run', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 85, order_index: 3 },
  { id: '24', name: 'Vercel', category: 'Tools & DevOps', icon: 'Terminal', proficiency: 90, order_index: 4 }
];

app.get('/api/skills', async (req, res) => {
  try {
    const data = await loadSkills(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'Skill'));
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
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.put('/api/skills/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = skillSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('skills').update(validatedData).eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.delete('/api/skills/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('skills').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profile Routes (Unified with Bio JSON storage)
app.get('/api/profile', async (req, res) => {
  try {
    const data = await loadProfile(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'Profile'));
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
        cover_image_url: validatedData.cover_image_url,
        journey_events: validatedData.journey_events
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
        cover_image_url: validatedData.cover_image_url,
        journey_events: validatedData.journey_events
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

// SEO Settings Routes (Real database table 'seo_settings')
// The table doesn't have columns for every field the admin form can send (e.g. plausible_domain,
// plausible_api_key aren't columns yet), so writes are filtered down to columns that actually exist.
const SEO_TABLE_COLUMNS = [
  'logo_url', 'site_name', 'footer_copyright', 'browser_title', 'meta_keywords', 'twitter_card_image',
  'google_analytics_id', 'google_tag_manager_id', 'microsoft_clarity_id', 'meta_pixel_id',
  'maintenance_mode', 'site_title', 'meta_description', 'og_image_url', 'twitter_handle',
  'favicon_url', 'canonical_url'
];
function pickColumns(obj: any, columns: string[]) {
  const out: any = {};
  for (const key of columns) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

app.get('/api/seo', async (req, res) => {
  try {
    res.json(await loadSeo(createLoadContext(), await isDraftRequest(req)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seo', requireAuth, async (req, res) => {
  try {
    const validatedData = seoSchema.parse(req.body);
    const { data: existing } = await supabaseAdmin.from('seo_settings').select('*').limit(1).maybeSingle();
    const toSave = pickColumns(validatedData, SEO_TABLE_COLUMNS);
    // An empty secret field means "unchanged": the admin form may have been filled from public data
    // that never contains the secret, and saving it must not wipe the stored value.
    for (const field of SECRET_SEO_FIELDS) {
      if (!toSave[field] && existing?.[field]) toSave[field] = existing[field];
    }
    let result;
    if (existing?.id) {
      const { data, error } = await supabaseAdmin.from('seo_settings').update({ ...toSave, updated_at: new Date().toISOString() }).eq('id', existing.id).select().maybeSingle();
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await supabaseAdmin.from('seo_settings').insert([toSave]).select().maybeSingle();
      if (error) throw new Error(error.message);
      result = data;
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

// Contact Information Routes (Real database table 'contact_information')
app.get('/api/contact_info', async (req, res) => {
  try {
    res.json(await loadContactInfo(createLoadContext(), await isDraftRequest(req)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contact_info', requireAuth, async (req, res) => {
  try {
    const validatedData = contactInfoSchema.parse(req.body);
    const { data: existing } = await supabaseAdmin.from('contact_information').select('id').limit(1).maybeSingle();
    let result;
    if (existing?.id) {
      const { data, error } = await supabaseAdmin.from('contact_information').update({ ...validatedData, updated_at: new Date().toISOString() }).eq('id', existing.id).select().maybeSingle();
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await supabaseAdmin.from('contact_information').insert([validatedData]).select().maybeSingle();
      if (error) throw new Error(error.message);
      result = data;
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

// Resume Experience and Education (Mapped to Profile Bio JSON with fallbacks)
const staticExperience = [
  {
    role: "Freelance Web Developer",
    company: "Self-Employed",
    period: "2023 - Present",
    description: "Designing and developing premium web applications for clients across various industries, focusing on performance, aesthetics, and scalable architectures."
  }
];

const staticEducation = [
  {
    degree: "Self-Taught Computer Science",
    institution: "Various Platforms (Coursera, Udemy, Docs)",
    period: "2022 - Present",
    description: "Rigorous self-directed study covering data structures, algorithms, system design, and modern web frameworks."
  }
];

app.get('/api/resume_experience', async (req, res) => {
  try {
    const data = await loadResumeExperience(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'ResumeExperience'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/resume_education', async (req, res) => {
  try {
    const data = await loadResumeEducation(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'ResumeEducation'));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resume Experience Mutations
app.post('/api/resume_experience', requireAuth, async (req, res) => {
  try {
    const validatedData = resumeExperienceSchema.parse(req.body);
    const newExp = {
      id: crypto.randomUUID(),
      ...validatedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await saveBioJson((current) => {
      const exp = current.resume_experience || [];
      exp.push(newExp);
      return { ...current, resume_experience: exp };
    });
    res.status(201).json(newExp);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.put('/api/resume_experience/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = resumeExperienceSchema.parse(req.body);
    let updatedExp: any = null;
    await saveBioJson((current) => {
      const exp = current.resume_experience || [];
      const idx = exp.findIndex((s: any) => s.id === req.params.id);
      if (idx !== -1) {
        exp[idx] = {
          ...exp[idx],
          ...validatedData,
          updated_at: new Date().toISOString()
        };
        updatedExp = exp[idx];
      }
      return { ...current, resume_experience: exp };
    });
    if (!updatedExp) return res.status(404).json({ error: 'Experience not found' });
    res.json(updatedExp);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.delete('/api/resume_experience/:id', requireAuth, async (req, res) => {
  try {
    await saveBioJson((current) => {
      const exp = (current.resume_experience || []).filter((s: any) => s.id !== req.params.id);
      return { ...current, resume_experience: exp };
    });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resume Education Mutations
app.post('/api/resume_education', requireAuth, async (req, res) => {
  try {
    const validatedData = resumeEducationSchema.parse(req.body);
    const newEdu = {
      id: crypto.randomUUID(),
      ...validatedData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await saveBioJson((current) => {
      const edu = current.resume_education || [];
      edu.push(newEdu);
      return { ...current, resume_education: edu };
    });
    res.status(201).json(newEdu);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.put('/api/resume_education/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = resumeEducationSchema.parse(req.body);
    let updatedEdu: any = null;
    await saveBioJson((current) => {
      const edu = current.resume_education || [];
      const idx = edu.findIndex((s: any) => s.id === req.params.id);
      if (idx !== -1) {
        edu[idx] = {
          ...edu[idx],
          ...validatedData,
          updated_at: new Date().toISOString()
        };
        updatedEdu = edu[idx];
      }
      return { ...current, resume_education: edu };
    });
    if (!updatedEdu) return res.status(404).json({ error: 'Education not found' });
    res.json(updatedEdu);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.delete('/api/resume_education/:id', requireAuth, async (req, res) => {
  try {
    await saveBioJson((current) => {
      const edu = (current.resume_education || []).filter((s: any) => s.id !== req.params.id);
      return { ...current, resume_education: edu };
    });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
      status: (status === 'Draft' || status === 'Archived') ? status : 'Published',
      seo_title: row.seo_title !== undefined && row.seo_title !== null ? row.seo_title : seoTitle,
      seo_description: row.seo_description !== undefined && row.seo_description !== null ? row.seo_description : seoDescription,
      tech_stack: techStack,
      tags: tags,
      gallery_images: galleryImages,
      has_dashboard: row.has_dashboard ?? false,
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
    status: (status === 'Draft' || status === 'Archived') ? status : 'Published',
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    tech_stack: techStack,
    tags: tags,
    gallery_images: galleryImages,
    has_dashboard: row.has_dashboard ?? false,
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
    const projects = await loadProjects(await isDraftRequest(req));
    res.json(await handleTranslation(projects, req, 'Project'));
  } catch (err: any) {
    console.error('[GET /api/projects] Error:', err.message);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

app.get('/api/projects/:slug', async (req, res) => {
  try {
    const project = await loadProject(req.params.slug, await isDraftRequest(req));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(await handleTranslation(project, req, 'Project'));
  } catch (err: any) {
    console.error(`[GET /api/projects/:slug] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generates a draft project entry from a screenshot/image the admin uploads -- the AI looks at the image (plus
// any short context the admin typed) and proposes title, slug, description, case study, category and tech tags.
// Nothing is saved here: the admin UI fills its form with the result for review/editing, and the existing
// POST/PUT /api/projects routes are what actually persist it, same as a hand-typed entry would.
const PROJECT_FROM_IMAGE_CATEGORIES = ['Web Development', 'Solar Installations', 'Mobile Applications', 'IoT Engineering', 'UX/UI Prototypes'];

app.post('/api/admin/projects/generate-from-image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    if (!req.file.mimetype.startsWith('image/')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Please upload an image file' });
    }
    if (!process.env.GEMINI_API_KEY) {
      fs.unlinkSync(req.file.path);
      return res.status(503).json({ error: 'Image analysis is not configured (GEMINI_API_KEY missing).' });
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    fs.unlinkSync(req.file.path);
    const context = typeof req.body?.context === 'string' ? req.body.context.slice(0, 1000) : '';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: req.file.mimetype, data: imageBuffer.toString('base64') } },
            {
              text:
                `This is a screenshot of a web/app project for Abdulwahab's developer portfolio.${context ? ` Extra context from him: ${context}` : ''}\n` +
                'Look at what the screenshot actually shows (layout, UI patterns, visible text, branding, apparent purpose) and propose a portfolio entry for it. ' +
                'Guess a plausible, specific tech stack from what the UI style suggests (do not just default to React/Tailwind unless the screenshot actually looks like it). ' +
                'Keep the description to 1-2 sentences, written the way a developer would describe their own work -- confident, plain, no hype words.',
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'A short, specific project name (2-5 words)' },
            description: { type: Type.STRING, description: 'A 1-2 sentence pitch of what it is and does' },
            long_description: { type: Type.STRING, description: 'A longer case-study style write-up, 2-4 short paragraphs in markdown, covering the problem and the build' },
            category: { type: Type.STRING, enum: PROJECT_FROM_IMAGE_CATEGORIES },
            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-6 specific technology/tool tags suggested by the screenshot' },
          },
          required: ['title', 'description', 'long_description', 'category', 'tags'],
        },
      },
    });

    let raw = response.text?.trim() || '{}';
    if (raw.startsWith('```')) raw = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(raw);

    const title = typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : '';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: any) => typeof t === 'string').slice(0, 8) : [];

    res.json({
      title,
      slug,
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 500) : '',
      long_description: typeof parsed.long_description === 'string' ? parsed.long_description.slice(0, 5000) : '',
      category: PROJECT_FROM_IMAGE_CATEGORIES.includes(parsed.category) ? parsed.category : 'Web Development',
      tags,
    });
  } catch (err: any) {
    console.error('Error generating project from image:', err?.message);
    res.status(500).json({ error: 'Could not analyze that image. Try again, or fill the form in by hand.' });
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
        gallery_images: preprocessed.gallery_images,
        has_dashboard: preprocessed.has_dashboard
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

    // Attempt 2: Fallback to serialized JSON in description column (for unmigrated schema). Uses `preprocessed`
    // (not the raw validatedData) so a description that already carried a legacy "---METADATA---" blob gets
    // unwrapped first -- otherwise this would re-serialize the whole already-wrapped payload into a new, doubly
    // wrapped JSON blob (this was the root cause of the Azure-hotel / h-orizon-hotel data corruption).
    const serializedDesc = serializeProjectDesc(preprocessed);
    const { data, error } = await supabaseAdmin.from('projects').insert([{
      slug: preprocessed.slug,
      title: preprocessed.title,
      description: serializedDesc,
      thumbnail_url: preprocessed.thumbnail_url,
      hero_image_url: preprocessed.hero_image_url,
      live_url: preprocessed.live_url,
      github_url: preprocessed.github_url,
      is_featured: preprocessed.is_featured,
      order_index: preprocessed.order_index
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
        has_dashboard: preprocessed.has_dashboard,
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

    // Attempt 2: Fallback to serialized JSON in description column (for unmigrated schema). Uses `preprocessed`,
    // same reasoning as the POST route above -- never re-wrap an already-wrapped description.
    const serializedDesc = serializeProjectDesc(preprocessed);
    const { data, error } = await supabaseAdmin.from('projects').update({
      slug: preprocessed.slug,
      title: preprocessed.title,
      description: serializedDesc,
      thumbnail_url: preprocessed.thumbnail_url,
      hero_image_url: preprocessed.hero_image_url,
      live_url: preprocessed.live_url,
      github_url: preprocessed.github_url,
      is_featured: preprocessed.is_featured,
      order_index: preprocessed.order_index,
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
    const data = await loadCertificates(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'Certificate'));
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
    res.status(400).json({ error: formatZodError(err) });
  }
});

app.put('/api/certificates/:id', requireAuth, async (req, res) => {
  try {
    const validatedData = certificateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('certificates').update(validatedData).eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    res.json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
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
    const data = await loadTestimonials(createLoadContext(), await isDraftRequest(req));
    res.json(await handleTranslation(data, req, 'Testimonial'));
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
    res.status(400).json({ error: formatZodError(err) });
  }
});
app.get('/api/admin/testimonials', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('testimonials').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
    res.status(400).json({ error: formatZodError(err) });
  }
});
app.delete('/api/testimonials/:id', requireAuth, async (req, res) => {
  let error;
  try {
    ({ error } = await supabaseAdmin.from('testimonials').delete().eq('id', req.params.id));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
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

// Strip reviewer contact details and tracking data before sending reviews to the public
function toPublicReview(review: any) {
  const { email, ip_address, browser, ...publicFields } = review || {};
  return publicFields;
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
    if (await isDraftRequest(req)) {
      reviews = await getReviewsJson();
    } else {
      reviews = await getPublishedResource('reviews', async () => {
        return await getReviewsJson();
      });
    }
    // Only approved reviews should appear publicly, without reviewers' private details
    const approvedReviews = (reviews || [])
      .filter((r: any) => r.status === 'Approved')
      .map(toPublicReview);
    
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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 6));
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
      review: toPublicReview(newReview)
    });
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
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
    res.status(400).json({ error: formatZodError(err) });
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
        resume_url: profileRow?.resume_url || bio.resume_url,
        bio: bio.bio || bio.bio_text || 'I build web apps',
        long_bio: bio.long_bio,
        tagline: bio.tagline,
        cover_image_url: bio.cover_image_url,
        journey_events: bio.journey_events || null
      },
      about: bio.about_sections || [],
      resume_experience: bio.resume_experience || [],
      resume_education: bio.resume_education || [],
      reviews: bio.reviews || [],
      services: bio.services || [],
      seo: bio.seo_settings || {},
      contact_info: bio.contact_information || {},
      skills: (skills && skills.length > 0) ? skills : staticSkills,
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
    
    res.json({ 
      success: true, 
      message: 'Portfolio successfully updated and published.',
      published_summary: {
        resume_url: snapshot.profile.resume_url || null,
        projects_count: snapshot.projects.length,
        skills_count: snapshot.skills.length,
        certificates_count: snapshot.certificates.length,
        testimonials_count: snapshot.testimonials.length,
        published_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Contact Messages
app.post('/api/contact', async (req, res) => {
  try {
    const validatedData = contactMessageSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('contact_messages').insert([validatedData]).select();
    if (error) {
      console.error("Contact message DB insert error:", error.message);
      return res.status(500).json({ error: 'Your message could not be delivered right now. Please try again or reach out by email.' });
    }
    res.status(201).json({ message: 'Message sent successfully', data: data?.[0] });
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});

// CRM Leads Insertion Proxy (Secure Server-side ingestion)
app.post('/api/leads', async (req, res) => {
  try {
    const validatedData = leadSchema.parse(req.body);
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 5000) : '';
    const leadPayload = {
      ...validatedData,
      notes: notes || null,
      created_at: validatedData.created_at || new Date().toISOString()
    };
    
    const { data, error } = await supabaseAdmin.from('leads').insert([leadPayload]).select();
    if (error) {
      console.error("Supabase lead insertion error:", error.message);
      return res.status(500).json({ error: 'Your request could not be saved right now. Please try again shortly.' });
    }

    const lead = data?.[0];

    // Also add the submitted details (e.g. solar sizing snapshot) to the lead's note timeline shown in the CRM
    if (notes && lead?.id) {
      const { error: noteError } = await supabaseAdmin.from('lead_notes').insert([{
        lead_id: lead.id,
        note: notes,
        created_at: new Date().toISOString()
      }]);
      if (noteError) console.warn("Failed to store lead note:", noteError.message);
    }

    // Log to activity log
    const { error: logError } = await supabaseAdmin.from('activity_log').insert([{
      action: 'Lead Inbound Ingested',
      details: `New prospect registered: ${leadPayload.name} (${leadPayload.company || 'Private'}) via ${leadPayload.source}`,
      created_at: new Date().toISOString()
    }]);
    if (logError) console.warn("Failed to insert lead activity log:", logError.message);

    res.status(201).json({ 
      message: 'Lead registered successfully', 
      data: lead 
    });
  } catch (err: any) {
    res.status(400).json({ error: formatZodError(err) });
  }
});
// Lead digest cron routes. Vercel's scheduler calls these on the schedule in vercel.json's `crons` array, sending
// `Authorization: Bearer $CRON_SECRET` automatically -- so as long as CRON_SECRET is set in the environment, only
// Vercel's own scheduler (or someone with that secret) can trigger a send. Uses supabaseAdmin directly, same as
// every other admin route here, since this never takes visitor input.
function isAuthorizedCronRequest(req: express.Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

async function runDigest(req: express.Request, res: express.Response, sinceMs: number, periodLabel: string, isWeekly: boolean) {
  if (!isAuthorizedCronRequest(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    if (!digestConfigured()) return res.status(503).json({ error: 'Digest email is not configured (RESEND_API_KEY missing).' });
    const since = new Date(Date.now() - sinceMs).toISOString();
    const staleCutoff = new Date(Date.now() - STALE_LEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const selectCols = 'id, name, email, phone, company, status, source, notes, priority, created_at, updated_at';

    const [{ data, error }, { data: staleData, error: staleError }] = await Promise.all([
      supabaseAdmin.from('leads').select(selectCols).gte('created_at', since).order('created_at', { ascending: false }).limit(200),
      // Quiet leads: still 'New' or 'Contacted' (nothing resolved either way) and untouched for days --
      // surfaced as a reminder to Abdulwahab himself, never contacted automatically.
      supabaseAdmin
        .from('leads')
        .select(selectCols)
        .in('status', ['New', 'Contacted'])
        .lt('updated_at', staleCutoff)
        .order('updated_at', { ascending: true })
        .limit(10),
    ]);
    if (error) throw new Error(error.message);
    if (staleError) throw new Error(staleError.message);
    const leads = (data || []) as DigestLead[];
    const staleLeads = (staleData || []) as DigestLead[];

    // A daily digest with nothing new and nothing stale to flag is just noise -- skip it. A weekly digest always
    // sends, as a quiet heartbeat confirming the pipeline is still working even in a slow week.
    if (leads.length === 0 && staleLeads.length === 0 && !isWeekly) return res.status(200).json({ sent: false, reason: 'nothing_to_report' });

    const content = buildDigest(leads, periodLabel, isWeekly, staleLeads);
    const sent = await sendDigestEmail(content);
    res.status(sent ? 200 : 502).json({ sent, leadCount: leads.length, staleCount: staleLeads.length });
  } catch (err: any) {
    console.error('Digest cron error:', err?.message);
    res.status(500).json({ error: 'Digest failed', message: err?.message });
  }
}

app.get('/api/cron/digest-daily', (req, res) => runDigest(req, res, 24 * 60 * 60 * 1000, 'today', false));
app.get('/api/cron/digest-weekly', (req, res) => runDigest(req, res, 7 * 24 * 60 * 60 * 1000, 'this week', true));

app.get('/api/admin/messages', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('contact_messages').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
    res.status(400).json({ error: formatZodError(err) });
  }
});
app.post('/api/analytics/event', async (req, res) => {
  try {
    const { session_id, event_type, page_url, metadata } = req.body;
    if (!session_id || !event_type) return res.status(400).json({ error: 'Missing session_id or event_type' });
    try {
      // Capture the real browser/device and IP on every event, not just the first one -- a session upsert only
      // writes these the first time otherwise, and a returning visitor's device can legitimately change (phone vs
      // laptop) across a session that spans days via the same localStorage id.
      const ip_address = (req.ip || (req.headers['x-forwarded-for'] as string) || '').toString().split(',')[0].trim() || null;
      const user_agent = (req.headers['user-agent'] || '').toString() || null;
      const { data: visitor } = await supabaseAdmin.from('visitors')
        .upsert({ session_id, last_visit_at: new Date().toISOString(), user_agent, ip_address }, { onConflict: 'session_id' })
        .select('id').single();
      if (visitor) {
        await supabaseAdmin.from('analytics_events').insert([{
          visitor_id: visitor.id, event_type, page_url, metadata
        }]);
      }
    } catch (dbErr: any) {
      console.warn("Analytics DB/RLS warning:", dbErr.message);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: true, fallback: true });
  }
});
app.get('/api/admin/analytics', requireAuth, async (req, res) => {
  try {
    const { count: visitorsCount } = await supabaseAdmin.from('visitors').select('*', { count: 'exact', head: true });
    const { count: eventsCount } = await supabaseAdmin.from('analytics_events').select('*', { count: 'exact', head: true });
    res.json({ total_visitors: visitorsCount || 0, total_events: eventsCount || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/plausible-stats', requireAuth, async (req, res) => {
  try {
    const period = (req.query.period as string) || '30d';
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);
    const daysAgoString = daysAgo.toISOString();

    const [recentVisitorsRes, recentEventsRes] = await Promise.all([
      supabaseAdmin.from('visitors').select('id, created_at, user_agent').gte('created_at', daysAgoString),
      supabaseAdmin.from('analytics_events').select('visitor_id, created_at, event_type, page_url, metadata').gte('created_at', daysAgoString)
    ]);

    const recentVisitors = recentVisitorsRes.data || [];
    const recentEvents = recentEventsRes.data || [];

    // A "bounce" is a visitor whose whole visit was a single page_view with nothing else recorded after it --
    // the closest honest proxy to Plausible's definition available from this schema without a client-side timer.
    const eventsByVisitor = new Map<string, typeof recentEvents>();
    for (const e of recentEvents) {
      if (!e.visitor_id) continue;
      if (!eventsByVisitor.has(e.visitor_id)) eventsByVisitor.set(e.visitor_id, []);
      eventsByVisitor.get(e.visitor_id)!.push(e);
    }
    let bounced = 0;
    let sessionsWithEvents = 0;
    let totalDurationSeconds = 0;
    for (const [, evs] of eventsByVisitor) {
      sessionsWithEvents++;
      const pageViews = evs.filter((e) => e.event_type === 'page_view');
      if (evs.length <= 1 && pageViews.length <= 1) bounced++;
      if (evs.length > 1) {
        const times = evs.map((e) => new Date(e.created_at).getTime()).sort((a, b) => a - b);
        totalDurationSeconds += (times[times.length - 1] - times[0]) / 1000;
      }
    }
    const bounceRate = sessionsWithEvents > 0 ? Math.round((bounced / sessionsWithEvents) * 100) : 0;
    const avgDuration = sessionsWithEvents > 0 ? Math.round(totalDurationSeconds / sessionsWithEvents) : 0;

    const aggregate = {
      visitors: { value: recentVisitors.length },
      pageviews: { value: recentEvents.filter((e) => e.event_type === 'page_view').length },
      bounce_rate: { value: bounceRate },
      visit_duration: { value: avgDuration }
    };

    const timeseries = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const dayVisitors = recentVisitors.filter(v => v.created_at.startsWith(dateString)).length;
      const dayEvents = recentEvents.filter(e => e.created_at.startsWith(dateString)).length;
      timeseries.push({
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        visitors: dayVisitors,
        pageviews: dayEvents
      });
    }

    // Real traffic sources, from whatever referrer each session's first event carried.
    const sourcesMap = new Map<string, number>();
    recentEvents.forEach(e => {
        const ref = (e.metadata as any)?.referrer || 'Direct / None';
        sourcesMap.set(ref, (sourcesMap.get(ref) || 0) + 1);
    });
    const sources = Array.from(sourcesMap.entries()).map(([source, visitors]) => ({ source, visitors })).sort((a,b) => b.visitors - a.visitors).slice(0, 5);

    // Real browser breakdown, parsed from each visitor's own stored User-Agent -- replaces the old hardcoded
    // "everyone is on Chrome" placeholder.
    const browserMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    for (const v of recentVisitors) {
      const { browser, device } = classifyUserAgent((v as any).user_agent);
      browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
    }
    const browsers = Array.from(browserMap.entries()).map(([browser, visitors]) => ({ browser, visitors })).sort((a, b) => b.visitors - a.visitors);
    const devices = Array.from(deviceMap.entries()).map(([device, visitors]) => ({ device, visitors })).sort((a, b) => b.visitors - a.visitors);

    // Which portfolio projects are actually getting looked at -- a page_view whose path is /projects/<slug>.
    const projectCounts = new Map<string, number>();
    for (const e of recentEvents) {
      if (e.event_type !== 'page_view' || !e.page_url) continue;
      const match = e.page_url.match(/^\/projects\/([^/?]+)/);
      if (match) projectCounts.set(match[1], (projectCounts.get(match[1]) || 0) + 1);
    }
    let topProjects: { slug: string; title: string; views: number }[] = [];
    if (projectCounts.size > 0) {
      const { data: projectRows } = await supabaseAdmin.from('projects').select('slug, title').in('slug', Array.from(projectCounts.keys()));
      const titleBySlug = new Map((projectRows || []).map((p: any) => [p.slug, p.title]));
      topProjects = Array.from(projectCounts.entries())
        .map(([slug, views]) => ({ slug, title: titleBySlug.get(slug) || slug, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);
    }

    res.json({
      connected: true,
      domain: 'Local DB Analytics',
      apiKeyConfigured: true,
      aggregate,
      timeseries,
      sources,
      browsers,
      devices,
      topProjects
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Live-ish feed of recent individual visits for the admin dashboard: "who came today, and what did they do."
// No identity is ever known or stored here (just an anonymous per-browser session id, IP and User-Agent), so this
// answers "how many distinct visits, from what kind of device, via what referrer, through which pages" -- not
// "which named person." That's the honest ceiling of what a cookie-based session id can tell you.
app.get('/api/admin/visitor-feed', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '40', 10) || 40, 100);

    const { data: visitors, error: visitorsErr } = await supabaseAdmin
      .from('visitors')
      .select('id, session_id, user_agent, ip_address, created_at, last_visit_at')
      .order('last_visit_at', { ascending: false })
      .limit(limit);
    if (visitorsErr) throw new Error(visitorsErr.message);

    const visitorIds = (visitors || []).map((v: any) => v.id);
    const { data: events, error: eventsErr } = visitorIds.length
      ? await supabaseAdmin
          .from('analytics_events')
          .select('visitor_id, event_type, page_url, metadata, created_at')
          .in('visitor_id', visitorIds)
          .order('created_at', { ascending: true })
      : { data: [], error: null };
    if (eventsErr) throw new Error(eventsErr.message);

    const eventsByVisitor = new Map<string, any[]>();
    for (const e of events || []) {
      if (!eventsByVisitor.has(e.visitor_id)) eventsByVisitor.set(e.visitor_id, []);
      eventsByVisitor.get(e.visitor_id)!.push(e);
    }

    const feed = (visitors || []).map((v: any) => {
      const evs = eventsByVisitor.get(v.id) || [];
      const pageViews = evs.filter((e) => e.event_type === 'page_view');
      const { browser, device } = classifyUserAgent(v.user_agent);
      const referrer = evs.find((e) => e.metadata?.referrer)?.metadata?.referrer || null;
      return {
        session_id: v.session_id,
        first_seen: v.created_at,
        last_seen: v.last_visit_at,
        browser,
        device,
        referrer,
        page_count: pageViews.length,
        pages: pageViews.map((e) => ({ path: e.page_url, at: e.created_at })),
        other_events: evs.filter((e) => e.event_type !== 'page_view').map((e) => ({ type: e.event_type, at: e.created_at, meta: e.metadata || null })),
      };
    });

    res.json({ feed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Lead discovery, crawling, AI drafting and the review queue -- merged in from the standalone AI-Outreach tool.
// Every route is admin-only (requireAuth), so it's safe to reuse the service-role client here even though the
// original standalone app only ever held a restricted anon key (it had no login of its own to gate behind).
app.use('/api/admin/outreach', createOutreachRouter({ requireAuth, supabaseUrl, supabaseServiceKey }));
// Gmail read-only Inbox tab (replies / sent-confirmation / unsubscribe detection for outreach leads). Its
// OAuth callback route is reached via a direct browser redirect from Google, not requireAuth, but every
// other route on this router still requires the admin to be logged in -- see inbox/route.ts.
app.use('/api/admin/inbox', createInboxRouter({ requireAuth, supabaseUrl, supabaseServiceKey }));
// AtelierFit: public order-intake + Paystack verification routes live here too, with the admin list/status routes
// gated inside the router itself -- see atelierfit/route.ts.
app.use('/api/atelierfit', createAtelierFitRouter({ requireAuth, supabaseUrl, supabaseServiceKey }));
// StitchBook: the desktop-app project -- a live, public tailor-shop management demo, plus (on the same
// router) real Live data from AtelierFit/Atelier Noir and the Real Inventory. Reads are public (customer
// details masked for visitors); writes to real stock need the signed-in owner. See stitchbook/route.ts.
app.use('/api/stitchbook', createStitchBookRouter({ supabaseUrl, supabaseServiceKey, getOwner: getAdminUser }));

// Gallery: read-only bridge onto the Atelier Noir / Agbada Luxe product catalog (a separate app's table in this
// same Supabase project). No writes happen here -- see gallery/route.ts for why.
app.use('/api/gallery', createGalleryRouter({ supabaseUrl, supabaseServiceKey }));

// --- PUBLIC CONTENT LOADERS ---
// Shared by the JSON API routes above and by the server-side renderer below.

async function loadBioResource(ctx: LoadContext, draft: boolean, publishedKey: string, bioKey: string, empty: any) {
  if (draft) {
    const bio = await getBioJson(ctx);
    return bio[bioKey] || empty;
  }
  return getPublishedResource(publishedKey, async () => {
    const bio = await getBioJson(ctx);
    return bio[bioKey] || empty;
  }, ctx);
}

const loadServices = (ctx: LoadContext, draft: boolean) => loadBioResource(ctx, draft, 'services', 'services', []);

async function queryAboutSections() {
  const { data, error } = await supabaseAdmin.from('about_sections').select('*').order('order_index', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}
const loadAbout = (ctx: LoadContext, draft: boolean) =>
  draft ? queryAboutSections() : getPublishedResource('about', queryAboutSections, ctx);

// Fields of the SEO/analytics settings that are secrets: only admins may see them. Public responses (and the
// state embedded in server-rendered pages) never include them.
const SECRET_SEO_FIELDS = ['plausible_api_key'];
function publicSeo(seo: any) {
  if (!seo || typeof seo !== 'object') return seo;
  const copy = { ...seo };
  for (const field of SECRET_SEO_FIELDS) delete copy[field];
  return copy;
}
async function querySeoSettings() {
  // Ordered so the oldest row always wins if more than one ever exists.
  const { data, error } = await supabaseAdmin.from('seo_settings').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data || {};
}
const loadSeo = async (ctx: LoadContext, draft: boolean) => {
  const seo = draft ? await querySeoSettings() : await getPublishedResource('seo', querySeoSettings, ctx);
  return draft ? seo : publicSeo(seo);
};

async function queryContactInfo() {
  // Ordered so the oldest row always wins if more than one ever exists.
  const { data, error } = await supabaseAdmin.from('contact_information').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data || {};
}
const loadContactInfo = (ctx: LoadContext, draft: boolean) =>
  draft ? queryContactInfo() : getPublishedResource('contact_info', queryContactInfo, ctx);

async function loadResumeExperience(ctx: LoadContext, draft: boolean) {
  try {
    const exp = await loadBioResource(ctx, draft, 'resume_experience', 'resume_experience', []);
    return Array.isArray(exp) && exp.length > 0 ? exp : staticExperience;
  } catch {
    return staticExperience;
  }
}

async function loadResumeEducation(ctx: LoadContext, draft: boolean) {
  try {
    const edu = await loadBioResource(ctx, draft, 'resume_education', 'resume_education', []);
    return Array.isArray(edu) && edu.length > 0 ? edu : staticEducation;
  } catch {
    return staticEducation;
  }
}

async function querySkills() {
  const { data, error } = await supabaseAdmin.from('skills').select('*').order('order_index', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadSkills(ctx: LoadContext, draft: boolean) {
  const skills = draft ? await querySkills() : await getPublishedResource('skills', querySkills, ctx);
  return Array.isArray(skills) && skills.length > 0 ? skills : staticSkills;
}

const defaultProfile = { name: "Abdul Wahab", title: "Web Developer", bio: "I build web apps" };

function mapProfileRow(data: any) {
  if (!data) return defaultProfile;
  const parsed = safeParseJson(data.bio);
  if (!parsed) return data;
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
    updated_at: data.updated_at,
    journey_events: parsed.journey_events || null
  };
}

async function loadProfile(ctx: LoadContext, draft: boolean) {
  if (draft) return mapProfileRow(await ctx.profileRow());
  return getPublishedResource('profile', async () => mapProfileRow(await ctx.profileRow()), ctx);
}

async function loadProjects(draft: boolean) {
  const { data, error } = await supabaseAdmin.from('projects').select('*').order('order_index', { ascending: true });
  if (error) {
    throw new Error(`Supabase Error: ${error.message} (${error.code})`);
  }
  const projects = (data || []).map(deserializeProject).filter(Boolean) as any[];
  return draft ? projects : projects.filter((p: any) => p.status === 'Published');
}

async function loadProject(slug: string, draft: boolean) {
  const { data, error } = await supabaseAdmin.from('projects').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error(error.message);
  const project = deserializeProject(data);
  if (!project) return null;
  if (!draft && project.status !== 'Published') return null;
  return project;
}

async function queryCertificates() {
  const { data, error } = await supabaseAdmin.from('certificates').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadCertificates(ctx: LoadContext, draft: boolean) {
  return (draft ? await queryCertificates() : await getPublishedResource('certificates', queryCertificates, ctx)) || [];
}

async function queryApprovedTestimonials() {
  const { data, error } = await supabaseAdmin.from('testimonials').select('*').eq('is_approved', true).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadTestimonials(ctx: LoadContext, draft: boolean) {
  const testimonials = draft ? await queryApprovedTestimonials() : await getPublishedResource('testimonials', queryApprovedTestimonials, ctx);
  return (testimonials || []).filter((t: any) => t.is_approved === true);
}

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
    message = 'File is too large to upload. Please try a smaller file (max 100MB).';
  }

  res.status(status).json({ error: message });
});

// --- SERVER-SIDE RENDERING ---
// Public pages are rendered to HTML on the server (with their content prefetched from Supabase) so that
// crawlers, link previews and no-JS clients get real content. The client then hydrates that markup.

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const SSR_DATA_TIMEOUT_MS = 4000;
let viteDevServer: any = null;
let prodRendererPromise: Promise<any> | null = null;
let prodTemplate: string | null = null;

async function loadRenderer() {
  if (viteDevServer) return viteDevServer.ssrLoadModule('/src/entry-server.tsx');
  if (!prodRendererPromise) {
    prodRendererPromise = import(pathToFileURL(path.join(process.cwd(), 'dist/server/entry-server.js')).href);
    prodRendererPromise.catch(() => { prodRendererPromise = null; });
  }
  return prodRendererPromise;
}

async function loadTemplate(url: string): Promise<string> {
  if (viteDevServer) {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'app.html'), 'utf-8');
    return viteDevServer.transformIndexHtml(url, raw);
  }
  if (!prodTemplate) {
    prodTemplate = fs.readFileSync(path.join(process.cwd(), 'dist/server/template.html'), 'utf-8');
  }
  return prodTemplate;
}

function loadResource(resource: any, ctx: LoadContext): Promise<any> {
  switch (resource.type) {
    case 'profile': return loadProfile(ctx, false);
    case 'seo': return loadSeo(ctx, false);
    case 'contact_info': return loadContactInfo(ctx, false);
    case 'services': return loadServices(ctx, false);
    case 'skills': return loadSkills(ctx, false);
    case 'projects': return loadProjects(false);
    case 'certificates': return loadCertificates(ctx, false);
    case 'testimonials': return loadTestimonials(ctx, false);
    case 'about': return loadAbout(ctx, false);
    case 'resume_experience': return loadResumeExperience(ctx, false);
    case 'resume_education': return loadResumeEducation(ctx, false);
    case 'project': return loadProject(resource.slug, false);
    default: return Promise.reject(new Error(`Unknown resource ${resource.type}`));
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Loads everything a page needs. Anything that fails or is slow is skipped; the page renders its fallbacks
// for it and the client fetches it after hydration.
async function loadPageData(plan: any): Promise<Map<string, any>> {
  const ctx = createLoadContext();
  const data = new Map<string, any>();
  await Promise.all(plan.queries.map(async (entry: any) => {
    const id = entry.resource.type === 'project' ? `project:${entry.resource.slug}` : entry.resource.type;
    try {
      data.set(id, await withTimeout(loadResource(entry.resource, ctx), SSR_DATA_TIMEOUT_MS));
    } catch (err: any) {
      console.warn(`[SSR] Could not load "${id}": ${err.message}`);
    }
  }));
  return data;
}

function serializeState(state: unknown): string {
  return JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function fillTemplate(template: string, result: { html: string; head: string; state: unknown } | null): string {
  let html = template.replace('<!--app-html-->', () => result?.html ?? '');
  if (result) {
    html = html
      .replace(/<title>[\s\S]*?<\/title>/, () => result.head)
      .replace('<!--app-state-->', () => `<script>window.__REACT_QUERY_STATE__=${serializeState(result.state)}</script>`);
  } else {
    html = html.replace('<!--app-state-->', '');
  }
  return html;
}

// Public base URL (no trailing slash) for canonical links, the sitemap and robots.txt: the CMS canonical URL
// if set, then SITE_URL, then Vercel's production domain, then the host of the current request.
function resolveSiteUrl(req: express.Request, seo?: any): string {
  return normalizeSiteUrl(seo?.canonical_url) || siteUrlFromEnv(process.env) || `${req.protocol}://${req.get('host')}`;
}

async function loadPublicSeo(): Promise<any> {
  try {
    return await withTimeout(loadSeo(createLoadContext(), false), SSR_DATA_TIMEOUT_MS);
  } catch {
    return {};
  }
}

const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Lists the public pages plus every published project, straight from the CMS, so it never goes stale.
app.get('/sitemap.xml', async (req, res) => {
  const [seo, projects] = await Promise.all([
    loadPublicSeo(),
    withTimeout(loadProjects(false), SSR_DATA_TIMEOUT_MS).catch((err: any) => {
      console.warn('[sitemap] Could not load projects:', err.message);
      return [] as any[];
    }),
  ]);
  const base = resolveSiteUrl(req, seo);
  const entries: { loc: string; lastmod?: string; priority: string }[] = STATIC_ROUTES.map((route) => ({
    loc: base + (route === '/' ? '/' : route),
    priority: route === '/' ? '1.0' : route === '/projects' ? '0.9' : '0.7',
  }));
  const seen = new Set<string>();
  for (const project of projects) {
    const slug = project?.slug || project?.id;
    if (!slug || seen.has(String(slug))) continue;
    seen.add(String(slug));
    const updated = project.updated_at || project.created_at;
    const lastmod = updated && !Number.isNaN(Date.parse(updated)) ? new Date(updated).toISOString().slice(0, 10) : undefined;
    entries.push({ loc: `${base}/projects/${encodeURIComponent(String(slug))}`, lastmod, priority: '0.8' });
  }
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => `  <url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}<priority>${e.priority}</priority></url>`),
    '</urlset>',
    '',
  ].join('\n');
  res.status(200).set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' }).send(xml);
});

app.get('/robots.txt', async (req, res) => {
  const base = resolveSiteUrl(req, await loadPublicSeo());
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n');
  res.status(200).set({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' }).send(body);
});

const isAtelierFitPath = (p: string) => p === '/atelierfit' || p.startsWith('/atelierfit/');

// AtelierFit is an installable app, so its install tags go in the HTML itself rather than only after
// React mounts: iOS Safari's "Add to Home Screen" and Chrome's install check both read the first response.
// The inline script keeps Chrome's install prompt if it fires before the page's own code is ready, and the
// portfolio's first-paint skeleton is swapped for the app's plain dark background.
function atelierFitShell(template: string): string {
  const head = [
    '<meta name="description" content="Order a tailored garment, get measured by camera or by hand, and pay your deposit." />',
    '<link rel="manifest" href="/atelierfit-manifest.webmanifest" />',
    '<meta name="theme-color" content="#0B0A08" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    '<meta name="apple-mobile-web-app-title" content="AtelierFit" />',
    '<link rel="apple-touch-icon" sizes="180x180" href="/icons/atelierfit-180.png" />',
    '<script>window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__afInstallPrompt=e;});</script>',
    '<style>html,body{background:#0B0A08}#initial-skeleton{background:#0B0A08}</style>',
  ].join('\n    ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/, '<title>AtelierFit — Tailor Orders</title>')
    .replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />')
    .replace('</head>', `    ${head}\n  </head>`);
}

async function renderPage(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  // Missing static files (robots.txt, stale asset hashes, ...) get a plain 404 instead of a full page render
  if (path.extname(req.path)) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  const url = req.originalUrl;
  try {
    const [renderer, template] = await Promise.all([loadRenderer(), loadTemplate(url)]);
    const plan = renderer.getRoutePlan(req.path);

    if (plan.kind === 'client') {
      const page = isAtelierFitPath(req.path) ? atelierFitShell(template) : template;
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).send(fillTemplate(page, null));
      return;
    }

    const data = await loadPageData(plan);
    const result = renderer.render(url, plan, data, resolveSiteUrl(req, data.get('seo')));
    res.status(result.status).set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': result.status === 200 ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' : 'no-store',
    }).send(fillTemplate(template, result));
  } catch (err: any) {
    viteDevServer?.ssrFixStacktrace?.(err);
    console.error('[SSR] Render failed, falling back to client-side rendering:', err);
    try {
      const template = await loadTemplate(url);
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).send(fillTemplate(template, null));
    } catch {
      next(err);
    }
  }
}

// Registered after every API route above but before the catch-all page renderer below, so any error that
// reaches here via next(err) (most routes handle and respond to their own errors directly and never hit this,
// but it's a safety net for ones that don't) is recorded in Sentry before falling through to the HTML renderer.
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    viteDevServer = await createViteServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
    app.use(viteDevServer.middlewares);
  } else {
    // The HTML template is moved out of dist/client at build time, so every page goes through the renderer
    app.use(express.static(path.join(process.cwd(), 'dist/client'), { index: false, maxAge: '1y', immutable: true }));
  }
  app.use(renderPage);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL) {
  // On Vercel, static assets are served by the CDN and every other page request is routed to this function
  app.use(renderPage);
} else {
  startServer();
}

export default app;
