import { useState } from "react";
import { motion } from "motion/react";
import { Mail, Github, Linkedin, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { GlassCard } from "@/components/GlassCard";
import { MagneticButton } from "@/components/MagneticButton";
import { useSubmitContact, useContactInfo } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [success, setSuccess] = useState(false);
  const submitContact = useSubmitContact();
  const { data: contactInfo } = useContactInfo();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitContact.mutateAsync(formData);
      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <PageTransition className="w-full flex-1 flex flex-col justify-center min-h-[calc(100vh-12rem)]">
      <div className="max-w-6xl mx-auto w-full">
        <motion.div 
          className="text-center mb-16 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6 uppercase">
            {t("contact.title", "Let's Build Something")} <span className="text-gradient">{t("contact.title_bold", "Great.")}</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("contact.subtitle", "Open for freelance opportunities, collaborations, and ambitious projects.")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Contact Info & Socials */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col justify-between"
          >
            <div>
              <h2 className="text-3xl font-display font-semibold text-white mb-8">{t("contact.reach_out_title", "Reach Out directly")}</h2>
              
              <div className="space-y-6">
                <a href={`mailto:${contactInfo?.email || "abdulwahababdullah3619@gmail.com"}`} className="flex items-center gap-6 p-4 rounded-2xl hover:bg-white/5 transition-colors group interactive">
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
                    <Mail size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">{t("contact.email", "Email")}</p>
                    <p className="text-lg text-white font-medium">{contactInfo?.email || "abdulwahababdullah3619@gmail.com"}</p>
                  </div>
                </a>
              </div>
            </div>

            <div className="mt-12 lg:mt-0">
              <h3 className="text-xl font-display font-semibold text-white mb-6">{t("contact.connect", "Connect")}</h3>
              <div className="flex gap-4">
                {contactInfo?.github_url && (
                  <a href={contactInfo.github_url} target="_blank" rel="noreferrer" className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-gold hover:border-gold/50 transition-all interactive hover:-translate-y-1">
                    <Github size={24} />
                  </a>
                )}
                {contactInfo?.linkedin_url && (
                  <a href={contactInfo.linkedin_url} target="_blank" rel="noreferrer" className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-gold hover:border-gold/50 transition-all interactive hover:-translate-y-1">
                    <Linkedin size={24} />
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <GlassCard className="p-8 md:p-10">
              <h3 className="text-2xl font-display font-semibold text-white mb-8">{t("contact.send_message_title", "Send a Message")}</h3>
              
              {success ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-2xl font-bold text-white">{t("contact.success_title", "Message Sent!")}</h4>
                  <p className="text-gray-400">{t("contact.success_message", "Thank you for reaching out. I'll get back to you shortly.")}</p>
                  <button onClick={() => setSuccess(false)} className="text-gold hover:underline mt-4">{t("contact.send_another", "Send another message")}</button>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400 font-medium">{t("contact.label_name", "Name")}</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
                        placeholder={t("contact.placeholder_name", "John Doe")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400 font-medium">{t("contact.label_email", "Email")}</label>
                      <input 
                        type="email" 
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
                        placeholder={t("contact.placeholder_email", "john@example.com")}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-medium">{t("contact.label_subject", "Subject")}</label>
                    <input 
                      type="text" 
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors"
                      placeholder={t("contact.placeholder_subject", "Project Inquiry")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-medium">{t("contact.label_message", "Message")}</label>
                    <textarea 
                      rows={5}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold/50 transition-colors resize-none"
                      placeholder={t("contact.placeholder_message", "Tell me about your project...")}
                    />
                  </div>

                  <button disabled={submitContact.isPending} className="w-full py-4 interactive glass-button bg-gold text-black rounded-lg font-bold flex justify-center items-center gap-2 disabled:opacity-50" type="submit">
                    <span>{submitContact.isPending ? t("contact.button_sending", "Sending...") : t("contact.button_send", "Send Message")}</span>
                    <Send size={18} />
                  </button>
                </form>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
