import React, { useEffect, useState } from 'react';
import { useAdmin } from '../../components/admin/AdminLayout';
import { fetchApi } from '../../hooks/useApi';
import {
  Radar,
  Link2,
  FileText,
  Search as SearchIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  Copy,
  AlertTriangle,
  Ban,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Admin-only lead discovery, crawling, AI drafting and review queue -- merged in from the standalone AI-Outreach
// tool. Every call here goes through /api/admin/outreach/*, which is gated by the same requireAuth check as the
// rest of the admin API (see outreach/route.ts); nothing here is reachable by a site visitor.

type LeadStatus =
  | 'crawling' | 'crawl_error' | 'drafting' | 'draft_error' | 'drafted' | 'duplicate' | 'opted_out' | 'approved' | 'rejected' | 'sent';

interface CrawlEvidence {
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
}

type ContactChannel = 'website' | 'whatsapp' | 'facebook' | 'instagram' | 'phone';

interface Lead {
  id: number;
  businessId: number;
  domain: string;
  website: string | null;
  contactChannel: ContactChannel;
  contactValue: string | null;
  businessName: string | null;
  city: string | null;
  country: string | null;
  source: string;
  status: LeadStatus;
  error: string | null;
  evidence: CrawlEvidence | null;
  draftSubject: string | null;
  draftBody: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SearchRecord {
  id: number;
  city: string;
  category: string;
  createdAt: string;
  resultCount: number;
}

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  crawling: { label: 'Crawling', className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  crawl_error: { label: 'Crawl error', className: 'bg-rose-500/10 text-[#EF4444] border-rose-500/20' },
  drafting: { label: 'Drafting', className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  draft_error: { label: 'Draft error', className: 'bg-rose-500/10 text-[#EF4444] border-rose-500/20' },
  drafted: { label: 'Drafted', className: 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/20' },
  duplicate: { label: 'Duplicate', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  opted_out: { label: 'Opted out', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  approved: { label: 'Approved', className: 'bg-emerald-500/10 text-[#22C55E] border-emerald-500/20' },
  rejected: { label: 'Rejected', className: 'bg-rose-500/10 text-[#EF4444] border-rose-500/20' },
  sent: { label: 'Sent', className: 'bg-emerald-500/10 text-[#22C55E] border-emerald-500/20' },
};

type Tab = 'queue' | 'add' | 'coverage';

export default function AdminOutreach() {
  const { triggerToast } = useAdmin();
  const [tab, setTab] = useState<Tab>('queue');
  const [config, setConfig] = useState<{ geminiConfigured: boolean; senderConfigured: boolean; osmContactConfigured: boolean } | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All');
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<number, { subject: string; body: string }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [website, setWebsite] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);

  const [csvText, setCsvText] = useState('');
  const [addingCsv, setAddingCsv] = useState(false);

  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  const [coverage, setCoverage] = useState<any>(null);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [optOuts, setOptOuts] = useState<string[]>([]);
  const [optOutEmail, setOptOutEmail] = useState('');
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const qs = statusFilter === 'All' ? '' : `?status=${statusFilter}`;
      const data = await fetchApi(`/api/admin/outreach/leads${qs}`);
      setLeads(Array.isArray(data) ? data : []);
    } catch (err: any) {
      triggerToast('Could not load leads', err.message || 'Something went wrong', 'warning');
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadCoverage = async () => {
    setLoadingCoverage(true);
    try {
      const [stats, history, outs] = await Promise.all([
        fetchApi('/api/admin/outreach/coverage'),
        fetchApi('/api/admin/outreach/search/history'),
        fetchApi('/api/admin/outreach/optouts'),
      ]);
      setCoverage(stats);
      setSearches(Array.isArray(history) ? history : []);
      setOptOuts(Array.isArray(outs) ? outs : []);
    } catch (err: any) {
      triggerToast('Could not load coverage', err.message || 'Something went wrong', 'warning');
    } finally {
      setLoadingCoverage(false);
    }
  };

  useEffect(() => {
    fetchApi('/api/admin/outreach/config').then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (tab === 'coverage') loadCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const summarizeOutcome = (o: any): string => {
    if (o.kind === 'duplicate') return `Already ${o.existingStatus} -- skipped`;
    if (o.kind === 'opted_out') return 'On the do-not-contact list -- skipped';
    if (o.kind === 'crawl_error') return `Crawl failed: ${o.error}`;
    if (o.kind === 'draft_error') return `Draft failed: ${o.error}`;
    if (o.kind === 'drafted') return 'Drafted -- in the review queue';
    if (o.error) return o.error;
    return JSON.stringify(o);
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website.trim()) return;
    setAddingUrl(true);
    try {
      const outcome = await fetchApi('/api/admin/outreach/leads/url', {
        method: 'POST',
        body: JSON.stringify({ website: website.trim(), businessName: businessName.trim() || undefined }),
      });
      triggerToast('Lead processed', summarizeOutcome(outcome), outcome.kind === 'drafted' ? 'success' : 'info');
      setWebsite('');
      setBusinessName('');
      setTab('queue');
      loadLeads();
    } catch (err: any) {
      triggerToast('Could not add lead', err.message || 'Something went wrong', 'warning');
    } finally {
      setAddingUrl(false);
    }
  };

  const handleAddCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setAddingCsv(true);
    try {
      const result = await fetchApi('/api/admin/outreach/leads/csv', { method: 'POST', body: JSON.stringify({ csv: csvText }) });
      const draftedCount = (result.outcomes || []).filter((o: any) => o.kind === 'drafted').length;
      triggerToast('CSV imported', `${result.imported} row(s) processed, ${result.skipped} skipped, ${draftedCount} drafted.`, 'success');
      setCsvText('');
      setTab('queue');
      loadLeads();
    } catch (err: any) {
      triggerToast('Could not import CSV', err.message || 'Something went wrong', 'warning');
    } finally {
      setAddingCsv(false);
    }
  };

  const handleSearch = async (force = false) => {
    if (!city.trim() || !category.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const result = await fetchApi('/api/admin/outreach/search', {
        method: 'POST',
        body: JSON.stringify({ city: city.trim(), category: category.trim(), force }),
      });
      setSearchResult(result);
      if (!result.repeat) {
        const draftedCount = (result.outcomes || []).filter((o: any) => o.kind === 'drafted').length;
        const place = result.resolvedPlace ? ` (searched: ${result.resolvedPlace})` : '';
        triggerToast('Search complete', `Found ${result.found} business(es), ${draftedCount} drafted.${place}`, 'success');
        loadLeads();
      }
    } catch (err: any) {
      const message = err.message || 'Something went wrong';
      triggerToast('Search failed', message, 'warning');
      // Also kept on-screen below the button (not just as a toast) -- a toast can disappear before it's read.
      setSearchResult({ repeat: false, error: message });
    } finally {
      setSearching(false);
    }
  };

  const patchLead = async (id: number, body: Record<string, unknown>) => {
    try {
      const updated = await fetchApi(`/api/admin/outreach/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      return updated as Lead;
    } catch (err: any) {
      triggerToast('Update failed', err.message || 'Something went wrong', 'warning');
      return null;
    }
  };

  const handleSaveDraft = async (lead: Lead) => {
    const edit = draftEdits[lead.id];
    if (!edit) return;
    const updated = await patchLead(lead.id, { draftSubject: edit.subject, draftBody: edit.body });
    if (updated) triggerToast('Draft saved', 'Your edits were saved.', 'success');
  };

  const handleApprove = async (lead: Lead) => {
    const updated = await patchLead(lead.id, { action: 'approve' });
    if (updated) triggerToast('Approved', 'Open the mailto link when ready to send.', 'success');
  };

  const handleReject = async (lead: Lead) => {
    const updated = await patchLead(lead.id, { action: 'reject' });
    if (updated) triggerToast('Rejected', 'This lead will not be drafted again.', 'info');
  };

  const handleMarkSent = async (lead: Lead) => {
    const updated = await patchLead(lead.id, { action: 'mark_sent' });
    if (updated) triggerToast('Marked as sent', 'Recorded in the coverage registry permanently.', 'success');
  };

  const handleAddOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optOutEmail.trim()) return;
    try {
      await fetchApi('/api/admin/outreach/optouts', { method: 'POST', body: JSON.stringify({ email: optOutEmail.trim() }) });
      setOptOutEmail('');
      triggerToast('Added to do-not-contact list', 'This cannot be undone from here.', 'success');
      loadCoverage();
    } catch (err: any) {
      triggerToast('Could not add', err.message || 'Something went wrong', 'warning');
    }
  };

  const mailtoHref = (lead: Lead) => {
    const email = lead.evidence?.emails?.[0];
    if (!email || !lead.draftSubject || !lead.draftBody) return undefined;
    return `mailto:${email}?subject=${encodeURIComponent(lead.draftSubject)}&body=${encodeURIComponent(lead.draftBody)}`;
  };

  // For a no-website lead found via WhatsApp, this opens a chat with the drafted message pre-filled --
  // the closest thing to "send" that exists for a channel with no login/API of its own here.
  const whatsappHref = (lead: Lead) => {
    if (lead.contactChannel !== 'whatsapp' || !lead.contactValue || !lead.draftBody) return undefined;
    const digits = lead.contactValue.replace(/[^\d]/g, '');
    if (!digits) return undefined;
    const text = lead.draftSubject ? `${lead.draftSubject}\n\n${lead.draftBody}` : lead.draftBody;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  const CHANNEL_LABEL: Record<ContactChannel, string> = {
    website: 'Website',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    phone: 'Phone',
  };

  const copyDraft = (lead: Lead) => {
    const text = `Subject: ${lead.draftSubject}\n\n${lead.draftBody}`;
    navigator.clipboard?.writeText(text).then(
      () => triggerToast('Copied', 'Draft copied to clipboard.', 'success'),
      () => triggerToast('Copy failed', 'Could not access the clipboard.', 'warning'),
    );
  };

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  // Bulk review: any lead with a drafted message can be selected, regardless of
  // which status it's currently in (drafted / approved / sent), so the user can
  // glance at and act on many messages in one pass instead of expanding each.
  const selectableLeads = leads.filter((l) => l.draftSubject && l.draftBody);
  const allSelectableSelected = selectableLeads.length > 0 && selectableLeads.every((l) => selectedIds.has(l.id));
  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelectableSelected ? new Set() : new Set(selectableLeads.map((l) => l.id)));
  };

  const handleBulkApprove = async () => {
    const toApprove = selectedLeads.filter((l) => l.status === 'drafted');
    if (toApprove.length === 0) {
      triggerToast('Nothing to approve', 'Select one or more drafted leads first.', 'info');
      return;
    }
    await Promise.all(toApprove.map((l) => patchLead(l.id, { action: 'approve' })));
    triggerToast('Approved', `${toApprove.length} draft(s) approved.`, 'success');
  };

  const handleBulkMarkSent = async () => {
    const toMark = selectedLeads.filter((l) => l.status === 'approved');
    if (toMark.length === 0) {
      triggerToast('Nothing to mark', 'Select one or more approved leads first.', 'info');
      return;
    }
    await Promise.all(toMark.map((l) => patchLead(l.id, { action: 'mark_sent' })));
    triggerToast('Marked as sent', `${toMark.length} lead(s) recorded as sent.`, 'success');
  };

  const handleBulkCopy = () => {
    const withDrafts = selectedLeads.filter((l) => l.draftSubject && l.draftBody);
    if (withDrafts.length === 0) {
      triggerToast('Nothing to copy', 'Select one or more drafted leads first.', 'info');
      return;
    }
    const text = withDrafts
      .map((l) => {
        const contact = l.contactChannel === 'website' ? (l.evidence?.emails?.[0] || 'no email found') : `${CHANNEL_LABEL[l.contactChannel]}: ${l.contactValue}`;
        return `===== ${l.businessName || l.domain} <${contact}> =====\nSubject: ${l.draftSubject}\n\n${l.draftBody}`;
      })
      .join('\n\n\n');
    navigator.clipboard?.writeText(text).then(
      () => triggerToast('Copied', `${withDrafts.length} draft(s) copied -- paste them wherever you send from.`, 'success'),
      () => triggerToast('Copy failed', 'Could not access the clipboard.', 'warning'),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">AI Outreach</h1>
        <p className="text-xs font-mono text-[#00F0FF]/80">LEAD DISCOVERY, CRAWLING & DRAFT REVIEW</p>
      </div>

      {config && (!config.geminiConfigured || !config.senderConfigured) && (
        <div className="glass-admin rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs font-mono text-amber-300 space-y-1">
            {!config.geminiConfigured && <p>GEMINI_API_KEY is not set -- crawling and coverage tracking still work, but drafting will fail with a clear error.</p>}
            {!config.senderConfigured && <p>SENDER_BUSINESS_NAME / SENDER_ADDRESS are not set -- drafted emails will show a placeholder compliance footer until these are set.</p>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/8 text-xs font-mono">
        {([
          ['queue', 'Review Queue', Radar],
          ['add', 'Add Leads', Link2],
          ['coverage', 'Coverage', SearchIcon],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors ${
              tab === key ? 'border-[#00F0FF] text-[#00F0FF]' : 'border-transparent text-gray-500 hover:text-white'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <button
              onClick={() => setStatusFilter('All')}
              className={`px-2.5 py-1 rounded border transition-colors ${statusFilter === 'All' ? 'bg-white/10 text-white border-white/20' : 'bg-white/2 text-gray-500 border-white/8 hover:text-white'}`}
            >
              All ({leads.length})
            </button>
            {(Object.keys(STATUS_META) as LeadStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded border transition-colors ${statusFilter === s ? STATUS_META[s].className : 'bg-white/2 text-gray-500 border-white/8 hover:text-white'}`}
              >
                {STATUS_META[s].label} ({statusCounts[s] || 0})
              </button>
            ))}
            <button onClick={loadLeads} className="ml-auto flex items-center gap-1 text-gray-500 hover:text-white">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {selectableLeads.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-white/[0.03] border border-white/8 rounded-lg p-3 text-xs font-mono">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input type="checkbox" checked={allSelectableSelected} onChange={toggleSelectAll} className="accent-[#00F0FF] w-3.5 h-3.5" />
                Select all with a draft ({selectableLeads.length})
              </label>
              <span className="text-gray-500">{selectedIds.size} selected</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button onClick={handleBulkCopy} disabled={selectedIds.size === 0} className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/8 text-white font-mono text-[10px] uppercase disabled:opacity-30 disabled:cursor-not-allowed">
                  <Copy size={12} /> Copy all selected
                </button>
                <button onClick={handleBulkApprove} disabled={selectedIds.size === 0} className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[#22C55E] font-mono text-[10px] uppercase disabled:opacity-30 disabled:cursor-not-allowed">
                  <CheckCircle2 size={12} /> Approve selected
                </button>
                <button onClick={handleBulkMarkSent} disabled={selectedIds.size === 0} className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[#22C55E] font-mono text-[10px] uppercase disabled:opacity-30 disabled:cursor-not-allowed">
                  <CheckCircle2 size={12} /> Mark selected sent
                </button>
              </div>
            </div>
          )}

          {loadingLeads ? (
            <div className="flex items-center justify-center py-12 text-gray-500"><Loader2 className="animate-spin" /></div>
          ) : leads.length === 0 ? (
            <div className="glass-admin rounded-lg border border-white/8 p-8 text-center text-gray-500 font-mono text-xs">No leads yet -- add one from the "Add Leads" tab.</div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => {
                const expanded = expandedId === lead.id;
                const edit = draftEdits[lead.id] ?? { subject: lead.draftSubject || '', body: lead.draftBody || '' };
                const mailto = mailtoHref(lead);
                return (
                  <div key={lead.id} className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 overflow-hidden">
                    <div className="w-full flex items-center gap-3 p-4">
                      {lead.draftSubject && lead.draftBody && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="accent-[#00F0FF] w-3.5 h-3.5 flex-shrink-0"
                          aria-label={`Select ${lead.businessName || lead.domain}`}
                        />
                      )}
                      <button
                        onClick={() => setExpandedId(expanded ? null : lead.id)}
                        className="flex-1 min-w-0 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors rounded"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{lead.businessName || lead.domain}</p>
                          <p className="text-[10px] font-mono text-gray-500 truncate">
                            {lead.contactChannel === 'website' ? lead.website : `${CHANNEL_LABEL[lead.contactChannel]}: ${lead.contactValue}`}
                            {lead.city ? ` · ${lead.city}` : ''}
                          </p>
                          {!expanded && lead.draftSubject && (
                            <p className="text-[11px] font-mono text-gray-400 truncate mt-1">&ldquo;{lead.draftSubject}&rdquo;</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${STATUS_META[lead.status].className}`}>{STATUS_META[lead.status].label}</span>
                          {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                        </div>
                      </button>
                    </div>

                    {expanded && (
                      <div className="p-4 border-t border-white/8 space-y-4 text-xs">
                        {lead.error && (
                          <div className="flex items-start gap-2 text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded p-2.5">
                            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>{lead.error}</span>
                          </div>
                        )}

                        {lead.evidence && (
                          <div className="bg-white/2 border border-white/8 rounded p-3 space-y-1.5 font-mono text-[11px] text-gray-400">
                            <p><span className="text-gray-500">Title:</span> {lead.evidence.title || '(none)'}</p>
                            <p><span className="text-gray-500">Meta description:</span> {lead.evidence.metaDescription ? 'present' : 'missing'}</p>
                            <p><span className="text-gray-500">Mobile viewport tag:</span> {lead.evidence.hasViewportMeta ? 'present' : 'missing'}</p>
                            <p><span className="text-gray-500">Images missing alt text:</span> {lead.evidence.imagesMissingAlt} of {lead.evidence.imageCount}</p>
                            <p><span className="text-gray-500">Detected CMS:</span> {lead.evidence.cms || 'unknown'}</p>
                            <p><span className="text-gray-500">Contact email:</span> {lead.evidence.emails[0] || '(none found)'}</p>
                            {lead.evidence.issues.length > 0 && <p><span className="text-gray-500">Issues:</span> {lead.evidence.issues.join('; ')}</p>}
                          </div>
                        )}

                        {(lead.status === 'drafted' || lead.status === 'approved' || lead.status === 'sent') && (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">Subject</label>
                            <input
                              value={edit.subject}
                              onChange={(e) => setDraftEdits((prev) => ({ ...prev, [lead.id]: { ...edit, subject: e.target.value } }))}
                              className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs"
                            />
                            <label className="block text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">Body</label>
                            <textarea
                              value={edit.body}
                              onChange={(e) => setDraftEdits((prev) => ({ ...prev, [lead.id]: { ...edit, body: e.target.value } }))}
                              className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs h-40 resize-y"
                            />
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button onClick={() => handleSaveDraft(lead)} className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/8 text-white font-mono text-[10px] uppercase">Save edits</button>
                              {mailto && (
                                <a href={mailto} className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/20 text-[#00F0FF] font-mono text-[10px] uppercase">
                                  <Mail size={12} /> Open in mail client
                                </a>
                              )}
                              {whatsappHref(lead) && (
                                <a href={whatsappHref(lead)} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[#22C55E] font-mono text-[10px] uppercase">
                                  <Mail size={12} /> Open in WhatsApp
                                </a>
                              )}
                              {!mailto && !whatsappHref(lead) && lead.contactChannel !== 'website' && (
                                <span className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/2 border border-white/8 text-gray-500 font-mono text-[10px] uppercase">
                                  No direct link for {CHANNEL_LABEL[lead.contactChannel]} -- use Copy text, then message them there
                                </span>
                              )}
                              <button onClick={() => copyDraft(lead)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/8 text-white font-mono text-[10px] uppercase">
                                <Copy size={12} /> Copy text
                              </button>
                              {lead.status === 'drafted' && (
                                <>
                                  <button onClick={() => handleApprove(lead)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[#22C55E] font-mono text-[10px] uppercase">
                                    <CheckCircle2 size={12} /> Approve
                                  </button>
                                  <button onClick={() => handleReject(lead)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-[#EF4444] font-mono text-[10px] uppercase">
                                    <XCircle size={12} /> Reject
                                  </button>
                                </>
                              )}
                              {lead.status === 'approved' && (
                                <button onClick={() => handleMarkSent(lead)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[#22C55E] font-mono text-[10px] uppercase">
                                  <CheckCircle2 size={12} /> Mark sent (I sent this myself)
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'add' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
            <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider flex items-center gap-1.5"><Link2 size={13} /> One website</h3>
            <form onSubmit={handleAddUrl} className="space-y-2">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs" />
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name (optional)" className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs" />
              <button type="submit" disabled={addingUrl || !website.trim()} className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-[#00F0FF] text-black font-mono font-bold text-[10px] uppercase disabled:opacity-40">
                {addingUrl ? <Loader2 size={13} className="animate-spin" /> : null} Crawl & draft
              </button>
            </form>
          </div>

          <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
            <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider flex items-center gap-1.5"><FileText size={13} /> CSV import</h3>
            <form onSubmit={handleAddCsv} className="space-y-2">
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={"website,businessName,city\nexample.com,Example Co,Lagos"} className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs h-28 resize-none font-mono" />
              <button type="submit" disabled={addingCsv || !csvText.trim()} className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-[#00F0FF] text-black font-mono font-bold text-[10px] uppercase disabled:opacity-40">
                {addingCsv ? <Loader2 size={13} className="animate-spin" /> : null} Import & process
              </button>
            </form>
          </div>

          <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
            <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider flex items-center gap-1.5"><SearchIcon size={13} /> Auto-search (OpenStreetMap)</h3>
            <div className="space-y-2">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, e.g. Lagos, Nigeria" className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs" />
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category, e.g. plumbers" className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs" />
              <button onClick={() => handleSearch(false)} disabled={searching || !city.trim() || !category.trim()} className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-[#00F0FF] text-black font-mono font-bold text-[10px] uppercase disabled:opacity-40">
                {searching ? <Loader2 size={13} className="animate-spin" /> : null} Search & process
              </button>
            </div>
            {searchResult?.repeat && (
              <div className="text-[11px] font-mono text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded p-2.5 space-y-2">
                <p>{searchResult.message}</p>
                <button onClick={() => handleSearch(true)} className="underline hover:text-amber-200">Run it again anyway</button>
              </div>
            )}
            {searchResult?.error && (
              <div className="text-[11px] font-mono text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded p-2.5 space-y-2">
                <p>{searchResult.error}</p>
                <button onClick={() => handleSearch(false)} className="underline hover:text-rose-200">Try again</button>
              </div>
            )}
            {searchResult && !searchResult.repeat && !searchResult.error && (
              <div className="text-[11px] font-mono text-gray-400 space-y-1">
                <p>Found {searchResult.found} business(es). See the Review Queue tab.</p>
                {searchResult.resolvedPlace && (
                  <p className="text-gray-500">
                    Searched around: <span className="text-gray-300">{searchResult.resolvedPlace}</span> -- check this matches where you meant.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'coverage' && (
        <div className="space-y-4">
          {loadingCoverage ? (
            <div className="flex items-center justify-center py-12 text-gray-500"><Loader2 className="animate-spin" /></div>
          ) : coverage ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  ['Businesses', coverage.totalBusinesses],
                  ['Drafted', coverage.drafted],
                  ['Sent', coverage.sent],
                  ['Rejected', coverage.rejected],
                  ['Searches run', coverage.searchesRun],
                ].map(([label, value]) => (
                  <div key={label as string} className="glass-admin p-3 rounded border border-white/8 bg-[#111111]/40">
                    <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">{label}</h4>
                    <p className="text-xl font-bold text-white font-mono mt-1">{value ?? 0}</p>
                  </div>
                ))}
              </div>

              <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4">
                <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider mb-3">Search history</h3>
                {searches.length === 0 ? (
                  <p className="text-xs font-mono text-gray-500">No searches run yet.</p>
                ) : (
                  <div className="space-y-1.5 text-xs font-mono">
                    {searches.map((s) => (
                      <div key={s.id} className="flex justify-between text-gray-400 border-b border-white/4 pb-1.5">
                        <span className="text-white">{s.category} in {s.city}</span>
                        <span>{s.resultCount} found · {new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
                <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider flex items-center gap-1.5"><Ban size={13} /> Do-not-contact list</h3>
                <p className="text-[11px] font-mono text-gray-500">Checked before every draft. Adding an email here cannot be undone from this screen.</p>
                <form onSubmit={handleAddOptOut} className="flex gap-2">
                  <input value={optOutEmail} onChange={(e) => setOptOutEmail(e.target.value)} placeholder="email@example.com" className="flex-1 bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs" />
                  <button type="submit" className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 border border-white/8 text-white font-mono text-[10px] uppercase">Add</button>
                </form>
                {optOuts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {optOuts.map((email) => (
                      <span key={email} className="px-2 py-1 rounded bg-white/4 border border-white/8 text-[10px] font-mono text-gray-300">{email}</span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-admin rounded-lg border border-white/8 p-8 text-center text-gray-500 font-mono text-xs">Could not load coverage data.</div>
          )}
        </div>
      )}
    </div>
  );
}
