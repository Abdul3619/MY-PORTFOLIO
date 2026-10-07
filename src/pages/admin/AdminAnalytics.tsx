import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../components/admin/AdminLayout';
import { fetchApi, isSelfExcluded, EXCLUDE_SELF_KEY } from '../../hooks/useApi';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import {
  LineChart as ChartIcon,
  Globe,
  Monitor,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  BarChart3,
  ArrowUpRight,
  X,
  Eye,
  Clock
} from 'lucide-react';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AdminAnalytics() {
  const { triggerToast } = useAdmin();
  const [timeScope, setTimeScope] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [visitorFeed, setVisitorFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  // Clicking a visitor opens a full detail sub-screen (see the modal near the bottom of this component)
  // instead of expanding inline -- a dedicated screen per person, the way the admin asked for.
  const [selectedVisitor, setSelectedVisitor] = useState<any | null>(null);
  // "Today" overview: clicking the tile filters Recent Visits down to just today's sessions.
  const [todayOnly, setTodayOnly] = useState(false);
  // Per-browser, not global: this only stops THIS browser (the one the admin is using right now) from being
  // counted. Visiting from a different phone/computer still needs its own toggle there.
  const [excludeSelf, setExcludeSelf] = useState(() => isSelfExcluded());

  const toggleExcludeSelf = () => {
    const next = !excludeSelf;
    try {
      if (next) localStorage.setItem(EXCLUDE_SELF_KEY, '1');
      else localStorage.removeItem(EXCLUDE_SELF_KEY);
    } catch {
      // ignore storage failures
    }
    setExcludeSelf(next);
    triggerToast(
      next ? 'This browser is now excluded' : 'This browser is included again',
      next
        ? 'Visits from this browser won’t be counted in your analytics or GA4 from now on.'
        : 'Visits from this browser will be counted again.',
      next ? 'success' : 'info',
    );
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetchApi(`/api/admin/plausible-stats?period=${timeScope}`);
      setAnalyticsData(res);
    } catch (err: any) {
      console.error(err);
      triggerToast('Analytics Error', err.message || 'Failed to fetch analytics', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const loadVisitorFeed = async () => {
    try {
      const res = await fetchApi('/api/admin/visitor-feed?limit=40');
      setVisitorFeed(res.feed || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeScope]);

  // The visitor feed is what makes this "real-time" rather than a once-a-day report -- poll it on a short
  // interval so a visit that happens while the admin has this tab open actually shows up without a manual refresh.
  useEffect(() => {
    loadVisitorFeed();
    const interval = setInterval(loadVisitorFeed, 30_000);
    return () => clearInterval(interval);
  }, []);

  const COLORS = ['#00F0FF', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];

  const now = new Date();
  const todaysVisitors = visitorFeed.filter((v) => isSameLocalDay(v.last_seen, now) || isSameLocalDay(v.first_seen, now));
  const todaysPageviews = todaysVisitors.reduce((sum, v) => sum + (v.page_count || 0), 0);
  const visibleFeed = todayOnly ? todaysVisitors : visitorFeed;

  // One combined, time-sorted list of everything a visitor did -- page views and other tracked events
  // interleaved in the order they actually happened, rather than two separate lists.
  const visitorTimeline = (v: any) =>
    [
      ...v.pages.map((p: any) => ({ kind: 'page' as const, label: p.path, at: p.at })),
      ...v.other_events.map((e: any) => ({ kind: 'event' as const, label: `${e.type}${e.meta?.title ? ` · ${e.meta.title}` : ''}`, at: e.at })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-6">
      
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">
            Visitor & Traffic Analytics
          </h1>
          <p className="text-xs font-mono text-[#00F0FF]/80">REAL-TIME PRIVACY-FRIENDLY ANALYTICS ENGINE</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Exclude-me toggle: this browser only */}
          <button
            onClick={toggleExcludeSelf}
            title="Stops THIS browser's visits from being counted -- doesn't affect any other device."
            className={`px-3 py-1.5 rounded-md border text-xs font-mono font-bold uppercase tracking-wider transition-all ${
              excludeSelf
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-white/4 border-white/8 text-gray-400 hover:text-white'
            }`}
          >
            {excludeSelf ? 'This browser: excluded' : 'Exclude this browser'}
          </button>

          {/* Date scope switcher */}
          <div className="bg-white/4 border border-white/8 rounded-md p-0.5 flex text-xs font-mono">
            {([
              { label: '7D', scope: '7d' },
              { label: '30D', scope: '30d' },
              { label: '90D', scope: '90d' },
              { label: '1 Year', scope: '12m' }
            ] as const).map((item) => (
              <button
                key={item.scope}
                onClick={() => setTimeScope(item.scope)}
                className={`px-3 py-1.5 font-bold uppercase tracking-wider rounded-sm transition-all ${
                  timeScope === item.scope
                    ? 'bg-[#00F0FF] text-black font-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Setup & Connection Status Banner / Guide */}
      {(!analyticsData || !analyticsData.connected) && (
        <div className="glass-admin p-6 rounded-lg bg-[#111111]/80 border border-cyan-500/30 space-y-4">
          <div className="flex items-start gap-3">
             <div className="p-2 rounded-lg bg-cyan-500/10 text-[#00F0FF] border border-cyan-500/20 shrink-0 mt-1">
              <Globe size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">Analytics Initializing</h3>
              <p className="text-xs text-gray-400">Loading traffic data...</p>
            </div>
          </div>
        </div>
      )}

      {/* Connected State with Real Analytics */}
      {analyticsData && analyticsData.connected && (
        <div className="space-y-6">
          
          {/* Status Bar */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={16} />
              <span>Connected to Plausible Domain: <strong className="text-white">{analyticsData.domain}</strong></span>
            </div>
            <div className="text-gray-400">
              {analyticsData.apiKeyConfigured && (
                <span className="text-[#00F0FF] flex items-center gap-1"><ShieldCheck size={14} /> Stats API Active</span>
              )}
            </div>
          </div>

          {/* Aggregate Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-admin p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-1">
              <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">Total Visitors</span>
              <p className="text-2xl font-black font-mono text-white">
                {analyticsData.aggregate?.visitors?.value?.toLocaleString() || 0}
              </p>
              <p className="text-[10px] text-gray-400 font-mono">Unique individual browsers</p>
            </div>

            <div className="glass-admin p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-1">
              <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">Pageviews</span>
              <p className="text-2xl font-black font-mono text-[#00F0FF]">
                {analyticsData.aggregate?.pageviews?.value?.toLocaleString() || 0}
              </p>
              <p className="text-[10px] text-gray-400 font-mono">Total page requests</p>
            </div>

            <div className="glass-admin p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-1">
              <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">Bounce Rate</span>
              <p className="text-2xl font-black font-mono text-white">
                {analyticsData.aggregate?.bounce_rate?.value != null ? `${analyticsData.aggregate.bounce_rate.value}%` : '0%'}
              </p>
              <p className="text-[10px] text-gray-400 font-mono">Single-page sessions</p>
            </div>

            <div className="glass-admin p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-1">
              <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">Visit Duration</span>
              <p className="text-2xl font-black font-mono text-white">
                {analyticsData.aggregate?.visit_duration?.value ? `${Math.round(analyticsData.aggregate.visit_duration.value)}s` : '0s'}
              </p>
              <p className="text-[10px] text-gray-400 font-mono">Average time on site</p>
            </div>
          </div>

          {/* Timeseries Chart */}
          {analyticsData.timeseries && analyticsData.timeseries.length > 0 && (
            <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <div>
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Visitor Traffic Trends</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Real-time visitor volume over time</p>
                </div>
              </div>
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#4B5563" 
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }} 
                    />
                    <YAxis 
                      stroke="#4B5563" 
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: '10px', fontFamily: 'JetBrains Mono' }} 
                    />
                    <Tooltip 
                      contentStyle={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                      labelStyle={{ color: '#00F0FF', fontFamily: 'JetBrains Mono', fontSize: '10px' }}
                      itemStyle={{ color: '#fff', fontSize: '11px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="visitors" 
                      stroke="#00F0FF" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#visitorsGrad)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sources and Browsers Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Referrers */}
            <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white border-b border-white/8 pb-3">Top Traffic Sources</h3>
              {analyticsData.sources && analyticsData.sources.length > 0 ? (
                <div className="space-y-3 font-mono text-xs">
                  {analyticsData.sources.map((src: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border-b border-white/4 pb-2">
                      <span className="text-gray-300 truncate max-w-[200px]">{src.source || 'Direct / None'}</span>
                      <span className="text-[#00F0FF] font-bold">{src.visitors} visitors</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-gray-500 py-8 text-center">No referrer data recorded yet.</p>
              )}
            </div>

            {/* Browser Breakdown */}
            <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white border-b border-white/8 pb-3">Browser Breakdown</h3>
              {analyticsData.browsers && analyticsData.browsers.length > 0 ? (
                <div className="space-y-3 font-mono text-xs">
                  {analyticsData.browsers.map((b: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border-b border-white/4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-300">{b.browser || 'Unknown'}</span>
                      </div>
                      <span className="text-white font-bold">{b.visitors} visitors</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-gray-500 py-8 text-center">No browser data recorded yet.</p>
              )}
            </div>

          </div>

          {/* Top Projects */}
          <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white border-b border-white/8 pb-3">Which Projects Get Looked At</h3>
            {analyticsData.topProjects && analyticsData.topProjects.length > 0 ? (
              <div className="space-y-3 font-mono text-xs">
                {analyticsData.topProjects.map((p: any) => {
                  const max = analyticsData.topProjects[0].views || 1;
                  const pct = Math.max(6, Math.round((p.views / max) * 100));
                  return (
                    <div key={p.slug} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 truncate max-w-[220px]">{p.title}</span>
                        <span className="text-[#00F0FF] font-bold">{p.views} view{p.views === 1 ? '' : 's'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00F0FF]/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs font-mono text-gray-500 py-8 text-center">No project pages viewed yet in this window.</p>
            )}
          </div>

        </div>
      )}

      {/* Today overview -- the thing to glance at first: how many real people came today, clickable to filter
          the list below down to just them. */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setTodayOnly(false)}
          className={`glass-admin p-5 rounded-lg border text-left space-y-1 transition-all ${
            !todayOnly ? 'border-[#00F0FF]/50 bg-[#00F0FF]/5' : 'border-white/8 bg-[#111111]/40 hover:border-white/20'
          }`}
        >
          <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">All recent sessions</span>
          <p className="text-2xl font-black font-mono text-white">{visitorFeed.length}</p>
        </button>
        <button
          type="button"
          onClick={() => setTodayOnly(true)}
          className={`glass-admin p-5 rounded-lg border text-left space-y-1 transition-all ${
            todayOnly ? 'border-[#00F0FF]/50 bg-[#00F0FF]/5' : 'border-white/8 bg-[#111111]/40 hover:border-white/20'
          }`}
        >
          <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">Today</span>
          <p className="text-2xl font-black font-mono text-[#00F0FF]">{todaysVisitors.length}</p>
          <p className="text-[10px] text-gray-400 font-mono">{todaysPageviews} page view{todaysPageviews === 1 ? '' : 's'} today -- tap to filter below</p>
        </button>
      </div>

      {/* Live Visitor Feed -- who came and what they actually did, independent of the date-range switcher above */}
      <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
              {todayOnly ? "Today's Visits" : 'Recent Visits'}
            </h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Anonymous per-browser sessions -- refreshes every 30s. Click one to see everything they did.</p>
          </div>
          <ArrowUpRight size={14} className="text-gray-500" />
        </div>

        {feedLoading ? (
          <p className="text-xs font-mono text-gray-500 py-6 text-center">Loading...</p>
        ) : visibleFeed.length === 0 ? (
          <p className="text-xs font-mono text-gray-500 py-8 text-center">
            {todayOnly ? 'No visits yet today.' : 'No visits recorded yet.'}
          </p>
        ) : (
          <div className="space-y-2 font-mono text-xs max-h-[480px] overflow-y-auto pr-1">
            {visibleFeed.map((v: any) => (
              <button
                key={v.session_id}
                type="button"
                onClick={() => setSelectedVisitor(v)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left border border-white/8 rounded-md bg-white/4 hover:bg-white/8 hover:border-[#00F0FF]/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Monitor size={14} className="text-gray-500 shrink-0" />
                  <span className="text-gray-300 truncate">{v.device} · {v.browser}</span>
                  <span className="text-gray-500 truncate hidden sm:inline">
                    {v.referrer && v.referrer !== 'Direct / None' ? `via ${v.referrer}` : 'direct visit'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#00F0FF]">{v.page_count} page{v.page_count === 1 ? '' : 's'}</span>
                  <span className="text-gray-500">{timeAgo(v.last_seen)}</span>
                  <Eye size={13} className="text-gray-600" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Per-visitor detail sub-screen -- opened by clicking a row above, closed by the X or the backdrop. */}
      {selectedVisitor && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setSelectedVisitor(null)}
        >
          <div
            className="glass-admin w-full max-w-lg mt-8 sm:mt-0 rounded-lg border border-white/10 bg-[#0d0d0d] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Monitor size={16} className="text-[#00F0FF]" />
                <h3 className="text-sm font-mono font-bold text-white">{selectedVisitor.device} · {selectedVisitor.browser}</h3>
              </div>
              <button type="button" onClick={() => setSelectedVisitor(null)} className="text-gray-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4 font-mono text-xs max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase text-gray-500">First seen</span>
                  <p className="text-gray-200">{formatClock(selectedVisitor.first_seen)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase text-gray-500">Last seen</span>
                  <p className="text-gray-200">{formatClock(selectedVisitor.last_seen)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase text-gray-500">Came from</span>
                  <p className="text-gray-200 truncate">
                    {selectedVisitor.referrer && selectedVisitor.referrer !== 'Direct / None' ? selectedVisitor.referrer : 'Direct / no referrer'}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase text-gray-500">Pages viewed</span>
                  <p className="text-gray-200">{selectedVisitor.page_count}</p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><Clock size={11} /> What they did, in order</span>
                <div className="space-y-1.5 border-l border-white/10 pl-3">
                  {visitorTimeline(selectedVisitor).map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className={item.kind === 'event' ? 'text-amber-400/80' : 'text-gray-300'}>{item.label}</span>
                      <span className="text-gray-600 shrink-0">{timeAgo(item.at)}</span>
                    </div>
                  ))}
                  {visitorTimeline(selectedVisitor).length === 0 && (
                    <p className="text-gray-500">No activity recorded for this session.</p>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-gray-600 pt-2 border-t border-white/8">
                This identifies a browser session, not a real-world identity -- there's no name, email or IP shown here on purpose.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
