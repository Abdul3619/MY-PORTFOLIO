const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminSiteSettings.tsx', 'utf8');

// Add Journey State
content = content.replace(
  "const [personal, setPersonal] = useState({",
  "const [journeyEvents, setJourneyEvents] = useState<any[]>([]);\n  const [personal, setPersonal] = useState({"
);

// Populate journeyEvents in useEffect
content = content.replace(
  "if (profile) setPersonal(p => ({ ...p, ...profile }));",
  "if (profile) {\n      setPersonal(p => ({ ...p, ...profile }));\n      if (profile.journey_events) setJourneyEvents(profile.journey_events);\n    }"
);

// Save journeyEvents in handleSave
content = content.replace(
  "await updateProfile.mutateAsync(personal);",
  "await updateProfile.mutateAsync({ ...personal, journey_events: journeyEvents });"
);

// Add tab definition
content = content.replace(
  "{ id: 'personal', label: 'Personal Info', icon: <User size={16} /> },",
  "{ id: 'personal', label: 'Personal Info', icon: <User size={16} /> },\n    { id: 'journey', label: 'Journey', icon: <Share2 size={16} /> },"
);

// Add tab content
const tabContent = `
        {activeTab === 'journey' && (
          <GlassCard className="p-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white font-display">Journey Timeline</h3>
              <button 
                onClick={() => setJourneyEvents([...journeyEvents, { id: Date.now().toString(), title: 'New Event', content: '', date: '', icon: 'Lightbulb' }])}
                className="px-3 py-1 bg-white/10 text-white border border-white/20 rounded hover:bg-white/20 text-xs font-mono"
              >
                + Add Event
              </button>
            </div>
            
            {journeyEvents.length === 0 && (
              <p className="text-gray-400 text-sm">No journey events yet. Click "Add Event" to start your timeline.</p>
            )}
            
            <div className="space-y-6">
              {journeyEvents.map((evt, idx) => (
                <div key={evt.id} className="p-4 bg-black/30 border border-white/10 rounded-lg space-y-4">
                  <div className="flex justify-between">
                    <h4 className="text-[#00F0FF] font-mono text-xs">Event {idx + 1}</h4>
                    <button 
                      onClick={() => setJourneyEvents(journeyEvents.filter(e => e.id !== evt.id))}
                      className="text-red-400 hover:text-red-300 text-xs font-mono"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-gray-400 mb-1">Title</label>
                      <input type="text" value={evt.title || ''} onChange={e => {
                        const newEvts = [...journeyEvents];
                        newEvts[idx].title = e.target.value;
                        setJourneyEvents(newEvts);
                      }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-gray-400 mb-1">Date / Label</label>
                      <input type="text" value={evt.date || ''} onChange={e => {
                        const newEvts = [...journeyEvents];
                        newEvts[idx].date = e.target.value;
                        setJourneyEvents(newEvts);
                      }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" placeholder="e.g. 2023 or 'The Beginning'" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-mono text-gray-400 mb-1">Content</label>
                      <textarea value={evt.content || ''} onChange={e => {
                        const newEvts = [...journeyEvents];
                        newEvts[idx].content = e.target.value;
                        setJourneyEvents(newEvts);
                      }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm h-24 resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-gray-400 mb-1">Icon Name (lucide-react)</label>
                      <input type="text" value={evt.icon || ''} onChange={e => {
                        const newEvts = [...journeyEvents];
                        newEvts[idx].icon = e.target.value;
                        setJourneyEvents(newEvts);
                      }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" placeholder="e.g. Code, Sun, Rocket" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
`;

content = content.replace(
  "{activeTab === 'personal' && (",
  tabContent + "\n\n        {activeTab === 'personal' && ("
);

fs.writeFileSync('src/pages/admin/AdminSiteSettings.tsx', content);
