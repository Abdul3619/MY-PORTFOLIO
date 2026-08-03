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

export default function AdminAnalytics() {
  const { triggerToast } = useAdmin();
  const [timeScope, setTimeScope] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

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

  useEffect(() => {
    loadAnalytics();
  }, [timeScope]);

  const COLORS = ['#00F0FF', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];

  return (
    <div className="space-y-6">
      
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">
            Visitor & Traffic Analytics
          </h1>
          <p className="text-xs font-mono text-[#00F0FF]/80">REAL-TIME PRIVACY-FRIENDLY PLAUSIBLE ANALYTICS</p>
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
      {(!analyticsData || !analyticsData.connected || !analyticsData.domain) && (
        <div className="glass-admin p-6 rounded-lg bg-[#111111]/80 border border-cyan-500/30 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-[#00F0FF] border border-cyan-500/20 shrink-0 mt-1">
              <Globe size={24} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">Connect Plausible Analytics</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Setup Required</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                The mockup analytics view has been removed. To display real visitor metrics, connect your privacy-friendly Plausible Analytics account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/10 font-sans text-xs">
            <div className="p-4 rounded bg-white/[0.02] border border-white/6 space-y-2">
              <div className="w-6 h-6 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] flex items-center justify-center font-mono font-bold text-xs">1</div>
              <h4 className="font-bold text-white">Create a Free Account</h4>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Sign up at <a href="https://plausible.io" target="_blank" rel="noreferrer" className="text-[#00F0FF] hover:underline inline-flex items-center gap-0.5">Plausible.io <ExternalLink size={10} /></a>. It is lightweight, GDPR-compliant, and requires no cookie banner.
              </p>
            </div>

            <div className="p-4 rounded bg-white/[0.02] border border-white/6 space-y-2">
              <div className="w-6 h-6 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] flex items-center justify-center font-mono font-bold text-xs">2</div>
              <h4 className="font-bold text-white">Add Your Domain</h4>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Add your portfolio domain (e.g., <code className="text-[#00F0FF] font-mono">yourdomain.com</code>) to your Plausible dashboard.
              </p>
            </div>

            <div className="p-4 rounded bg-white/[0.02] border border-white/6 space-y-2">
              <div className="w-6 h-6 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] flex items-center justify-center font-mono font-bold text-xs">3</div>
              <h4 className="font-bold text-white">Paste Domain & API Key</h4>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                Go to <span className="text-white font-semibold">Dashboard Admin &gt; Settings &gt; Analytics</span>, enter your domain and optional Stats API key, and save.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] font-mono text-gray-500">
              * Note: Real metrics will populate automatically once your site is live and visitors browse your portfolio.
            </p>
            <a 
              href="/admin/settings" 
              className="px-4 py-2 bg-[#00F0FF] text-black font-bold font-mono text-xs rounded hover:bg-[#00F0FF]/80 transition-all flex items-center gap-1.5"
            >
              Go to Analytics Settings <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Connected State with Real Analytics */}
      {analyticsData && analyticsData.connected && analyticsData.domain && (
        <div className="space-y-6">
          
          {/* Status Bar */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={16} />
              <span>Connected to Plausible Domain: <strong className="text-white">{analyticsData.domain}</strong></span>
            </div>
            <div className="text-gray-400">
              {analyticsData.apiKeyConfigured ? (
                <span className="text-[#00F0FF] flex items-center gap-1"><ShieldCheck size={14} /> Stats API Active</span>
              ) : (
                <span className="text-yellow-400">Tracking script active on site. Add API key in Settings to view dashboard charts.</span>
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

        </div>
      )}

    </div>
  );
}
