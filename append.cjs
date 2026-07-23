const fs = require('fs');
const content = fs.readFileSync('src/pages/admin/AdminResume.tsx', 'utf8');
const targetStr = `                <div className="w-full h-full flex items-center justify-center font-mono text-gray-600 text-[10px]">No download logs recorded</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}`;
const replacement = `                <div className="w-full h-full flex items-center justify-center font-mono text-gray-600 text-[10px]">No download logs recorded</div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'experience' && <ResumeExperienceEditor />}
      {activeTab === 'education' && <ResumeEducationEditor />}
    </div>
  );
}

function ResumeExperienceEditor() {
  const { data: experience, isLoading } = require('../../hooks/useApi').useResumeExperience();
  const createExp = require('../../hooks/useApi').useCreateResumeExperience();
  const updateExp = require('../../hooks/useApi').useUpdateResumeExperience();
  const deleteExp = require('../../hooks/useApi').useDeleteResumeExperience();
  const { triggerToast } = require('../../components/admin/AdminLayout').useAdmin();

  const [items, setItems] = require('react').useState([]);
  const [hasDraft, setHasDraft] = require('react').useState(false);
  const [initialLoad, setInitialLoad] = require('react').useState(true);

  require('react').useEffect(() => {
    const draft = localStorage.getItem('admin_resume_exp_draft');
    if (draft) setHasDraft(true);
  }, []);

  const restoreDraft = () => {
    const draft = localStorage.getItem('admin_resume_exp_draft');
    if (draft) {
      try {
        setItems(JSON.parse(draft));
        triggerToast('Draft Restored', 'Unsaved experience data loaded.', 'success');
        setHasDraft(false);
      } catch (e) {}
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('admin_resume_exp_draft');
    setHasDraft(false);
    if (experience) setItems(experience);
    triggerToast('Draft Cleared', 'Unsaved changes discarded.', 'info');
  };

  require('react').useEffect(() => {
    if (!experience) return;
    if (initialLoad) {
      if (!hasDraft) setItems(experience);
      setInitialLoad(false);
    } else {
      localStorage.setItem('admin_resume_exp_draft', JSON.stringify(items));
    }
  }, [experience, items, initialLoad, hasDraft]);

  const handleSave = async () => {
    try {
      for (const item of items) {
        if (item.id && !item.id.startsWith('temp_')) {
          await updateExp.mutateAsync({ id: item.id, ...item });
        } else {
          await createExp.mutateAsync(item);
        }
      }
      localStorage.removeItem('admin_resume_exp_draft');
      setHasDraft(false);
      triggerToast('Success', 'Experience history saved.', 'success');
    } catch (e) {
      triggerToast('Error', e.message, 'danger');
    }
  };

  const handleDelete = async (id, idx) => {
    if (id && !id.startsWith('temp_')) {
      try {
        await deleteExp.mutateAsync(id);
      } catch (e) {
        triggerToast('Error', e.message, 'danger');
        return;
      }
    }
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
  };

  if (isLoading) return <div className="text-gray-400">Loading experience...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Experience History</h2>
        <div className="flex gap-2">
          <button onClick={() => setItems([...items, { id: 'temp_' + Date.now(), role: '', company: '', period: '', description: '', order_index: items.length }])} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded font-mono text-xs transition-colors">
            + Add Role
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 font-mono text-xs transition-colors">
            Save Changes
          </button>
        </div>
      </div>

      {hasDraft && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 flex items-center justify-between">
          <span className="text-sm text-yellow-500">You have an unsaved draft.</span>
          <div className="flex gap-3">
            <button onClick={clearDraft} className="text-xs text-gray-400 hover:text-white">Discard</button>
            <button onClick={restoreDraft} className="px-3 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">Restore</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.id} className="p-4 bg-black/40 border border-white/10 rounded space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[#00F0FF] font-mono text-xs">Role {idx + 1}</h4>
              <button onClick={() => handleDelete(item.id, idx)} className="text-red-400 text-xs font-mono hover:text-red-300">Remove</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Role Title</label>
                <input type="text" value={item.role || ''} onChange={e => { const n = [...items]; n[idx].role = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50" />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Company</label>
                <input type="text" value={item.company || ''} onChange={e => { const n = [...items]; n[idx].company = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50" />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Period (e.g. 2020 - Present)</label>
                <input type="text" value={item.period || ''} onChange={e => { const n = [...items]; n[idx].period = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-mono text-gray-400 mb-1">Description</label>
                <textarea value={item.description || ''} onChange={e => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50 h-24 resize-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumeEducationEditor() {
  const { data: education, isLoading } = require('../../hooks/useApi').useResumeEducation();
  const createEdu = require('../../hooks/useApi').useCreateResumeEducation();
  const updateEdu = require('../../hooks/useApi').useUpdateResumeEducation();
  const deleteEdu = require('../../hooks/useApi').useDeleteResumeEducation();
  const { triggerToast } = require('../../components/admin/AdminLayout').useAdmin();

  const [items, setItems] = require('react').useState([]);
  const [hasDraft, setHasDraft] = require('react').useState(false);
  const [initialLoad, setInitialLoad] = require('react').useState(true);

  require('react').useEffect(() => {
    const draft = localStorage.getItem('admin_resume_edu_draft');
    if (draft) setHasDraft(true);
  }, []);

  const restoreDraft = () => {
    const draft = localStorage.getItem('admin_resume_edu_draft');
    if (draft) {
      try {
        setItems(JSON.parse(draft));
        triggerToast('Draft Restored', 'Unsaved education data loaded.', 'success');
        setHasDraft(false);
      } catch (e) {}
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('admin_resume_edu_draft');
    setHasDraft(false);
    if (education) setItems(education);
    triggerToast('Draft Cleared', 'Unsaved changes discarded.', 'info');
  };

  require('react').useEffect(() => {
    if (!education) return;
    if (initialLoad) {
      if (!hasDraft) setItems(education);
      setInitialLoad(false);
    } else {
      localStorage.setItem('admin_resume_edu_draft', JSON.stringify(items));
    }
  }, [education, items, initialLoad, hasDraft]);

  const handleSave = async () => {
    try {
      for (const item of items) {
        if (item.id && !item.id.startsWith('temp_')) {
          await updateEdu.mutateAsync({ id: item.id, ...item });
        } else {
          await createEdu.mutateAsync(item);
        }
      }
      localStorage.removeItem('admin_resume_edu_draft');
      setHasDraft(false);
      triggerToast('Success', 'Education history saved.', 'success');
    } catch (e) {
      triggerToast('Error', e.message, 'danger');
    }
  };

  const handleDelete = async (id, idx) => {
    if (id && !id.startsWith('temp_')) {
      try {
        await deleteEdu.mutateAsync(id);
      } catch (e) {
        triggerToast('Error', e.message, 'danger');
        return;
      }
    }
    const newItems = [...items];
    newItems.splice(idx, 1);
    setItems(newItems);
  };

  if (isLoading) return <div className="text-gray-400">Loading education...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Education History</h2>
        <div className="flex gap-2">
          <button onClick={() => setItems([...items, { id: 'temp_' + Date.now(), degree: '', institution: '', period: '', description: '', order_index: items.length }])} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded font-mono text-xs transition-colors">
            + Add Degree
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 font-mono text-xs transition-colors">
            Save Changes
          </button>
        </div>
      </div>

      {hasDraft && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 flex items-center justify-between">
          <span className="text-sm text-yellow-500">You have an unsaved draft.</span>
          <div className="flex gap-3">
            <button onClick={clearDraft} className="text-xs text-gray-400 hover:text-white">Discard</button>
            <button onClick={restoreDraft} className="px-3 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">Restore</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.id} className="p-4 bg-black/40 border border-white/10 rounded space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[#00F0FF] font-mono text-xs">Degree {idx + 1}</h4>
              <button onClick={() => handleDelete(item.id, idx)} className="text-red-400 text-xs font-mono hover:text-red-300">Remove</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Degree / Certificate</label>
                <input type="text" value={item.degree || ''} onChange={e => { const n = [...items]; n[idx].degree = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50" />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Institution</label>
                <input type="text" value={item.institution || ''} onChange={e => { const n = [...items]; n[idx].institution = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50" />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Period (e.g. 2018 - 2020)</label>
                <input type="text" value={item.period || ''} onChange={e => { const n = [...items]; n[idx].period = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-mono text-gray-400 mb-1">Description</label>
                <textarea value={item.description || ''} onChange={e => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-[#00F0FF]/50 h-24 resize-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`;
const newContent = content.replace(targetStr, replacement);
fs.writeFileSync('src/pages/admin/AdminResume.tsx', newContent);
