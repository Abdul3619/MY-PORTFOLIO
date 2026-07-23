import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../components/admin/AdminLayout';
import { useProfile, useUpdateProfile, useSeo, useUpdateSeo, useContactInfo, useUpdateContactInfo } from '../../hooks/useApi';
import { Save, User, MapPin, Share2, Palette, Search, BarChart, ShieldAlert, AlertCircle } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { ProfileImageUploader } from '../../components/admin/ImageUploader';

export default function AdminSiteSettings() {
  const { triggerToast } = useAdmin();
  const [activeTab, setActiveTab] = useState('personal');

  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const { data: seo, isLoading: isSeoLoading } = useSeo();
  const { data: contact, isLoading: isContactLoading } = useContactInfo();

  const updateProfile = useUpdateProfile();
  const updateSeo = useUpdateSeo();
  const updateContact = useUpdateContactInfo();

  // Profile State
  const [journeyEvents, setJourneyEvents] = useState<any[]>([]);
  const [personal, setPersonal] = useState({
    name: '', title: '', bio: '', long_bio: '', tagline: '', resume_url: '', profile_image_url: '', cover_image_url: ''
  });

  // Contact State
  const [contactInfo, setContactInfo] = useState({
    email: '', phone: '', whatsapp: '', address: '', location: ''
  });

  // Social State
  const [social, setSocial] = useState({
    github_url: '', linkedin_url: '', twitter_url: '', instagram_url: '',
    facebook_url: '', behance_url: '', dribbble_url: '', youtube_url: '', discord_url: ''
  });

  // Branding State
  const [branding, setBranding] = useState({
    logo_url: '', favicon_url: '', site_name: '', footer_copyright: '', browser_title: ''
  });

  // SEO State
  const [seoData, setSeoData] = useState({
    site_title: '', meta_description: '', meta_keywords: '', og_image_url: '', twitter_card_image: '', canonical_url: ''
  });

  // Analytics & Maintenance State
  const [analytics, setAnalytics] = useState({
    google_analytics_id: '', google_tag_manager_id: '', microsoft_clarity_id: '', meta_pixel_id: '', maintenance_mode: false
  });

  const [hasDraft, setHasDraft] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    const draft = localStorage.getItem('admin_site_settings_draft');
    if (draft) {
      setHasDraft(true);
    }
  }, []);

  const restoreDraft = () => {
    const draft = localStorage.getItem('admin_site_settings_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.personal) setPersonal(p => ({ ...p, ...parsed.personal }));
        if (parsed.journeyEvents) setJourneyEvents(parsed.journeyEvents);
        triggerToast('Draft Restored', 'Your unsaved changes have been loaded.', 'success');
        setHasDraft(false);
      } catch (e) {}
    }
  };

  const clearDraft = () => {
    localStorage.removeItem('admin_site_settings_draft');
    setHasDraft(false);
    if (profile) {
      setPersonal(p => ({ ...p, ...profile }));
      if (profile.journey_events) setJourneyEvents(profile.journey_events);
    }
    triggerToast('Draft Cleared', 'Unsaved changes discarded.', 'info');
  };

  useEffect(() => {
    if (!profile) return;
    if (initialLoad) {
      // Always initialize with profile first
      setPersonal(p => ({ ...p, ...profile }));
      if (profile.journey_events) setJourneyEvents(profile.journey_events);
      setInitialLoad(false);
    } else {
      // Save draft on change (only after initial load has finished)
      // To avoid saving right after initial load before any edits, we could add a check,
      // but saving the exact profile state as a draft is harmless.
      localStorage.setItem('admin_site_settings_draft', JSON.stringify({ personal, journeyEvents }));
    }
  }, [profile, personal, journeyEvents, initialLoad]);

  useEffect(() => {
    if (contact) {
      setContactInfo({
        email: contact.email || '', phone: contact.phone || '', whatsapp: contact.whatsapp || '', 
        address: contact.address || '', location: contact.location || ''
      });
      setSocial({
        github_url: contact.github_url || '', linkedin_url: contact.linkedin_url || '', 
        twitter_url: contact.twitter_url || '', instagram_url: contact.instagram_url || '',
        facebook_url: contact.facebook_url || '', behance_url: contact.behance_url || '', 
        dribbble_url: contact.dribbble_url || '', youtube_url: contact.youtube_url || '', discord_url: contact.discord_url || ''
      });
    }
    if (seo) {
      setBranding({
        logo_url: seo.logo_url || '', favicon_url: seo.favicon_url || '', site_name: seo.site_name || '', 
        footer_copyright: seo.footer_copyright || '', browser_title: seo.browser_title || ''
      });
      setSeoData({
        site_title: seo.site_title || '', meta_description: seo.meta_description || '', 
        meta_keywords: seo.meta_keywords || '', og_image_url: seo.og_image_url || '', 
        twitter_card_image: seo.twitter_card_image || '', canonical_url: seo.canonical_url || ''
      });
      setAnalytics({
        google_analytics_id: seo.google_analytics_id || '', google_tag_manager_id: seo.google_tag_manager_id || '', 
        microsoft_clarity_id: seo.microsoft_clarity_id || '', meta_pixel_id: seo.meta_pixel_id || '', 
        maintenance_mode: !!seo.maintenance_mode
      });
    }
  }, [profile, contact, seo]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({ ...personal, journey_events: journeyEvents });
      await updateContact.mutateAsync({ ...contactInfo, ...social });
      await updateSeo.mutateAsync({ ...branding, ...seoData, ...analytics });
      localStorage.removeItem('admin_site_settings_draft');
      setHasDraft(false);
      triggerToast('Settings Saved', 'Your site settings have been updated successfully.', 'success');
    } catch (err: any) {
      triggerToast('Save Failed', err.message || 'An error occurred while saving.', 'danger');
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: <User size={16} /> },
    { id: 'journey', label: 'Journey', icon: <Share2 size={16} /> },
    { id: 'contact', label: 'Contact', icon: <MapPin size={16} /> },
    { id: 'social', label: 'Social Media', icon: <Share2 size={16} /> },
    { id: 'branding', label: 'Branding', icon: <Palette size={16} /> },
    { id: 'seo', label: 'SEO Defaults', icon: <Search size={16} /> },
    { id: 'analytics', label: 'Analytics & Maintenance', icon: <BarChart size={16} /> },
  ];

  const isLoading = isProfileLoading || isSeoLoading || isContactLoading;

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Site Settings</h1>
          <p className="text-sm text-gray-400">Manage global configuration for your portfolio.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 rounded-lg hover:bg-[#00F0FF]/20 transition-all font-mono text-xs">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      {hasDraft && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-yellow-500" />
            <div>
              <h4 className="text-sm font-semibold text-white">Unsaved Draft Found</h4>
              <p className="text-xs text-gray-400">You have unsaved changes from a previous session.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={clearDraft} className="text-xs font-mono text-gray-400 hover:text-white transition-colors">Discard Draft</button>
            <button onClick={restoreDraft} className="px-3 py-1.5 bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 rounded hover:bg-yellow-500/30 transition-all font-mono text-xs">Restore Draft</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-mono text-xs whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white/10 text-white border-b-2 border-[#00F0FF]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        
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


        {activeTab === 'personal' && (
          <GlassCard className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Full Name</label><input type="text" value={personal.name || ''} onChange={e => setPersonal({...personal, name: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Professional Title</label><input type="text" value={personal.title || ''} onChange={e => setPersonal({...personal, title: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div className="md:col-span-2"><label className="block text-xs font-mono text-gray-400 mb-1">Short Bio</label><textarea value={personal.bio || ''} onChange={e => setPersonal({...personal, bio: e.target.value})} className="w-full h-20 bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm resize-none" /></div>
              <div className="md:col-span-2"><label className="block text-xs font-mono text-gray-400 mb-1">Long Bio</label><textarea value={personal.long_bio || ''} onChange={e => setPersonal({...personal, long_bio: e.target.value})} className="w-full h-32 bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm resize-none" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Tagline</label><input type="text" value={personal.tagline || ''} onChange={e => setPersonal({...personal, tagline: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Resume URL</label><input type="text" value={personal.resume_url || ''} onChange={e => setPersonal({...personal, resume_url: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div>
                <ProfileImageUploader
                  label="Profile Picture"
                  value={personal.profile_image_url || ''}
                  onChange={(url) => setPersonal({ ...personal, profile_image_url: url })}
                />
              </div>
              <div>
                <ProfileImageUploader
                  label="Cover Image"
                  value={personal.cover_image_url || ''}
                  onChange={(url) => setPersonal({ ...personal, cover_image_url: url })}
                />
              </div>
            </div>
          </GlassCard>
        )}

        {activeTab === 'contact' && (
          <GlassCard className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Email</label><input type="email" value={contactInfo.email || ''} onChange={e => setContactInfo({...contactInfo, email: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Phone</label><input type="text" value={contactInfo.phone || ''} onChange={e => setContactInfo({...contactInfo, phone: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">WhatsApp</label><input type="text" value={contactInfo.whatsapp || ''} onChange={e => setContactInfo({...contactInfo, whatsapp: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Location</label><input type="text" value={contactInfo.location || ''} onChange={e => setContactInfo({...contactInfo, location: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div className="md:col-span-2"><label className="block text-xs font-mono text-gray-400 mb-1">Address</label><textarea value={contactInfo.address || ''} onChange={e => setContactInfo({...contactInfo, address: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm h-20 resize-none" /></div>
            </div>
          </GlassCard>
        )}

        {activeTab === 'social' && (
          <GlassCard className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(social).map(key => (
                <div key={key}>
                  <label className="block text-xs font-mono text-gray-400 mb-1 capitalize">{key.replace('_url', '')}</label>
                  <input type="text" value={(social as any)[key] || ''} onChange={e => setSocial({...social, [key]: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" placeholder="https://" />
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {activeTab === 'branding' && (
          <GlassCard className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Logo URL</label><input type="text" value={branding.logo_url || ''} onChange={e => setBranding({...branding, logo_url: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Favicon URL</label><input type="text" value={branding.favicon_url || ''} onChange={e => setBranding({...branding, favicon_url: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Site Name</label><input type="text" value={branding.site_name || ''} onChange={e => setBranding({...branding, site_name: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Browser Title Format</label><input type="text" value={branding.browser_title || ''} onChange={e => setBranding({...branding, browser_title: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div className="md:col-span-2"><label className="block text-xs font-mono text-gray-400 mb-1">Footer Copyright</label><input type="text" value={branding.footer_copyright || ''} onChange={e => setBranding({...branding, footer_copyright: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
            </div>
          </GlassCard>
        )}

        {activeTab === 'seo' && (
          <GlassCard className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Default Meta Title</label><input type="text" value={seoData.site_title || ''} onChange={e => setSeoData({...seoData, site_title: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Meta Description</label><textarea value={seoData.meta_description || ''} onChange={e => setSeoData({...seoData, meta_description: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm h-20 resize-none" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Keywords</label><input type="text" value={seoData.meta_keywords || ''} onChange={e => setSeoData({...seoData, meta_keywords: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" placeholder="portfolio, developer, design" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-mono text-gray-400 mb-1">Open Graph Image URL</label><input type="text" value={seoData.og_image_url || ''} onChange={e => setSeoData({...seoData, og_image_url: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
                <div><label className="block text-xs font-mono text-gray-400 mb-1">Twitter Card Image URL</label><input type="text" value={seoData.twitter_card_image || ''} onChange={e => setSeoData({...seoData, twitter_card_image: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Canonical URL</label><input type="text" value={seoData.canonical_url || ''} onChange={e => setSeoData({...seoData, canonical_url: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
            </div>
          </GlassCard>
        )}

        {activeTab === 'analytics' && (
          <GlassCard className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2"><ShieldAlert size={16} className="text-yellow-500" /> Maintenance Mode</h4>
                <p className="text-xs text-gray-400 mt-1">When enabled, visitors see a professional maintenance page. You still have access.</p>
              </div>
              <button
                type="button"
                onClick={() => setAnalytics(prev => ({...prev, maintenance_mode: !prev.maintenance_mode}))}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${analytics.maintenance_mode ? 'bg-[#00F0FF]' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${analytics.maintenance_mode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Google Analytics ID</label><input type="text" value={analytics.google_analytics_id || ''} onChange={e => setAnalytics({...analytics, google_analytics_id: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" placeholder="G-XXXXXXXXXX" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Google Tag Manager ID</label><input type="text" value={analytics.google_tag_manager_id || ''} onChange={e => setAnalytics({...analytics, google_tag_manager_id: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" placeholder="GTM-XXXXXXX" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Microsoft Clarity ID</label><input type="text" value={analytics.microsoft_clarity_id || ''} onChange={e => setAnalytics({...analytics, microsoft_clarity_id: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
              <div><label className="block text-xs font-mono text-gray-400 mb-1">Meta Pixel ID</label><input type="text" value={analytics.meta_pixel_id || ''} onChange={e => setAnalytics({...analytics, meta_pixel_id: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[#00F0FF]/50 text-sm" /></div>
            </div>
          </GlassCard>
        )}
      </div>
      
      {/* Bottom Save Button for convenience */}
      <div className="flex justify-end pt-6 border-t border-white/10 mt-8">
        <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 bg-[#00F0FF] text-black font-bold border border-[#00F0FF] rounded-lg hover:bg-[#00F0FF]/80 transition-all font-mono text-sm shadow-[0_0_15px_rgba(0,240,255,0.3)]">
          <Save size={18} /> Update Settings
        </button>
      </div>
    </div>
  );
}
