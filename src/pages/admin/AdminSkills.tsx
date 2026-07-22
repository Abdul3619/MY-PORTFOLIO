import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search,
  Trash2,
  Edit2,
  Save,
  X,
  Code
} from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';

export default function AdminSkills() {
  const { triggerToast } = useAdmin();
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingSkill, setEditingSkill] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    icon: '',
    proficiency: 100,
    order_index: 0
  });

  const fetchSkills = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('order_index', { ascending: true });
      
    if (error) {
      triggerToast('Error fetching skills', error.message, 'danger');
    } else {
      setSkills(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleEdit = (skill: any) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name,
      category: skill.category,
      icon: skill.icon || '',
      proficiency: skill.proficiency || 100,
      order_index: skill.order_index || 0
    });
    setIsEditing(true);
  };

  const handleCreate = () => {
    setEditingSkill(null);
    setFormData({
      name: '',
      category: 'Frontend',
      icon: '',
      proficiency: 90,
      order_index: skills.length
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingSkill(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerToast('Saving Skill', 'Updating database...', 'info');
    
    if (editingSkill) {
      // Update
      const { data, error } = await supabase
        .from('skills')
        .update(formData)
        .eq('id', editingSkill.id)
        .select();
        
      if (error) {
        triggerToast('Error', error.message, 'danger');
      } else {
        triggerToast('Success', 'Skill updated.', 'success');
        setIsEditing(false);
        fetchSkills();
      }
    } else {
      // Create
      const { data, error } = await supabase
        .from('skills')
        .insert([formData])
        .select();
        
      if (error) {
        triggerToast('Error', error.message, 'danger');
      } else {
        triggerToast('Success', 'Skill added.', 'success');
        setIsEditing(false);
        fetchSkills();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this skill?")) return;
    
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) {
      triggerToast('Error', error.message, 'danger');
    } else {
      triggerToast('Success', 'Skill deleted.', 'success');
      fetchSkills();
    }
  };

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Skills Manager</h1>
          <p className="text-sm text-gray-400">Manage your technical skills and categories.</p>
        </div>
        
        {!isEditing && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search skills..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#00F0FF]/50 transition-colors w-64"
              />
            </div>
            <button 
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#00F0FF] text-black font-bold border border-[#00F0FF] rounded-lg hover:bg-[#00F0FF]/80 transition-all font-mono text-xs shadow-[0_0_15px_rgba(0,240,255,0.3)]"
            >
              <Plus size={16} /> Add Skill
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <GlassCard className="p-6 md:p-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                  <Code className="text-[#00F0FF]" size={20} />
                  {editingSkill ? 'Edit Skill' : 'Create New Skill'}
                </h2>
                <button onClick={handleCancel} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-mono text-gray-400 mb-1">Skill Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded p-3 text-white outline-none focus:border-[#00F0FF]/50 text-sm"
                      placeholder="e.g. React"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-400 mb-1">Category</label>
                    <input 
                      type="text" 
                      required
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded p-3 text-white outline-none focus:border-[#00F0FF]/50 text-sm"
                      placeholder="e.g. Frontend"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-400 mb-1">Icon (lucide-react name)</label>
                    <input 
                      type="text" 
                      value={formData.icon}
                      onChange={e => setFormData({...formData, icon: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded p-3 text-white outline-none focus:border-[#00F0FF]/50 text-sm"
                      placeholder="e.g. Code, Database, Server"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-400 mb-1">Proficiency (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      value={formData.proficiency}
                      onChange={e => setFormData({...formData, proficiency: parseInt(e.target.value) || 0})}
                      className="w-full bg-black/40 border border-white/10 rounded p-3 text-white outline-none focus:border-[#00F0FF]/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-400 mb-1">Order Index</label>
                    <input 
                      type="number" 
                      value={formData.order_index}
                      onChange={e => setFormData({...formData, order_index: parseInt(e.target.value) || 0})}
                      className="w-full bg-black/40 border border-white/10 rounded p-3 text-white outline-none focus:border-[#00F0FF]/50 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
                  <button 
                    type="button" 
                    onClick={handleCancel}
                    className="px-4 py-2 border border-white/20 text-white rounded hover:bg-white/5 transition-colors text-sm font-mono"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2 bg-[#00F0FF] text-black font-bold rounded hover:bg-[#00F0FF]/80 transition-all text-sm font-mono"
                  >
                    <Save size={16} /> Save Skill
                  </button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading skills...</div>
            ) : filteredSkills.length === 0 ? (
              <div className="p-12 text-center border border-white/10 rounded-lg bg-black/20">
                <p className="text-gray-400 mb-4">No skills found.</p>
                <button 
                  onClick={handleCreate}
                  className="px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded hover:bg-[#00F0FF]/20 transition-all font-mono text-xs"
                >
                  Create Your First Skill
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredSkills.map(skill => (
                  <GlassCard key={skill.id} className="p-4 group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-gray-400 uppercase">
                        {skill.category}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(skill)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(skill.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h3 className="font-bold text-white text-lg">{skill.name}</h3>
                      <div className="w-full bg-black/50 rounded-full h-1.5 mt-3 overflow-hidden">
                        <div 
                          className="bg-[#00F0FF] h-full"
                          style={{ width: `${skill.proficiency || 100}%` }}
                        />
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
