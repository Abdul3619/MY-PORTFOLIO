// POST /api/chat: the portfolio assistant.
//
// Flow: validate input -> rate limit (in memory, then the database quota) -> retrieve knowledge base entries ->
// call Claude with the system prompt and those entries -> stream the answer back as server-sent events.
//
// Security notes
// * ANTHROPIC_API_KEY, CHAT_DATABASE_URL and CHAT_VISITOR_SALT are read from the server environment only.
// * This router never touches the Supabase service-role client; its only database access is ./knowledge.ts,
//   which connects as the restricted chatbot_reader login.
// * The model has submit_lead always, plus check_availability/book_call when Cal.com is configured. Each can only
//   call its own narrow, validated, rate-limited function (knowledge.ts or calcom.ts) -- never raw SQL or an
//   unvalidated external request. The second (tool-result) call always omits `tools`, so at most one tool
//   round-trip can happen per visitor turn, however the model is prompted.
// * Visitor IPs are never stored: the quota uses a salted hash of the IP.

import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { z } from 'zod';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import {
  isKnowledgeConfigured,
  retrieveKnowledge,
  retrieveProjects,
  takeQuota,
  submitLead,
  takeBookingQuota,
  createDashboardLink,
  type KnowledgeEntry,
  type ProjectEntry,
  type LeadResult,
  type LeadPriority,
} from './knowledge.js';
import { calComConfigured, getAvailableSlots, createBooking } from './calcom.js';

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

// The live, always-current project list (see knowledge.ts/retrieveProjects). This is the one place the model
// should trust for "is this actually live" and "what's its link" -- the hand-written <knowledge> entries add
// narrative detail, but a project only here, with no entry here, isn't something to present as a working demo.
function formatProjects(projects: ProjectEntry[]) {
  const escape = (s: string) => s.replace(/[<>]/g, '');
  const body = projects
    .map((p) => {
      const stack = [...p.techStack, ...p.tags].filter(Boolean).join(', ');
      const lines = [
        `<project slug="${escape(p.slug)}" title="${escape(p.title).replace(/"/g, "'")}" hasDashboard="${p.hasDashboard ? 'true' : 'false'}">`,
        escape(p.description),
        p.longDescription ? escape(p.longDescription) : '',
        stack ? `Tech/tags: ${escape(stack)}` : '',
        p.liveUrl ? `Live demo: ${escape(p.liveUrl)}` : 'No live demo link.',
        p.hasDashboard
          ? 'This project has an admin/booking dashboard that is deliberately not linked from its own page -- only offer it here in conversation, with its live demo link as a button.'
          : '',
        `Project page: /projects/${escape(p.slug)}`,
        '</project>',
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n');
  return `<projects>\n${body || 'No published projects.'}\n</projects>`;
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

let gemini: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!gemini) gemini = new GoogleGenAI({ apiKey: env('GEMINI_API_KEY') });
  return gemini;
}

// Google's free-tier models occasionally return a transient 503 ("model is currently experiencing high demand")
// that typically clears within a second or two. Anthropic's SDK already retries transient errors itself
// (see getClient()'s maxRetries), but the Gemini SDK doesn't, so this gives the Gemini path the same one-retry
// grace before it gives up and tells the visitor to try again.
//
// 429/RESOURCE_EXHAUSTED counts as "overloaded" too -- that's Google's free-tier *rate limit* kicking in (a low
// requests-per-minute ceiling, separate from the daily quota), which a live voice conversation hits far more
// easily than typed chat since every turn is its own request. Treating it the same as a 503 means: one short
// retry here, and (in runGeminiTurn's candidate loop) a chance to fall through to the next fallback model rather
// than hard-failing the visitor's turn.
function isProviderOverloaded(err: any): boolean {
  const status = err?.status ?? err?.error?.code;
  const message = String(err?.message ?? err?.error?.message ?? '');
  return (
    status === 503 ||
    status === 429 ||
    String(status) === '429' ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    /\bUNAVAILABLE\b|\bRESOURCE_EXHAUSTED\b|overloaded|high demand|quota|rate limit/i.test(message)
  );
}

async function withOverloadRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isProviderOverloaded(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 900));
    return fn();
  }
}

// Which model actually answers the chat. Anthropic is preferred (it's what the system prompt and tone were tuned
// against); Gemini is a free-tier fallback for whenever ANTHROPIC_API_KEY isn't set (e.g. no budget for it yet)
// -- same system prompt, same knowledge, same submit_lead tool, just a different model underneath. The moment an
// Anthropic key is added, this switches back over on its own, no code or config change needed beyond that.
type ChatProvider = 'anthropic' | 'gemini';
function activeProvider(): ChatProvider | null {
  if (env('ANTHROPIC_API_KEY')) return 'anthropic';
  if (env('GEMINI_API_KEY')) return 'gemini';
  return null;
}

// The only tool the model has. It can save a lead the visitor gave in conversation -- the server still validates
// and rate-limits everything in submitLead()/chat_submit_lead(), so a model mistake can at worst insert one row.
const SUBMIT_LEAD_DESCRIPTION =
  "Passes a visitor's contact details to Abdulwahab so he can follow up, instead of only pointing them at the contact form. Only call this after the visitor has clearly given their own name, at least one way to reach them (email, or a phone/WhatsApp number), and wants to be contacted -- never guess, never invent a value, and never call this more than once per conversation. A visitor can give either contact method, whichever they actually use; don't insist on email specifically.";

const PRIORITY_DESCRIPTION =
  "Your own read of how urgent this lead is, based only on what they actually said in this conversation -- never guess beyond it. 'hot': they mentioned a real deadline or urgency (\"need this live next week\", \"asap\"), a concrete budget or willingness to pay, or said they're ready to start/hire now. 'cold': they're clearly just browsing, comparing options with no timeline, or said it's for \"someday\"/\"just curious\". 'warm': anything in between, or if it's genuinely unclear -- warm is always the safe default, never invent urgency or budget signals that weren't actually said.";

const SUBMIT_LEAD_TOOL: Anthropic.Tool = {
  name: 'submit_lead',
  description: SUBMIT_LEAD_DESCRIPTION,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The visitor's name, exactly as they gave it." },
      email: { type: 'string', description: "The visitor's email address, if they gave one." },
      phone: { type: 'string', description: 'A phone or WhatsApp number, if they gave one, in whatever format they typed it.' },
      message: { type: 'string', description: 'A short note on what they want, in your own words, for Abdulwahab to read.' },
      priority: { type: 'string', enum: ['hot', 'warm', 'cold'], description: PRIORITY_DESCRIPTION },
    },
    required: ['name', 'message'],
  },
};

const SUBMIT_LEAD_FUNCTION_DECLARATION: FunctionDeclaration = {
  name: 'submit_lead',
  description: SUBMIT_LEAD_DESCRIPTION,
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The visitor's name, exactly as they gave it." },
      email: { type: Type.STRING, description: "The visitor's email address, if they gave one." },
      phone: { type: Type.STRING, description: 'A phone or WhatsApp number, if they gave one, in whatever format they typed it.' },
      message: { type: Type.STRING, description: 'A short note on what they want, in your own words, for Abdulwahab to read.' },
      priority: { type: Type.STRING, enum: ['hot', 'warm', 'cold'], description: PRIORITY_DESCRIPTION },
    },
    required: ['name', 'message'],
  },
};

function toLeadPriority(value: unknown): LeadPriority {
  return value === 'hot' || value === 'cold' ? value : 'warm';
}

const LEAD_RESULT_TEXT: Record<LeadResult, string> = {
  ok: 'Saved. Abdulwahab will follow up soon.',
  invalid_input: "That didn't go through -- the name looked empty, or the email/phone didn't look valid. Ask the visitor to double-check it.",
  visitor_day: "That didn't go through -- too many submissions from this visitor today. Point them to the contact form at /contact or WhatsApp instead.",
  global_day: "That didn't go through -- the daily limit for this was reached. Point them to the contact form at /contact or WhatsApp instead.",
};

// Runs the submit_lead tool call the same way regardless of which model asked for it, so both providers get
// identical validation/rate-limiting behaviour.
async function runSubmitLead(
  visitorKeyValue: string,
  input: { name?: unknown; email?: unknown; phone?: unknown; message?: unknown; priority?: unknown },
): Promise<LeadResult> {
  try {
    const name = typeof input.name === 'string' ? input.name : '';
    const email = typeof input.email === 'string' ? input.email : undefined;
    const phone = typeof input.phone === 'string' ? input.phone : undefined;
    const note = typeof input.message === 'string' ? input.message : '';
    const priority = toLeadPriority(input.priority);
    return await submitLead(visitorKeyValue, name, email, note, phone, priority);
  } catch (err: any) {
    console.error('Lead submit error:', err?.message);
    return 'global_day';
  }
}

// Lets the model look up Abdulwahab's real open slots for a 15-minute call, then book one directly once the
// visitor has picked a time and given their name and email. Both tools only appear when Cal.com is configured
// (see calComConfigured()), so a deployment without a Cal.com key behaves exactly as before.
const CHECK_AVAILABILITY_DESCRIPTION =
  "Looks up Abdulwahab's real open slots for a 15-minute call over the next week. Call this when a visitor wants to book a call or a quick chat with him, before offering any specific time -- never invent or guess a time yourself. Takes no input. The result is a short list of open slots in his own timezone (Africa/Lagos) for you to read out to the visitor exactly as given, so they can pick one.";

const BOOK_CALL_DESCRIPTION =
  "Books a real 15-minute call on Abdulwahab's calendar at one specific slot. Only call this after you've shown the visitor real slots from check_availability, they've clearly picked one of those exact times, and they've given their name and an email address for the calendar invite -- never invent a name, email or time, and never call this without having called check_availability first in this conversation. Use this for an ordinary, non-urgent booking request; if the visitor describes something urgent or time-sensitive that can't wait for the call, use submit_lead instead (or point to the WhatsApp link in <knowledge> for a true emergency), since this only books a slot, it doesn't notify Abdulwahab immediately.";

const CHECK_AVAILABILITY_TOOL: Anthropic.Tool = {
  name: 'check_availability',
  description: CHECK_AVAILABILITY_DESCRIPTION,
  input_schema: { type: 'object', properties: {} },
};

const BOOK_CALL_TOOL: Anthropic.Tool = {
  name: 'book_call',
  description: BOOK_CALL_DESCRIPTION,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: "The visitor's name, exactly as they gave it." },
      email: { type: 'string', description: 'The email address for the calendar invite.' },
      startIso: { type: 'string', description: 'The exact ISO timestamp of the slot they picked, copied exactly from a check_availability result.' },
      note: { type: 'string', description: 'A short note on what they want to discuss, if they said anything about it.' },
    },
    required: ['name', 'email', 'startIso'],
  },
};

const CHECK_AVAILABILITY_FUNCTION_DECLARATION: FunctionDeclaration = {
  name: 'check_availability',
  description: CHECK_AVAILABILITY_DESCRIPTION,
  parameters: { type: Type.OBJECT, properties: {} },
};

const BOOK_CALL_FUNCTION_DECLARATION: FunctionDeclaration = {
  name: 'book_call',
  description: BOOK_CALL_DESCRIPTION,
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The visitor's name, exactly as they gave it." },
      email: { type: Type.STRING, description: 'The email address for the calendar invite.' },
      startIso: { type: Type.STRING, description: 'The exact ISO timestamp of the slot they picked, copied exactly from a check_availability result.' },
      note: { type: Type.STRING, description: 'A short note on what they want to discuss, if they said anything about it.' },
    },
    required: ['name', 'email', 'startIso'],
  },
};

// Mints a one-time login link straight into a project's real admin dashboard. Only meaningful for a project
// marked hasDashboard="true" in <projects> -- see systemPrompt.ts for when the model should call this.
const GET_DASHBOARD_ACCESS_DESCRIPTION =
  'Mints a one-time login link into a project\'s real admin dashboard. Only call this for a project marked hasDashboard="true" in <projects>, and only when you\'re offering the dashboard or the visitor asked to see it -- the dashboard is deliberately not reachable any other way. The link signs the visitor straight in, is single-use, and expires after 10 minutes, so mint a fresh one each time rather than reusing one from earlier in the conversation, even for the same project.';

const GET_DASHBOARD_ACCESS_TOOL: Anthropic.Tool = {
  name: 'get_dashboard_access',
  description: GET_DASHBOARD_ACCESS_DESCRIPTION,
  input_schema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'The exact slug of the project, copied from its <project slug="..."> attribute.' },
    },
    required: ['slug'],
  },
};

const GET_DASHBOARD_ACCESS_FUNCTION_DECLARATION: FunctionDeclaration = {
  name: 'get_dashboard_access',
  description: GET_DASHBOARD_ACCESS_DESCRIPTION,
  parameters: {
    type: Type.OBJECT,
    properties: {
      slug: { type: Type.STRING, description: 'The exact slug of the project, copied from its <project slug="..."> attribute.' },
    },
    required: ['slug'],
  },
};

const DASHBOARD_LINK_RESULT_TEXT: Record<string, string> = {
  not_found: "That didn't go through -- the dashboard login couldn't be found. Offer the project's live demo link instead.",
  not_supported: "This project doesn't have a dashboard login wired up yet. Offer its live demo link instead, and don't mention a dashboard for it.",
  unknown: "Couldn't open the dashboard right now. Offer the project's live demo link instead.",
  error: "Couldn't reach the dashboard right now. Offer the project's live demo link instead.",
};

async function runGetDashboardAccess(input: { slug?: unknown }): Promise<string> {
  const slug = typeof input.slug === 'string' ? input.slug : '';
  const result = await createDashboardLink(slug);
  if (!result.ok) {
    return DASHBOARD_LINK_RESULT_TEXT[(result as { error: string }).error] ?? DASHBOARD_LINK_RESULT_TEXT.unknown;
  }
  return `Here is a one-time dashboard login link, valid for the next 10 minutes and usable once: ${result.url}\nGive this to the visitor exactly as given so it becomes a button, and mention it's a one-time link just for them.`;
}

const TOOL_NAMES = ['submit_lead', 'check_availability', 'book_call', 'get_dashboard_access'] as const;
type ToolName = (typeof TOOL_NAMES)[number];
function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

function anthropicTools(): Anthropic.Tool[] {
  const tools = [SUBMIT_LEAD_TOOL, GET_DASHBOARD_ACCESS_TOOL];
  return calComConfigured() ? [...tools, CHECK_AVAILABILITY_TOOL, BOOK_CALL_TOOL] : tools;
}

function geminiFunctionDeclarations(): FunctionDeclaration[] {
  const tools = [SUBMIT_LEAD_FUNCTION_DECLARATION, GET_DASHBOARD_ACCESS_FUNCTION_DECLARATION];
  return calComConfigured() ? [...tools, CHECK_AVAILABILITY_FUNCTION_DECLARATION, BOOK_CALL_FUNCTION_DECLARATION] : tools;
}

// Plain-string-typed tool declarations for the browser to drop straight into the Live API's own setup message
// (see createVoiceLiveRouter below). Deliberately NOT the @google/genai FunctionDeclaration objects above: those
// use the SDK's own `Type` enum for the "type" field, and whether that enum's members serialize over plain JSON
// (res.json -> fetch -> JSON.stringify in the setup message) as the proto's expected string names ("OBJECT",
// "STRING") or as numbers isn't something to assume either way -- every other enum-like field the raw Live
// protocol expects (e.g. "START_SENSITIVITY_HIGH") is the literal proto string, so these are written out as
// plain strings by hand rather than trusting a value that only needs to round-trip correctly through the SDK's
// own request-building code today, for a completely different call path (generateContentStream).
const VOICE_TOOL_DECLARATIONS: Array<{ name: string; description: string; parameters: unknown }> = [
  {
    name: 'submit_lead',
    description: SUBMIT_LEAD_DESCRIPTION,
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: "The visitor's name, exactly as they gave it." },
        email: { type: 'STRING', description: "The visitor's email address, if they gave one." },
        phone: { type: 'STRING', description: 'A phone or WhatsApp number, if they gave one, in whatever format they said it.' },
        message: { type: 'STRING', description: 'A short note on what they want, in your own words, for Abdulwahab to read.' },
        priority: { type: 'STRING', enum: ['hot', 'warm', 'cold'], description: PRIORITY_DESCRIPTION },
      },
      required: ['name', 'message'],
    },
  },
  {
    name: 'get_dashboard_access',
    description: GET_DASHBOARD_ACCESS_DESCRIPTION,
    parameters: {
      type: 'OBJECT',
      properties: { slug: { type: 'STRING', description: 'The exact slug of the project, copied from its <project slug="..."> attribute.' } },
      required: ['slug'],
    },
  },
  {
    name: 'check_availability',
    description: CHECK_AVAILABILITY_DESCRIPTION,
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'book_call',
    description: BOOK_CALL_DESCRIPTION,
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: "The visitor's name, exactly as they gave it." },
        email: { type: 'STRING', description: 'The email address for the calendar invite.' },
        startIso: { type: 'STRING', description: 'The exact ISO timestamp of the slot they picked, copied exactly from a check_availability result.' },
        note: { type: 'STRING', description: 'A short note on what they want to discuss, if they said anything about it.' },
      },
      required: ['name', 'email', 'startIso'],
    },
  },
];

// Voice-only, client-handled -- never routed through /voice/tool or runTool, because it never touches the
// database or Cal.com. The browser answers it immediately and locally (see VoiceCallOverlay.tsx's onToolCall):
// this exists purely so a link becomes a tappable card on screen instead of the model reading a URL out loud,
// which is unreadable/unusable as speech and was the whole problem this tool fixes.
const SHOW_LINK_DESCRIPTION =
  'Shows a tappable link card on the visitor\'s screen -- for any project link, live project URL, dashboard link (from get_dashboard_access), or site path (e.g. /projects/<slug>, /contact) you want to hand them. ALWAYS call this instead of saying a URL out loud -- never read a link, "slash", or "dot" as speech. After calling it, just say something natural like "I\'ve put that on your screen" or describe what they\'ll see there, without repeating the address.';

const SHOW_LINK_DECLARATION: { name: string; description: string; parameters: unknown } = {
  name: 'show_link',
  description: SHOW_LINK_DESCRIPTION,
  parameters: {
    type: 'OBJECT',
    properties: {
      url: { type: 'STRING', description: 'The exact URL or site path to open, copied exactly from <projects>/<knowledge> or a get_dashboard_access result -- never invented or guessed.' },
      label: { type: 'STRING', description: 'Short button text, e.g. the project\'s title or "Open dashboard". A few words, never the raw URL.' },
    },
    required: ['url', 'label'],
  },
};

function voiceToolDeclarations() {
  const tools = [VOICE_TOOL_DECLARATIONS[0], VOICE_TOOL_DECLARATIONS[1], SHOW_LINK_DECLARATION];
  return calComConfigured() ? [...tools, VOICE_TOOL_DECLARATIONS[2], VOICE_TOOL_DECLARATIONS[3]] : tools;
}

async function runCheckAvailability(): Promise<string> {
  try {
    const slots = await getAvailableSlots();
    if (slots.length === 0) return 'No open slots found in the next week. Suggest the contact form or WhatsApp instead.';
    return `Open slots (Africa/Lagos time) -- read these out to the visitor exactly, including the ISO timestamp if you call book_call next:\n${slots
      .map((s) => `- ${s.label} | startIso: ${s.startIso}`)
      .join('\n')}`;
  } catch (err: any) {
    console.error('Cal.com availability error:', err?.message);
    return "Couldn't reach the booking calendar right now. Use submit_lead or point them to the contact form/WhatsApp instead.";
  }
}

const BOOK_CALL_RESULT_TEXT: Record<'ok' | 'slot_unavailable' | 'invalid_input' | 'error' | 'visitor_day' | 'global_day', string> = {
  ok: 'Booked. Tell the visitor their call is confirmed and a calendar invite is on its way to their email.',
  slot_unavailable: "That slot isn't available anymore -- call check_availability again for a fresh list and ask them to pick another.",
  invalid_input: "That didn't go through -- the name, email or time looked invalid. Ask the visitor to double-check it.",
  error: "Couldn't reach the booking calendar right now. Use submit_lead instead so Abdulwahab can follow up and confirm manually.",
  visitor_day: "This visitor has already booked a call today. Point them to the contact form or WhatsApp for anything more urgent.",
  global_day: "Today's booking limit has been reached. Use submit_lead instead so Abdulwahab can follow up and confirm manually.",
};

async function runBookCall(
  visitorKeyValue: string,
  input: { name?: unknown; email?: unknown; startIso?: unknown; note?: unknown },
): Promise<string> {
  try {
    const quota = await takeBookingQuota(visitorKeyValue);
    if (quota !== 'ok') return BOOK_CALL_RESULT_TEXT[quota];
    const name = typeof input.name === 'string' ? input.name : '';
    const email = typeof input.email === 'string' ? input.email : '';
    const startIso = typeof input.startIso === 'string' ? input.startIso : '';
    const note = typeof input.note === 'string' ? input.note : undefined;
    const result = await createBooking({ name, email, startIso, note });
    return BOOK_CALL_RESULT_TEXT[result];
  } catch (err: any) {
    console.error('Cal.com booking error:', err?.message);
    return BOOK_CALL_RESULT_TEXT.error;
  }
}

// Shared dispatch for whichever tool the model asked for, so both providers get identical behaviour. Returns the
// text to feed back to the model as the tool result.
async function runTool(name: ToolName, visitorKeyValue: string, input: Record<string, unknown>): Promise<string> {
  if (name === 'check_availability') return runCheckAvailability();
  if (name === 'book_call') return runBookCall(visitorKeyValue, input);
  if (name === 'get_dashboard_access') return runGetDashboardAccess(input);
  const result = await runSubmitLead(visitorKeyValue, input);
  return LEAD_RESULT_TEXT[result];
}

export function chatConfigured() {
  return Boolean(activeProvider() && env('CHAT_VISITOR_SALT').length >= 32 && isKnowledgeConfigured());
}

const REFUSAL_TEXT =
  "I can't help with that one. If you have a question about Abdulwahab's work, I'm happy to help, or you can reach him through the contact form at /contact.";

interface TurnArgs {
  entries: KnowledgeEntry[];
  projects: ProjectEntry[];
  history: Turn[];
  message: string;
  visitorKeyValue: string;
  send: (data: Record<string, unknown>) => void;
  isClosed: () => boolean;
  res: express.Response;
}

async function runAnthropicTurn({ entries, projects, history, message, visitorKeyValue, send, isClosed, res }: TurnArgs) {
  const configuredModel = env('CHAT_MODEL');
  const model = configuredModel && !configuredModel.startsWith('gemini') ? configuredModel : 'claude-sonnet-5';
  // Claude Haiku 4.5 doesn't take the effort setting (newer Sonnet/Opus models do), so only send it to those
  const supportsEffort = !/^claude-(haiku-4|sonnet-4-5|sonnet-4-0|opus-4-[01])/.test(model);
  const system = [
    // Stable instructions first so they can be cached; the per-question knowledge follows.
    { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
    { type: 'text' as const, text: formatKnowledge(entries) },
    { type: 'text' as const, text: formatProjects(projects) },
  ];
  const baseParams = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    ...(supportsEffort ? { output_config: { effort: (env('CHAT_EFFORT') || 'low') as 'low' | 'medium' | 'high' } } : {}),
    system,
  };

  const conversation: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }];

  // First call: the model may answer directly, or ask to call one of its tools. Either way its text streams live.
  const first = getClient().messages.stream({ ...baseParams, tools: anthropicTools(), messages: conversation });
  res.once('close', () => first.abort());
  let sentText = false;
  first.on('text', (text) => {
    if (isClosed()) return;
    sentText = true;
    send({ type: 'delta', text });
  });
  const firstFinal = await first.finalMessage();

  if (firstFinal.stop_reason === 'refusal' && !sentText) {
    send({ type: 'delta', text: REFUSAL_TEXT });
  }

  const toolUse = firstFinal.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && isToolName(b.name));
  if (toolUse && !isClosed()) {
    const resultText = await runTool(toolUse.name as ToolName, visitorKeyValue, (toolUse.input ?? {}) as Record<string, unknown>);

    // Second call continues the same conversation with the tool result, but with no tools, so the model can
    // only reply in text -- this guarantees at most one tool round-trip per visitor turn.
    conversation.push({ role: 'assistant', content: firstFinal.content });
    conversation.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: resultText }],
    });
    const second = getClient().messages.stream({ ...baseParams, messages: conversation });
    res.once('close', () => second.abort());
    second.on('text', (text) => {
      if (isClosed()) return;
      send({ type: 'delta', text });
    });
    await second.finalMessage();
  }
}

// Same conversation, same system prompt, same submit_lead tool -- backed by Gemini's free tier instead of
// Anthropic. Used only when ANTHROPIC_API_KEY isn't set (see activeProvider()). Gemini's JS SDK doesn't expose a
// stream-abort handle the way Anthropic's does, so on a client disconnect this just stops forwarding further
// chunks (isClosed() checks below) rather than cancelling the underlying request -- an acceptable gap for a
// fallback path.
// Google keeps changing which model names are actually live for a given account (a model can be retired for new
// accounts, or an alias like "-latest" can jump onto a brand-new, capacity-constrained preview release) with no
// warning the code can detect ahead of time. Rather than hardcode one model and go dark the next time Google
// reshuffles, this tries an explicitly-configured model first (if CHAT_MODEL is set), then a short list of other
// current, stable, non-preview models, moving to the next only when a model is rejected outright (retired/unknown)
// or is itself overloaded -- never mid-stream, since by then text may already be on its way to the visitor.
const GEMINI_FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

function isModelUnavailable(err: any): boolean {
  const status = err?.status ?? err?.error?.code;
  const message = String(err?.message ?? err?.error?.message ?? '');
  return status === 404 || /is no longer available|not found|not supported/i.test(message);
}

// Gemini's "thinking" models (2.5 and 3.x) spend part of the response budget reasoning silently before the first
// visible token comes out -- fine for a hard question, but it's most of why the chat (and especially the voice
// call, where every extra second of silence is felt directly) was slow to start replying to something as simple
// as a greeting. Each family configures it differently (3.x: a thinkingLevel string; 2.5: a numeric token budget,
// 0 disables it outright); 2.0 and earlier don't think at all, so there's nothing to configure.
function thinkingConfigFor(modelName: string): Record<string, unknown> | undefined {
  if (modelName.startsWith('gemini-3')) return { thinkingLevel: 'low' };
  if (modelName.startsWith('gemini-2.5')) return { thinkingBudget: 0 };
  return undefined;
}

async function runGeminiTurn({ entries, projects, history, message, visitorKeyValue, send, isClosed }: TurnArgs) {
  const configuredModel = env('CHAT_MODEL');
  const candidates = [
    ...(configuredModel && configuredModel.startsWith('gemini') ? [configuredModel] : []),
    ...GEMINI_FALLBACK_MODELS,
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const systemInstruction = [SYSTEM_PROMPT, formatKnowledge(entries), formatProjects(projects)].join('\n\n');

  const toGeminiRole = (role: 'user' | 'assistant') => (role === 'assistant' ? ('model' as const) : ('user' as const));
  const contents = [
    ...history.map((t) => ({ role: toGeminiRole(t.role), parts: [{ text: t.content }] })),
    { role: 'user' as const, parts: [{ text: message }] },
  ];

  const client = getGeminiClient();
  let model = candidates[0];
  let stream: Awaited<ReturnType<typeof client.models.generateContentStream>> | undefined;
  let lastErr: any;
  for (const candidate of candidates) {
    try {
      stream = await withOverloadRetry(() =>
        client.models.generateContentStream({
          model: candidate,
          contents,
          config: {
            systemInstruction,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            tools: [{ functionDeclarations: geminiFunctionDeclarations() }],
            ...(thinkingConfigFor(candidate) ? { thinkingConfig: thinkingConfigFor(candidate) } : {}),
          },
        }),
      );
      model = candidate;
      break;
    } catch (err: any) {
      lastErr = err;
      if (isModelUnavailable(err) || isProviderOverloaded(err)) continue; // try the next candidate
      throw err; // some other error (bad key, etc.) -- no point trying more models
    }
  }
  if (!stream) throw lastErr;

  let sentText = false;
  let functionCall: { name: ToolName; args: Record<string, unknown> } | undefined;
  for await (const chunk of stream) {
    if (isClosed()) break;
    if (chunk.text) {
      sentText = true;
      send({ type: 'delta', text: chunk.text });
    }
    const calls = chunk.functionCalls;
    if (calls && calls.length > 0 && isToolName(calls[0].name ?? '') && !functionCall) {
      functionCall = { name: calls[0].name as ToolName, args: (calls[0].args ?? {}) as Record<string, unknown> };
    }
  }

  if (!sentText && !functionCall && !isClosed()) {
    send({ type: 'delta', text: REFUSAL_TEXT });
  }

  if (functionCall && !isClosed()) {
    const resultText = await runTool(functionCall.name, visitorKeyValue, functionCall.args);
    const followup = [
      ...contents,
      { role: 'model' as const, parts: [{ functionCall: { name: functionCall.name, args: functionCall.args } }] },
      { role: 'user' as const, parts: [{ functionResponse: { name: functionCall.name, response: { result: resultText } } }] },
    ];
    const second = await client.models.generateContentStream({
      model,
      contents: followup,
      config: {
        systemInstruction,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...(thinkingConfigFor(model) ? { thinkingConfig: thinkingConfigFor(model) } : {}),
      },
    });
    for await (const chunk of second) {
      if (isClosed()) break;
      if (chunk.text) send({ type: 'delta', text: chunk.text });
    }
  }
}

// --- Live voice call: ephemeral tokens + tool bridge -----------------------------------------------------------
//
// The old voice call ran the browser's own speech-to-text, sent the recognized text through the exact same
// request/response endpoint as typed chat, then read the answer aloud with the browser's own text-to-speech --
// voice only at the very edges, a normal turn-based Q&A underneath. That's the whole reason real interruption
// was never possible: there was no live audio stream to interrupt.
//
// The Gemini Live API is a different shape entirely: the browser opens one persistent WebSocket straight to
// Google and streams raw microphone audio into it continuously; Google's own servers do voice-activity
// detection, decide when the visitor has paused vs. finished vs. is talking over the assistant, and stream
// audio straight back -- the "turn" concept basically disappears into one continuous conversation. This file is
// the two small, ordinary HTTP endpoints that real-time path still needs from a traditional backend:
//
// 1. POST /api/voice/session -- mints a short-lived "ephemeral token" the browser can use to open that WebSocket
//    directly, so the real GEMINI_API_KEY never has to leave the server. The browser authenticates with the
//    token, not the key; even if someone extracted it from the page, it's only valid for a few minutes.
// 2. POST /api/voice/tool -- when the live model wants to call submit_lead/check_availability/book_call/
//    get_dashboard_access mid-conversation, the browser can't run those itself (they touch the database and
//    Cal.com), so it posts the call here and relays the result back into the Live session. Exactly the same
//    runTool() dispatch typed chat uses, so both paths get identical validation and rate-limiting.
//
// Model names below are a short fallback list for the same reason GEMINI_FALLBACK_MODELS exists above: Google
// renames/retires Live-capable preview models with no advance notice, so the client tries this list in order
// and moves on past whichever name has gone stale, rather than this whole feature going dark at once. The
// ephemeral token itself is intentionally NOT locked to one model (no liveConnectConstraints), so that retry can
// happen without minting a fresh token each time.
const GEMINI_LIVE_MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-live-preview',
  'gemini-3.1-flash-live-preview',
];

const VOICE_SESSION_SYSTEM_SUFFIX =
  '\n\nYou are speaking out loud on a live voice call, not typing a chat message. Keep replies short and ' +
  "conversational -- a sentence or two at a time, like a real phone call, never a bulleted list or long " +
  'paragraph. Spell out things that read oddly aloud (say "fifteen minutes" not "15 min"). Never say a URL, ' +
  'site path or link out loud, in full or in part -- no "slash", no "dot", no reading out the address. ' +
  'Whenever you would give a visitor any link -- a project\'s live link, a dashboard link, /contact, anything ' +
  'from <projects>/<knowledge> -- call the show_link tool with that exact url and a short label instead, then ' +
  'just say naturally that you\'ve put it on their screen (e.g. "I\'ve put the project on your screen" or ' +
  '"here\'s the dashboard -- I\'ve shown it on screen"). This is the only way to give a link on a voice call.';

export function createVoiceLiveRouter() {
  const router = express.Router();

  const sessionLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 6,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false, default: false },
    message: { error: LIMIT_MESSAGES.visitor_minute },
  });

  // Mints the ephemeral token the browser needs to open the Live WebSocket itself. Reuses the exact same
  // knowledge/project retrieval and system prompt as typed chat so the voice assistant knows the same things and
  // sounds like the same assistant, just briefed to talk instead of write (see VOICE_SESSION_SYSTEM_SUFFIX).
  router.post('/session', sessionLimiter, express.json({ limit: '4kb' }), async (req, res) => {
    if (!originAllowed(req)) return res.status(403).json({ error: 'Not allowed.' });
    if (!env('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'Voice calls need a Gemini API key configured on the server.' });
    }
    if (!isKnowledgeConfigured()) {
      return res.status(503).json({ error: 'The assistant is not available right now. Please use the contact form at /contact.' });
    }
    try {
      const visitorKeyValue = visitorKey(req.ip || req.socket.remoteAddress || 'unknown');
      const quota = await takeQuota(visitorKeyValue);
      if (quota !== 'ok') return res.status(429).json({ error: LIMIT_MESSAGES[quota] ?? LIMIT_MESSAGES.global_day });

      const [entries, projects] = await Promise.all([retrieveKnowledge('voice call introduction'), retrieveProjects()]);
      const systemInstruction = [SYSTEM_PROMPT + VOICE_SESSION_SYSTEM_SUFFIX, formatKnowledge(entries), formatProjects(projects)].join('\n\n');

      const client = getGeminiClient();
      const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      // `uses` is deliberately more than 1: the browser client tries a short list of model names and two URL
      // forms (see liveVoiceClient.ts) until one connects, since Google renames/retires Live-preview models
      // without notice -- each attempt that opens a socket at all likely counts as a use, even one that then
      // fails before setupComplete, so a single fallback round (a handful of models x 2 URL shapes) needs more
      // than one. Still a long way from a reusable credential: it's dead in 30 minutes and tied to this origin.
      const token = await (client as any).authTokens.create({
        config: { uses: 8, expireTime, newSessionExpireTime },
      });
      const tokenValue = token?.name ?? token?.token ?? token;

      res.json({
        token: tokenValue,
        models: GEMINI_LIVE_MODELS,
        systemInstruction,
        tools: voiceToolDeclarations(),
      });
    } catch (err: any) {
      console.error('Voice session mint error:', err?.message);
      res.status(503).json({ error: 'Could not start a voice session right now. Please try again in a moment.' });
    }
  });

  const toolLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false, default: false },
    message: { error: LIMIT_MESSAGES.visitor_minute },
  });

  const voiceToolSchema = z
    .object({ name: z.string(), input: z.record(z.string(), z.unknown()).default({}) })
    .strict();

  // The Live session calls this once per function call it wants to make, mid-conversation, and keeps streaming
  // audio the whole time it waits -- the voice side never blocks on this. Every tool still enforces its own
  // quota/validation underneath (see runTool/runSubmitLead/runBookCall above), same as the typed-chat path.
  router.post('/tool', toolLimiter, express.json({ limit: '4kb' }), async (req, res) => {
    if (!originAllowed(req)) return res.status(403).json({ error: 'Not allowed.' });
    const parsed = voiceToolSchema.safeParse(req.body);
    if (!parsed.success || !isToolName(parsed.data.name)) {
      return res.status(400).json({ error: 'Invalid tool call.' });
    }
    try {
      const visitorKeyValue = visitorKey(req.ip || req.socket.remoteAddress || 'unknown');
      const result = await runTool(parsed.data.name, visitorKeyValue, parsed.data.input);
      res.json({ result });
    } catch (err: any) {
      console.error('Voice tool error:', parsed.data.name, err?.message);
      res.json({ result: "Couldn't complete that right now. Let the visitor know and offer the contact form or WhatsApp instead." });
    }
  });

  router.all('*', (_req, res) => res.status(405).json({ error: 'Method not allowed.' }));
  return router;
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
    let projects: ProjectEntry[];
    try {
      const quota = await takeQuota(visitorKey(req.ip || req.socket.remoteAddress || 'unknown'));
      if (quota !== 'ok') return res.status(429).json({ error: LIMIT_MESSAGES[quota] ?? LIMIT_MESSAGES.global_day });
      [entries, projects] = await Promise.all([retrieveKnowledge(`${message} ${previousQuestion}`), retrieveProjects()]);
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

    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    const visitorKeyValue = visitorKey(req.ip || req.socket.remoteAddress || 'unknown');
    const provider = activeProvider();

    try {
      if (provider === 'gemini') {
        await runGeminiTurn({ entries, projects, history, message, visitorKeyValue, send, isClosed: () => closed, res });
      } else {
        await runAnthropicTurn({ entries, projects, history, message, visitorKeyValue, send, isClosed: () => closed, res });
      }
      send({ type: 'done' });
    } catch (err: any) {
      if (closed) return;
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
        console.error('Chat model busy:', err.status);
      } else {
        console.error('Chat model error:', err?.status ?? '', err?.message);
      }
      const busy = isProviderOverloaded(err);
      send({
        type: 'error',
        message: busy
          ? "The AI model is getting a lot of requests right now. Please try again in a few seconds, or use the contact form at /contact."
          : 'Something went wrong on my side. Please try again in a moment, or use the contact form at /contact.',
      });
    } finally {
      if (!closed) res.end();
    }
  });

  router.all('/', (_req, res) => res.status(405).json({ error: 'Method not allowed.' }));
  return router;
}
