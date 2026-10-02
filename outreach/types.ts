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

export interface Business {
  id: number;
  domain: string;
  name: string | null;
  website: string;
  city: string | null;
  country: string | null;
  createdAt: string;
}

export interface Lead {
  id: number;
  businessId: number;
  domain: string;
  website: string;
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
