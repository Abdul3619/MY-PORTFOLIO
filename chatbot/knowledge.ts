// Database access for the portfolio assistant.
//
// This module connects as the restricted `chatbot_reader` login (CHAT_DATABASE_URL), never with the Supabase
// service-role key. That login can SELECT published rows of public.public_knowledge_base, SELECT
// public.chat_live_projects (a view over already-public, published projects), and EXECUTE
// private.chat_take_quota and private.chat_submit_lead, and nothing else, so no visitor message can reach
// private tables through it. The model never writes SQL: the queries below are fixed, and visitor text only
// reaches them as bound parameters (reduced to plain [a-z0-9] search words for the knowledge-base lookup, or
// validated and length-capped server-side for a lead).

import pg from 'pg';
import { SUPABASE_ROOT_CA } from './supabaseCa.js';

export interface KnowledgeEntry {
  category: string;
  title: string;
  content: string;
}

export interface ProjectEntry {
  slug: string;
  title: string;
  description: string;
  longDescription: string | null;
  techStack: string[];
  tags: string[];
  liveUrl: string | null;
  hasDashboard: boolean;
}

export type QuotaResult = 'ok' | 'visitor_minute' | 'visitor_day' | 'global_day';

const MAX_TERMS = 12;
const MAX_ENTRIES = 8;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = (process.env.CHAT_DATABASE_URL || '').trim();
  if (!connectionString) throw new Error('CHAT_DATABASE_URL is not set');
  const url = new URL(connectionString);
  // Refuse to start if the URL was accidentally given a privileged login
  const user = decodeURIComponent(url.username).split('.')[0];
  if (user !== 'chatbot_reader') throw new Error('CHAT_DATABASE_URL must use the chatbot_reader login');
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  pool = new pg.Pool({
    host: url.hostname,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    // Supabase's pooler presents a certificate signed by Supabase's own root CA, so verify against it
    ssl: local ? undefined : { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (err) => console.error('Chat DB pool error:', err.message));
  return pool;
}

export function isKnowledgeConfigured() {
  return Boolean((process.env.CHAT_DATABASE_URL || '').trim());
}

// Turns visitor text into a safe full-text query: lowercase words of letters and digits only, each matched as a
// prefix and joined with OR. Nothing else (quotes, operators, punctuation) can get through.
export function toSearchQuery(text: string): string {
  const words = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && w.length <= 30);
  const unique = [...new Set(words)].slice(0, MAX_TERMS);
  return unique.map((w) => `${w}:*`).join(' | ');
}

// Core entries (always_include) plus the best full-text matches for the question.
export async function retrieveKnowledge(question: string): Promise<KnowledgeEntry[]> {
  const query = toSearchQuery(question);
  const { rows } = await getPool().query<KnowledgeEntry>(
    `with q as (select case when $1::text = '' then null else to_tsquery('english', $1::text) end as tsq)
     select k.category, k.title, k.content
       from public.public_knowledge_base k, q
      where k.is_published
        and (k.always_include or (q.tsq is not null and k.search @@ q.tsq))
      order by k.always_include desc, ts_rank_cd(k.search, q.tsq) desc nulls last, k.sort_order
      limit $2`,
    [query, MAX_ENTRIES],
  );
  return rows;
}

const MAX_PROJECTS = 30;

// The full, always-current list of published projects -- the same ones visible on /projects -- so a project
// added through the admin dashboard is known to the assistant the moment it's published, with no separate
// knowledge-base entry to write by hand. Small table, no per-question filtering needed: every request gets the
// whole list, and the model picks out what's relevant.
export async function retrieveProjects(): Promise<ProjectEntry[]> {
  const { rows } = await getPool().query<{
    slug: string;
    title: string;
    description: string;
    long_description: string | null;
    tech_stack: unknown;
    tags: unknown;
    live_url: string | null;
    has_dashboard: boolean | null;
  }>(`select slug, title, description, long_description, tech_stack, tags, live_url, has_dashboard from public.chat_live_projects limit $1`, [
    MAX_PROJECTS,
  ]);
  const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    longDescription: r.long_description,
    techStack: toStringArray(r.tech_stack),
    tags: toStringArray(r.tags),
    liveUrl: r.live_url,
    hasDashboard: Boolean(r.has_dashboard),
  }));
}

// Counts one message against the per-visitor and site-wide limits. `visitorKey` is a salted SHA-256 hex digest.
export async function takeQuota(visitorKey: string): Promise<QuotaResult> {
  const { rows } = await getPool().query<{ result: QuotaResult }>('select private.chat_take_quota($1) as result', [visitorKey]);
  return rows[0]?.result ?? 'global_day';
}

export type LeadResult = 'ok' | 'invalid_input' | 'visitor_day' | 'global_day';

// Saves a lead the model collected in conversation. The server never decides to call this -- the model only
// reaches it through the submit_lead tool, after the visitor has clearly given their details and agreed to be
// contacted (see the tool's description and the system prompt). The function itself still validates and rate
// limits everything server-side, so a model mistake or a prompt injection can at worst insert one junk row,
// never anything more. Email and phone are each optional, but at least one must resolve to something valid --
// a visitor may prefer to leave a phone/WhatsApp number instead of an email, especially outside regions where
// WhatsApp is less common.
export async function submitLead(visitorKey: string, name: string, email: string | undefined, message: string, phone?: string): Promise<LeadResult> {
  const { rows } = await getPool().query<{ result: LeadResult }>(
    'select private.chat_submit_lead($1, $2, $3, $4, $5) as result',
    [visitorKey, name, email || null, message, phone || null],
  );
  return rows[0]?.result ?? 'global_day';
}
