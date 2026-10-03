// Drafts one outreach email per lead from real crawl evidence.
//
// The old repo's version of this file would silently substitute canned
// generic text, fake quality scores, and a made-up case study whenever the
// Gemini call failed or the API key was missing — meaning the user could
// send a "personalized" email that was actually a template, with no
// indication anything was wrong. This version NEVER does that: on any
// failure it returns { ok: false, error } and the caller must show that
// error to the user, never a draft.
//
// The @google/genai SDK is imported dynamically (only inside draftEmail)
// so the rest of this app — including every other test — can run without
// that package installed, and so a missing/invalid API key produces one
// clear error instead of crashing the whole process at import time.

import type { CrawlEvidence, DraftResult } from './types.js';

export interface SenderProfile {
  businessName: string;
  services: string[];
  tone?: string;
  address: string;
  // Not used in the Gemini prompt itself (the signature link is appended deterministically by
  // compliance.ts, never left for the model to "remember" to include) -- carried on this type only so one
  // SenderProfile object can be passed to both draftEmail() and appendComplianceFooter() without a mismatch.
  portfolioUrl?: string;
}

export interface DraftLeadInput {
  businessName: string;
  website: string;
  evidence: CrawlEvidence;
  sender: SenderProfile;
}

function buildPrompt(input: DraftLeadInput): string {
  const { businessName, website, evidence, sender } = input;
  return `
You are drafting a short, honest cold outreach email from a freelance web
developer to a real local business, based ONLY on the evidence below. Do not
invent facts, statistics, testimonials, or case studies that are not given
to you.

Recipient business: ${businessName}
Recipient website: ${website}

Real evidence gathered from that website just now:
- Page title: ${evidence.title || '(none found)'}
- Meta description: ${evidence.metaDescription || '(none found)'}
- Has mobile viewport tag: ${evidence.hasViewportMeta}
- Uses HTTPS: ${evidence.usesHttps}
- Headings found: ${evidence.headings.slice(0, 8).join(' | ') || '(none)'}
- Images missing alt text: ${evidence.imagesMissingAlt} of ${evidence.imageCount}
- Detected CMS/platform: ${evidence.cms || 'unknown'}
- Issues detected: ${evidence.issues.join('; ') || 'none'}

Sender (who this email is from):
- Name/business: ${sender.businessName}
- Services offered: ${sender.services.join(', ') || 'web design and development'}
- Requested tone: ${sender.tone || 'friendly, direct, not salesy'}

Write:
1. 2-3 specific observations about THIS business's actual site, each one
   tied directly to a piece of evidence above (no generic filler like
   "in today's digital world").
2. A complete outreach email body (not a template with placeholders) that:
   - opens with a genuine, specific observation from #1
   - briefly explains one concrete improvement and its plausible benefit
   - offers a low-pressure next step (a short call or a quick reply)
   - signs off as ${sender.businessName}
   - is under 180 words
3. A short subject line (under 60 characters, no clickbait, no ALL CAPS).

Return strict JSON with this shape and nothing else:
{"subject": string, "body": string, "observations": string[]}
`.trim();
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

export async function draftEmail(input: DraftLeadInput): Promise<DraftResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY is not set. Add it to your .env file (see .env.example) — no draft can be generated without it.' };
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

  let GoogleGenAI: any;
  try {
    ({ GoogleGenAI } = await import('@google/genai'));
  } catch (e: any) {
    return {
      ok: false,
      error: `The @google/genai package is not installed. Run "npm install" first. (${e.message || e})`,
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: buildPrompt(input),
      config: {
        systemInstruction:
          'You write short, honest, specific cold outreach emails. You never invent facts, statistics, client names, or results that were not given to you. You return only valid JSON matching the requested shape.',
        responseMimeType: 'application/json',
      },
    });

    const text: string | undefined = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { ok: false, error: `Gemini (model "${model}") returned an empty response.` };
    }

    let parsed: any;
    try {
      parsed = extractJson(text);
    } catch (e: any) {
      return { ok: false, error: `Gemini's response was not valid JSON and could not be parsed: ${e.message || e}` };
    }

    if (!parsed.subject || !parsed.body) {
      return { ok: false, error: 'Gemini response was missing a subject or body field.' };
    }

    return {
      ok: true,
      subject: String(parsed.subject),
      body: String(parsed.body),
      observations: Array.isArray(parsed.observations) ? parsed.observations.map(String) : [],
    };
  } catch (e: any) {
    const message = e?.message || String(e);
    return { ok: false, error: `Gemini API call failed (model "${model}"): ${message}` };
  }
}
