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
import type { OutreachLanguage } from './language.js';

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
  /** Plain-language things that are genuinely expected for this type of business but missing from the
   * site (e.g. "a visible menu" for a restaurant) -- see businessRequirements.ts. Empty when the business's
   * category wasn't known or recognized. */
  compulsoryMissing?: string[];
  /** Real, specific complaints found by live web search (see reputation.ts) -- never invented, and empty
   * when search found nothing notable. Independent of the crawl: this is what people say about the
   * business, not what their own site looks like. */
  reputationIssues?: string[];
  /** A real screenshot of the homepage, judged the way a visitor actually would (see visualAudit.ts) --
   * specific, concrete design issues, never generic filler. Undefined when the automatic visual audit
   * couldn't run or failed (e.g. no Chromium, navigation timeout) -- the draft still works fine without it. */
  visualFindings?: { issues: string[]; strengths: string[] };
  /** The language the business should be written to in (null/undefined = English). See language.ts. */
  language?: OutreachLanguage | null;
}

// Technical crawl findings are real, but a business owner has never heard of a "meta description" and
// doesn't care about one -- they care about customers finding them, or not. This maps each technical signal
// to the plain, real-world consequence it actually has, so the model is pointed at writing about the thing
// that matters instead of restating jargon the recipient will skim past.
function translateEvidence(evidence: CrawlEvidence): string[] {
  const facts: string[] = [];
  if (!evidence.hasViewportMeta) facts.push('The site does not resize properly on a phone screen -- most visitors are on mobile, so this is likely costing them customers directly.');
  if (!evidence.usesHttps) facts.push('The site loads without the secure padlock (HTTP, not HTTPS) -- browsers flag this as "not secure," which makes visitors leave.');
  if (evidence.emails.length === 0 && evidence.phones.length === 0) facts.push('There is no visible email or phone number anywhere on the homepage -- a visitor who wants to buy or book has no way to reach them.');
  if (Object.keys(evidence.socialLinks).length === 0) facts.push('No social media links on the site, so there is no path from the website to wherever the business is actually active, if anywhere.');
  if (evidence.wordCount < 150) facts.push('The homepage has very little actual content -- it looks unfinished or abandoned at a glance.');
  if (!evidence.title) facts.push('The page has no title at all, so it shows up blank or as a raw URL in a browser tab or a Google search result.');
  if (evidence.imagesMissingAlt > 0 && evidence.imageCount > 0 && evidence.imagesMissingAlt === evidence.imageCount) {
    facts.push('None of the images on the page would show up in Google Image search or work for anyone using a screen reader.');
  }
  if (evidence.usesOutdatedMarkup) facts.push('The site is built with page-layout techniques that stopped being used well over a decade ago -- to anyone who opens it, it visibly looks like an old site, not an outdated-but-modern one.');
  if (evidence.oldCopyrightYear !== null && evidence.oldCopyrightYear <= new Date().getFullYear() - 3) {
    facts.push(`The footer still shows a copyright year of ${evidence.oldCopyrightYear}, which quietly tells every visitor the site has not been updated since then.`);
  }
  if (!evidence.hasClearCallToAction) facts.push('Nothing on the page actually tells a visitor what to do next -- there is no obvious button or line that says to call, book, or get in touch.');
  if (!evidence.hasOnlinePayment) facts.push('There is no way to pay, book, or check out online -- anything like that has to happen off the site entirely, usually by phone.');
  if (!evidence.hasTestimonials) facts.push('There is nothing on the site showing what past customers think -- no reviews or testimonials, so a new visitor has nothing to reassure them.');
  // These three are actually tested, not guessed at -- a real request was made and it actually failed.
  if (evidence.deadButtonCount > 0) facts.push(`${evidence.deadButtonCount} button${evidence.deadButtonCount === 1 ? '' : 's'} on the page do nothing when clicked -- they go nowhere at all, which looks broken to anyone who tries.`);
  if (evidence.brokenLinkCount > 0) facts.push(`${evidence.brokenLinkCount} link${evidence.brokenLinkCount === 1 ? '' : 's'} on the page lead to a page that no longer exists or returns an error.`);
  if (evidence.brokenImageCount > 0) facts.push(`${evidence.brokenImageCount} image${evidence.brokenImageCount === 1 ? '' : 's'} on the page fail to load -- visitors see a broken image icon instead.`);
  return facts;
}

// When enough of the plain-language facts point at the SITE ITSELF looking old or unfinished (as opposed to
// one isolated technical gap), the email should offer a concrete next step -- "let me show you what this
// could look like" -- rather than just listing what's wrong. This is what turns a list of flaws into
// something the business owner can actually say yes to.
const DESIGN_AGE_SIGNAL_COUNT = (evidence: CrawlEvidence): number =>
  [evidence.usesOutdatedMarkup, evidence.oldCopyrightYear !== null, !evidence.hasClearCallToAction, evidence.wordCount < 150].filter(Boolean).length;

const STYLE_RULES = `
Write the way a direct, honest person writes when they actually mean what they're saying, not the way an AI
assistant writes a sales email. Concretely:
- No hashtags, anywhere.
- No em-dashes (the "--" character or "—"). Use a period or comma instead.
- No bullet points, numbered lists, or dashes-as-bullets inside the email body itself -- it's a message to
  one human, not a slide.
- No corporate/AI-sounding phrases: "in today's digital world/age", "I hope this email finds you well",
  "take your business to the next level", "unlock your potential", "passionate", "cutting-edge",
  "game-changer", "seamless", "elevate". If a sentence sounds like it could open a template, cut it.
- No exclamation points, no emoji.
- Short, plain, declarative sentences. State things directly rather than hedging ("I was wondering if
  maybe..." becomes "I noticed...").
- Translate any technical detail into what it actually means for a customer or the business owner, in plain
  words -- never use technical terms like "meta description," "alt text," "viewport," "HTTPS," or "H1 tag"
  literally in the email itself. Say what the person would actually notice or lose because of it.
- Sign off plainly with just the sender's name, nothing more ornate.
`.trim();

// When the recipient is not English-speaking, the draft is written in their language and a faithful English
// copy is returned next to it, so the sender (who may not read that language) can check exactly what is being
// sent. The English copy is for the sender only and is never sent to the business.
function languageInstructions(language: OutreachLanguage | null | undefined): { rules: string; shape: string } {
  if (!language || language.code === 'en') {
    return { rules: '', shape: '{"subject": string, "body": string, "observations": string[]}' };
  }
  return {
    rules: `
LANGUAGE: The recipient is in a ${language.name}-speaking market. Write the subject and the body in natural,
polite, native-sounding ${language.name}, the way a courteous local professional would write to a business
owner they do not know yet (${language.code === 'fr' ? 'use "vous", never "tu"' : 'use the formal form of address'}). Do not translate word for word from English. The style rules above still apply.
Also return "subjectEnglish" and "bodyEnglish": a faithful English translation of the subject and body, for the
sender to read and check. Keep "observations" in English.`,
    shape: '{"subject": string, "body": string, "subjectEnglish": string, "bodyEnglish": string, "observations": string[]}',
  };
}

function buildPrompt(input: DraftLeadInput): string {
  const { businessName, website, evidence, sender } = input;
  const plainFacts = translateEvidence(evidence);
  const siteLooksOld = DESIGN_AGE_SIGNAL_COUNT(evidence) >= 2;
  const compulsoryMissing = input.compulsoryMissing || [];
  const reputationIssues = input.reputationIssues || [];
  const visualIssues = input.visualFindings?.issues || [];
  const lang = languageInstructions(input.language);
  return `
You are drafting a short, honest cold outreach email from a freelance web
developer to a real local business, based ONLY on the evidence below. Do not
invent facts, statistics, testimonials, or case studies that are not given
to you.

Recipient business: ${businessName}
Recipient website: ${website}

Plain-language facts about their site (already translated from technical signals -- use these as the
substance of the email, not the raw jargon):
${plainFacts.length > 0 ? plainFacts.map((f) => `- ${f}`).join('\n') : '- No major issues were detected -- the site looks reasonably solid technically; focus the email on offering a second opinion or a small improvement rather than inventing a problem.'}

${compulsoryMissing.length > 0 ? `Things customers specifically expect from this TYPE of business, that this site does not have (these are not generic nice-to-haves -- treat the most important one or two as the lead observation if nothing else stands out more):\n${compulsoryMissing.map((m) => `- ${m}`).join('\n')}\n` : ''}

${reputationIssues.length > 0 ? `Real complaints found online about this business (from actual reviews/search, not the site itself -- these are sensitive, so raise AT MOST one, gently, only if it fits naturally, and never sound like you're attacking them):\n${reputationIssues.map((r) => `- ${r}`).join('\n')}\n` : ''}

${visualIssues.length > 0 ? `What the homepage actually looks like to a visitor (from a real screenshot, judged on sight -- these are specific, observed design problems, not guesses; pick at most one or two, in your own plain words, never quoting them verbatim):\n${visualIssues.map((v) => `- ${v}`).join('\n')}\n` : ''}

Raw technical evidence, for your own reference only (do not quote these terms in the email itself):
- Page title: ${evidence.title || '(none found)'}
- Headings found: ${evidence.headings.slice(0, 8).join(' | ') || '(none)'}
- Detected CMS/platform: ${evidence.cms || 'unknown'}

Sender (who this email is from):
- Name/business: ${sender.businessName}
- Services offered: ${sender.services.join(', ') || 'web design and development'}
- Requested tone: ${sender.tone || 'friendly, direct, not salesy'}

${STYLE_RULES}
${lang.rules}

Write:
1. 2-3 specific observations about THIS business's actual site, each one
   tied directly to one of the plain-language facts above, written in the
   same plain, non-technical way (no jargon, no generic filler like
   "in today's digital world").
2. A complete outreach email body (not a template with placeholders) that:
   - opens with a genuine, specific observation from #1, stated plainly
   - briefly explains one concrete improvement and the real benefit it has
     for THIS business (more bookings, fewer lost customers, looking
     trustworthy) -- not a vague claim
${siteLooksOld
    ? '   - since several signs point at the whole site looking old rather than one small gap, offer to put together a free quick mockup/preview of what an updated version could look like, no obligation, rather than just naming the problem'
    : '   - offers a low-pressure next step (a short call or a quick reply)'}
   - signs off as ${sender.businessName}
   - is under 180 words, in short paragraphs (2-4 sentences each)
3. A short subject line (under 60 characters, no clickbait, no ALL CAPS, no hashtags).

Return strict JSON with this shape and nothing else:
${lang.shape}
`.trim();
}

// The prompt and system instruction both tell the model not to do these things, but a model can still slip
// -- this is the backstop that actually guarantees the output the user asked for, rather than hoping the
// instructions were followed. Deliberately conservative: it only strips things that are never wanted (a
// stray "#tag", an em-dash used as punctuation), it never rewrites or reword actual sentence content.
function sanitizeDraftText(text: string): string {
  return text
    .replace(/#[A-Za-z][A-Za-z0-9_]*/g, '') // stray hashtags
    .replace(/\s*[-–—]{2,}\s*/g, ', ') // em/en-dashes and "--" used as a pause -> a comma
    .replace(/—/g, ',') // any lone em-dash character
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

async function callGemini(prompt: string, language?: OutreachLanguage | null): Promise<DraftResult> {
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
      contents: prompt,
      config: {
        systemInstruction:
          'You write short, honest, specific cold outreach messages the way a direct, plain-spoken person ' +
          'writes when they mean it, never the way a generic AI sales email reads. No hashtags, no ' +
          'em-dashes, no bullet points inside the message body, no exclamation points or emoji, no ' +
          'corporate/AI-sounding phrases ("in today\'s digital world," "I hope this email finds you well," ' +
          '"take your business to the next level," "unlock your potential," "cutting-edge," "seamless"). ' +
          'Short, declarative sentences. Never invent facts, statistics, client names, or results that were ' +
          'not given to you. You return only valid JSON matching the requested shape.',
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
      subject: sanitizeDraftText(String(parsed.subject)),
      body: sanitizeDraftText(String(parsed.body)),
      observations: Array.isArray(parsed.observations) ? parsed.observations.map(String) : [],
      ...(language && language.code !== 'en'
        ? {
            language: language.name,
            languageCode: language.code,
            subjectEnglish: parsed.subjectEnglish ? sanitizeDraftText(String(parsed.subjectEnglish)) : undefined,
            bodyEnglish: parsed.bodyEnglish ? sanitizeDraftText(String(parsed.bodyEnglish)) : undefined,
          }
        : {}),
    };
  } catch (e: any) {
    const message = e?.message || String(e);
    return { ok: false, error: `Gemini API call failed (model "${model}"): ${message}` };
  }
}

export async function draftEmail(input: DraftLeadInput): Promise<DraftResult> {
  return callGemini(buildPrompt(input), input.language);
}

export interface DraftNoWebsiteLeadInput {
  businessName: string;
  category: string;
  city: string | null;
  contactChannel: 'whatsapp' | 'facebook' | 'instagram' | 'phone';
  sender: SenderProfile;
  /** Real, specific complaints found by live web search (see reputation.ts) -- never invented. */
  reputationIssues?: string[];
  /** The language the business should be written to in (null/undefined = English). See language.ts. */
  language?: OutreachLanguage | null;
}

function buildNoWebsitePrompt(input: DraftNoWebsiteLeadInput): string {
  const { businessName, category, city, contactChannel, sender } = input;
  const reputationIssues = input.reputationIssues || [];
  const lang = languageInstructions(input.language);
  const channelLabel: Record<DraftNoWebsiteLeadInput['contactChannel'], string> = {
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    phone: 'phone',
  };
  return `
You are drafting a short, honest outreach message from a freelance web
developer to a real local business, based ONLY on the facts below. This
business does NOT appear to have a website -- there is nothing to crawl and
nothing to say about an existing site. Do not invent any detail about their
current online presence, their size, their customers, or anything else not
given to you below.

Recipient business: ${businessName}
Business category: ${category}
${city ? `Location: ${city}` : ''}
How they're reachable: ${channelLabel[contactChannel]} (no website found)

${reputationIssues.length > 0 ? `Real complaints found online about this business (from actual reviews/search -- these are sensitive, so raise AT MOST one, gently, only if it fits naturally, and never sound like you're attacking them):\n${reputationIssues.map((r) => `- ${r}`).join('\n')}\n` : ''}

Sender (who this message is from):
- Name/business: ${sender.businessName}
- Services offered: ${sender.services.join(', ') || 'web design and development'}
- Requested tone: ${sender.tone || 'friendly, direct, not salesy'}

${STYLE_RULES}
${lang.rules}

Write:
1. A complete message body (not a template with placeholders) that:
   - opens by noting, plainly and respectfully, that you noticed their
     business doesn't seem to have a website yet (do not guess why, and do
     not claim to have seen anything about their business beyond its name
     and category)
   - briefly explains one or two concrete, generic benefits a simple
     website/online presence would bring a ${category} business reachable
     mainly by ${channelLabel[contactChannel]} (e.g. being findable by new
     customers who search online, having a page to share instead of just a
     phone/social handle) -- phrased as general, honest reasoning, never as
     a specific claim about THIS business's results
   - offers a low-pressure next step (a short call or a quick reply)
   - signs off as ${sender.businessName}
   - is under 160 words
2. A short subject line (under 60 characters, no clickbait, no ALL CAPS, no hashtags).

Return strict JSON with this shape and nothing else:
${lang.shape}
(leave "observations" as an empty array -- there's no site evidence to list)
`.trim();
}

export async function draftNoWebsiteEmail(input: DraftNoWebsiteLeadInput): Promise<DraftResult> {
  return callGemini(buildNoWebsitePrompt(input), input.language);
}
