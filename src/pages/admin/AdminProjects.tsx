import React, { useState } from 'react';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../../hooks/useApi';

export default function AdminProjects() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [isEditing, setIsEditing] = useState(false);
  const [currentProject, setCurrentProject] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    live_url: '',
    github_url: '',
    thumbnail_url: '',
    hero_image_url: '',
    is_featured: false,
    order_index: 0,
  });

  const handleEdit = (project: any) => {
    setCurrentProject(project);
    setFormData({
      title: project.title,
      slug: project.slug,
      description: project.description,
      live_url: project.live_url || '',
      github_url: project.github_url || '',
      thumbnail_url: project.thumbnail_url || '',
      hero_image_url: project.hero_image_url || '',
      is_featured: project.is_featured || false,
      order_index: project.order_index || 0,
    });
    setIsEditing(true);
  };

  const handleCreate = () => {
    setCurrentProject(null);
    setFormData({
      title: '',
      slug: '',
      description: '',
      live_url: '',
      github_url: '',
      thumbnail_url: '',
      hero_image_url: '',
      is_featured: false,
      order_index: 0,
    });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentProject) {
      await updateProject.mutateAsync({ id: currentProject.id, ...formData });
    } else {
      await createProject.mutateAsync(formData);
    }
    setIsEditing(false);
  };

  if (isLoading) return <div className="text-white">Loading projects...</div>;

  if (isEditing) {
    return (
      <div className="glass-panel p-8 rounded-xl max-w-3xl">
        <h2 className="text-2xl font-bold mb-6 text-gradient">{currentProject ? 'Edit Project' : 'Create Project'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Title</label>
              <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slug</label>
              <input type="text" required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white h-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Live URL</label>
              <input type="url" value={formData.live_url} onChange={e => setFormData({...formData, live_url: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">GitHub URL</label>
              <input type="url" value={formData.github_url} onChange={e => setFormData({...formData, github_url: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Thumbnail URL</label>
              <input type="url" value={formData.thumbnail_url} onChange={e => setFormData({...formData, thumbnail_url: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Hero Image URL</label>
              <input type="url" value={formData.hero_image_url} onChange={e => setFormData({...formData, hero_image_url: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-gray-400">
              <input type="checkbox" checked={formData.is_featured} onChange={e => setFormData({...formData, is_featured: e.target.checked})} className="rounded bg-white/5 border-white/10" />
              Featured Project
            </label>
            <div>
              <label className="text-sm text-gray-400 mr-2">Order</label>
              <input type="number" value={formData.order_index} onChange={e => setFormData({...formData, order_index: parseInt(e.target.value)})} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white" />
            </div>
          </div>
          
          <div className="flex justify-end gap-4 mt-8">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded text-gray-400 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={createProject.isPending || updateProject.isPending} className="px-4 py-2 bg-gold text-black rounded font-medium disabled:opacity-50">
              {currentProject ? 'Update' : 'Create'} Project
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-display font-bold text-gradient">Projects Manager</h1>
        <button onClick={handleCreate} className="bg-gold text-black px-4 py-2 rounded-lg font-medium">Add New Project</button>
      </div>

      <div className="grid gap-4">
        {projects?.map((project: any) => (
          <div key={project.id} className="glass-panel p-6 rounded-xl flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">{project.title}</h3>
              <p className="text-sm text-gray-400">{project.slug} • {project.is_featured ? 'Featured' : 'Standard'}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleEdit(project)} className="text-blue-400 hover:text-blue-300 bg-blue-400/10 px-3 py-1 rounded">Edit</button>
              <button 
                onClick={() => {
                  if(confirm('Are you sure you want to delete this project?')) {
                    deleteProject.mutate(project.id);
                  }
                }} 
                className="text-red-400 hover:text-red-300 bg-red-400/10 px-3 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {(!projects || projects.length === 0) && (
          <p className="text-gray-400">No projects found. Create one above.</p>
        )}
      </div>
    </div>
  );
}
