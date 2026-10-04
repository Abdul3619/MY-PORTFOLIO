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
  businessName: string | null;
  city: string | null;
  country: string | null;
  source: LeadSource;
  status: LeadStatus;
  error: string | null;
  evidence: CrawlEvidence | null;
  draftSubject: string | null;
  draftBody: string | null;
  createdAt: string;
  updatedAt: string;
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
