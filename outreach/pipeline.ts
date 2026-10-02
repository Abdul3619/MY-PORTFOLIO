// The one pipeline every lead goes through, no matter how it entered
// (pasted URL, CSV row, or auto-search result): crawl -> check coverage
// registry -> draft -> land in the review queue. No per-lead manual
// trigger is needed once this is called.

import { Store } from './store.js';
import { crawlHomepage } from './crawler.js';
import { draftEmail, type SenderProfile } from './gemini.js';
import { appendComplianceFooter } from './compliance.js';
import { domainKey, normalizeUrl } from './domain.js';
import type { Lead, LeadSource } from './types.js';

export interface PipelineInput {
  website: string;
  businessName?: string | null;
  city?: string | null;
  country?: string | null;
  source: LeadSource;
}

export interface PipelineDeps {
  store: Store;
  sender: SenderProfile;
  crawl?: typeof crawlHomepage;
  draft?: typeof draftEmail;
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

export function loadSenderProfileFromEnv(): SenderProfile {
  return {
    businessName: process.env.SENDER_BUSINESS_NAME || '',
    services: (process.env.SENDER_SERVICES || 'Web design, web development, website audits').split(',').map((s) => s.trim()),
    tone: process.env.SENDER_TONE || 'friendly, direct, not salesy',
    address: process.env.SENDER_ADDRESS || '',
  };
}
