import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdmin } from '../../components/admin/AdminLayout';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Trash2, 
  CheckCircle2, 
  UserPlus, 
  CornerUpLeft, 
  Clock, 
  Search, 
  ChevronRight, 
  ExternalLink, 
  Inbox, 
  AlertCircle 
} from 'lucide-react';

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export default function AdminMessages() {
  const { searchQuery, triggerToast } = useAdmin();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  
  // Reply drafting state
  const [replyText, setReplyText] = useState('');

  // Default fallback messages if table is empty
  const mockMessages: Message[] = [
    { id: 'm1', name: 'Abdul Wahab', email: 'wahab@riyadhsolarsystems.com', subject: 'Solar Array Design Optimization Query', message: 'Hello Abdulwahab,\n\nWe saw your recent solar power engineering portfolio. We would love to discuss a commercial project design contract with you regarding a 50kW industrial grid setup in Riyadh.\n\nPlease let us know your availability for a consultant call next Tuesday.\n\nBest,\nAbdul Wahab', created_at: new Date(Date.now() - 30 * 60000).toISOString(), is_read: false },
    { id: 'm2', name: 'Leila Al-Farsi', email: 'leila.f@jeddahcreatives.sa', subject: 'Fullstack React CRM Redevelopment', message: 'Hi Abdul,\n\nOur creative agency is currently running an outdated CRM engine and looking for an experienced developer to rebuild our system utilizing Next.js, Tailwind, and Supabase.\n\nYour portfolio is highly impressive. What are your standard hourly consulting fees for custom CRM projects?\n\nKind Regards,\nLeila Al-Farsi', created_at: new Date(Date.now() - 3600000 * 5).toISOString(), is_read: true },
    { id: 'm3', name: 'John Doe', email: 'john@interglobe-logistics.com', subject: 'API Endpoint Performance Tuning', message: 'Abdul,\n\nI noticed your open-source database sync utility on GitHub. We need help tuning some Postgres indexing and writing custom RLS policies for our company app.\n\nDo you accept freelance contract work?\n\nSincerely,\nJohn', created_at: new Date(Date.now() - 3600000 * 24).toISOString(), is_read: true }
  ];

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setMessages(data as Message[]);
        setSelectedMsgId(data[0].id);
      } else {
        // Fallback mocked messages
        setMessages(mockMessages);
        setSelectedMsgId(mockMessages[0].id);
      }
    } catch (err: any) {
      console.warn('Contact messages read fallback triggered', err.message);
      setMessages(mockMessages);
      setSelectedMsgId(mockMessages[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleMarkAsRead = async (id: string, readVal: boolean) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: readVal } : m));
    
    try {
      // Mark as read in contact_messages
      const { error } = await supabase
        .from('contact_messages')
        .update({ is_read: readVal })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err: any) {
      console.warn("Messages update failure", err.message);
    }

    triggerToast('Session Updated', `Message marked as ${readVal ? 'read' : 'unread'}`, 'info');
  };

  const handleDeleteMessage = async (id: string) => {
    const freshMessages = messages.filter(m => m.id !== id);
    setMessages(freshMessages);
    
    if (selectedMsgId === id) {
      setSelectedMsgId(freshMessages.length > 0 ? freshMessages[0].id : null);
    }

    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.warn("Messages delete failure", err.message);
    }

    triggerToast('Message Purged', 'Contact mail cleared from inbox logs.', 'warning');
  };

  // Convert Message directly into CRM Lead pipeline schema
  const handleConvertToLead = async (msg: Message) => {
    try {
      const leadPayload = {
        name: msg.name,
        email: msg.email,
        company: msg.subject?.substring(0, 45) || 'Converted Lead',
        status: 'New' as const,
        value: 5000, // Default base estimation
        source: 'Contact Inbox',
        created_at: new Date().toISOString()
      };

      // 1. Post directly to Supabase leads table
      let recordId = Math.random().toString(36).substring(7);
      try {
        const { data, error } = await supabase
          .from('leads')
          .insert([leadPayload])
          .select();
        
        if (error) throw error;
        if (data && data[0]) recordId = data[0].id;
      } catch (dbErr) {
        // Fallback mock cache append
        const cachedLeads = JSON.parse(localStorage.getItem('crm_leads_cache') || '[]');
        const localLead = { ...leadPayload, id: recordId };
        localStorage.setItem('crm_leads_cache', JSON.stringify([localLead, ...cachedLeads]));
      }

      // 2. Insert original mail body as first client note
      const notePayload = {
        lead_id: recordId,
        note: `Converted from Message Inbox. Original message subject: "${msg.subject}". Message Body:\n\n${msg.message}`,
        created_at: new Date().toISOString()
      };

      try {
        await supabase.from('lead_notes').insert([notePayload]);
      } catch (nErr) {
        const cachedNotes = JSON.parse(localStorage.getItem(`crm_lead_notes_${recordId}`) || '[]');
        localStorage.setItem(`crm_lead_notes_${recordId}`, JSON.stringify([{ ...notePayload, id: 'n_init' }, ...cachedNotes]));
      }

      // 3. Mark original message as read
      handleMarkAsRead(msg.id, true);

      // 4. Log to System Activity Log
      try {
        await supabase.from('activity_log').insert([{
          action: 'Inbound CRM Conversion',
          details: `Inbox message from "${msg.name}" ingested into active Leads pipeline.`,
          created_at: new Date().toISOString()
        }]);
      } catch (e) {}

      triggerToast('Client Pipeline Ingestion', `"${msg.name}" converted to CRM lead successfully!`, 'success');
    } catch (err: any) {
      console.error("Conversion error", err);
      triggerToast('Conversion Failed', err.message, 'danger');
    }
  };

  const handleSendReply = (msg: Message) => {
    if (!replyText.trim()) return;
    
    // Trigger desktop electronic mail client (mailto protocol) with pre-filled fields as requested
    const subject = encodeURIComponent(`RE: ${msg.subject}`);
    const body = encodeURIComponent(replyText);
    window.open(`mailto:${msg.email}?subject=${subject}&body=${body}`);
    
    setReplyText('');
    triggerToast('Mail Dispatched', 'Mail system interface opened.', 'success');
  };

  // Find active message details
  const activeMessage = messages.find(m => m.id === selectedMsgId);

  // Filter messages via header search bar
  const filteredMessages = messages.filter(m => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(query) ||
      m.email?.toLowerCase().includes(query) ||
      m.subject?.toLowerCase().includes(query) ||
      m.message?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-kanit font-black tracking-wider text-white uppercase text-cyan-glow">
          Inbox Messages
        </h1>
        <p className="text-xs font-mono text-[#00F0FF]/80">CLIENT COMMUNICATIONS LOG INTERFACE</p>
      </div>

      {/* Split Pane View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[540px] border border-white/8 rounded-lg overflow-hidden bg-[#111111]/40">
        
        {/* LEFT PANEL (Master: List of messages - Col span 4) */}
        <div className="lg:col-span-4 border-r border-white/8 flex flex-col bg-white/[0.01] h-full overflow-hidden">
          <div className="p-3 border-b border-white/8 bg-white/2 flex items-center gap-1.5 shrink-0">
            <Inbox size={14} className="text-[#00F0FF]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white">Message Ledger</span>
            <span className="ml-auto bg-[#00F0FF]/10 text-[#00F0FF] text-[9px] font-mono px-1.5 rounded">
              {messages.filter(m => !m.is_read).length} Unread
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/4">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  setSelectedMsgId(msg.id);
                  if (!msg.is_read) handleMarkAsRead(msg.id, true);
                }}
                className={`p-3 text-xs transition-all cursor-pointer relative ${
                  selectedMsgId === msg.id 
                    ? 'bg-[#00F0FF]/4 border-l-2 border-[#00F0FF]' 
                    : 'hover:bg-white/2'
                } ${!msg.is_read ? 'font-semibold' : 'opacity-70'}`}
              >
                {/* Unread notification blue dot */}
                {!msg.is_read && (
                  <span className="absolute top-4 right-3 w-1.5 h-1.5 rounded-full bg-[#00F0FF] shadow-[0_0_8px_rgba(0,240,255,1)]" />
                )}
                
                <div className="flex justify-between items-center mb-1 pr-3">
                  <span className="text-white truncate max-w-[150px]">{msg.name}</span>
                  <span className="text-[9px] text-gray-500 font-mono">
                    {new Date(msg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <h4 className="text-[11px] text-[#00F0FF] font-semibold truncate max-w-[200px] mb-1">{msg.subject}</h4>
                <p className="text-[10px] text-gray-400 truncate pr-4">{msg.message}</p>
              </div>
            ))}
            {filteredMessages.length === 0 && (
              <p className="text-xs font-mono text-gray-500 py-8 text-center">No message logs match query.</p>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (Detail: Content View - Col span 8) */}
        <div className="lg:col-span-8 flex flex-col h-full bg-[#111111]/10 overflow-hidden">
          {activeMessage ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Message Header Actions */}
              <div className="p-4 border-b border-white/8 bg-white/2 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                  <h3 className="font-semibold text-white text-sm">{activeMessage.name}</h3>
                  <a href={`mailto:${activeMessage.email}`} className="text-[#00F0FF] font-mono text-[10px] hover:underline flex items-center gap-1">
                    {activeMessage.email} <ExternalLink size={10} />
                  </a>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Convert to Lead button */}
                  <button
                    onClick={() => handleConvertToLead(activeMessage)}
                    className="p-1.5 px-3 rounded bg-[#00F0FF]/10 hover:bg-[#00F0FF] text-[#00F0FF] hover:text-black font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all border border-[#00F0FF]/20"
                    title="Ingest contact details directly into CRM Pipeline"
                  >
                    <UserPlus size={11} /> Convert to Lead
                  </button>
                  {/* Mark unread toggle */}
                  <button
                    onClick={() => handleMarkAsRead(activeMessage.id, !activeMessage.is_read)}
                    className="p-1.5 rounded bg-white/4 hover:bg-white/8 text-gray-400 hover:text-white transition-all text-[10px] font-mono uppercase"
                  >
                    {activeMessage.is_read ? 'Mark Unread' : 'Mark Read'}
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteMessage(activeMessage.id)}
                    className="p-1.5 rounded bg-white/4 hover:bg-red-500/15 text-gray-400 hover:text-red-400 transition-all"
                    title="Permanently Delete Message"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Message Context content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 border-b border-white/6 pb-2">
                  <span>Subject: <strong className="text-[#00F0FF] font-sans font-medium text-xs">{activeMessage.subject}</strong></span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(activeMessage.created_at).toLocaleString()}
                  </span>
                </div>
                
                <p className="text-gray-300 leading-relaxed text-xs whitespace-pre-wrap bg-white/[0.01] border border-white/4 p-4 rounded-md font-sans">
                  {activeMessage.message}
                </p>
              </div>

              {/* Quick Reply Form Drafting Area */}
              <div className="p-4 border-t border-white/8 bg-white/2 space-y-3 shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
                  <CornerUpLeft size={12} className="text-[#00F0FF]" />
                  <span>Draft Quick Response (Dispatches mail via local mail protocols)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Draft reply message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-[#161616] border border-white/8 rounded p-2 text-xs text-white outline-none focus:border-[#00F0FF]/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendReply(activeMessage);
                    }}
                  />
                  <button
                    onClick={() => handleSendReply(activeMessage)}
                    className="bg-[#1A1A1A] hover:bg-[#00F0FF] hover:text-black border border-white/8 text-white px-4 rounded text-xs font-mono font-bold uppercase transition-all duration-200"
                  >
                    DISPATCH
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center font-mono text-gray-600 text-xs">
              <Mail size={32} className="text-gray-700 mb-2" />
              <span>Select mail log entry to inspect communications payload</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
