const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminAnalytics.tsx', 'utf8');

// Remove setup required banner
const regex = /\{\(!analyticsData \|\| !analyticsData\.connected \|\| !analyticsData\.domain\) && \([\s\S]*?\}\)/m;

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

const subtitleRegex = /<p className="text-xs font-mono text-\[\#00F0FF\]\/80">REAL-TIME PRIVACY-FRIENDLY PLAUSIBLE ANALYTICS<\/p>/;
content = content.replace(subtitleRegex, '<p className="text-xs font-mono text-[#00F0FF]/80">REAL-TIME PRIVACY-FRIENDLY ANALYTICS ENGINE</p>');

const domainCheckRegex = /\{analyticsData && analyticsData\.connected && analyticsData\.domain && \(/;
content = content.replace(domainCheckRegex, '{analyticsData && analyticsData.connected && (');

const headerCheckRegex = /<span className="text-yellow-400">Tracking script active on site\. Add API key in Settings to view dashboard charts\.<\/span>/;
content = content.replace(headerCheckRegex, '');

fs.writeFileSync('src/pages/admin/AdminAnalytics.tsx', content);
