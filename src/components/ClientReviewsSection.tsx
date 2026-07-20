import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, MessageSquare, Plus, X, Send, Filter, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  created_at: string;
}

export function ClientReviewsSection() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar" || document.documentElement.dir === "rtl";

  // Data State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest_rated">("newest");
  const [loading, setLoading] = useState(true);
  
  // Rating breakdown derived from a fast pre-fetch of approved counts
  const [starStats, setStarStats] = useState({
    avg: 0,
    total: 0,
    distribution: [0, 0, 0, 0, 0] // index 0 = 1 star, index 4 = 5 star
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    client_name: "",
    email: "",
    company: "",
    job_title: "",
    project_name: "",
    rating: 5,
    title: "",
    message: ""
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch approved reviews with active sort & pagination
  const fetchApprovedReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?sort=${sortBy}&page=${currentPage}&limit=6`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setTotalCount(data.total);
        setTotalPages(data.pages);
      }
    } catch (err) {
      console.error("Error loading approved reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats details (all approved reviews to compute stars breakdown)
  const fetchStatsDistribution = async () => {
    try {
      const res = await fetch("/api/reviews?limit=1000", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const allApproved: Review[] = data.reviews || [];
        const count = allApproved.length;
        
        if (count === 0) {
          setStarStats({ avg: 0, total: 0, distribution: [0, 0, 0, 0, 0] });
          return;
        }

        const sum = allApproved.reduce((acc, curr) => acc + curr.rating, 0);
        const avg = parseFloat((sum / count).toFixed(1));
        
        const dist = [0, 0, 0, 0, 0];
        allApproved.forEach(r => {
          const idx = Math.min(Math.max(r.rating - 1, 0), 4);
          dist[idx]++;
        });

        setStarStats({ avg, total: count, distribution: dist });
      }
    } catch (err) {
      console.error("Error computing distribution stats:", err);
    }
  };

  useEffect(() => {
    fetchApprovedReviews();
  }, [sortBy, currentPage]);

  useEffect(() => {
    fetchStatsDistribution();
  }, []);

  const handleOpenModal = () => {
    setFormData({
      client_name: "",
      email: "",
      company: "",
      job_title: "",
      project_name: "",
      rating: 5,
      title: "",
      message: ""
    });
    setFormErrors({});
    setSubmitSuccess(null);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.client_name.trim()) errors.client_name = t("reviews.err_name", "Name is required");
    
    if (!formData.email.trim()) {
      errors.email = t("reviews.err_email_empty", "Email is required");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = t("reviews.err_email_invalid", "Invalid email address");
    }

    if (!formData.title.trim()) errors.title = t("reviews.err_title", "Review title is required");
    
    if (!formData.message.trim()) {
      errors.message = t("reviews.err_message_empty", "Review message is required");
    } else if (formData.message.trim().length < 10) {
      errors.message = t("reviews.err_message_short", "Message must be at least 10 characters");
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const res = await fetch("/api/reviews", { credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setSubmitSuccess(data.message || t("reviews.submit_success_msg", "Thank you! Your review has been submitted and is awaiting approval."));
        // Reset form
        setFormData({
          client_name: "",
          email: "",
          company: "",
          job_title: "",
          project_name: "",
          rating: 5,
          title: "",
          message: ""
        });
      } else {
        setSubmitError(data.error || t("reviews.submit_error_msg", "Failed to submit review. Please try again."));
      }
    } catch (err: any) {
      setSubmitError(t("reviews.submit_error_network", "Network error occurred. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-24 pt-16 border-t border-white/8 w-full" id="client-reviews-section">
      <div className="max-w-6xl mx-auto px-4 md:px-0">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div className={isRtl ? "text-right" : "text-left"}>
            <span className="text-gold font-mono text-xs uppercase tracking-widest">{t("reviews.sub", "MODERATED FEEDBACK")}</span>
            <h2 className="text-3xl md:text-4xl font-display font-bold mt-2">
              {t("reviews.title_part1", "CLIENT")} <span className="text-gradient">{t("reviews.title_part2", "REVIEWS")}</span>
            </h2>
          </div>
          
          <button
            onClick={handleOpenModal}
            className="group flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-gold/80 to-gold text-black font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>{t("reviews.leave_btn", "Leave a Review")}</span>
          </button>
        </div>

        {/* Rating Overview and Distribution */}
        {starStats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 p-6 md:p-8 rounded-2xl glass-card border border-white/5 bg-white/[0.01]">
            {/* Big Average */}
            <div className="flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-white/8 pb-6 md:pb-0 md:pr-8">
              <span className="text-5xl md:text-6xl font-display font-bold text-white mb-2">{starStats.avg}</span>
              <div className="flex text-yellow-500 gap-0.5 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    size={20} 
                    fill={i < Math.round(starStats.avg) ? "currentColor" : "none"} 
                    className={i < Math.round(starStats.avg) ? "text-yellow-500" : "text-gray-700"}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                {t("reviews.based_on", "Based on")} {starStats.total} {t("reviews.total_approved", "approved submissions")}
              </span>
            </div>

            {/* Distribution bars */}
            <div className="col-span-2 flex flex-col justify-center space-y-2 md:pl-4">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = starStats.distribution[stars - 1] || 0;
                const percentage = starStats.total > 0 ? (count / starStats.total) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-gray-400 w-12 flex items-center gap-1 shrink-0 justify-end">
                      {stars} <Star size={10} className="text-yellow-500" fill="currentColor" />
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-gold/50 to-gold rounded-full"
                      />
                    </div>
                    <span className="font-mono text-gray-500 w-10 shrink-0 text-left">
                      {count} ({Math.round(percentage)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Board: Filter controls and Review Cards Grid */}
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/[0.01] border border-white/5 p-4 rounded-xl text-xs font-mono ${isRtl ? "sm:flex-row-reverse" : ""}`}>
            <span className="text-gray-400">
              {t("reviews.showing_count", "Showing")} {reviews.length} {t("reviews.of", "of")} {totalCount} {t("reviews.reviews", "approved reviews")}
            </span>

            <div className="flex items-center gap-2">
              <Filter size={12} className="text-gold" />
              <span className="text-gray-500 mr-1">{t("reviews.sort_label", "Sort:")}</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-[#111111] border border-white/10 rounded px-2 py-1 text-xs text-white cursor-pointer outline-none focus:border-gold"
              >
                <option value="newest">{t("reviews.sort_newest", "Newest First")}</option>
                <option value="oldest">{t("reviews.sort_oldest", "Oldest First")}</option>
                <option value="highest_rated">{t("reviews.sort_rating", "Highest Rating")}</option>
              </select>
            </div>
          </div>

          {/* Loader or Feed */}
          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin mb-3" />
              <p className="font-mono text-xs text-gold uppercase tracking-wider">{t("reviews.loading", "Syncing reviews feed...")}</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-white/5 bg-white/[0.01] max-w-lg mx-auto">
              <MessageSquare className="text-gray-600 mx-auto mb-4" size={32} />
              <h3 className="font-bold text-white text-sm uppercase tracking-wide">{t("reviews.no_reviews", "No reviews published yet")}</h3>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {t("reviews.no_reviews_sub", "Be the first to submit feedback on our contract services by clicking the leave a review button above!")}
              </p>
            </div>
          ) : (
            <>
              {/* Review Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {reviews.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className="glass-card p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:border-gold/20 hover:bg-white/[0.02] flex flex-col justify-between transition-all duration-300 relative group"
                    >
                      <div>
                        {/* Upper Details */}
                        <div className="flex justify-between items-start mb-4 gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-white text-sm truncate">{item.client_name}</h4>
                            {(item.job_title || item.company) && (
                              <p className="text-[10px] text-gold font-mono mt-0.5 truncate">
                                {item.job_title || "Client"} {item.company ? `@ ${item.company}` : ""}
                              </p>
                            )}
                          </div>
                          
                          {/* Stars */}
                          <div className="flex gap-0.5 text-yellow-500 shrink-0">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={11} 
                                fill={i < item.rating ? "currentColor" : "none"} 
                                className={i < item.rating ? "text-yellow-500" : "text-gray-700"}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Project Context */}
                        {item.project_name && (
                          <div className="mb-3 px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-mono text-gray-400 inline-block truncate max-w-full">
                            <span className="text-gold font-bold uppercase mr-1">{t("reviews.project_tag", "Project:")}</span>
                            <span className="text-white">{item.project_name}</span>
                          </div>
                        )}

                        {/* Title and Message */}
                        <h5 className="font-bold text-white text-xs tracking-wide mb-1.5">"{item.title}"</h5>
                        <p className="text-xs text-gray-300 italic font-sans leading-relaxed whitespace-pre-line mb-4">
                          "{item.message}"
                        </p>
                      </div>

                      {/* Footer Info */}
                      <div className="border-t border-white/5 pt-3 mt-auto flex items-center justify-between text-[9px] font-mono text-gray-500">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        <span className="uppercase text-gold/60">{t("reviews.verified", "VERIFIED FEEDBACK")}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 pt-4 text-xs font-mono">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="p-1 px-3 rounded border border-white/10 hover:border-gold hover:text-gold disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-gray-500 transition-colors"
                  >
                    {t("reviews.prev", "Previous")}
                  </button>
                  <span className="text-gray-400">
                    {t("reviews.page", "Page")} {currentPage} {t("reviews.of", "of")} {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="p-1 px-3 rounded border border-white/10 hover:border-gold hover:text-gold disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-gray-500 transition-colors"
                  >
                    {t("reviews.next", "Next")}
                  </button>
                </div>
              )}
            </>
          )}

        </div>

      </div>

      {/* Leave Review Form Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="glass-card w-full max-w-xl bg-[#0A0A0A]/95 border border-white/10 rounded-2xl overflow-hidden relative z-10 p-6 md:p-8 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-white/8 pb-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold font-display uppercase text-white">{t("reviews.modal_title", "Submit a Review")}</h3>
                  <p className="text-[10px] font-mono text-gray-500 uppercase mt-0.5 tracking-wider">{t("reviews.modal_subtitle", "Your review will be reviewed for approval before publishing")}</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {submitSuccess ? (
                /* Success Slate */
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8 space-y-4"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <h4 className="text-sm font-bold font-mono text-white uppercase tracking-wider">{t("reviews.submitted_title", "Submission Completed")}</h4>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
                    {submitSuccess}
                  </p>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 bg-gradient-to-r from-gold/80 to-gold text-black rounded-full font-mono text-xs font-bold uppercase transition-transform transform hover:scale-105 mt-6"
                  >
                    {t("reviews.close", "Close Portal")}
                  </button>
                </motion.div>
              ) : (
                /* Form */
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  
                  {submitError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded p-3 text-xs text-rose-400 flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Personal Block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">{t("reviews.field_name", "Your Name")} <span className="text-gold">*</span></label>
                      <input 
                        type="text"
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        className={`w-full bg-white/[0.02] border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold/50 ${formErrors.client_name ? 'border-rose-500/45' : 'border-white/8'}`}
                        placeholder="e.g. John Doe"
                      />
                      {formErrors.client_name && <p className="text-[10px] text-rose-400 font-mono mt-1">{formErrors.client_name}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">{t("reviews.field_email", "Email Address")} <span className="text-gold">*</span></label>
                      <input 
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full bg-white/[0.02] border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold/50 ${formErrors.email ? 'border-rose-500/45' : 'border-white/8'}`}
                        placeholder="e.g. john@example.com"
                      />
                      {formErrors.email && <p className="text-[10px] text-rose-400 font-mono mt-1">{formErrors.email}</p>}
                    </div>
                  </div>

                  {/* Employment details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">{t("reviews.field_company", "Company / Agency")}</label>
                      <input 
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold/50"
                        placeholder="e.g. Acme Tech Inc (Optional)"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">{t("reviews.field_title", "Your Job Title")}</label>
                      <input 
                        type="text"
                        value={formData.job_title}
                        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                        className="w-full bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold/50"
                        placeholder="e.g. Solar Operations Director (Optional)"
                      />
                    </div>
                  </div>

                  {/* Project name & Star selection */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">{t("reviews.field_project", "Project Delivered")}</label>
                      <input 
                        type="text"
                        value={formData.project_name}
                        onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                        className="w-full bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold/50"
                        placeholder="e.g. Custom CRM System (Optional)"
                      />
                    </div>

                    {/* Interactive Star rating selector */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1.5">{t("reviews.field_rating", "Star Score")} <span className="text-gold">*</span></label>
                      <div className="flex gap-1 py-1 text-yellow-500 cursor-pointer">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData({ ...formData, rating: star })}
                            className="focus:outline-none transform hover:scale-125 transition-transform"
                            title={`${star} Stars`}
                          >
                            <Star 
                              size={18} 
                              fill={star <= formData.rating ? "currentColor" : "none"} 
                              className={star <= formData.rating ? "text-yellow-500" : "text-gray-700"}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Review title */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">{t("reviews.field_review_title", "Review Title")} <span className="text-gold">*</span></label>
                    <input 
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className={`w-full bg-white/[0.02] border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold/50 ${formErrors.title ? 'border-rose-500/45' : 'border-white/8'}`}
                      placeholder="e.g. Outstanding Deliverables & Commendable Project Conduct"
                    />
                    {formErrors.title && <p className="text-[10px] text-rose-400 font-mono mt-1">{formErrors.title}</p>}
                  </div>

                  {/* Message content text area */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-1">{t("reviews.field_message", "Detailed Feedback")} <span className="text-gold">*</span></label>
                    <textarea 
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className={`w-full bg-white/[0.02] border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold/50 font-sans leading-relaxed resize-none ${formErrors.message ? 'border-rose-500/45' : 'border-white/8'}`}
                      placeholder={t("reviews.field_message_placeholder", "Share details of your experience working with me. (Minimum 10 characters)")}
                    />
                    {formErrors.message && <p className="text-[10px] text-rose-400 font-mono mt-1">{formErrors.message}</p>}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/8 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 border border-white/10 hover:bg-white/5 rounded-full text-xs font-mono uppercase text-gray-400 transition-colors"
                    >
                      {t("reviews.cancel", "Cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 bg-gradient-to-r from-gold/80 to-gold text-black rounded-full font-mono text-xs font-bold uppercase hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border border-black/20 border-t-black rounded-full animate-spin" />
                          <span>{t("reviews.transmitting", "TRANSMITTING...")}</span>
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          <span>{t("reviews.transmit", "SUBMIT FEEDBACK")}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
