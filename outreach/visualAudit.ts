// The "look at it like a human would" piece: sends a real screenshot (see screenshot.ts) to Gemini's vision
// capability and asks for the kind of judgment a person scrolling past the site would form in the first few
// seconds -- does the design look current or dated, do colors clash, does the layout feel cramped or
// unbalanced -- rather than the pattern-matched, HTML-level signals the rest of the audit already checks
// (technicalAudit.ts, htmlExtract.ts). Deliberately cautious about one thing the user was explicit about:
// never judging a site as "old" purely from a surface cue like a stale copyright year -- that check already
// lives in htmlExtract.ts, and this prompt tells the model outright not to lean on it either.

const EXTRACT_JSON = (text: string): any => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
};

export interface VisualAuditResult {
  ok: boolean;
  error?: string;
  findings?: {
    /** One-paragraph, plain-language first impression, the way a visitor would actually describe it. */
    summary: string;
    /** Specific, concrete visual issues -- never generic filler like "could look more modern." */
    issues: string[];
    /** Things that are genuinely fine or good, so the critique isn't one-sided. */
    strengths: string[];
  };
}

export async function runVisualAudit(base64Png: string, businessName: string): Promise<VisualAuditResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY is not set.' };

  const model = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

  let GoogleGenAI: any;
  try {
    ({ GoogleGenAI } = await import('@google/genai'));
  } catch (e: any) {
    return { ok: false, error: `The @google/genai package is not installed. (${e.message || e})` };
  }

  const prompt = `
You are looking at a real screenshot of ${businessName}'s homepage, exactly as a visitor would see it. Judge
it the way an honest, observant person would after a few seconds of looking -- not by reading code, not by
checking a footer date. Do not assume a site is old just because of a copyright year or any other single
surface detail; judge only what you actually SEE in this image: the colors, the layout, the spacing, the
typography, whether things feel balanced or cramped or cluttered, whether it looks like a real, finished
business site or something unfinished/templated.

Be concrete and specific -- point at an actual element or area ("the header text is low-contrast against the
background," "the hero image is stretched and blurry," "there's a large empty gap below the main heading"),
never a vague generality like "the design feels outdated" with nothing to back it up. If the screenshot
genuinely looks clean, current, and well put together, say so plainly -- do not invent a flaw to fill the
response.

Return ONLY this JSON shape, nothing else, no markdown fencing:
{"summary": string, "issues": string[], "strengths": string[]}
`.trim();

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType: 'image/png', data: base64Png } }],
        },
      ],
      config: {
        systemInstruction:
          'You are a careful, honest design reviewer. You only describe what is actually visible in the ' +
          'image. You never invent a flaw to fill the response, and you never judge a design as old or bad ' +
          'based on anything other than what you can see in the picture itself. You respond with raw JSON ' +
          'only, no markdown code fences, no commentary before or after it.',
      },
    });

    const text: string | undefined = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: `Gemini (model "${model}") returned an empty response.` };

    let parsed: any;
    try {
      parsed = EXTRACT_JSON(text);
    } catch (e: any) {
      return { ok: false, error: `Response was not valid JSON: ${e.message || e}` };
    }

    return {
      ok: true,
      findings: {
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).filter(Boolean) : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).filter(Boolean) : [],
      },
    };
  } catch (e: any) {
    return { ok: false, error: `Visual audit failed (model "${model}"): ${e.message || e}` };
  }
}
