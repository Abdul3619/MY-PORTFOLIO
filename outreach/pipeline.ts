// The one pipeline every lead goes through, no matter how it entered
// (pasted URL, CSV row, or auto-search result): crawl -> check coverage
// registry -> draft -> land in the review queue. No per-lead manual
// trigger is needed once this is called.

import { Store } from './store.js';
import { crawlHomepage } from './crawler.js';
import { draftEmail, draftNoWebsiteEmail, type SenderProfile } from './gemini.js';
import { appendComplianceFooter } from './compliance.js';
import { domainKey, normalizeUrl, contactKey } from './domain.js';
import type { Lead, LeadSource } from './types.js';

export interface PipelineInput {
  website: string;
  businessName?: string | null;
  city?: string | null;
  country?: string | null;
  source: LeadSource;
  /** A phone number OSM had on file for this business even though it also has a website (see
   * overpass.ts's extractContact). Carried onto the business record as a bonus contact method, never
   * overwriting whatever the crawler itself finds on the site. */
  osmPhone?: string | null;
}

export interface PipelineDeps {
  store: Store;
  sender: SenderProfile;
  crawl?: typeof crawlHomepage;
  draft?: typeof draftEmail;
  draftNoWebsite?: typeof draftNoWebsiteEmail;
}

export type PipelineOutcome =
  | { kind: 'duplicate'; leadId: null; domain: string; existingStatus: string }
  | { kind: 'opted_out'; leadId: number; domain: string }
  | { kind: 'crawl_error'; leadId: number; domain: string; error: string }
  | { kind: 'draft_error'; leadId: number; domain: string; error: string }
  | { kind: 'drafted'; leadId: number; domain: string };

/** Runs one lead through the full pipeline. Always checks the permanent
 * coverage registry FIRST, before doing any network work, so a duplicate
 * never gets re-crawled or re-drafted. */
export async function runLeadPipeline(input: PipelineInput, deps: PipelineDeps): Promise<PipelineOutcome> {
  const { store } = deps;
  const crawl = deps.crawl ?? crawlHomepage;
  const draft = deps.draft ?? draftEmail;

  let domain: string;
  try {
    domain = domainKey(input.website);
  } catch (e: any) {
    // Not a usable URL at all — record nothing, just report it up.
    throw new Error(`Invalid website "${input.website}": ${e.message || e}`);
  }

  const alreadyCovered = await store.isAlreadyCovered(domain);
  if (alreadyCovered) {
    return { kind: 'duplicate', leadId: null, domain, existingStatus: alreadyCovered.status };
  }

  const business = await store.upsertBusiness({
    domain,
    website: normalizeUrl(input.website),
    name: input.businessName ?? null,
    city: input.city ?? null,
    country: input.country ?? null,
    contactValue: input.osmPhone ?? null,
  });

  const leadId = await store.createLead(business.id, input.source, 'crawling');
  await store.recordRegistryAction({ domain, businessName: input.businessName, status: 'crawling', city: input.city, country: input.country });

  const crawlResult = await crawl(business.website);
  if (!crawlResult.ok || !crawlResult.evidence) {
    const error = crawlResult.error || 'Unknown crawl error';
    await store.updateLead(leadId, { status: 'crawl_error', error });
    await store.recordRegistryAction({ domain, status: 'crawl_error' });
    return { kind: 'crawl_error', leadId, domain, error };
  }

  await store.updateLead(leadId, { evidence: crawlResult.evidence, status: 'drafting' });

  // Opt-out check happens after crawling (we still want the evidence saved
  // for transparency) but strictly before drafting or contacting anyone.
  const contactEmail = crawlResult.evidence.emails[0];
  if (contactEmail && (await store.isOptedOut(contactEmail))) {
    await store.updateLead(leadId, { status: 'opted_out', error: `${contactEmail} is on the do-not-contact list.` });
    await store.recordRegistryAction({ domain, status: 'opted_out' });
    return { kind: 'opted_out', leadId, domain };
  }

  const draftResult = await draft({
    businessName: input.businessName || business.name || domain,
    website: business.website,
    evidence: crawlResult.evidence,
    sender: deps.sender,
  });

  if (!draftResult.ok || !draftResult.subject || !draftResult.body) {
    const error = draftResult.error || 'Unknown drafting error';
    await store.updateLead(leadId, { status: 'draft_error', error });
    // Deliberately NOT recording this in the registry as "drafted" — a
    // failed draft attempt should not block a future retry.
    return { kind: 'draft_error', leadId, domain, error };
  }

  const finalBody = appendComplianceFooter(draftResult.body, deps.sender);
  await store.updateLead(leadId, { status: 'drafted', draftSubject: draftResult.subject, draftBody: finalBody, error: null });
  await store.recordRegistryAction({ domain, businessName: input.businessName || business.name, status: 'drafted', city: input.city, country: input.country });

  return { kind: 'drafted', leadId, domain };
}

export interface NoWebsitePipelineInput {
  businessName: string;
  category: string;
  city?: string | null;
  country?: string | null;
  contactChannel: 'whatsapp' | 'facebook' | 'instagram' | 'phone';
  contactValue: string;
  source: LeadSource;
}

/** The equivalent of runLeadPipeline for a business that has no website --
 * no homepage to crawl, so this skips straight to drafting, grounded only
 * in the bare facts (name, category, city, how they're reachable). Still
 * goes through the same permanent coverage registry first, keyed on the
 * contact info itself (see contactKey) instead of a domain. */
export async function runNoWebsiteLeadPipeline(input: NoWebsitePipelineInput, deps: PipelineDeps): Promise<PipelineOutcome> {
  const { store } = deps;
  const draft = deps.draftNoWebsite ?? draftNoWebsiteEmail;

  let key: string;
  try {
    key = contactKey(input.contactChannel, input.contactValue);
  } catch (e: any) {
    throw new Error(`Invalid ${input.contactChannel} contact "${input.contactValue}": ${e.message || e}`);
  }

  const alreadyCovered = await store.isAlreadyCovered(key);
  if (alreadyCovered) {
    return { kind: 'duplicate', leadId: null, domain: key, existingStatus: alreadyCovered.status };
  }

  const business = await store.upsertBusiness({
    domain: key,
    website: null,
    name: input.businessName ?? null,
    city: input.city ?? null,
    country: input.country ?? null,
    contactChannel: input.contactChannel,
    contactValue: input.contactValue,
  });

  const leadId = await store.createLead(business.id, input.source, 'drafting');
  await store.recordRegistryAction({ domain: key, businessName: input.businessName, status: 'drafting', city: input.city, country: input.country });

  // No email address exists for these channels, so the opt-out list (keyed
  // on email) doesn't apply here -- there's no email to check against.

  const draftResult = await draft({
    businessName: input.businessName || business.name || key,
    category: input.category,
    city: input.city ?? null,
    contactChannel: input.contactChannel,
    sender: deps.sender,
  });

  if (!draftResult.ok || !draftResult.subject || !draftResult.body) {
    const error = draftResult.error || 'Unknown drafting error';
    await store.updateLead(leadId, { status: 'draft_error', error });
    return { kind: 'draft_error', leadId, domain: key, error };
  }

  const finalBody = appendComplianceFooter(draftResult.body, deps.sender);
  await store.updateLead(leadId, { status: 'drafted', draftSubject: draftResult.subject, draftBody: finalBody, error: null });
  await store.recordRegistryAction({ domain: key, businessName: input.businessName || business.name, status: 'drafted', city: input.city, country: input.country });

  return { kind: 'drafted', leadId, domain: key };
}

/** Runs several async jobs with at most `limit` running at once. Crawling
 * and drafting are both network-bound (waiting on someone else's server,
 * then on Gemini), so running a handful in parallel instead of one at a
 * time lets a single auto-search request get through several times as
 * many businesses before the platform's request time limit cuts it off --
 * without this, a 60-second budget only fits 5-10 businesses processed
 * one after another; with 5-way concurrency it fits several times that. */
export async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runNext(): Promise<void> {
    const i = next++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

export function loadSenderProfileFromEnv(): SenderProfile {
  return {
    businessName: process.env.SENDER_BUSINESS_NAME || '',
    services: (process.env.SENDER_SERVICES || 'Web design, web development, website audits').split(',').map((s) => s.trim()),
    tone: process.env.SENDER_TONE || 'friendly, direct, not salesy',
    address: process.env.SENDER_ADDRESS || '',
    portfolioUrl: process.env.SENDER_PORTFOLIO_URL || undefined,
  };
}
