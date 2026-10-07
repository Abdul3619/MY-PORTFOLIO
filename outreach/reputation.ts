// A second, independent kind of evidence alongside the crawl: what people online actually say about this
// business, found by live web search rather than guessed at or pattern-matched from their own site. Reuses
// the same GEMINI_API_KEY already required for drafting (no second account, no second key to manage) via
// Gemini's built-in Google Search grounding tool, which lets the model issue real web searches and cites
// what it finds.
//
// Deliberately conservative: the system instruction forbids inventing a single complaint, and an empty
// result is reported as "nothing found" rather than papering over it with a vague default. This is
// best-effort, additive evidence -- a failure here (missing key, no results, a flaky call) should never
// block a lead from being drafted on crawl evidence alone; the caller treats it as optional.

export interface ReputationFinding {
  /** One-line, plain-language summary of what was found (or that nothing notable was). */
  summary: string;
  /** Specific, attributable complaints/issues found online, each a short plain sentence -- never invented;
   * each one should trace to something an actual source said, not a generic guess. */
  complaints: string[];
  /** The pages search found this on, so a human can verify before anything is sent based on it. */
  sources: { title: string; url: string }[];
}

export interface ReputationResult {
  ok: boolean;
  error?: string;
  findings?: ReputationFinding;
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

/** Searches the open web for real reviews, complaints, or reputation issues about a specific local
 * business, grounded in actual search results rather than the model's own guesses. Returns ok: false (never
 * throws) on any failure -- missing key, missing package, empty/malformed response, or an API error -- so a
 * caller can treat this as optional, best-effort evidence without special-casing exceptions. */
export async function findReputationIssues(businessName: string, city: string | null, country: string | null): Promise<ReputationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY is not set.' };
  if (!businessName || !businessName.trim()) return { ok: false, error: 'No business name to search for.' };

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const location = [city, country].filter(Boolean).join(', ');

  let GoogleGenAI: any;
  try {
    ({ GoogleGenAI } = await import('@google/genai'));
  } catch (e: any) {
    return { ok: false, error: `The @google/genai package is not installed. (${e.message || e})` };
  }

  const prompt = `
Search the live web for real, specific reviews or complaints about this local business. Do not rely on
anything you already "know" -- only what your search actually turns up right now.

Business: ${businessName}
${location ? `Location: ${location}` : ''}

Look specifically for: recurring complaints (bad service, late delivery, rude staff, overcharging, quality
problems), a notably low rating with a stated reason, or any specific, repeated problem customers mention.
Ignore generic five-star praise with nothing substantive in it.

If your search finds NOTHING specific and verifiable -- no reviews turn up, or they're all generic praise --
say so plainly. Never invent a complaint, a rating, or a source to fill the response. A business having no
findable complaints is a completely normal, fine result -- report it as "summary": "No specific complaints
found online." with an empty complaints array, not as a reason to make something up.

Every item in "complaints" must be something an actual source actually said, phrased plainly (not quoted
verbatim, but not exaggerated either), and every URL in "sources" must be a real page your search actually
found.

Return ONLY this JSON shape, nothing else, no markdown fencing:
{"summary": string, "complaints": string[], "sources": [{"title": string, "url": string}]}
`.trim();

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction:
          'You are a careful fact-finder, not a storyteller. You only report what a real web search actually ' +
          'returned. You never invent a complaint, statistic, review, rating, or source URL. When search ' +
          'finds nothing specific, you say so plainly instead of fabricating something to fill the response. ' +
          'You respond with raw JSON only, no markdown code fences, no commentary before or after it.',
      },
    });

    const text: string | undefined = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: `Gemini (model "${model}") returned an empty response.` };

    let parsed: any;
    try {
      parsed = extractJson(text);
    } catch (e: any) {
      return { ok: false, error: `Response was not valid JSON: ${e.message || e}` };
    }

    const summary = typeof parsed.summary === 'string' ? parsed.summary : 'No specific complaints found online.';
    const complaints = Array.isArray(parsed.complaints) ? parsed.complaints.map(String).filter(Boolean) : [];
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources
          .filter((s: any) => s && typeof s.url === 'string' && s.url.trim())
          .map((s: any) => ({ title: typeof s.title === 'string' && s.title.trim() ? s.title : s.url, url: s.url }))
      : [];

    return { ok: true, findings: { summary, complaints, sources } };
  } catch (e: any) {
    return { ok: false, error: `Reputation search failed (model "${model}"): ${e.message || e}` };
  }
}
