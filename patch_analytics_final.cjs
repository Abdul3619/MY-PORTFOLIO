const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminAnalytics.tsx', 'utf8');

const regex = /\{\(\!analyticsData \|\| \!analyticsData\.connected \|\| \!analyticsData\.domain\) && \([\s\S]*?\)\}/m;

const replacement = `{(!analyticsData || !analyticsData.connected) && (
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
      )}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/pages/admin/AdminAnalytics.tsx', content);
