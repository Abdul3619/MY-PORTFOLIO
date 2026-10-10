// Which language a business should be written to in. Drafts go to real people in their own country, so a
// hotel in Cotonou gets French, not English. The country comes from the geocoded search place (an ISO code
// from Nominatim) or, for pasted/CSV leads, from the country name the user typed.

export interface OutreachLanguage {
  /** English name of the language, used in the model prompt. */
  name: string;
  /** ISO 639-1 code. */
  code: string;
}

const FR: OutreachLanguage = { name: 'French', code: 'fr' };
const ES: OutreachLanguage = { name: 'Spanish', code: 'es' };
const PT: OutreachLanguage = { name: 'Portuguese', code: 'pt' };
const AR: OutreachLanguage = { name: 'Arabic', code: 'ar' };
const DE: OutreachLanguage = { name: 'German', code: 'de' };
const IT: OutreachLanguage = { name: 'Italian', code: 'it' };
const TH: OutreachLanguage = { name: 'Thai', code: 'th' };
const ZH: OutreachLanguage = { name: 'Simplified Chinese', code: 'zh' };

const BY_ISO2: Record<string, OutreachLanguage> = {
  // French-speaking Africa
  bj: FR, tg: FR, bf: FR, ci: FR, sn: FR, ml: FR, ne: FR, gn: FR, cm: FR, ga: FR, cg: FR, cd: FR, td: FR,
  cf: FR, bi: FR, rw: FR, dj: FR, km: FR, mg: FR, mr: FR, gq: FR,
  // Europe / elsewhere, French
  fr: FR, be: FR, lu: FR, mc: FR, ht: FR, cu: ES,
  // Maghreb and Arabic-speaking
  ma: FR, dz: FR, tn: FR, eg: AR, sa: AR, ae: AR, jo: AR, lb: FR, qa: AR, kw: AR, om: AR, bh: AR, iq: AR,
  // Spanish
  es: ES, mx: ES, ar: ES, co: ES, cl: ES, pe: ES, ve: ES, ec: ES, bo: ES, uy: ES, py: ES, cr: ES, pa: ES,
  gt: ES, hn: ES, ni: ES, sv: ES, do: ES, pr: ES,
  // Portuguese
  pt: PT, br: PT, ao: PT, mz: PT, gw: PT, cv: PT, st: PT,
  // Others
  de: DE, at: DE, ch: DE, it: IT, th: TH, cn: ZH, tw: ZH,
};

const BY_NAME: Record<string, OutreachLanguage> = {
  benin: FR, bénin: FR, togo: FR, 'burkina faso': FR, "cote d'ivoire": FR, "côte d'ivoire": FR, 'ivory coast': FR,
  senegal: FR, sénégal: FR, mali: FR, niger: FR, guinea: FR, cameroon: FR, gabon: FR, congo: FR, france: FR,
  belgium: FR, morocco: FR, algeria: FR, tunisia: FR, spain: ES, mexico: ES, colombia: ES, argentina: ES,
  brazil: PT, portugal: PT, angola: PT, mozambique: PT, germany: DE, italy: IT, thailand: TH, china: ZH,
  egypt: AR, 'saudi arabia': AR, 'united arab emirates': AR, uae: AR,
};

/** Returns the language to write in for a country, or null when it should be English (the default). Accepts an
 * ISO 3166-1 alpha-2 code ("bj") or a country name ("Benin"). A multilingual country picks its most common
 * business language; the English copy next to every draft means a wrong guess is easy to spot. */
export function languageForCountry(country: string | null | undefined): OutreachLanguage | null {
  const key = (country || '').trim().toLowerCase();
  if (!key) return null;
  if (key.length === 2) return BY_ISO2[key] ?? null;
  if (BY_NAME[key]) return BY_NAME[key];
  // "Cotonou, Littoral, Bénin" or "Benin (Bénin)": check the last comma-separated part, then any known name inside.
  const parts = key.split(',').map((p) => p.trim());
  const last = parts[parts.length - 1];
  if (BY_NAME[last]) return BY_NAME[last];
  // Whole-word match only: "nigeria" must not match "niger", "guinea-bissau" must not match "guinea".
  for (const part of parts) {
    if (BY_NAME[part]) return BY_NAME[part];
  }
  return null;
}

/** The unsubscribe footer in the draft's language -- the legal opt-out line must be readable by the recipient. */
export function footerStrings(language: OutreachLanguage | null): { moreWork: string; unsubscribe: string } {
  if (language?.code === 'fr') {
    return {
      moreWork: 'Voir mes réalisations :',
      unsubscribe: 'Si vous ne souhaitez plus recevoir de message de ma part, répondez simplement « désinscription » et je ne vous contacterai plus.',
    };
  }
  if (language?.code === 'es') {
    return {
      moreWork: 'Vea más de mi trabajo:',
      unsubscribe: 'Si prefiere no recibir más mensajes míos, responda «baja» y no volveré a contactarle.',
    };
  }
  if (language?.code === 'pt') {
    return {
      moreWork: 'Veja mais do meu trabalho:',
      unsubscribe: 'Se preferir não receber mais mensagens minhas, responda "cancelar" e não voltarei a contactá-lo.',
    };
  }
  return {
    moreWork: 'See more of my work:',
    unsubscribe: "If you'd rather not hear from me again, just reply with \"unsubscribe\" and I won't contact you again.",
  };
}
