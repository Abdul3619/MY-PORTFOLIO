const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminSiteSettings.tsx', 'utf8');

content = content.replace(
  "      </div>\n    </div>\n  );\n}",
  `      </div>
      
      {/* Bottom Save Button for convenience */}
      <div className="flex justify-end pt-6 border-t border-white/10 mt-8">
        <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 bg-[#00F0FF] text-black font-bold border border-[#00F0FF] rounded-lg hover:bg-[#00F0FF]/80 transition-all font-mono text-sm shadow-[0_0_15px_rgba(0,240,255,0.3)]">
          <Save size={18} /> Update Settings
        </button>
      </div>
    </div>
  );
}`
);

fs.writeFileSync('src/pages/admin/AdminSiteSettings.tsx', content);
