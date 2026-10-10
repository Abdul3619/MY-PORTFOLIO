// A general-purpose compliance footer appended to every drafted email —
// never AI-generated, so it's always present and always accurate. No
// single country's law is targeted (the user is deliberately keeping their
// target market open); see README.md "Compliance" for the real differences
// between markets (CAN-SPAM, UK/EU, Nigeria's NDPA) before scaling up.

import { footerStrings, type OutreachLanguage } from './language.js';

export interface SenderProfile {
  businessName: string;
  address: string;
  // Appended as a plain link in the signature (see buildComplianceFooter) so every recipient gets a real,
  // working way back to the portfolio -- a link is what a pasted-as-plain-text email or WhatsApp message can
  // actually carry; a generated graphic "button" wouldn't survive being copied into either. Most mail and
  // chat clients auto-linkify a bare URL on paste/send, so this reads and acts like a button without needing
  // one to be rendered. Left out of the footer entirely if not set, rather than showing a placeholder.
  portfolioUrl?: string;
}

export function buildComplianceFooter(sender: SenderProfile, language: OutreachLanguage | null = null): string {
  const words = footerStrings(language);
  const business = sender.businessName?.trim() || '[Your business name — set SENDER_BUSINESS_NAME in .env]';
  const address = sender.address?.trim() || '[Your mailing address — set SENDER_ADDRESS in .env]';
  const portfolioUrl = sender.portfolioUrl?.trim();
  return [
    '',
    '--',
    business,
    address,
    ...(portfolioUrl ? [`${words.moreWork} ${portfolioUrl}`] : []),
    words.unsubscribe,
  ].join('\n');
}

export function appendComplianceFooter(body: string, sender: SenderProfile, language: OutreachLanguage | null = null): string {
  return `${body.trimEnd()}\n${buildComplianceFooter(sender, language)}`;
}

/** Very small heuristic for detecting an opt-out reply/instruction in text
 * the user pastes in (e.g. a bounce or reply). Used by the /api/optouts
 * endpoint's free-text mode; the primary path is the explicit opt-out form. */
export function looksLikeOptOutRequest(text: string): boolean {
  return /unsubscribe|opt[- ]?out|remove me|stop (contacting|emailing)|d[ée]sinscri|d[ée]sabonn|dar de baja|cancelar inscri/i.test(text);
}
