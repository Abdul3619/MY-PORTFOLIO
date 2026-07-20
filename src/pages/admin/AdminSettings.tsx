import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdmin } from '../../components/admin/AdminLayout';
import { motion } from 'motion/react';
import { 
  User, 
  Settings, 
  Search, 
  Mail, 
  Globe, 
  Github, 
  Linkedin, 
  ToggleLeft, 
  ToggleRight, 
  AlertCircle, 
  CheckCircle2, 
  Save, 
  Sparkles, 
  Sliders 
} from 'lucide-react';

export default function AdminSettings() {
  const { triggerToast } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string>('');

  // 1. Profile States
  const [formName, setFormName] = useState('Abdulwahab Abdullah');
  const [formRole, setFormRole] = useState('Senior Full-Stack Cloud & CRM Architect');
  const [formBio, setFormBio] = useState('Building premium enterprise solar solutions, responsive full-stack dashboards, and secure automated CRM engines.');
  const [formEmail, setFormEmail] = useState('abdulwahababdullah3619@gmail.com');
  const [formGithub, setFormGithub] = useState('https://github.com');
  const [formLinkedin, setFormLinkedin] = useState('https://linkedin.com');

  // 2. SEO Meta States (With character limits)
  const [seoTitle, setSeoTitle] = useState('Abdulwahab Abdullah | Senior CRM Architect');
  const [seoDesc, setSeoDesc] = useState('Senior full-stack developer specializing in bespoke solar energy CRM applications, premium portfolio dashboards, and modern cloud database sync workflows.');
  const [seoSlug, setSeoSlug] = useState('abdulwahab-architect');

  // 3. Automated Notification switches
  const [notifLeads, setNotifLeads] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifWeeklyReport, setNotifWeeklyReport] = useState(false);
  
  // 4. Security
  const [formPassword, setFormPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchProfileAndSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').limit(1).single();
      
      if (data) {
        setProfileId(data.id);
        setFormName(data.full_name || '');
        setFormRole(data.role || '');
        setFormBio(data.bio || '');
        setFormEmail(data.email || 'abdulwahababdullah3619@gmail.com');
        setFormGithub(data.github_url || '');
        setFormLinkedin(data.linkedin_url || '');
      }

      // Load SEO & notifications from localStorage shadow configuration block for state safety
      const cachedSEO = localStorage.getItem('seo_settings_cache');
      if (cachedSEO) {
        const parsed = JSON.parse(cachedSEO);
        setSeoTitle(parsed.title || seoTitle);
        setSeoDesc(parsed.desc || seoDesc);
        setSeoSlug(parsed.slug || seoSlug);
      }

      const cachedNotifs = localStorage.getItem('notification_switches_cache');
      if (cachedNotifs) {
        const parsed = JSON.parse(cachedNotifs);
        setNotifLeads(parsed.leads !== undefined ? parsed.leads : true);
        setNotifMessages(parsed.messages !== undefined ? parsed.messages : true);
        setNotifWeeklyReport(parsed.weekly !== undefined ? parsed.weekly : false);
      }

    } catch (err: any) {
      console.warn("Using local configuration settings fallback", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerToast('Saving Settings', 'Updating profile values in database memory...', 'info');

    try {
      // 1. Save profile fields to profiles table
      if (profileId) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formName,
            role: formRole,
            bio: formBio,
            email: formEmail,
            github_url: formGithub,
            linkedin_url: formLinkedin,
            updated_at: new Date().toISOString()
          })
          .eq('id', profileId);

        if (error) throw error;
      }

      // Update password if provided
      if (formPassword) {
        if (formPassword !== confirmPassword) {
          triggerToast('Validation Error', 'Passwords do not match.', 'warning');
          return;
        }
        if (formPassword.length < 6) {
          triggerToast('Validation Error', 'Password should be at least 6 characters.', 'warning');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: formPassword });
        if (error) {
          triggerToast('Error updating password', error.message, 'warning');
        } else {
          setFormPassword('');
          setConfirmPassword('');
          triggerToast('Password Updated', 'Your login password has been changed successfully.', 'success');
        }
      }

      // 2. Cache SEO parameters
      const seoPayload = { title: seoTitle, desc: seoDesc, slug: seoSlug };
      localStorage.setItem('seo_settings_cache', JSON.stringify(seoPayload));

      // 3. Cache Alerts switches
      const notifsPayload = { leads: notifLeads, messages: notifMessages, weekly: notifWeeklyReport };
      localStorage.setItem('notification_switches_cache', JSON.stringify(notifsPayload));

      // 4. Log Mutation to activity registry
      try {
        await supabase.from('activity_log').insert([{
          action: 'System Settings Updated',
          details: 'Altered profile metrics, SEO character mappings, and email notification relays.',
          created_at: new Date().toISOString()
        }]);
      } catch (e) {}

      triggerToast('Settings Synced', 'Global configurations updated successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      triggerToast('Update Failure', err.message || 'Failed to sync options to Postgres tables.', 'danger');
    }
  };

  // Compute character lengths and thresholds
  const titleLen = seoTitle.length;
  const descLen = seoDesc.length;

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">
          Metadata & Profile Settings
        </h1>
        <p className="text-xs font-mono text-[#00F0FF]/80">SEO SNIPPET REPRODUCER & PROFILE CONFIGURATORS</p>
      </div>

      <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        
        {/* LEFT COLUMN: Profile & Notification switches (Col span 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Client Profile Settings Card */}
          <div className="glass-admin p-4 sm:p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
            <div className="flex items-center gap-2 mb-2 border-b border-white/8 pb-3">
              <User size={16} className="text-[#00F0FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Client Portfolio Profile</h3>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">Full Legal Name</label>
                <input 
                  type="text" 
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#161616] border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/40"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">Professional Title</label>
                <input 
                  type="text" 
                  required
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full bg-[#161616] border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">Primary Communications Email</label>
              <div className="relative">
                <Mail size={12} className="absolute left-3 top-3 text-gray-500" />
                <input 
                  type="email" 
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-[#161616] border border-white/8 rounded pl-8 pr-2.5 py-2 text-white outline-none focus:border-[#00F0FF]/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">Professional Biography Statement</label>
              <textarea 
                required
                value={formBio}
                onChange={(e) => setFormBio(e.target.value)}
                className="w-full bg-[#161616] border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/40 h-16 resize-none"
              />
            </div>

            {/* Social coordinate nodes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">GitHub Address</label>
                <div className="relative">
                  <Github size={12} className="absolute left-3 top-3 text-gray-500" />
                  <input 
                    type="url" 
                    value={formGithub}
                    onChange={(e) => setFormGithub(e.target.value)}
                    className="w-full bg-[#161616] border border-white/8 rounded pl-8 pr-2.5 py-2 text-white outline-none focus:border-[#00F0FF]/40"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">LinkedIn Network Profile</label>
                <div className="relative">
                  <Linkedin size={12} className="absolute left-3 top-3 text-gray-500" />
                  <input 
                    type="url" 
                    value={formLinkedin}
                    onChange={(e) => setFormLinkedin(e.target.value)}
                    className="w-full bg-[#161616] border border-white/8 rounded pl-8 pr-2.5 py-2 text-white outline-none focus:border-[#00F0FF]/40"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Security & Authentication */}
          <div className="glass-admin p-4 sm:p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
            <div className="flex items-center gap-2 mb-1 border-b border-white/8 pb-3">
              <AlertCircle size={16} className="text-[#00F0FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Security & Authentication</h3>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">Update Admin Password</label>
              <input 
                type="password" 
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40 mb-3"
                placeholder="New Password"
              />
              <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#161616] border border-white/8 rounded p-2 text-white outline-none focus:border-[#00F0FF]/40"
                placeholder="Confirm Password"
              />
              <p className="text-[10px] text-gray-500 mt-2">Leave blank to keep current password.</p>
            </div>
          </div>

          {/* Email Alert Switch Boards */}
          <div className="glass-admin p-4 sm:p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
            <div className="flex items-center gap-2 mb-1 border-b border-white/8 pb-3">
              <Sliders size={16} className="text-[#00F0FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Communications Toggle Alert board</h3>
            </div>

            <div className="space-y-3">
              {/* Switch 1 */}
              <div className="flex items-center justify-between p-2.5 bg-white/2 border border-white/4 rounded">
                <div>
                  <h4 className="font-semibold text-white">Inbound Lead Alerts</h4>
                  <p className="text-[10px] text-gray-500">Dispatch instant automated SMTP emails on pipeline stage creation</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifLeads(!notifLeads)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {notifLeads ? (
                    <ToggleRight size={28} className="text-[#00F0FF]" />
                  ) : (
                    <ToggleLeft size={28} className="text-gray-600" />
                  )}
                </button>
              </div>

              {/* Switch 2 */}
              <div className="flex items-center justify-between p-2.5 bg-white/2 border border-white/4 rounded">
                <div>
                  <h4 className="font-semibold text-white">Direct Inbox Notifications</h4>
                  <p className="text-[10px] text-gray-500">Send copy of client contact messages logs directly to personal inbox</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifMessages(!notifMessages)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {notifMessages ? (
                    <ToggleRight size={28} className="text-[#00F0FF]" />
                  ) : (
                    <ToggleLeft size={28} className="text-gray-600" />
                  )}
                </button>
              </div>

              {/* Switch 3 */}
              <div className="flex items-center justify-between p-2.5 bg-white/2 border border-white/4 rounded">
                <div>
                  <h4 className="font-semibold text-white">Weekly Traffic Digest</h4>
                  <p className="text-[10px] text-gray-500">Acquire consolidated analytical breakdowns on visitor rates</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifWeeklyReport(!notifWeeklyReport)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {notifWeeklyReport ? (
                    <ToggleRight size={28} className="text-[#00F0FF]" />
                  ) : (
                    <ToggleLeft size={28} className="text-gray-600" />
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: SEO Settings & Google Snippet Reproducer (Col span 5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SEO Input Configurator */}
          <div className="glass-admin p-4 sm:p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/8 pb-3 mb-2">
              <Globe size={16} className="text-[#00F0FF]" />
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Search Engine Optimization</h3>
                <p className="text-[9px] text-gray-500 mt-0.5">Control indexing indexes character metrics</p>
              </div>
            </div>

            {/* SEO Title Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-mono uppercase text-[#00F0FF]">Meta Browser Title</label>
                <span className={`text-[9px] font-mono ${titleLen > 60 ? 'text-[#EF4444]' : 'text-gray-500'}`}>
                  {titleLen}/60 Recommended Chars
                </span>
              </div>
              <input 
                type="text" 
                required
                maxLength={70}
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className="w-full bg-[#161616] border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/40 text-[11px]"
              />
            </div>

            {/* SEO Slug Link Path */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#00F0FF] mb-1">Canonical Path Slug</label>
              <input 
                type="text" 
                required
                value={seoSlug}
                onChange={(e) => setSeoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))}
                className="w-full bg-[#161616] border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/40 text-[11px] font-mono"
              />
            </div>

            {/* SEO Meta Description */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-mono uppercase text-[#00F0FF]">Meta Page Description</label>
                <span className={`text-[9px] font-mono ${descLen > 160 ? 'text-[#EF4444]' : 'text-gray-500'}`}>
                  {descLen}/160 Recommended Chars
                </span>
              </div>
              <textarea 
                required
                maxLength={200}
                value={seoDesc}
                onChange={(e) => setSeoDesc(e.target.value)}
                className="w-full bg-[#161616] border border-white/8 rounded p-2.5 text-white outline-none focus:border-[#00F0FF]/40 text-[11px] h-20 resize-none"
              />
            </div>

          </div>

          {/* REAL-TIME SEO Snippet Preview Visualizer Module (Google SERP Replica) */}
          <div className="glass-admin p-4 sm:p-5 rounded-lg bg-[#111111]/40 border border-white/8 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-white/8 pb-2">
              <Sparkles size={14} className="text-[#00F0FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Google SERP Snippet Preview</h3>
            </div>

            {/* Google SERP Card Replica */}
            <div className="bg-white p-4 rounded-lg shadow-inner text-left font-sans space-y-1">
              {/* URL */}
              <div className="flex items-center gap-1 text-[11px] text-[#202124]">
                <span className="font-semibold">abdulwahab.dev</span>
                <span className="text-[#5f6368] font-mono">› {seoSlug || 'profile'}</span>
              </div>
              {/* Title link */}
              <h4 className="text-[18px] text-[#1a0dab] hover:underline font-normal cursor-pointer leading-tight font-sans truncate max-w-md">
                {seoTitle || 'Abdulwahab Abdullah | Senior CRM Architect'}
              </h4>
              {/* Description snippet */}
              <p className="text-[12px] text-[#4d5156] leading-normal font-sans line-clamp-2 break-words">
                {seoDesc || 'Senior full-stack developer specializing in bespoke solar energy CRM applications...'}
              </p>
            </div>

            <p className="text-[9px] text-gray-500 font-mono italic leading-normal text-center">
              *Replica maps exactly how this system is indexed on desktop search results. Keep descriptions tight.
            </p>
          </div>

          {/* Unified Save Configuration Operations Drawer Buttons */}
          <div className="flex gap-3 justify-end">
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-[#00F0FF] to-[#00aeff] text-black font-mono font-bold uppercase text-[10px] py-3.5 rounded-lg flex items-center justify-center gap-2 hover:cyan-glow transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            >
              <Save size={14} /> Commit Settings Schema
            </button>
          </div>

        </div>

      </form>

    </div>
  );
}
