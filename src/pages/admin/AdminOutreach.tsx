import React, { useEffect, useRef, useState } from 'react';
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
  fallbackPhone: string | null;
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

type Tab = 'queue' | 'add' | 'coverage' | 'inbox';

function normalizeWhatsAppUrl(raw: string, text?: string): string | undefined {
  if (!raw) return undefined;
  // If raw is already a wa.me or api.whatsapp.com URL:
  if (/wa\.me\/|whatsapp\.com/i.test(raw)) {
    const phoneMatch = raw.match(/(?:wa\.me\/|phone=)(\+?\d+)/i);
    if (phoneMatch) raw = phoneMatch[1];
    else {
      if (!text) return raw;
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}text=${encodeURIComponent(text)}`;
    }
  }
  let digits = raw.replace(/\D/g, '');
  // Fewer than 7 digits can't be a real phone number -- rather than build a wa.me link to a near-empty
  // number (a dead button that "doesn't lead to WhatsApp when opened"), treat it as no number at all.
  if (!digits || digits.length < 7) return undefined;
  // Handle Nigerian mobile format (080..., 081..., 070..., 090..., 091...): strip leading 0 and prepend 234
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '234' + digits.slice(1);
  } else if (digits.startsWith('0') && (digits.length === 10 || digits.length === 12)) {
    digits = '234' + digits.slice(1);
  } else if (digits.length === 10 && !digits.startsWith('234')) {
    digits = '234' + digits;
  }
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

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
  const [searchElapsed, setSearchElapsed] = useState(0);
  const searchResultRef = useRef<HTMLDivElement>(null);

  // A search can take anywhere from a few seconds to over a minute (it's crawling and drafting several
  // businesses, not just doing one lookup), and a bare spinner with no sense of progress or time reads as
  // "stuck" long before it actually is. There's no real progress feed from the backend without streaming
  // (a bigger change), so this gives an honest, reassuring substitute: a running clock plus a slow-changing
  // description of what's *likely* happening at that point in the process.
  useEffect(() => {
    if (!searching) {
      setSearchElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setSearchElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [searching]);

  const SEARCH_STAGES: Array<{ afterSeconds: number; label: string }> = [
    { afterSeconds: 0, label: 'Looking up the place on the map...' },
    { afterSeconds: 4, label: 'Searching OpenStreetMap for matching businesses...' },
    { afterSeconds: 10, label: 'Visiting each business’s website and checking it over...' },
    { afterSeconds: 20, label: 'Drafting outreach messages with AI for each lead...' },
    { afterSeconds: 40, label: 'Still working -- larger searches (50+ results) can take a minute or so...' },
  ];
  const currentSearchStage = [...SEARCH_STAGES].reverse().find((s) => searchElapsed >= s.afterSeconds) ?? SEARCH_STAGES[0];

  // So a finished result is impossible to miss on mobile, where this card can be a full scroll away from
  // where the person's thumb already is.
  useEffect(() => {
    if (searchResult && searchResultRef.current) {
      searchResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchResult]);

  const [coverage, setCoverage] = useState<any>(null);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [optOuts, setOptOuts] = useState<string[]>([]);
  const [optOutEmail, setOptOutEmail] = useState('');
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // Inbox tab: a read-only view of the admin's own Gmail (replies / sent-confirmation / unsubscribes for
  // outreach leads) plus the portfolio's own contact-form messages, side by side in one place.
  const [gmailStatus, setGmailStatus] = useState<{ configured: boolean; connected: boolean; email?: string | null } | null>(null);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [portfolioMessages, setPortfolioMessages] = useState<any[]>([]);
  const [loadingPortfolioMessages, setLoadingPortfolioMessages] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(false);
  const [gmailByEmail, setGmailByEmail] = useState<Record<string, { messages: any[]; looksLikeUnsubscribe: boolean }>>({});

  const loadGmailStatus = async () => {
    try {
      setGmailStatus(await fetchApi('/api/admin/inbox/status'));
    } catch {
      setGmailStatus(null);
    }
  };

  const loadPortfolioMessages = async () => {
    setLoadingPortfolioMessages(true);
    try {
      const data = await fetchApi('/api/admin/messages');
      setPortfolioMessages(Array.isArray(data) ? data : []);
    } catch {
      setPortfolioMessages([]);
    } finally {
      setLoadingPortfolioMessages(false);
    }
  };

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const { url } = await fetchApi('/api/admin/inbox/connect');
      window.location.href = url;
    } catch (err: any) {
      triggerToast('Could not start Gmail connection', err.message || 'Something went wrong', 'warning');
      setConnectingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await fetchApi('/api/admin/inbox/disconnect', { method: 'POST' });
      setGmailStatus({ configured: true, connected: false });
      setGmailByEmail({});
      triggerToast('Disconnected', 'Gmail is no longer connected.', 'success');
    } catch (err: any) {
      triggerToast('Could not disconnect', err.message || 'Something went wrong', 'warning');
    }
  };

  // Every lead with a known email, regardless of status -- this is what gets checked against Gmail.
  const leadEmails = Array.from(new Set(leads.map((l) => l.evidence?.emails?.[0]).filter((e): e is string => Boolean(e))));

  const handleCheckGmail = async () => {
    if (leadEmails.length === 0) {
      triggerToast('Nothing to check', 'No leads with a known email yet.', 'info');
      return;
    }
    setCheckingGmail(true);
    try {
      const result = await fetchApi('/api/admin/inbox/messages', { method: 'POST', body: JSON.stringify({ emails: leadEmails }) });
      setGmailByEmail(result.byEmail || {});
      const repliedCount = Object.values(result.byEmail || {}).filter((v: any) => v.messages.some((m: any) => m.labelIds?.includes('INBOX'))).length;
      const newlyOptedOut: string[] = result.newlyOptedOut || [];
      if (newlyOptedOut.length > 0) {
        triggerToast(
          'Unsubscribe requests honored',
          `${newlyOptedOut.length} contact(s) asked not to be emailed again and were added to the do-not-contact list automatically: ${newlyOptedOut.join(', ')}`,
          'warning',
        );
      } else {
        triggerToast('Checked Gmail', `${repliedCount} lead(s) have activity in your inbox or sent folder.`, 'success');
      }
    } catch (err: any) {
      triggerToast('Could not check Gmail', err.message || 'Something went wrong', 'warning');
    } finally {
      setCheckingGmail(false);
    }
  };

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
    if (tab === 'inbox') {
      loadGmailStatus();
      loadPortfolioMessages();
    }
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
        const rawNote = result.found === 0 && result.rawCount > 0 ? ` ${result.rawCount} matched but had no usable contact info.` : '';
        triggerToast('Search complete', `Found ${result.found} business(es), ${draftedCount} drafted.${place}${rawNote}`, 'success');
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

  const CHANNEL_LABEL: Record<ContactChannel, string> = {
    website: 'Website',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    phone: 'Phone',
  };

  interface ContactOption {
    key: string;
    label: string;
    display: string;
    href?: string;
    external?: boolean;
    /** True when this is a phone number being offered as "might also be their WhatsApp" rather than a
     * confirmed WhatsApp contact -- most small businesses run WhatsApp on their normal line, but OSM/the
     * crawled site never actually says so, so this is a guess worth labeling as one. */
    unconfirmed?: boolean;
  }

  // Every way we actually have on file to reach this lead -- not just whichever one happened to be picked
  // as the "primary" channel. A website-channel business can still have a phone number the crawler found on
  // the page, or social links, or (if OSM tagged it) a phone number carried over from the map data even
  // though the website won out as the primary channel. Surfacing all of them is the fix for leads that
  // looked like "nothing to reach them by" when a usable contact was sitting in the data all along.
  const getContactOptions = (lead: Lead): ContactOption[] => {
    const draftText = lead.draftSubject && lead.draftBody ? `${lead.draftSubject}\n\n${lead.draftBody}` : null;
    const opts: ContactOption[] = [];

    if (lead.contactChannel === 'website') {
      const email = lead.evidence?.emails?.[0];
      if (email) {
        opts.push({
          key: 'email',
          label: 'Email',
          display: email,
          href: draftText ? `mailto:${email}?subject=${encodeURIComponent(lead.draftSubject || '')}&body=${encodeURIComponent(lead.draftBody || '')}` : `mailto:${email}`,
        });
      }

      // Crawled phone first (found directly on their site); contactValue is the fallback -- for
      // website-channel leads it only ever holds a phone number OSM had tagged alongside the website.
      const phone = lead.evidence?.phones?.[0] || lead.contactValue || undefined;
      if (phone) {
        const digits = phone.replace(/[^\d+]/g, '');
        if (digits) {
          opts.push({ key: 'phone', label: 'Phone', display: phone, href: `tel:${digits}` });
          const waUrl = normalizeWhatsAppUrl(phone, draftText);
          if (waUrl) {
            opts.push({
              key: 'whatsapp-guess',
              label: 'Try WhatsApp',
              display: phone,
              href: waUrl,
              external: true,
              unconfirmed: true,
            });
          }
        }
      }

      for (const [platform, url] of Object.entries(lead.evidence?.socialLinks || {})) {
        if (!url) continue;
        if (platform === 'whatsapp') {
          const waUrl = normalizeWhatsAppUrl(url, draftText);
          if (waUrl) {
            opts.push({ key: 'whatsapp-site', label: 'WhatsApp (from site)', display: url, href: waUrl, external: true });
            continue;
          }
        }
        opts.push({ key: `social-${platform}`, label: platform.charAt(0).toUpperCase() + platform.slice(1), display: url, href: url, external: true });
      }
    } else if (lead.contactValue) {
      if (lead.contactChannel === 'whatsapp') {
        const waUrl = normalizeWhatsAppUrl(lead.contactValue, draftText);
        // Only a real, working link is worth a button -- a dead one (no digits came out of the OSM value)
        // is worse than not showing it, since it looks clickable but silently does nothing.
        if (waUrl) {
          opts.push({ key: 'whatsapp', label: 'WhatsApp', display: lead.contactValue, href: waUrl, external: true });
        }
      } else if (lead.contactChannel === 'phone') {
        const digits = lead.contactValue.replace(/[^\d+]/g, '');
        if (digits) opts.push({ key: 'phone', label: 'Phone', display: lead.contactValue, href: `tel:${digits}` });
      } else {
        // facebook / instagram -- OSM sometimes tags these as a full URL, sometimes just a handle.
        const isUrl = /^https?:\/\//i.test(lead.contactValue);
        let href: string | undefined = undefined;
        if (isUrl) {
          href = lead.contactValue;
        } else if (lead.contactChannel === 'instagram') {
          href = `https://instagram.com/${lead.contactValue.replace(/^@/, '')}`;
        } else if (lead.contactChannel === 'facebook') {
          href = `https://facebook.com/${lead.contactValue.replace(/^@/, '')}`;
        }
        if (href) {
          opts.push({ key: lead.contactChannel, label: CHANNEL_LABEL[lead.contactChannel], display: lead.contactValue, href, external: true });
        }
      }

      // A real phone OSM had on file even though whatsapp/facebook/instagram won as the primary channel --
      // surfaced as its own option (call + a "try WhatsApp" guess) rather than silently dropped. Skipped
      // when the primary channel already IS this same number (phone-channel leads, or a whatsapp value
      // that already came from this phone).
      if (lead.fallbackPhone && lead.fallbackPhone !== lead.contactValue) {
        const digits = lead.fallbackPhone.replace(/[^\d+]/g, '');
        if (digits) {
          opts.push({ key: 'fallback-phone', label: 'Phone', display: lead.fallbackPhone, href: `tel:${digits}` });
          const waUrl = normalizeWhatsAppUrl(lead.fallbackPhone, draftText);
          if (waUrl && lead.contactChannel !== 'whatsapp') {
            opts.push({ key: 'fallback-whatsapp', label: 'Try WhatsApp', display: lead.fallbackPhone, href: waUrl, external: true, unconfirmed: true });
          }
        }
      }
    }

    return opts;
  };

  /** A single short line for previews/exports -- the first (best) contact option, or an honest "none found"
   * rather than silently showing nothing. */
  const primaryContactLine = (lead: Lead): string => {
    const opts = getContactOptions(lead);
    if (opts.length === 0) return 'no contact info found';
    return `${opts[0].label}: ${opts[0].display}`;
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
        return `===== ${l.businessName || l.domain} <${primaryContactLine(l)}> =====\nSubject: ${l.draftSubject}\n\n${l.draftBody}`;
      })
      .join('\n\n\n');
    navigator.clipboard?.writeText(text).then(
      () => triggerToast('Copied', `${withDrafts.length} draft(s) copied -- paste them wherever you send from.`, 'success'),
      () => triggerToast('Copy failed', 'Could not access the clipboard.', 'warning'),
    );
  };

  const csvField = (value: string): string => `"${value.replace(/"/g, '""')}"`;

  // Everything needed to actually reach and follow up on a batch of leads, as one CSV -- all the contact
  // info gathered, not just whichever single field happened to be shown in the UI. Built from the leads
  // already loaded in this tab, so no extra request or backend route is needed; the date range just filters
  // what's already here by createdAt.
  const handleExportContacts = (rangeDays: number | null) => {
    const cutoff = rangeDays === null ? null : Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    const inRange = leads.filter((l) => cutoff === null || new Date(l.createdAt).getTime() >= cutoff);
    if (inRange.length === 0) {
      triggerToast('Nothing to export', 'No leads fall in that date range.', 'info');
      return;
    }

    const headers = ['Business', 'City', 'Country', 'Status', 'Best contact', 'Email', 'Phone', 'WhatsApp/Phone channel', 'Social links', 'Website', 'Subject', 'Created at'];
    const rows = inRange.map((l) => {
      const opts = getContactOptions(l);
      const email = l.contactChannel === 'website' ? l.evidence?.emails?.[0] || '' : '';
      const phone = l.contactChannel === 'website' ? l.evidence?.phones?.[0] || l.contactValue || '' : l.contactChannel === 'phone' ? l.contactValue || '' : '';
      const waOrChannel = l.contactChannel !== 'website' ? `${CHANNEL_LABEL[l.contactChannel]}: ${l.contactValue || ''}` : '';
      const social = Object.entries(l.evidence?.socialLinks || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      return [
        l.businessName || l.domain,
        l.city || '',
        l.country || '',
        STATUS_META[l.status].label,
        opts[0] ? `${opts[0].label}: ${opts[0].display}` : 'none found',
        email,
        phone,
        waOrChannel,
        social,
        l.website || '',
        l.draftSubject || '',
        l.createdAt,
      ]
        .map((v) => csvField(String(v)))
        .join(',');
    });
    const csv = [headers.map(csvField).join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = rangeDays === null ? 'all-time' : `last-${rangeDays}d`;
    a.href = url;
    a.download = `outreach-contacts-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    triggerToast('Exported', `${inRange.length} lead(s) exported to a CSV file.`, 'success');
  };

  // vCard special characters (comma, semicolon, backslash, newline) have to be backslash-escaped inside a
  // field value, or they get parsed as a field separator by the phone's contacts app instead of literal text.
  const vcardEscape = (value: string): string => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  // One .vcf file holding every lead that has a usable phone number, built as a sequence of standard VCARD
  // blocks (the same format a phone's own "export contact" produces). Opening a .vcf with more than one
  // VCARD in it is exactly what both iOS and Android treat as "import all of these" -- so this is a single
  // tap to add every number to the real phone contacts app, rather than saving each lead one at a time.
  const handleExportVCard = (rangeDays: number | null) => {
    const cutoff = rangeDays === null ? null : Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    const inRange = leads.filter((l) => cutoff === null || new Date(l.createdAt).getTime() >= cutoff);

    const cards: string[] = [];
    for (const l of inRange) {
      const opts = getContactOptions(l);
      const phoneOpt = opts.find((o) => o.key === 'phone');
      const email = l.contactChannel === 'website' ? l.evidence?.emails?.[0] : undefined;
      if (!phoneOpt && !email) continue; // nothing a phone contacts app can actually store for this lead

      const name = l.businessName || l.domain;
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardEscape(name)}`, `ORG:${vcardEscape(name)}`];
      if (phoneOpt) {
        const digits = phoneOpt.display.replace(/[^\d+]/g, '');
        lines.push(`TEL;TYPE=WORK,VOICE:${vcardEscape(digits || phoneOpt.display)}`);
      }
      if (email) lines.push(`EMAIL;TYPE=WORK:${vcardEscape(email)}`);
      if (l.city || l.country) lines.push(`ADR;TYPE=WORK:;;;${vcardEscape(l.city || '')};;;${vcardEscape(l.country || '')}`);
      lines.push(`NOTE:${vcardEscape(`Outreach lead${l.city ? ` -- ${l.city}` : ''}`)}`);
      lines.push('END:VCARD');
      cards.push(lines.join('\r\n'));
    }

    if (cards.length === 0) {
      triggerToast('Nothing to export', 'No leads in that range have a phone number or email to save.', 'info');
      return;
    }

    const vcf = cards.join('\r\n') + '\r\n';
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = rangeDays === null ? 'all-time' : `last-${rangeDays}d`;
    a.href = url;
    a.download = `outreach-contacts-${label}-${new Date().toISOString().slice(0, 10)}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    triggerToast('Ready to import', `${cards.length} contact(s) in the file -- open it on your phone and choose "Import all" / "Add all contacts".`, 'success');
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
          ['inbox', 'Inbox', Mail],
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
            <div className="ml-auto flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-gray-500">
                Export
                <select
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    handleExportContacts(v === 'all' ? null : Number(v));
                    e.target.value = '';
                  }}
                  defaultValue=""
                  className="bg-[#161616] border border-white/8 rounded px-2 py-1 text-gray-300 outline-none focus:border-[#00F0FF]/40"
                >
                  <option value="" disabled>
                    contacts as CSV...
                  </option>
                  <option value="1">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-gray-500">
                Save to phone
                <select
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    handleExportVCard(v === 'all' ? null : Number(v));
                    e.target.value = '';
                  }}
                  defaultValue=""
                  title="Downloads a .vcf file -- open it on your phone and it offers to add every contact at once."
                  className="bg-[#161616] border border-white/8 rounded px-2 py-1 text-gray-300 outline-none focus:border-[#00F0FF]/40"
                >
                  <option value="" disabled>
                    contacts as .vcf...
                  </option>
                  <option value="1">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </label>
              <button onClick={loadLeads} className="flex items-center gap-1 text-gray-500 hover:text-white">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
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
                const contactOptions = getContactOptions(lead);
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
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {contactOptions.map((opt) => (
                              <span
                                key={opt.key}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
                                  opt.key.includes('whatsapp')
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : opt.key === 'email'
                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                    : opt.key.includes('instagram')
                                    ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                    : 'bg-white/5 text-gray-400 border-white/10'
                                }`}
                              >
                                {opt.label}: {opt.display}
                              </span>
                            ))}
                            {contactOptions.length === 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                No contact metadata found
                              </span>
                            )}
                          </div>
                          {!expanded && lead.draftSubject && (
                            <p className="text-[11px] font-mono text-gray-400 truncate mt-1.5">&ldquo;{lead.draftSubject}&rdquo;</p>
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
                            <p><span className="text-gray-500">Phone on site:</span> {lead.evidence.phones[0] || '(none found)'}</p>
                            <p><span className="text-gray-500">Social links:</span> {Object.keys(lead.evidence.socialLinks).length > 0 ? Object.keys(lead.evidence.socialLinks).join(', ') : '(none found)'}</p>
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
                              {contactOptions.map((opt) =>
                                opt.href ? (
                                  <a
                                    key={opt.key}
                                    href={opt.href}
                                    {...(opt.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                                    title={opt.display}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/20 text-[#00F0FF] font-mono text-[10px] uppercase"
                                  >
                                    <Mail size={12} /> {opt.unconfirmed ? `Try ${opt.label}` : `Open ${opt.label}`}
                                  </a>
                                ) : (
                                  <span key={opt.key} title={opt.display} className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/2 border border-white/8 text-gray-500 font-mono text-[10px] uppercase">
                                    {opt.label}: {opt.display}
                                  </span>
                                ),
                              )}
                              {contactOptions.length === 0 && (
                                <span className="flex items-center gap-1 px-3 py-1.5 rounded bg-rose-500/5 border border-rose-500/20 text-rose-300 font-mono text-[10px] uppercase">
                                  No contact info found for this lead
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
          {/* Auto-search comes first in the source order (not just visually) so on mobile -- where this grid
              stacks into a single column -- it's the first card someone reaches, not the third one down. It's
              also the feature actually used day to day; the other two are occasional/manual paths. */}
          <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
            <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider flex items-center gap-1.5"><SearchIcon size={13} /> Auto-search (OpenStreetMap)</h3>
            <div className="space-y-2">
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City, e.g. Lagos, Nigeria" disabled={searching} className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs disabled:opacity-50" />
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category, e.g. plumbers" disabled={searching} className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 text-xs disabled:opacity-50" />
              <button onClick={() => handleSearch(false)} disabled={searching || !city.trim() || !category.trim()} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded bg-[#00F0FF] text-black font-mono font-bold text-[10px] uppercase disabled:opacity-40">
                {searching ? <Loader2 size={13} className="animate-spin" /> : null} Search & process
              </button>
            </div>

            {searching && (
              <div className="text-[11px] font-mono text-[#00F0FF] bg-[#00F0FF]/5 border border-[#00F0FF]/20 rounded p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Working...</span>
                  <span className="text-gray-400 tabular-nums">{searchElapsed}s elapsed</span>
                </div>
                <p className="text-gray-300">{currentSearchStage.label}</p>
                <p className="text-gray-500 text-[10px]">
                  This can take anywhere from a few seconds to a couple of minutes depending on how many businesses match. Feel free to leave this
                  tab -- it'll still be here, with a result, when you come back.
                </p>
              </div>
            )}

            {!searching && (searchResult?.repeat || searchResult?.error || (searchResult && !searchResult.repeat && !searchResult.error)) && (
              <div ref={searchResultRef}>
                {searchResult?.repeat && (
                  <div className="text-[11px] font-mono text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded p-2.5 space-y-2">
                    <p>{searchResult.message}</p>
                    <button onClick={() => handleSearch(true)} className="underline hover:text-amber-200">Run it again anyway</button>
                  </div>
                )}
                {searchResult?.error && (
                  <div className="text-[11px] font-mono text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded p-2.5 space-y-2">
                    <p className="flex items-center gap-1.5 font-bold"><XCircle size={13} /> Search failed</p>
                    <p>{searchResult.error}</p>
                    <button onClick={() => handleSearch(false)} className="underline hover:text-rose-200">Try again</button>
                  </div>
                )}
                {searchResult && !searchResult.repeat && !searchResult.error && (
                  <div className="text-[11px] font-mono text-gray-400 bg-emerald-500/5 border border-emerald-500/20 rounded p-2.5 space-y-1">
                    <p className="flex items-center gap-1.5 text-[#22C55E] font-bold"><CheckCircle2 size={13} /> Done -- found {searchResult.found} business(es)</p>
                    <p>See the Review Queue tab for drafted messages.</p>
                    {searchResult.resolvedPlace && (
                      <p className="text-gray-500">
                        Searched around: <span className="text-gray-300">{searchResult.resolvedPlace}</span> -- check this matches where you meant.
                      </p>
                    )}
                    {searchResult.found === 0 && typeof searchResult.rawCount === 'number' && (
                      <p className="text-gray-500">
                        {searchResult.rawCount === 0
                          ? "OpenStreetMap has nothing mapped under this category in this area at all -- not a filtering issue, there's simply nothing there to find yet."
                          : `OpenStreetMap has ${searchResult.rawCount} matching business(es) here, but none of them have a website, WhatsApp, phone, Facebook, or Instagram on file to reach them by.`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

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

      {tab === 'inbox' && (
        <div className="space-y-4">
          <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
            <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider flex items-center gap-1.5"><Mail size={13} /> Gmail connection</h3>
            {!gmailStatus ? (
              <p className="text-xs font-mono text-gray-500">Checking...</p>
            ) : !gmailStatus.configured ? (
              <p className="text-xs font-mono text-amber-300">
                Not set up yet -- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI need to be added to the server's environment first.
              </p>
            ) : gmailStatus.connected ? (
              <div className="flex items-center justify-between text-xs font-mono">
                <p className="text-[#22C55E] flex items-center gap-1.5"><CheckCircle2 size={13} /> Connected as {gmailStatus.email}</p>
                <button onClick={handleDisconnectGmail} className="px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/8 text-gray-400 uppercase text-[10px]">
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs font-mono">
                <p className="text-gray-500">Not connected -- replies and sent-confirmation won't show up here until you connect it.</p>
                <button
                  onClick={handleConnectGmail}
                  disabled={connectingGmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00F0FF] text-black font-bold uppercase text-[10px] disabled:opacity-40"
                >
                  {connectingGmail ? <Loader2 size={12} className="animate-spin" /> : null} Connect Gmail
                </button>
              </div>
            )}
          </div>

          {gmailStatus?.connected && (
            <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">Outreach activity ({leadEmails.length} known email(s))</h3>
                <button
                  onClick={handleCheckGmail}
                  disabled={checkingGmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/8 text-white font-mono text-[10px] uppercase disabled:opacity-40"
                >
                  {checkingGmail ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Check Gmail
                </button>
              </div>
              {Object.keys(gmailByEmail).length === 0 ? (
                <p className="text-[11px] font-mono text-gray-500">Click "Check Gmail" to see which leads have replied, been sent to, or asked to unsubscribe.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(gmailByEmail).map(([email, info]) => {
                    const lead = leads.find((l) => l.evidence?.emails?.[0] === email);
                    const hasReply = info.messages.some((m) => m.labelIds?.includes('INBOX'));
                    const hasSent = info.messages.some((m) => m.labelIds?.includes('SENT'));
                    return (
                      <div key={email} className="border border-white/8 rounded p-3 text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">{lead?.businessName || email}</span>
                          <div className="flex gap-1.5">
                            {info.looksLikeUnsubscribe && <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">Looks like unsubscribe</span>}
                            {hasReply && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-[#22C55E] border border-emerald-500/20">Replied</span>}
                            {!hasReply && hasSent && <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">Sent, no reply yet</span>}
                            {info.messages.length === 0 && <span className="px-2 py-0.5 rounded bg-white/4 text-gray-500 border border-white/8">No activity found</span>}
                          </div>
                        </div>
                        <p className="text-gray-500">{email}</p>
                        {info.messages.slice(0, 3).map((m) => (
                          <a
                            key={m.id}
                            href={`https://mail.google.com/mail/u/0/#all/${m.threadId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-gray-400 hover:text-[#00F0FF] truncate"
                          >
                            {m.labelIds?.includes('SENT') ? '-> ' : '<- '}
                            {m.subject || '(no subject)'} -- {m.snippet}
                          </a>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="glass-admin rounded-lg border border-white/8 bg-[#111111]/40 p-4 space-y-3">
            <h3 className="text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">Portfolio contact-form messages</h3>
            {loadingPortfolioMessages ? (
              <div className="flex items-center justify-center py-8 text-gray-500"><Loader2 className="animate-spin" /></div>
            ) : portfolioMessages.length === 0 ? (
              <p className="text-[11px] font-mono text-gray-500">No messages through the portfolio's contact form yet.</p>
            ) : (
              <div className="space-y-2">
                {portfolioMessages.slice(0, 20).map((m) => (
                  <div key={m.id} className="border border-white/8 rounded p-3 text-[11px] font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">{m.name || m.email || 'Someone'}</span>
                      <span className="text-gray-500">{m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    {m.email && <p className="text-gray-500">{m.email}</p>}
                    {m.message && <p className="text-gray-400 line-clamp-2">{m.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
