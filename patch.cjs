const fs = require('fs');
const content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf8');

const regex = /const \[plausibleRes, vRes, mRes, pRes, leadsRes, actRes, downloadsRes, eventsRes, projectsRes\] = await Promise\.all\(\[([\s\S]*?)\]\);/;

const replacement = `const days = dateFilter === '7D' ? 7 : dateFilter === '30D' ? 30 : 90;
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      const daysAgoString = daysAgo.toISOString();

      const [plausibleRes, vRes, mRes, pRes, leadsRes, actRes, downloadsRes, eventsRes, projectsRes, recentEventsRes, recentVisitorsRes] = await Promise.all([
        fetchApi(\`/api/admin/plausible-stats?period=\${scope}\`).catch(() => null),
        supabase.from('visitors').select('*', { count: 'exact', head: true }),
        supabase.from('contact_messages').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('leads').select('*'),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).in('event_type', ['download_resume', 'resume_download']),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).in('event_type', ['page_view', 'project_view', 'project_click']),
        supabase.from('projects').select('id, title, slug').limit(10),
        supabase.from('analytics_events').select('page_url, created_at, metadata').gte('created_at', daysAgoString),
        supabase.from('visitors').select('created_at').gte('created_at', daysAgoString)
      ]);`;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/pages/admin/Dashboard.tsx', newContent);
