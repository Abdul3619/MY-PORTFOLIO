const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminAnalytics.tsx', 'utf8');

const regex = /\{analyticsData\.apiKeyConfigured \? \([\s\S]*?\) : \(\s*\)\}/m;

content = content.replace(regex, `{analyticsData.apiKeyConfigured && (
                <span className="text-[#00F0FF] flex items-center gap-1"><ShieldCheck size={14} /> Stats API Active</span>
              )}`);

fs.writeFileSync('src/pages/admin/AdminAnalytics.tsx', content);
