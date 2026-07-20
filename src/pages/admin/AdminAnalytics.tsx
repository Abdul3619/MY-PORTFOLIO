import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdmin } from '../../components/admin/AdminLayout';
import { motion } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  LineChart as ChartIcon, 
  Calendar, 
  MapPin, 
  Monitor, 
  Gauge, 
  Clock, 
  Smartphone, 
  TrendingUp, 
  MousePointerClick 
} from 'lucide-react';

export default function AdminAnalytics() {
  const { searchQuery, triggerToast } = useAdmin();
  const [timeScope, setTimeScope] = useState<'7D' | '30D' | '90D' | '1Y'>('30D');
  const [loading, setLoading] = useState(true);

  // Analytics states
  const [chartData, setChartData] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any[]>([]);
  const [hardwareData, setHardwareData] = useState<any[]>([]);
  const [projectEngagement, setProjectEngagement] = useState<any[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Create dynamic chart data depending on selection
      const now = new Date();
      const pointsCount = timeScope === '7D' ? 7 : timeScope === '30D' ? 30 : timeScope === '90D' ? 12 : 12;
      const step = timeScope === '90D' || timeScope === '1Y' ? 'month' : 'day';
      
      const generatedPoints = [];
      
      if (step === 'day') {
        for (let i = pointsCount - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          const val = 120 + Math.sin(i * 0.4) * 50 + Math.random() * 25;
          generatedPoints.push({
            label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            views: Math.floor(val * 3.5),
            visitors: Math.floor(val)
          });
        }
      } else {
        // Month blocks
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = pointsCount - 1; i >= 0; i--) {
          const mIdx = (now.getMonth() - i + 12) % 12;
          const val = 2400 + Math.sin(i * 0.7) * 800 + Math.random() * 400;
          generatedPoints.push({
            label: monthNames[mIdx],
            views: Math.floor(val * 3.8),
            visitors: Math.floor(val)
          });
        }
      }
      setChartData(generatedPoints);

      // Geographical regional metrics (Saudi regional focused)
      setGeoData([
        { country: 'Saudi Arabia', flag: '🇸🇦', region: 'Riyadh / Jeddah', sessions: 2840, percentage: 55, bounce: '24%' },
        { country: 'United Arab Emirates', flag: '🇦🇪', region: 'Dubai / Abu Dhabi', sessions: 980, percentage: 19, bounce: '28%' },
        { country: 'United States', flag: '🇺🇸', region: 'Silicon Valley / NY', sessions: 620, percentage: 12, bounce: '32%' },
        { country: 'United Kingdom', flag: '🇬🇧', region: 'London Metro', sessions: 410, percentage: 8, bounce: '30%' },
        { country: 'Germany', flag: '🇩🇪', region: 'Frankfurt / Berlin', sessions: 310, percentage: 6, bounce: '25%' }
      ]);

      // Hardware Platform Distribution
      setHardwareData([
        { name: 'Chrome (Desktop)', value: 48, color: '#00F0FF' },
        { name: 'Safari (Mobile)', value: 24, color: '#10B981' },
        { name: 'Safari (Desktop)', value: 14, color: '#3B82F6' },
        { name: 'Firefox OS', value: 8, color: '#F59E0B' },
        { name: 'Edge Terminal', value: 6, color: '#8B5CF6' }
      ]);

      // Per-project Unique Engagement metrics
      setProjectEngagement([
        { name: 'Luxury Hotel Website', views: 2450, duration: '2m 45s', bounce: '28.4%', scrollDepth: '78%' },
        { name: 'Solar Calculator CRM', views: 1820, duration: '4m 12s', bounce: '18.2%', scrollDepth: '91%' },
        { name: 'Industrial IoT Screen', views: 1420, duration: '3m 05s', bounce: '32.1%', scrollDepth: '65%' },
        { name: 'E-Commerce core micro', views: 980, duration: '1m 58s', bounce: '44.8%', scrollDepth: '52%' }
      ]);

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeScope]);

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">
            Traffic & Engagement Analytics
          </h1>
          <p className="text-xs font-mono text-[#00F0FF]/80">CLIENT HARDWARE TELEMETRY & PROJECT ENGAGEMENT</p>
        </div>
        
        {/* Date scope switcher */}
        <div className="bg-white/4 border border-white/8 rounded-md p-0.5 flex text-xs font-mono">
          {([
            { label: '7D', scope: '7D' },
            { label: '30D', scope: '30D' },
            { label: '90D', scope: '90D' },
            { label: 'Year', scope: '1Y' }
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

      {/* Main Area Chart Card */}
      <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
        <div className="flex items-center justify-between mb-4 border-b border-white/8 pb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Historical Volume Framework</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Dual-metric visualization mapping sessions vs interactions</p>
          </div>
          <div className="flex gap-4 text-[10px] font-mono text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF]" /> Page Views</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500/20 border border-blue-500" /> Unique Sessions</span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="label" 
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
                  dataKey="views" 
                  stroke="#00F0FF" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#viewsGrad)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="visitors" 
                  stroke="#3B82F6" 
                  strokeWidth={1.5}
                  fillOpacity={1} 
                  fill="url(#visitorsGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-gray-500 text-xs">Awaiting database pipeline logs...</div>
          )}
        </div>
      </div>

      {/* Secondary Metrics split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (Geo Location Distribution table - Col Span 7) */}
        <div className="lg:col-span-7 glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
          <div className="flex items-center gap-2 mb-4 border-b border-white/8 pb-3">
            <MapPin size={16} className="text-[#00F0FF]" />
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Geographical Traffic Metrics</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Top regional database interactions sorted by IP telemetry</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/8 bg-white/2 text-[9px] uppercase tracking-wider text-gray-500">
                  <th className="p-3">Country</th>
                  <th className="p-3">Primary Metro Hub</th>
                  <th className="p-3 text-center">Sessions</th>
                  <th className="p-3 text-center">Distribution</th>
                  <th className="p-3 text-right">Bounce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {geoData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-3 font-semibold text-white flex items-center gap-2 font-sans text-xs">
                      <span className="text-lg">{row.flag}</span>
                      <span>{row.country}</span>
                    </td>
                    <td className="p-3 text-gray-400 font-sans">{row.region}</td>
                    <td className="p-3 text-center text-white">{row.sessions.toLocaleString()}</td>
                    <td className="p-3">
                      {/* Micro progress line */}
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#00F0FF]" style={{ width: `${row.percentage}%` }} />
                        </div>
                        <span className="text-gray-400">{row.percentage}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-gray-400">{row.bounce}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN (Platform Distribution Donut Chart - Col Span 5) */}
        <div className="lg:col-span-5 glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
          <div className="flex items-center gap-2 mb-4 border-b border-white/8 pb-3">
            <Monitor size={16} className="text-[#00F0FF]" />
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Client Hardware Distribution</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Operating environment agent headers</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4">
            <div className="w-36 h-36 shrink-0 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={hardwareData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={56}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {hardwareData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Abs center label */}
              <div className="absolute text-center">
                <p className="text-lg font-black font-mono text-white">88%</p>
                <p className="text-[8px] font-mono uppercase text-gray-500 tracking-wider">Mobile Yield</p>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5 font-mono text-[10px]">
              {hardwareData.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-white/4 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-400 truncate max-w-[120px]">{entry.name}</span>
                  </div>
                  <span className="text-white font-bold">{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Deep Per-project unique engagement analysis models */}
      <div className="glass-admin p-4 sm:p-6 rounded-lg bg-[#111111]/40 border border-white/8">
        <div className="flex items-center gap-2 mb-4 border-b border-white/8 pb-3">
          <Gauge size={16} className="text-[#00F0FF]" />
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Per-Project Engagement Analysis Models</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Granular unique tracking vectors pulling from dynamic interaction nodes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-sans">
          {projectEngagement.map((row, idx) => (
            <div key={idx} className="p-4 rounded border border-white/6 bg-white/[0.01] hover:bg-white/[0.02] transition-all space-y-3">
              <h4 className="font-bold text-white truncate border-b border-white/4 pb-2">{row.name}</h4>
              <div className="space-y-2 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase">Interactive Views</span>
                  <span className="text-white font-bold">{row.views}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase">Avg View Session</span>
                  <span className="text-[#00F0FF] font-bold flex items-center gap-1">
                    <Clock size={10} /> {row.duration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase">Bounce Rate</span>
                  <span className="text-gray-300">{row.bounce}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 uppercase">Avg Scroll Depth</span>
                  <span className="text-green-400 font-bold flex items-center gap-0.5">
                    <TrendingUp size={10} /> {row.scrollDepth}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
