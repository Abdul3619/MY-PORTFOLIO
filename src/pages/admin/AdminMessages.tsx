import React from 'react';
import { useAdminMessages } from '../../hooks/useApi';

export default function AdminMessages() {
  const { data: messages, isLoading } = useAdminMessages();

  if (isLoading) return <div className="text-white">Loading messages...</div>;

  return (
    <div>
      <h1 className="text-3xl font-display font-bold text-gradient mb-8">Contact Messages</h1>

      <div className="space-y-4">
        {messages?.map((msg: any) => (
          <div key={msg.id} className={`glass-panel p-6 rounded-xl ${msg.is_read ? 'opacity-70' : ''}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{msg.name}</h3>
                <a href={`mailto:${msg.email}`} className="text-gold hover:underline text-sm">{msg.email}</a>
              </div>
              <div className="text-xs text-gray-400">
                {new Date(msg.created_at).toLocaleDateString()}
              </div>
            </div>
            {msg.subject && <h4 className="font-semibold text-gray-300 mb-2">{msg.subject}</h4>}
            <p className="text-gray-400 whitespace-pre-wrap">{msg.message}</p>
          </div>
        ))}
        {(!messages || messages.length === 0) && (
          <p className="text-gray-400">No messages yet.</p>
        )}
      </div>
    </div>
  );
}
