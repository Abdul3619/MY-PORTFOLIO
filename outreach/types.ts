// Shared types used across the server. Kept in one small file on purpose —
// this is a single-user local tool, not a distributed system.

export type LeadStatus =
  | 'crawling'
  | 'crawl_error'
  | 'drafting'
  | 'draft_error'
  | 'drafted'
  | 'duplicate'
  | 'opted_out'
  | 'approved'
  | 'rejected'
  | 'sent';

export type LeadSource = 'manual_url' | 'csv' | 'auto_search';

export interface CrawlEvidence {
  finalUrl: string;
  title: string;
  metaDescription: string;
  hasViewportMeta: boolean;
  headings: string[];
  imageCount: number;
  imagesMissingAlt: number;
  cms: string | null;
  emails: string[];
  phones: string[];
  socialLinks: Record<string, string>;
  issues: string[];
  wordCount: number;
  usesHttps: boolean;
  rawBytes: number;
  // Design-age / credibility signals -- not whether the site has a technical bug, but whether it visibly
  // looks like it hasn't been touched in years or gives a visitor nothing to actually click.
  usesOutdatedMarkup: boolean; // <center>, <font>, <marquee>, bgcolor=, table-based layout scaffolding
  oldCopyrightYear: number | null; // a "© 20XX" footer year, when it's stale enough to be telling
  hasClearCallToAction: boolean; // any button/link whose text is an action verb (book, call, order, contact...)
  hasOnlinePayment: boolean; // any sign of checkout/cart/online booking/payment on the page
  // Generic keyword-presence signals, reused across business-type-specific "compulsory item" checks (see
  // businessRequirements.ts) -- a coarse "is this mentioned anywhere" rather than a verified feature.
  hasPricingInfo: boolean;
  hasHoursInfo: boolean;
  hasAddressInfo: boolean;
  hasMenuMention: boolean;
  hasBookingMention: boolean;
  hasPortfolioMention: boolean;
  hasTestimonials: boolean;
  // Real, actually-tested functional problems (see technicalAudit.ts) -- not pattern-matched guesses.
  deadButtonCount: number; // href="#"/javascript:void(0) with no real destination
  brokenLinkCount: number; // same-domain links that returned a 4xx/5xx when actually requested
  brokenImageCount: number; // same-domain images that failed to load when actually requested
}

export interface CrawlResult {
  ok: boolean;
  error?: string;
  evidence?: CrawlEvidence;
}

export interface DraftResult {
  ok: boolean;
  error?: string;
  subject?: string;
  body?: string;
  observations?: string[];
  /** Set when the draft was written in a language other than English (see language.ts). */
  language?: string;
  languageCode?: string;
  subjectEnglish?: string;
  bodyEnglish?: string;
}

// How a business can be reached. 'website' is the original, richest path
// (its homepage gets crawled for real evidence). The other four cover
// businesses with no website at all -- common for small, local, WhatsApp- or
// social-only businesses -- where there's nothing to crawl, so drafting is
// grounded only in the bare facts: name, category, city, and that this is
// how they're reachable.
export type ContactChannel = 'website' | 'whatsapp' | 'facebook' | 'instagram' | 'phone';

export interface Business {
  id: number;
  domain: string;
  name: string | null;
  website: string | null;
  contactChannel: ContactChannel;
  contactValue: string | null;
  /** A real phone number OSM had on file for this business even though something else (whatsapp/facebook/
   * instagram, or a website) won as the primary contact channel -- a fallback way to reach them that would
   * otherwise be silently discarded. See overpass.ts's extractContact. */
  fallbackPhone: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
}

export interface Lead {
  id: number;
  businessId: number;
  domain: string;
  website: string | null;
  contactChannel: ContactChannel;
  contactValue: string | null;
  fallbackPhone: string | null;
  businessName: string | null;
  city: string | null;
  country: string | null;
  source: LeadSource;
  status: LeadStatus;
  error: string | null;
  evidence: CrawlEvidence | null;
  draftSubject: string | null;
  draftBody: string | null;
  /** Language the draft is written in plus its English copy, or null when the draft is in English. */
  draftTranslation: DraftTranslation | null;
  /** The human-eye design critique (see visualAudit.ts) -- null until someone runs it from the Review Queue.
   * Opt-in and per-lead, not run automatically during auto-search (it launches a real browser, which is slow
   * and the one part of this pipeline with real infrastructure risk). */
  visualAudit: { summary: string; issues: string[]; strengths: string[] } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftTranslation {
  language: string;
  languageCode: string;
  subjectEnglish: string | null;
  bodyEnglish: string | null;
}

export interface RegistryEntry {
  domain: string;
  businessName: string | null;
  status: LeadStatus;
  city: string | null;
  country: string | null;
  firstSeenAt: string;
  lastActionAt: string;
}

export interface SearchRecord {
  id: number;
  city: string;
  category: string;
  createdAt: string;
  resultCount: number;
}
