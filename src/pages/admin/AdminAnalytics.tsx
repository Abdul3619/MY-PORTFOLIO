import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../components/admin/AdminLayout';
import { fetchApi } from '../../hooks/useApi';
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
  ArrowUpRight
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

export default function AdminAnalytics() {
  const { triggerToast } = useAdmin();
  const [timeScope, setTimeScope] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [visitorFeed, setVisitorFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

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

      {/* Live Visitor Feed -- who came and what they actually did, independent of the date-range switcher above */}
      <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Recent Visits</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Anonymous per-browser sessions -- refreshes every 30s</p>
          </div>
          <ArrowUpRight size={14} className="text-gray-500" />
        </div>

        {feedLoading ? (
          <p className="text-xs font-mono text-gray-500 py-6 text-center">Loading...</p>
        ) : visitorFeed.length === 0 ? (
          <p className="text-xs font-mono text-gray-500 py-8 text-center">No visits recorded yet.</p>
        ) : (
          <div className="space-y-2 font-mono text-xs max-h-[480px] overflow-y-auto pr-1">
            {visitorFeed.map((v: any) => (
              <div key={v.session_id} className="border border-white/8 rounded-md bg-white/4 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedSession(expandedSession === v.session_id ? null : v.session_id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
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
                  </div>
                </button>
                {expandedSession === v.session_id && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/8 space-y-1.5">
                    {v.pages.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400">{p.path}</span>
                        <span className="text-gray-600">{timeAgo(p.at)}</span>
                      </div>
                    ))}
                    {v.other_events.map((e: any, i: number) => (
                      <div key={`e-${i}`} className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-400/80">{e.type}{e.meta?.title ? ` · ${e.meta.title}` : ''}</span>
                        <span className="text-gray-600">{timeAgo(e.at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
