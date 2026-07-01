import React from 'react';
import { useAdminAnalytics } from '../../hooks/useApi';

export default function AdminDashboard() {
  const { data: analytics, isLoading } = useAdminAnalytics();

  if (isLoading) return <div className="text-white">Loading analytics...</div>;

  return (
    <div>
      <h1 className="text-3xl font-display font-bold text-gradient mb-8">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-xl">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Total Visitors</h3>
          <p className="text-4xl font-bold">{analytics?.total_visitors || 0}</p>
        </div>
        <div className="glass-panel p-6 rounded-xl">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Total Events</h3>
          <p className="text-4xl font-bold">{analytics?.total_events || 0}</p>
        </div>
      </div>
      
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
           {/* We can add quick links here later */}
           <p className="text-gray-400">Use the sidebar to manage your portfolio content.</p>
        </div>
      </div>
    </div>
  );
}
