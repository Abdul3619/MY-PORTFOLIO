// Data access layer. Talks to Supabase Postgres exclusively through
// SECURITY DEFINER RPC functions (see supabase/migration.sql) — never a
// direct table query — so the app only ever needs the public anon key.
//
// The Supabase JS client's `.rpc()` method is the only thing this class
// depends on, expressed here as the minimal `RpcClient` interface. That
// makes it possible to unit-test all of this app's data logic with an
// in-memory stand-in that implements the same interface (see
// test/fakeRpcClient.ts) without needing a real Supabase project, a
// network connection, or the @supabase/supabase-js package installed.

import type { Business, Lead, LeadSource, LeadStatus, RegistryEntry, SearchRecord, CrawlEvidence } from './types.js';

export interface RpcResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface RpcClient {
  rpc<T = any>(fn: string, params?: Record<string, any>): Promise<RpcResult<T>>;
}

function unwrap<T>(result: RpcResult<T>, context: string): T {
  if (result.error) {
    throw new Error(`${context} failed: ${result.error.message}`);
  }
  return result.data as T;
}

export class Store {
  constructor(private client: RpcClient) {}

  // ---- businesses ------------------------------------------------

  async upsertBusiness(input: { domain: string; website: string; name?: string | null; city?: string | null; country?: string | null }): Promise<Business> {
    const result = await this.client.rpc<any>('ai_outreach_upsert_business', {
      p_domain: input.domain,
      p_website: input.website,
      p_name: input.name ?? null,
      p_city: input.city ?? null,
      p_country: input.country ?? null,
    });
    const row = unwrap(result, 'upsertBusiness');
    return {
      id: row.id,
      domain: row.domain,
      name: row.name,
      website: row.website,
      city: row.city,
      country: row.country,
      createdAt: row.createdAt,
    };
  }

  // ---- leads -------------------------------------------------------

  async createLead(businessId: number, source: LeadSource, status: LeadStatus): Promise<number> {
    const result = await this.client.rpc<number>('ai_outreach_create_lead', {
      p_business_id: businessId,
      p_source: source,
      p_status: status,
    });
    return unwrap(result, 'createLead');
  }

  async updateLead(
    id: number,
    patch: Partial<{ status: LeadStatus; error: string | null; evidence: CrawlEvidence | null; draftSubject: string | null; draftBody: string | null }>,
  ): Promise<void> {
    const result = await this.client.rpc('ai_outreach_update_lead', { p_lead_id: id, p_patch: patch });
    unwrap(result, 'updateLead');
  }

  async getLead(id: number): Promise<Lead | null> {
    const result = await this.client.rpc<any>('ai_outreach_get_lead', { p_lead_id: id });
    const row = unwrap(result, 'getLead');
    return row ? rowToLead(row) : null;
  }

  async listLeads(filter?: { status?: LeadStatus }): Promise<Lead[]> {
    const result = await this.client.rpc<any[]>('ai_outreach_list_leads', { p_status: filter?.status ?? null });
    const rows = unwrap(result, 'listLeads') || [];
    return rows.map(rowToLead);
  }

  // ---- registry (permanent coverage record) -------------------------

  async getRegistryEntry(domain: string): Promise<RegistryEntry | null> {
    const result = await this.client.rpc<any>('ai_outreach_check_registry', { p_domain: domain });
    const row = unwrap(result, 'getRegistryEntry');
    return row ? rowToRegistryEntry(row) : null;
  }

  /** Records an action against a domain in the permanent registry. The RPC
   * function itself enforces "only move forward" — it never downgrades a
   * 'sent' business back to 'seen' just because it got crawled again. */
  async recordRegistryAction(input: { domain: string; businessName?: string | null; status: LeadStatus; city?: string | null; country?: string | null }): Promise<void> {
    const result = await this.client.rpc('ai_outreach_record_action', {
      p_domain: input.domain,
      p_status: input.status,
      p_business_name: input.businessName ?? null,
      p_city: input.city ?? null,
      p_country: input.country ?? null,
    });
    unwrap(result, 'recordRegistryAction');
  }

  /** A business counts as "already covered" for dedup purposes once it has
   * been drafted, rejected, approved, or sent — i.e. a human has already
   * seen a real draft for it, or it has been contacted. Bare crawl/draft
   * *errors* don't count, so a transient failure can be retried later. */
  async isAlreadyCovered(domain: string): Promise<RegistryEntry | null> {
    const entry = await this.getRegistryEntry(domain);
    if (!entry) return null;
    const covered: LeadStatus[] = ['drafted', 'rejected', 'approved', 'sent'];
    return covered.includes(entry.status) ? entry : null;
  }

  // ---- searches (auto-search coverage) -------------------------------

  async findPriorSearch(city: string, category: string): Promise<SearchRecord | null> {
    const result = await this.client.rpc<any>('ai_outreach_find_prior_search', { p_city: city, p_category: category });
    const row = unwrap(result, 'findPriorSearch');
    return row ? rowToSearchRecord(row) : null;
  }

  async recordSearch(city: string, category: string, resultCount: number): Promise<number> {
    const result = await this.client.rpc<number>('ai_outreach_record_search', {
      p_city: city,
      p_category: category,
      p_result_count: resultCount,
    });
    return unwrap(result, 'recordSearch');
  }

  async listSearches(): Promise<SearchRecord[]> {
    const result = await this.client.rpc<any[]>('ai_outreach_list_searches');
    const rows = unwrap(result, 'listSearches') || [];
    return rows.map(rowToSearchRecord);
  }

  // ---- opt-outs -------------------------------------------------------
  // Note: there is deliberately no "remove opt-out" method or RPC. Once
  // added, an opt-out cannot be reversed through this app.

  async addOptOut(email: string): Promise<void> {
    const result = await this.client.rpc('ai_outreach_add_optout', { p_email: email });
    unwrap(result, 'addOptOut');
  }

  async isOptedOut(email: string): Promise<boolean> {
    const result = await this.client.rpc<boolean>('ai_outreach_check_optout', { p_email: email });
    return !!unwrap(result, 'isOptedOut');
  }

  async listOptOuts(): Promise<string[]> {
    const result = await this.client.rpc<any[]>('ai_outreach_list_optouts');
    const rows = unwrap(result, 'listOptOuts') || [];
    return rows.map((r) => r.email);
  }

  // ---- coverage stats --------------------------------------------------

  async coverageStats() {
    const result = await this.client.rpc<any>('ai_outreach_coverage_stats');
    const stats = unwrap(result, 'coverageStats');
    return {
      totalBusinesses: stats.totalBusinesses,
      sent: stats.sent,
      drafted: stats.drafted,
      rejected: stats.rejected,
      searchesRun: stats.searchesRun,
      citiesCovered: stats.citiesCovered,
      searches: (stats.searches || []).map(rowToSearchRecord),
    };
  }
}

function rowToLead(row: any): Lead {
  return {
    id: row.id,
    businessId: row.businessId,
    domain: row.domain,
    website: row.website,
    businessName: row.businessName,
    city: row.city,
    country: row.country,
    source: row.source,
    status: row.status,
    error: row.error,
    evidence: row.evidence ?? null,
    draftSubject: row.draftSubject,
    draftBody: row.draftBody,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToRegistryEntry(row: any): RegistryEntry {
  return {
    domain: row.domain,
    businessName: row.businessName,
    status: row.status,
    city: row.city,
    country: row.country,
    firstSeenAt: row.firstSeenAt,
    lastActionAt: row.lastActionAt,
  };
}

function rowToSearchRecord(row: any): SearchRecord {
  return { id: row.id, city: row.city, category: row.category, createdAt: row.createdAt, resultCount: row.resultCount };
}
