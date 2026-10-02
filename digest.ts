// Builds and sends the periodic lead digest email to Abdulwahab (via Resend), summarizing leads captured since
// the last digest -- whether they came from the AI assistant, the contact form, or the solar calculator.
//
// This is an internal/admin feature, not visitor-facing: it's only ever triggered by the two cron routes in
// server.ts, which are themselves protected by Vercel's CRON_SECRET check, so it reuses the same supabaseAdmin
// (service-role) client already used by the rest of server.ts's admin endpoints -- never the restricted
// chatbot_reader login, which is scoped for the public assistant and has no business reading full lead records.

const RESEND_API_URL = 'https://api.resend.com/emails';
const DIGEST_FROM = 'Portfolio Assistant <onboarding@resend.dev>';
const DIGEST_TO = 'abdulwahababdullah3619@gmail.com';

export interface DigestLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string;
  notes: string | null;
  priority: string;
  created_at: string;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PRIORITY_EMOJI: Record<string, string> = { hot: '🔥', warm: '🟡', cold: '🧊' };

function formatLeadHtml(lead: DigestLead): string {
  const emoji = PRIORITY_EMOJI[lead.priority] || '🟡';
  const contact = [lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact given';
  const when = new Date(lead.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const note = lead.notes ? `<div style="color:#444;margin-top:4px;">${escapeHtml(lead.notes).slice(0, 500)}</div>` : '';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;">
        <div><strong>${emoji} ${escapeHtml(lead.name)}</strong> &nbsp;<span style="color:#888;font-size:13px;">${escapeHtml(lead.source)} · ${escapeHtml(lead.status)} · ${when}</span></div>
        <div style="color:#555;font-size:14px;">${escapeHtml(contact)}</div>
        ${note}
      </td>
    </tr>`;
}

function formatLeadText(lead: DigestLead): string {
  const emoji = PRIORITY_EMOJI[lead.priority] || '';
  const contact = [lead.email, lead.phone].filter(Boolean).join(' / ') || 'No contact given';
  const when = new Date(lead.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const note = lead.notes ? `\n    ${lead.notes.slice(0, 500)}` : '';
  return `- ${emoji} ${lead.name} (${lead.priority}) -- ${lead.source}, ${lead.status}, ${when}\n    ${contact}${note}`;
}

export interface DigestContent {
  subject: string;
  html: string;
  text: string;
}

// `periodLabel` is e.g. "today" or "this week"; `isWeekly` only changes the empty-state message (a weekly digest
// always sends, as a quiet heartbeat that the pipeline is still working; a daily digest with nothing new is
// skipped by the caller instead of being built at all).
export function buildDigest(leads: DigestLead[], periodLabel: string, isWeekly: boolean): DigestContent {
  const counts = { hot: 0, warm: 0, cold: 0 };
  for (const l of leads) {
    if (l.priority === 'hot' || l.priority === 'warm' || l.priority === 'cold') counts[l.priority]++;
  }
  const subject =
    leads.length === 0
      ? `No new leads ${periodLabel}`
      : `${leads.length} new lead${leads.length === 1 ? '' : 's'} ${periodLabel} (${counts.hot} hot, ${counts.warm} warm, ${counts.cold} cold)`;

  const summaryLine =
    leads.length === 0
      ? `No new leads came in ${periodLabel}.${isWeekly ? ' This is just a check-in to confirm the digest is still running.' : ''}`
      : `${leads.length} new lead${leads.length === 1 ? '' : 's'} ${periodLabel}: ${counts.hot} hot, ${counts.warm} warm, ${counts.cold} cold.`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
    <h2 style="margin:0 0 8px;">Lead digest -- ${escapeHtml(periodLabel)}</h2>
    <p style="color:#555;margin:0 0 20px;">${escapeHtml(summaryLine)}</p>
    ${leads.length > 0 ? `<table style="width:100%;border-collapse:collapse;">${leads.map(formatLeadHtml).join('')}</table>` : ''}
    <p style="color:#999;font-size:12px;margin-top:24px;">Sent automatically by the portfolio assistant's lead digest.</p>
  </body></html>`;

  const text = [`Lead digest -- ${periodLabel}`, '', summaryLine, '', ...leads.map(formatLeadText)].join('\n');

  return { subject, html, text };
}

export function digestConfigured() {
  return Boolean((process.env.RESEND_API_KEY || '').trim());
}

export async function sendDigestEmail(content: DigestContent): Promise<boolean> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: DIGEST_FROM,
      to: [DIGEST_TO],
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  });

  if (!res.ok) {
    console.error('Resend digest send failed:', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}
