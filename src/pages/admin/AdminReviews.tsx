import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdmin } from '../../components/admin/AdminLayout';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Check, 
  X, 
  Trash2, 
  Edit2,
  Star, 
  User, 
  Building, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  Globe,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';

interface Review {
  id: string;
  client_name: string;
  company: string | null;
  job_title: string | null;
  email: string;
  project_name: string | null;
  rating: number;
  title: string;
  message: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  approved_at: string | null;
  updated_at: string;
  ip_address?: string | null;
  browser?: string | null;
}

export default function AdminReviews() {
  const { searchQuery, triggerToast } = useAdmin();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form states for editing
  const [editForm, setEditForm] = useState({
    client_name: '',
    company: '',
    job_title: '',
    email: '',
    project_name: '',
    rating: 5,
    title: '',
    message: ''
  });

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    };
  };

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/reviews', { credentials: "include", headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch reviews: ${res.statusText}`);
      }
      const data = await res.json();
      setReviews(data);
    } catch (err: any) {
      console.error("Error loading reviews:", err);
      setError(err.message || "Failed to load reviews from server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'Pending' | 'Approved' | 'Rejected') => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/reviews/${id}`, { credentials: "include",
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        throw new Error(`Failed to update status: ${res.statusText}`);
      }

      const updatedReview = await res.json();
      setReviews(prev => prev.map(r => r.id === id ? updatedReview : r));
      
      if (newStatus === 'Approved') {
        triggerToast('Review Approved', `"${updatedReview.client_name}"'s review is now live!`, 'success');
      } else if (newStatus === 'Rejected') {
        triggerToast('Review Rejected', `"${updatedReview.client_name}"'s review was rejected.`, 'warning');
      } else {
        triggerToast('Review Moderated', `Review moved back to Pending inbox.`, 'info');
      }
    } catch (err: any) {
      triggerToast('Moderation Error', err.message || 'Failed to update review status', 'danger');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/reviews/${id}`, { credentials: "include",
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        throw new Error(`Failed to delete review: ${res.statusText}`);
      }

      setReviews(prev => prev.filter(r => r.id !== id));
      triggerToast('Review Deleted', 'The review has been purged from system memory.', 'danger');
    } catch (err: any) {
      triggerToast('Deletion Error', err.message || 'Failed to delete review', 'danger');
    }
  };

  const handleOpenEditModal = (review: Review) => {
    setEditingReview(review);
    setEditForm({
      client_name: review.client_name || '',
      company: review.company || '',
      job_title: review.job_title || '',
      email: review.email || '',
      project_name: review.project_name || '',
      rating: review.rating || 5,
      title: review.title || '',
      message: review.message || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;

    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/reviews/${editingReview.id}`, { credentials: "include",
        method: 'PUT',
        headers,
        body: JSON.stringify(editForm)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to update review: ${res.statusText}`);
      }

      const updatedReview = await res.json();
      setReviews(prev => prev.map(r => r.id === editingReview.id ? updatedReview : r));
      setIsEditModalOpen(false);
      setEditingReview(null);
      triggerToast('Review Updated', 'Successfully synchronized review adjustments.', 'success');
    } catch (err: any) {
      triggerToast('Update Error', err.message || 'Failed to edit review', 'danger');
    }
  };

  // Stats derivations
  const totalSubmissions = reviews.length;
  const pendingCount = reviews.filter(r => r.status === 'Pending').length;
  const approvedCount = reviews.filter(r => r.status === 'Approved').length;
  const rejectedCount = reviews.filter(r => r.status === 'Rejected').length;
  const averageRating = approvedCount > 0 
    ? (reviews.filter(r => r.status === 'Approved').reduce((acc, curr) => acc + curr.rating, 0) / approvedCount).toFixed(1)
    : '0.0';

  // Filters based on tab and Search string
  const filteredReviews = reviews.filter(r => {
    const tabMatches = activeTab === 'All' ? true : r.status === activeTab;
    const queryMatches = !searchQuery ||
      r.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.job_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return tabMatches && queryMatches;
  });

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">
            Client Reviews Modulator
          </h1>
          <p className="text-xs font-mono text-[#00F0FF]/80">MODERATE SUBMITTED CLIENT REVIEWS & SERVICE STAR RATINGS</p>
        </div>
        <button 
          onClick={fetchReviews}
          className="px-4 py-1.5 rounded bg-white/5 border border-white/8 hover:border-[#00F0FF]/30 hover:bg-white/10 text-xs font-mono font-bold uppercase tracking-wider text-[#00F0FF] transition-all"
        >
          Refresh Feed
        </button>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-admin p-4 rounded-xl bg-[#111111]/40 border border-white/8">
          <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Avg Rating (Approved)</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-yellow-500">{averageRating}</span>
            <div className="flex text-yellow-500">
              <Star size={18} fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="glass-admin p-4 rounded-xl bg-[#111111]/40 border border-white/8">
          <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Pending Approval</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-[#00F0FF]">{pendingCount}</span>
            <Clock size={16} className="text-[#00F0FF]/80 animate-pulse" />
          </div>
        </div>
        <div className="glass-admin p-4 rounded-xl bg-[#111111]/40 border border-white/8">
          <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Approved Public</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-500">{approvedCount}</span>
            <CheckCircle2 size={16} className="text-emerald-500/80" />
          </div>
        </div>
        <div className="glass-admin p-4 rounded-xl bg-[#111111]/40 border border-white/8">
          <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Rejected Reviews</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-rose-500">{rejectedCount}</span>
            <X size={16} className="text-rose-500/80" />
          </div>
        </div>
        <div className="glass-admin p-4 rounded-xl bg-[#111111]/40 border border-white/8 col-span-2 lg:col-span-1">
          <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Total Submissions</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-white">{totalSubmissions}</span>
            <Layers size={16} className="text-gray-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8 pb-2 text-xs font-mono overflow-x-auto gap-1 md:gap-2">
        {([
          { key: 'All', label: 'All Reviews', count: totalSubmissions, color: '' },
          { key: 'Pending', label: 'Pending Moderation', count: pendingCount, color: 'text-[#00F0FF]' },
          { key: 'Approved', label: 'Approved & Live', count: approvedCount, color: 'text-emerald-500' },
          { key: 'Rejected', label: 'Rejected / Archived', count: rejectedCount, color: 'text-rose-500' }
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 border-b-2 font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab.key 
                ? 'border-[#00F0FF] text-white font-black bg-white/[0.02]' 
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/[0.01]'
            }`}
          >
            {tab.label} <span className={`ml-1 px-1.5 py-0.5 rounded-full bg-white/5 text-[9px] ${tab.color || 'text-gray-400'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Loader */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#00F0FF]/20 border-t-[#00F0FF] rounded-full animate-spin mb-4" />
          <p className="font-mono text-xs text-[#00F0FF] uppercase tracking-wider animate-pulse">Loading Client Reviews Feed...</p>
        </div>
      ) : error ? (
        <div className="glass-admin p-6 rounded-xl border border-rose-500/30 bg-rose-500/5 text-center max-w-lg mx-auto">
          <AlertCircle className="text-rose-500 mx-auto mb-3" size={32} />
          <h3 className="text-sm font-bold font-mono uppercase text-white mb-1">Synchronization Fault</h3>
          <p className="text-xs text-rose-400 leading-relaxed mb-4">{error}</p>
          <button 
            onClick={fetchReviews}
            className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 font-mono text-xs uppercase hover:bg-rose-500/20 transition-all"
          >
            Retry Database Handshake
          </button>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="glass-admin p-12 text-center rounded-xl bg-white/[0.01] border border-white/4">
          <MessageSquare className="text-gray-600 mx-auto mb-4" size={40} />
          <h3 className="text-sm font-bold font-mono uppercase text-white mb-1">No Reviews Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            There are no reviews matching the "{activeTab}" status or the active search query.
          </p>
        </div>
      ) : (
        /* Reviews Grid */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredReviews.map((item) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                key={item.id}
                className={`glass-admin p-5 rounded-xl border flex flex-col justify-between relative group transition-all duration-300 ${
                  item.status === 'Approved' ? 'border-emerald-500/10 hover:border-emerald-500/30 bg-emerald-500/[0.01]' :
                  item.status === 'Rejected' ? 'border-rose-500/10 hover:border-rose-500/30 bg-rose-500/[0.01]' :
                  'border-white/8 hover:border-[#00F0FF]/30 bg-white/[0.01]'
                }`}
              >
                
                {/* Header info */}
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                        <User size={18} className="text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">{item.client_name}</h3>
                        <p className="text-[10px] text-gray-500 font-mono truncate">{item.email}</p>
                        {(item.job_title || item.company) && (
                          <p className="text-[10px] text-[#00F0FF] font-mono flex items-center gap-1 mt-0.5 truncate">
                            <Briefcase size={10} className="shrink-0" />
                            {item.job_title || 'Client'} {item.company ? `@ ${item.company}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {/* Rating stars */}
                      <div className="flex gap-0.5 text-yellow-500">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={12} 
                            fill={i < (item.rating || 5) ? 'currentColor' : 'none'} 
                            className={i < (item.rating || 5) ? 'text-yellow-500' : 'text-gray-800'}
                          />
                        ))}
                      </div>

                      {/* Status badge */}
                      <span className={`text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        item.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        item.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20 animate-pulse'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Project Name context */}
                  {item.project_name && (
                    <div className="mb-3 px-3 py-1 rounded bg-white/4 border border-white/4 text-[10px] font-mono text-gray-400 flex items-center gap-1.5">
                      <span className="text-[#00F0FF] uppercase tracking-wider font-bold">Project Context:</span>
                      <span className="text-white truncate">{item.project_name}</span>
                    </div>
                  )}

                  {/* Review Text */}
                  <div className="p-4 rounded-lg bg-black/30 border border-white/4 mb-4">
                    <h4 className="text-xs font-bold text-white tracking-wide mb-1">"{item.title}"</h4>
                    <p className="text-xs text-gray-300 italic leading-relaxed whitespace-pre-line font-sans">
                      "{item.message}"
                    </p>
                  </div>
                </div>

                {/* Footer specs / Action nodes */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/6 pt-4 mt-auto shrink-0">
                  
                  {/* System metadata */}
                  <div className="text-[9px] font-mono text-gray-500 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Clock size={10} />
                      <span>Submitted: {new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    {item.ip_address && (
                      <div className="flex items-center gap-1.5">
                        <Globe size={10} />
                        <span>IP: {item.ip_address} | Browser: {item.browser?.substring(0, 30)}...</span>
                      </div>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Edit button */}
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-[#00F0FF] transition-all"
                      title="Adjust review content or metadata"
                    >
                      <Edit2 size={12} />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded bg-white/5 hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 transition-all"
                      title="Permanently erase this review"
                    >
                      <Trash2 size={12} />
                    </button>

                    {/* Approve / Reject Actions */}
                    {item.status !== 'Approved' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'Approved')}
                        className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-all border border-emerald-500/20"
                        title="Publish to public portfolio page"
                      >
                        <Check size={10} /> Approve
                      </button>
                    )}

                    {item.status !== 'Rejected' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'Rejected')}
                        className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-all border border-rose-500/20"
                        title="Reject / Hide review"
                      >
                        <X size={10} /> Reject
                      </button>
                    )}

                    {item.status !== 'Pending' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'Pending')}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 transition-all"
                        title="Restore to Pending Inbox"
                      >
                        <Clock size={10} /> Revert
                      </button>
                    )}
                  </div>
                </div>

              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Review Slide-over Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsEditModalOpen(false); setEditingReview(null); }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="glass-admin w-full max-w-lg bg-[#111111]/95 border border-white/10 rounded-2xl overflow-hidden relative z-10 p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-white/8 pb-3 mb-4">
                <div>
                  <h3 className="text-md font-bold font-kanit tracking-wide uppercase text-[#00F0FF]">Adjust Review Metrics</h3>
                  <p className="text-[10px] font-mono text-gray-500">APPLY EDIT DETAILS TO SEEDED CLIENT RESPONSE</p>
                </div>
                <button 
                  onClick={() => { setIsEditModalOpen(false); setEditingReview(null); }}
                  className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Client Name</label>
                    <input 
                      type="text"
                      value={editForm.client_name}
                      onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                      className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Email</label>
                    <input 
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Company</label>
                    <input 
                      type="text"
                      value={editForm.company}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                      className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Job Title</label>
                    <input 
                      type="text"
                      value={editForm.job_title}
                      onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                      className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Project Context</label>
                    <input 
                      type="text"
                      value={editForm.project_name}
                      onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })}
                      placeholder="e.g. Solar Optimization Portal"
                      className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Rating Stars</label>
                    <select 
                      value={editForm.rating}
                      onChange={(e) => setEditForm({ ...editForm, rating: parseInt(e.target.value) })}
                      className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                    >
                      {[5, 4, 3, 2, 1].map(n => (
                        <option key={n} value={n} className="bg-[#111111]">{n} Stars</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Review Title</label>
                  <input 
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1">Message Content</label>
                  <textarea 
                    rows={4}
                    value={editForm.message}
                    onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                    className="w-full bg-[#161616] border border-white/8 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#00F0FF]/40 font-sans leading-relaxed resize-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-white/8 mt-6">
                  <button
                    type="button"
                    onClick={() => { setIsEditModalOpen(false); setEditingReview(null); }}
                    className="px-4 py-2 border border-white/8 hover:bg-white/5 rounded text-xs font-mono uppercase text-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-[#00F0FF] to-[#0077ff] hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] text-black rounded text-xs font-mono font-bold uppercase transition-all"
                  >
                    Commit Settings
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
