// POST /api/chat: the portfolio assistant.
//
// Flow: validate input -> rate limit (in memory, then the database quota) -> retrieve knowledge base entries ->
// call Claude with the system prompt and those entries -> stream the answer back as server-sent events.
//
// Security notes
// * ANTHROPIC_API_KEY, CHAT_DATABASE_URL and CHAT_VISITOR_SALT are read from the server environment only.
// * This router never touches the Supabase service-role client; its only database access is ./knowledge.ts,
//   which connects as the restricted chatbot_reader login.
// * The model gets no tools. Whatever a visitor types, the server only ever runs the two fixed queries.
// * Visitor IPs are never stored: the quota uses a salted hash of the IP.

import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { isKnowledgeConfigured, retrieveKnowledge, takeQuota, type KnowledgeEntry } from './knowledge.js';

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURNS = 10;
const MAX_ASSISTANT_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 2000;

const env = (key: string) => (process.env[key] || '').trim();

// Removes control characters (keeping newlines and tabs) and normalises Unicode so look-alike tricks are reduced.
export function cleanText(value: string) {
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const turnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(MAX_ASSISTANT_CHARS),
});

export const chatRequestSchema = z
  .object({
    message: z.string().min(1).max(MAX_MESSAGE_CHARS * 2),
    history: z.array(turnSchema).max(MAX_HISTORY_TURNS).default([]),
  })
  .strict();

type Turn = z.infer<typeof turnSchema>;

// Earlier turns must alternate user/assistant, starting with the visitor, so the new message is the next user turn.
function normaliseHistory(history: Turn[]): Turn[] | null {
  const cleaned = history.map((t) => ({ role: t.role, content: cleanText(t.content) }));
  for (let i = 0; i < cleaned.length; i++) {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (cleaned[i].role !== expected || !cleaned[i].content) return null;
    if (cleaned[i].role === 'user' && cleaned[i].content.length > MAX_MESSAGE_CHARS) return null;
  }
  if (cleaned.length % 2 !== 0) return null;
  return cleaned;
}

function formatKnowledge(entries: KnowledgeEntry[]) {
  const escape = (s: string) => s.replace(/[<>]/g, '');
  const body = entries
    .map((e) => `<entry category="${escape(e.category)}" title="${escape(e.title).replace(/"/g, "'")}">\n${escape(e.content)}\n</entry>`)
    .join('\n');
  return `<knowledge>\n${body || 'No entries.'}\n</knowledge>`;
}

function visitorKey(ip: string) {
  return crypto.createHash('sha256').update(`${env('CHAT_VISITOR_SALT')}|${ip}`).digest('hex');
}

// Browsers send Origin on POST. Only this site (and any origins listed in CHAT_ALLOWED_ORIGINS) may call the
// endpoint from a browser, so other websites can't embed the assistant and spend its budget.
function originAllowed(req: express.Request) {
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    if (host === req.get('host')) return true;
    const extra = env('CHAT_ALLOWED_ORIGINS').split(',').map((o) => o.trim()).filter(Boolean);
    return extra.some((o) => { try { return new URL(o).host === host; } catch { return false; } });
  } catch {
    return false;
  }
}

const LIMIT_MESSAGES: Record<string, string> = {
  visitor_minute: "You're sending messages quickly. Please wait a minute and try again.",
  visitor_day: "You've reached today's message limit for the assistant. For anything else, the contact form at /contact goes straight to Abdulwahab.",
  global_day: 'The assistant has reached its daily limit. Please use the contact form at /contact and Abdulwahab will reply personally.',
};

let anthropic: Anthropic | null = null;
function getClient() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 1, timeout: 45_000 });
  return anthropic;
}

export function chatConfigured() {
  return Boolean(env('ANTHROPIC_API_KEY') && env('CHAT_VISITOR_SALT').length >= 32 && isKnowledgeConfigured());
}

export function createChatRouter() {
  const router = express.Router();

  // First line of defence, before any database or API work: short bursts per IP (per server instance).
  const burstLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false, default: false },
    message: { error: LIMIT_MESSAGES.visitor_minute },
  });

  router.post('/', burstLimiter, express.json({ limit: '24kb' }), async (req, res) => {
    if (!originAllowed(req)) return res.status(403).json({ error: 'Not allowed.' });
    if (!chatConfigured()) return res.status(503).json({ error: 'The assistant is not available right now. Please use the contact form at /contact.' });

    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid message.' });
    const message = cleanText(parsed.data.message);
    if (!message) return res.status(400).json({ error: 'Please type a message.' });
    if (message.length > MAX_MESSAGE_CHARS) return res.status(400).json({ error: `Please keep messages under ${MAX_MESSAGE_CHARS} characters.` });
    const history = normaliseHistory(parsed.data.history);
    if (!history) return res.status(400).json({ error: 'Invalid conversation.' });

    // Retrieval uses the new message plus the previous question, so follow-ups like "how long would that take?"
    // still find the right entries.
    const previousQuestion = [...history].reverse().find((t) => t.role === 'user')?.content ?? '';

    let entries: KnowledgeEntry[];
    try {
      const quota = await takeQuota(visitorKey(req.ip || req.socket.remoteAddress || 'unknown'));
      if (quota !== 'ok') return res.status(429).json({ error: LIMIT_MESSAGES[quota] ?? LIMIT_MESSAGES.global_day });
      entries = await retrieveKnowledge(`${message} ${previousQuestion}`);
    } catch (err: any) {
      console.error('Chat knowledge error:', err?.message);
      return res.status(503).json({ error: 'The assistant is not available right now. Please use the contact form at /contact.' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const stream = getClient().messages.stream({
      model: env('CHAT_MODEL') || 'claude-opus-5-5',
      max_tokens: MAX_OUTPUT_TOKENS,
      output_config: { effort: (env('CHAT_EFFORT') || 'low') as 'low' | 'medium' | 'high' },
      system: [
        // Stable instructions first so they can be cached; the per-question knowledge follows.
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: formatKnowledge(entries) },
      ],
      messages: [...history, { role: 'user', content: message }],
    });

    let closed = false;
    res.on('close', () => {
      closed = true;
      stream.abort();
    });

    let sentText = false;
    stream.on('text', (text) => {
      if (closed) return;
      sentText = true;
      send({ type: 'delta', text });
    });

    try {
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal' && !sentText) {
        send({ type: 'delta', text: "I can't help with that one. If you have a question about Abdulwahab's work, I'm happy to help, or you can reach him through the contact form at /contact." });
      }
      send({ type: 'done' });
    } catch (err: any) {
      if (closed) return;
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
        console.error('Chat model busy:', err.status);
      } else {
        console.error('Chat model error:', err?.status ?? '', err?.message);
      }
      send({ type: 'error', message: 'Something went wrong on my side. Please try again in a moment, or use the contact form at /contact.' });
    } finally {
      if (!closed) res.end();
    }
  });

  router.all('/', (_req, res) => res.status(405).json({ error: 'Method not allowed.' }));
  return router;
}
