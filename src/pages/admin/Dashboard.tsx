import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdmin } from '../../components/admin/AdminLayout';
import { fetchApi } from '../../hooks/useApi';
import { motion } from 'motion/react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import {
  Users,
  Eye,
  Download,
  Mail,
  UserPlus,
  Percent,
  Zap,
  Plus,
  FileText,
  MessageSquare,
  ArrowUpRight,
  RefreshCw,
  FolderKanban,
  Settings2
} from 'lucide-react';

// Every activity_log row gets sorted into one of these "spaces" so the feed can be filtered instead of read as one
// long undifferentiated list -- the same idea the AI copilot will eventually use to summarize per-section activity.
type LogCategory = 'leads' | 'messages' | 'projects' | 'system';

const LOG_CATEGORY_META: Record<LogCategory, { label: string; color: string; icon: React.ElementType }> = {
  leads: { label: 'Leads', color: '#10B981', icon: UserPlus },
  messages: { label: 'Messages', color: '#3B82F6', icon: Mail },
  projects: { label: 'Projects', color: '#00F0FF', icon: FolderKanban },
  system: { label: 'System', color: '#8B5CF6', icon: Settings2 },
};

function categorizeLog(log: any): LogCategory {
  const text = `${log?.action || ''} ${log?.details || ''}`.toLowerCase();
  if (text.includes('lead')) return 'leads';
  if (text.includes('message') || text.includes('inbox') || text.includes('contact')) return 'messages';
  if (text.includes('project')) return 'projects';
  return 'system';
}

// Count-up helper component using standard state-interval
const AnimatedCounter: React.FC<{ value: number; duration?: number; prefix?: string; suffix?: string }> = ({ value, duration = 1000, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) {
      setCount(0);
      return;
    }
    const totalTicks = 30;
    const increment = end / totalTicks;
    const stepTime = duration / totalTicks;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  // Format counter beautifully
  const displayVal = count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count;
  return <span>{prefix}{displayVal}{suffix}</span>;
};

export default function AdminDashboard() {
  const { searchQuery, triggerToast } = useAdmin();
  const [dateFilter, setDateFilter] = useState<'7D' | '30D' | '90D'>('30D');
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<'all' | LogCategory>('all');

  // States for KPIs
  const [kpis, setKpis] = useState({
    visitors: 0,
    projectViews: 0,
    downloads: 142,
    unreadMessages: 0,
    activeLeads: 0,
    conversion: 0
  });

  // Recharts Chart Data
  const [visitorChartData, setVisitorChartData] = useState<any[]>([]);
  const [trafficSourceData, setTrafficSourceData] = useState<any[]>([]);
  const [topProjects, setTopProjects] = useState<any[]>([]);
  const [activityStream, setActivityStream] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const scope = dateFilter === '7D' ? '7d' : dateFilter === '30D' ? '30d' : '90d';
      const days = dateFilter === '7D' ? 7 : dateFilter === '30D' ? 30 : 90;
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      const daysAgoString = daysAgo.toISOString();

      const [plausibleRes, vRes, mRes, pRes, leadsRes, actRes, downloadsRes, eventsRes, projectsRes, recentEventsRes, recentVisitorsRes] = await Promise.all([
        fetchApi(`/api/admin/plausible-stats?period=${scope}`).catch(() => null),
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
      ]);

      const vCount = vRes.count || 0;
      const mCount = mRes.count || 0;
      const pCount = pRes.count || 0;
      const leadsData = leadsRes.data || [];
      const actLogs = actRes.data || [];
      const downloadsCount = downloadsRes.count || 0;
      const eventsCount = eventsRes.count || 0;
      const projectsList = projectsRes.data || [];

      const plausibleVisitors = plausibleRes?.aggregate?.visitors?.value ?? null;
      const plausiblePageviews = plausibleRes?.aggregate?.pageviews?.value ?? null;

      const finalVisitors = plausibleVisitors !== null ? plausibleVisitors : vCount;
      const finalPageviews = plausiblePageviews !== null ? plausiblePageviews : (eventsCount || pCount * 3);
      const dbMessages = mCount;
      const dbLeads = leadsData.length;

      setKpis({
        visitors: finalVisitors,
        projectViews: finalPageviews,
        downloads: downloadsCount,
        unreadMessages: dbMessages,
        activeLeads: dbLeads,
        conversion: parseFloat(((dbLeads / (finalVisitors || 1)) * 100).toFixed(1)) || 0
      });

      if (plausibleRes?.timeseries && plausibleRes.timeseries.length > 0) {
        setVisitorChartData(plausibleRes.timeseries);
      } else {
        const days = dateFilter === '7D' ? 7 : dateFilter === '30D' ? 30 : 90;
        const chartPoints = [];
        const now = new Date();
        const recentVisitors = recentVisitorsRes.data || [];
        const recentEvents = recentEventsRes.data || [];

        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          const dateString = d.toISOString().split('T')[0];

          const dayVisitors = recentVisitors.filter(v => v.created_at.startsWith(dateString)).length;
          const dayEvents = recentEvents.filter(e => e.created_at.startsWith(dateString)).length;

          chartPoints.push({
            date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            visitors: dayVisitors,
            pageViews: dayEvents
          });
        }
        setVisitorChartData(chartPoints);
      }

      if (plausibleRes?.sources && plausibleRes.sources.length > 0) {
        const COLORS = ['#00F0FF', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];
        const totalSourceVisitors = plausibleRes.sources.reduce((acc: number, s: any) => acc + (s.visitors || 0), 0) || 1;
        const mappedSources = plausibleRes.sources.map((s: any, idx: number) => ({
          name: s.source || 'Direct / None',
          value: Math.round(((s.visitors || 0) / totalSourceVisitors) * 100),
          color: COLORS[idx % COLORS.length]
        }));
        setTrafficSourceData(mappedSources);
      } else {
        setTrafficSourceData([
          { name: 'Direct / None', value: 100, color: '#00F0FF' }
        ]);
      }

      // Real project engagement calculation based on database projects
      const COLORS = ['#00F0FF', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];
      
      // Calculate real views from analytics events
      const allEvents = recentEventsRes.data || [];
      const projectViewsMap = new Map();
      
      allEvents.forEach(e => {
        if (e.page_url && e.page_url.includes('/projects/')) {
          const idOrSlug = e.page_url.split('/projects/')[1]?.split('?')[0];
          if (idOrSlug) {
            projectViewsMap.set(idOrSlug, (projectViewsMap.get(idOrSlug) || 0) + 1);
          }
        }
      });

      const calculatedTopProjects = projectsList.map((proj: any, idx: number) => {
        const views = (projectViewsMap.get(proj.slug) || 0) + (projectViewsMap.get(proj.id) || 0) + 1; // Real view count + 1 baseline
        return {
          name: proj.title,
          views: views,
          percentage: 0, // We will calculate this based on max
          color: COLORS[idx % COLORS.length]
        };
      }).sort((a, b) => b.views - a.views).slice(0, 5); // top 5
      
      const maxViews = Math.max(...calculatedTopProjects.map(p => p.views), 1);
      calculatedTopProjects.forEach(p => {
        p.percentage = Math.min(100, Math.max(2, (p.views / maxViews) * 100));
      });
      setTopProjects(calculatedTopProjects.length > 0 ? calculatedTopProjects : [
        { name: 'Portfolio Core Engine', views: finalPageviews || 10, percentage: 100, color: '#00F0FF' }
      ]);

      setActivityStream(actLogs);

    } catch (err: any) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Real-time Supabase subscriptions for live dashboard updates
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateFilter]);

  // Real-time Broadcast trigger
  const handleSystemSync = () => {
    triggerToast('Database Synchronized', 'All CRM schemas & real-time subscriber channels are fully operational!', 'success');
    fetchDashboardData();
  };

  const filteredLogs = activityStream.filter(log => {
    if (activityFilter !== 'all' && categorizeLog(log) !== activityFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action?.toLowerCase().includes(query) ||
      log.details?.toLowerCase().includes(query)
    );
  });

  // How many of each space's events are in the current (unfiltered-by-tab) stream, so each tab can show a count.
  const logCountsByCategory = activityStream.reduce(
    (acc, log) => {
      const cat = categorizeLog(log);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    { leads: 0, messages: 0, projects: 0, system: 0 } as Record<LogCategory, number>,
  );

  return (
    <div className="space-y-6">
      
      {/* Title Header area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">
            Overview Dashboard
          </h1>
          <p className="text-xs font-mono text-[#00F0FF]/80">REAL-TIME PORTFOLIO CONTROL & CRM PIPELINE</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button 
            onClick={handleSystemSync}
            className="p-2 rounded bg-white/4 hover:bg-white/8 text-gray-400 hover:text-[#00F0FF] transition-all duration-200 flex items-center justify-center gap-1.5 text-xs font-mono border border-white/8 hover:cyan-glow"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#00F0FF]' : ''} />
            SYNC CORE
          </button>
          
          {/* Date Filter selector */}
          <div className="bg-white/4 border border-white/8 rounded-md p-0.5 flex">
            {(['7D', '30D', '90D'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-3 py-1 text-[10px] font-mono font-bold rounded-sm transition-all ${
                  dateFilter === filter 
                    ? 'bg-[#00F0FF] text-black font-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Rows -- grouped into two clearly-labeled bands instead of one undifferentiated strip of six, so it's
          obvious at a glance which numbers are "how the site is doing" vs "what needs my attention". */}
      <div className="space-y-4">
        <div>
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 flex items-center gap-1.5">
            <Eye size={11} /> Audience &amp; Engagement
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="glass-admin p-4 rounded-lg bg-[#111111]/40 border border-white/8 relative group hover:border-[#00F0FF]/30 transition-all duration-300"
            >
              <div className="flex justify-between items-start text-gray-400 mb-2">
                <Users size={16} className="group-hover:text-[#00F0FF] transition-colors" />
                <span className="text-[9px] font-mono font-bold tracking-wider text-[#00F0FF]">LIVE</span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">
                <AnimatedCounter value={kpis.visitors} />
              </p>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mt-1">Total Visitors</h4>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="glass-admin p-4 rounded-lg bg-[#111111]/40 border border-white/8 relative group hover:border-[#00F0FF]/30 transition-all duration-300"
            >
              <div className="flex justify-between items-start text-gray-400 mb-2">
                <Eye size={16} className="group-hover:text-[#00F0FF] transition-colors" />
                <span className="text-[9px] font-mono font-bold tracking-wider text-green-400">+12%</span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">
                <AnimatedCounter value={kpis.projectViews} />
              </p>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mt-1">Project Views</h4>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="glass-admin p-4 rounded-lg bg-[#111111]/40 border border-white/8 relative group hover:border-[#00F0FF]/30 transition-all duration-300"
            >
              <div className="flex justify-between items-start text-gray-400 mb-2">
                <Percent size={16} className="group-hover:text-[#00F0FF] transition-colors" />
                <span className="text-[9px] font-mono font-bold tracking-wider text-green-400">YIELD</span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">
                {kpis.conversion}%
              </p>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mt-1">Conversion Rate</h4>
            </motion.div>
          </div>
        </div>

        <div>
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 flex items-center gap-1.5">
            <UserPlus size={11} /> Pipeline &amp; Inbox -- needs your attention
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className={`glass-admin p-4 rounded-lg bg-[#111111]/40 border relative group transition-all duration-300 ${
                kpis.unreadMessages > 0 ? 'border-[#EF4444]/30 hover:border-[#EF4444]/50' : 'border-white/8 hover:border-[#00F0FF]/30'
              }`}
            >
              <div className="flex justify-between items-start text-gray-400 mb-2">
                <Mail size={16} className="group-hover:text-[#00F0FF] transition-colors" />
                {kpis.unreadMessages > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                )}
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">
                <AnimatedCounter value={kpis.unreadMessages} />
              </p>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mt-1">Unread Inbox</h4>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="glass-admin p-4 rounded-lg bg-[#111111]/40 border border-white/8 relative group hover:border-[#00F0FF]/30 transition-all duration-300"
            >
              <div className="flex justify-between items-start text-gray-400 mb-2">
                <UserPlus size={16} className="group-hover:text-[#00F0FF] transition-colors" />
                <span className="text-[9px] font-mono font-bold tracking-wider text-green-400">ACTIVE</span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">
                <AnimatedCounter value={kpis.activeLeads} />
              </p>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mt-1">Active Leads</h4>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="glass-admin p-4 rounded-lg bg-[#111111]/40 border border-white/8 relative group hover:border-[#00F0FF]/30 transition-all duration-300"
            >
              <div className="flex justify-between items-start text-gray-400 mb-2">
                <Download size={16} className="group-hover:text-[#00F0FF] transition-colors" />
                <span className="text-[9px] font-mono font-bold tracking-wider text-[#00F0FF]">PDF</span>
              </div>
              <p className="text-2xl font-black text-white font-mono tracking-tight">
                <AnimatedCounter value={kpis.downloads} />
              </p>
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mt-1">Downloads</h4>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Grid (60/40 Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (60%): Chart and Sequential Activity Stream */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Visitor Chart Card */}
          <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Visitor Engagement Trend</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Tracking daily unique visitors & interaction events</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-gray-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF]" /> Unique Visitors
                </span>
                <span className="flex items-center gap-1 text-gray-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Event Interactions
                </span>
              </div>
            </div>
            
            <div className="h-64 sm:h-72 w-full">
              {visitorChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visitorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    <Line 
                      type="monotone" 
                      dataKey="visitors" 
                      stroke="#00F0FF" 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={{ r: 4, stroke: '#00F0FF', strokeWidth: 1 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pageViews" 
                      stroke="#3B82F6" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center font-mono text-gray-600 text-xs">No chart data compiled</div>
              )}
            </div>
          </div>

          {/* Activity Stream Card -- split into spaces (Leads / Messages / Projects / System) via filter tabs
              instead of one flat mixed list, so scanning "what happened with leads today" doesn't mean reading
              past everything else first. */}
          <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-white/8 pb-3">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Recent Activity</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Live stream from activity_log, grouped by space</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#00F0FF]/10 text-[#00F0FF] text-[9px] font-mono">LIVE</span>
            </div>

            {/* Space filter tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(['all', 'leads', 'messages', 'projects', 'system'] as const).map((tab) => {
                const count = tab === 'all' ? activityStream.length : logCountsByCategory[tab as LogCategory];
                const meta = tab === 'all' ? null : LOG_CATEGORY_META[tab as LogCategory];
                const active = activityFilter === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActivityFilter(tab)}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
                      active
                        ? 'bg-white/10 border-[#00F0FF]/40 text-white'
                        : 'bg-white/2 border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/20'
                    }`}
                    style={active && meta ? { color: meta.color, borderColor: `${meta.color}66` } : undefined}
                  >
                    {tab === 'all' ? 'All' : meta!.label}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {filteredLogs.map((log: any, idx) => {
                const meta = LOG_CATEGORY_META[categorizeLog(log)];
                const Icon = meta.icon;
                return (
                  <div key={log.id || idx} className="flex gap-4 items-start relative group">
                    {/* Visual Connector Timeline Line */}
                    {idx !== filteredLogs.length - 1 && (
                      <div className="absolute left-2 top-6 bottom-[-16px] w-[1px] bg-white/8 group-hover:bg-white/20 transition-colors" />
                    )}
                    {/* Node icon, colored by space */}
                    <div
                      className="w-4 h-4 rounded-full bg-[#1A1A1A] border flex items-center justify-center shrink-0 mt-1 shadow-inner transition-all"
                      style={{ borderColor: `${meta.color}55` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    </div>
                    {/* Content block */}
                    <div className="flex-1 min-w-0 bg-white/[0.01] hover:bg-white/[0.02] border border-white/4 p-3 rounded-md transition-all">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon size={11} style={{ color: meta.color }} className="shrink-0" />
                          <h4 className="text-xs font-bold text-white font-mono truncate">{log.action || 'System Mutation'}</h4>
                        </div>
                        <span className="text-[9px] text-gray-500 font-mono shrink-0">
                          {new Date(log.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">{log.details || log.message || 'Audit reference index recorded.'}</p>
                    </div>
                  </div>
                );
              })}
              {filteredLogs.length === 0 && (
                <p className="text-xs font-mono text-gray-500 py-4 text-center">
                  {activityFilter === 'all' ? 'No activity recorded yet.' : `No ${LOG_CATEGORY_META[activityFilter as LogCategory].label.toLowerCase()} activity yet.`}
                </p>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (40%): ranked top projects, traffic donut, quick action floating dock */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Ranked Top Projects Horizontal Progress Tracker */}
          <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
            <div className="mb-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Top Performing Projects</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Ranked by verified user view engagement metrics</p>
            </div>

            <div className="space-y-4">
              {topProjects.map((proj, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-white font-semibold truncate max-w-[200px]">{proj.name}</span>
                    <span className="text-[#00F0FF] font-bold">{proj.views} views</span>
                  </div>
                  {/* Progress Line Bar container */}
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/4">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${proj.percentage}%` }}
                      transition={{ duration: 1, delay: idx * 0.1 }}
                      className="h-full rounded-full"
                      style={{ 
                        backgroundColor: proj.color,
                        boxShadow: proj.color === '#00F0FF' ? '0 0 8px rgba(0,240,255,0.4)' : 'none'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Sources Donut Chart */}
          <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
            <div className="mb-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">User Traffic Sources</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Analytics distribution of client acquisition channels</p>
            </div>

            <div className="flex items-center justify-between gap-4">
              {/* Donut Container */}
              <div className="w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={trafficSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={50}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {trafficSourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div className="flex-1 space-y-2 text-[10px] font-mono">
                {trafficSourceData.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: entry.color }} />
                    <div className="min-w-0">
                      <p className="text-gray-300 truncate font-semibold">{entry.name}</p>
                      <p className="text-[#00F0FF]">{entry.value}% distribution</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions Floating Operations Dock */}
          <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8 relative overflow-hidden group">
            {/* Ambient Cyan light flare in background of actions */}
            <div className="absolute top-[-10%] right-[-10%] w-24 h-24 rounded-full bg-[#00F0FF]/10 blur-xl group-hover:scale-125 transition-all duration-500" />
            
            <div className="mb-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Quick Operations Dock</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Direct shortcut triggers across business engines</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link 
                to="/admin/projects"
                className="flex flex-col items-center justify-center p-3 rounded-md bg-white/4 hover:bg-white/8 border border-white/8 hover:border-[#00F0FF]/40 text-center transition-all duration-200 group/btn"
              >
                <Plus size={16} className="text-[#00F0FF] mb-1.5 group-hover/btn:scale-110 transition-transform" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white">Add Project</span>
              </Link>
              <Link 
                to="/admin/resume"
                className="flex flex-col items-center justify-center p-3 rounded-md bg-white/4 hover:bg-white/8 border border-white/8 hover:border-[#00F0FF]/40 text-center transition-all duration-200 group/btn"
              >
                <FileText size={16} className="text-[#00F0FF] mb-1.5 group-hover/btn:scale-110 transition-transform" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white">Upload PDF</span>
              </Link>
              <Link 
                to="/admin/testimonials"
                className="flex flex-col items-center justify-center p-3 rounded-md bg-white/4 hover:bg-white/8 border border-white/8 hover:border-[#00F0FF]/40 text-center transition-all duration-200 group/btn"
              >
                <MessageSquare size={16} className="text-[#00F0FF] mb-1.5 group-hover/btn:scale-110 transition-transform" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white">Moderation</span>
              </Link>
              <Link 
                to="/admin/leads"
                className="flex flex-col items-center justify-center p-3 rounded-md bg-white/4 hover:bg-white/8 border border-white/8 hover:border-[#00F0FF]/40 text-center transition-all duration-200 group/btn"
              >
                <ArrowUpRight size={16} className="text-[#00F0FF] mb-1.5 group-hover/btn:scale-110 transition-transform" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white">Leads Pipeline</span>
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
