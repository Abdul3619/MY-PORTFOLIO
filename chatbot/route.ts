// POST /api/chat: the portfolio assistant.
//
// Flow: validate input -> rate limit (in memory, then the database quota) -> retrieve knowledge base entries ->
// call Claude with the system prompt and those entries -> stream the answer back as server-sent events.
//
// Security notes
// * ANTHROPIC_API_KEY, CHAT_DATABASE_URL and CHAT_VISITOR_SALT are read from the server environment only.
// * This router never touches the Supabase service-role client; its only database access is ./knowledge.ts,
//   which connects as the restricted chatbot_reader login.
// * The model has exactly one tool, submit_lead, which can only insert a validated, rate-limited row through
//   knowledge.ts -- never raw SQL. The second (tool-result) call always omits `tools`, so at most one tool
//   round-trip can happen per visitor turn, however the model is prompted.
// * Visitor IPs are never stored: the quota uses a salted hash of the IP.

import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { isKnowledgeConfigured, retrieveKnowledge, takeQuota, submitLead, type KnowledgeEntry, type LeadResult } from './knowledge.js';

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

// The only tool the model has. It can save a lead the visitor gave in conversation -- the server still validates
// and rate-limits everything in submitLead()/chat_submit_lead(), so a model mistake can at worst insert one row.
const SUBMIT_LEAD_TOOL: Anthropic.Tool = {
  name: 'submit_lead',
  description:
    "Passes a visitor's contact details to Abdulwahab so he can follow up, instead of only pointing them at the contact form. Only call this after the visitor has clearly given their own name and a way to reach them and wants to be contacted -- never guess, never invent a value, and never call this more than once per conversation.",
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The visitor's name, exactly as they gave it." },
      email: { type: 'string', description: "The visitor's email address, exactly as they gave it." },
      phone: { type: 'string', description: 'Optional phone number, only if the visitor gave one.' },
      message: { type: 'string', description: 'A short note on what they want, in your own words, for Abdulwahab to read.' },
    },
    required: ['name', 'email', 'message'],
  },
};

const LEAD_RESULT_TEXT: Record<LeadResult, string> = {
  ok: 'Saved. Abdulwahab will follow up soon.',
  invalid_input: "That didn't go through -- the name or email looked invalid.",
  visitor_day: "That didn't go through -- too many submissions from this visitor today. Point them to the contact form at /contact or WhatsApp instead.",
  global_day: "That didn't go through -- the daily limit for this was reached. Point them to the contact form at /contact or WhatsApp instead.",
};

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

    const model = env('CHAT_MODEL') || 'claude-sonnet-5';
    // Claude Haiku 4.5 doesn't take the effort setting (newer Sonnet/Opus models do), so only send it to those
    const supportsEffort = !/^claude-(haiku-4|sonnet-4-5|sonnet-4-0|opus-4-[01])/.test(model);
    const system = [
      // Stable instructions first so they can be cached; the per-question knowledge follows.
      { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: formatKnowledge(entries) },
    ];
    const baseParams = {
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      ...(supportsEffort ? { output_config: { effort: (env('CHAT_EFFORT') || 'low') as 'low' | 'medium' | 'high' } } : {}),
      system,
    };

    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    const visitorKeyValue = visitorKey(req.ip || req.socket.remoteAddress || 'unknown');
    let leadCalled = false;

    try {
      const conversation: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }];

      // First call: the model may answer directly, or ask to call submit_lead. Either way its text streams live.
      const first = getClient().messages.stream({ ...baseParams, tools: [SUBMIT_LEAD_TOOL], messages: conversation });
      res.once('close', () => { closed = true; first.abort(); });
      let sentText = false;
      first.on('text', (text) => {
        if (closed) return;
        sentText = true;
        send({ type: 'delta', text });
      });
      const firstFinal = await first.finalMessage();

      if (firstFinal.stop_reason === 'refusal' && !sentText) {
        send({ type: 'delta', text: "I can't help with that one. If you have a question about Abdulwahab's work, I'm happy to help, or you can reach him through the contact form at /contact." });
      }

      const toolUse = firstFinal.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_lead');
      if (toolUse && !leadCalled && !closed) {
        leadCalled = true;
        const input = (toolUse.input ?? {}) as { name?: unknown; email?: unknown; phone?: unknown; message?: unknown };
        let result: LeadResult;
        try {
          const name = typeof input.name === 'string' ? input.name : '';
          const email = typeof input.email === 'string' ? input.email : '';
          const phone = typeof input.phone === 'string' ? input.phone : undefined;
          const note = typeof input.message === 'string' ? input.message : '';
          result = await submitLead(visitorKeyValue, name, email, note, phone);
        } catch (err: any) {
          console.error('Lead submit error:', err?.message);
          result = 'global_day';
        }

        // Second call continues the same conversation with the tool result, but with no tools, so the model can
        // only reply in text -- this guarantees at most one tool round-trip per visitor turn.
        conversation.push({ role: 'assistant', content: firstFinal.content });
        conversation.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: LEAD_RESULT_TEXT[result] }],
        });
        const second = getClient().messages.stream({ ...baseParams, messages: conversation });
        res.once('close', () => { closed = true; second.abort(); });
        second.on('text', (text) => {
          if (closed) return;
          sentText = true;
          send({ type: 'delta', text });
        });
        await second.finalMessage();
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
