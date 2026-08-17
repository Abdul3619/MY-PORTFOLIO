const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf8');

const replacementFallbackChart = `const chartPoints = [];
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
        setVisitorChartData(chartPoints);`;

content = content.replace(/const chartPoints = \[\];\s*const now = new Date\(\);\s*for \(let i = days - 1; i >= 0; i--\) \{[\s\S]*?setVisitorChartData\(chartPoints\);/, replacementFallbackChart);

const replacementProjects = `// Real project engagement calculation based on database projects
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
      });`;

content = content.replace(/\/\/ Real project engagement calculation based on database projects[\s\S]*?color: COLORS\[idx % COLORS\.length\]\s*\}\;\s*\}\)\;/m, replacementProjects);

fs.writeFileSync('src/pages/admin/Dashboard.tsx', content);
