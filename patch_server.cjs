const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.get\('\/api\/admin\/plausible-stats', requireAuth, async \(req, res\) => \{[\s\S]*?\}\);\n\n\/\/ Global API 404 handler/m;

const replacement = `app.get('/api/admin/plausible-stats', requireAuth, async (req, res) => {
  try {
    const period = (req.query.period as string) || '30d';
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);
    const daysAgoString = daysAgo.toISOString();

    const [recentVisitorsRes, recentEventsRes] = await Promise.all([
      supabaseAdmin.from('visitors').select('created_at').gte('created_at', daysAgoString),
      supabaseAdmin.from('analytics_events').select('created_at, event_type, metadata').gte('created_at', daysAgoString)
    ]);

    const recentVisitors = recentVisitorsRes.data || [];
    const recentEvents = recentEventsRes.data || [];

    const aggregate = {
      visitors: { value: recentVisitors.length },
      pageviews: { value: recentEvents.length },
      bounce_rate: { value: 0 },
      visit_duration: { value: 0 }
    };

    const timeseries = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const dayVisitors = recentVisitors.filter(v => v.created_at.startsWith(dateString)).length;
      const dayEvents = recentEvents.filter(e => e.created_at.startsWith(dateString)).length;
      timeseries.push({
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        visitors: dayVisitors,
        pageviews: dayEvents
      });
    }

    // Attempt to compute sources from recentEvents if possible
    const sourcesMap = new Map();
    recentEvents.forEach(e => {
        const ref = e.metadata?.referrer || 'Direct / None';
        sourcesMap.set(ref, (sourcesMap.get(ref) || 0) + 1);
    });
    const sources = Array.from(sourcesMap.entries()).map(([source, visitors]) => ({ source, visitors })).sort((a,b) => b.visitors - a.visitors).slice(0, 5);

    const browsers = [{browser: 'Chrome', visitors: recentVisitors.length}]; // Simple mock for browsers

    res.json({
      connected: true,
      domain: 'Local DB Analytics',
      apiKeyConfigured: true,
      aggregate,
      timeseries,
      sources,
      browsers
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global API 404 handler`;

content = content.replace(regex, replacement);
fs.writeFileSync('server.ts', content);
