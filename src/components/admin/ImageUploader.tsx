import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  Loader2, 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  X,
  RefreshCw,
  FileImage
} from 'lucide-react';
import { fetchApi } from '../../hooks/useApi';

interface SingleImageUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  projectSlug: string;
  fieldType: 'cover' | 'hero';
}

export function SingleImageUploader({ 
  label, 
  value, 
  onChange, 
  projectSlug, 
  fieldType 
}: SingleImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFile(e.target.files[0]);
    }
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPG, JPEG, PNG, and WEBP formats are allowed.');
      return false;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('Maximum file size allowed is 10MB.');
      return false;
    }
    setError(null);
    return true;
  };

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return;
    if (!projectSlug) {
      setError('Please provide a valid project slug before uploading images.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_slug', projectSlug);
      formData.append('field_type', fieldType);

      const result = await fetchApi('/api/projects/upload-media', {
        method: 'POST',
        body: formData,
      });

      if (result && result.url) {
        onChange(result.url);
      } else {
        throw new Error('Upload failed to return public URL.');
      }
    } catch (err: any) {
      console.error('Upload Error:', err);
      setError(err.message || 'An error occurred during image upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!value) return;
    if (window.confirm(`Are you sure you want to permanently delete this ${fieldType} image?`)) {
      const oldUrl = value;
      onChange(''); // clear immediately in UI
      try {
        await fetchApi('/api/projects/delete-media', {
          method: 'POST',
          body: JSON.stringify({ url: oldUrl })
        });
      } catch (err) {
        console.warn('Failed to delete image file from storage bucket:', err);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="block text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">
          {label}
        </label>
        {value && (
          <span className="text-[9px] font-mono text-gray-500 uppercase">
            Active Asset
          </span>
        )}
      </div>

      {value ? (
        // Visual Image Preview Card (Always visible controls for mobile & desktop)
        <div className="rounded-xl overflow-hidden border border-white/10 bg-[#161616] p-2.5 flex flex-col gap-3">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-[16/10] rounded-lg overflow-hidden cursor-pointer group border border-white/5"
            title="Click to replace image"
          >
            <img 
              src={value} 
              alt={label} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
              referrerPolicy="no-referrer"
            />
            {/* Soft overlay on hover to indicate clickability */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white font-mono text-[10px] bg-black/60 px-2 py-1 rounded border border-white/10">
                CLICK TO REPLACE
              </span>
            </div>
            
            {uploading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                <Loader2 size={24} className="text-[#00F0FF] animate-spin" />
                <span className="text-[9px] font-mono text-white animate-pulse">UPLOADING...</span>
              </div>
            )}
          </div>

          {/* Action buttons (always visible) */}
          <div className="flex gap-2 justify-between items-center pt-0.5">
            <div className="text-[9px] font-mono text-gray-400 truncate max-w-[55%] bg-white/5 px-2 py-1 rounded">
              {value.split('/').pop() || 'image.webp'}
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-2.5 py-1.5 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 hover:border-[#00F0FF]/60 rounded-lg text-white font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} className="text-[#00F0FF]" />}
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/60 rounded-lg text-white font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={10} className="text-red-400" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Visual Upload Target Dropzone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`h-36 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all p-4 text-center ${
            isDragOver 
              ? 'border-[#00F0FF] bg-[#00F0FF]/5 shadow-[0_0_15px_rgba(0,240,255,0.1)]' 
              : 'border-white/20 bg-white/2 hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/2'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="text-[#00F0FF] animate-spin mb-1" />
              <p className="text-[11px] font-mono text-gray-300">UPLOADING IMAGE...</p>
              <p className="text-[9px] font-mono text-[#00F0FF] tracking-wider animate-pulse">OPTIMIZING ASSETS</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-gray-400 group-hover:text-[#00F0FF] mb-1" />
              <p className="text-xs font-mono text-gray-300">
                DRAG & DROP OR <span className="text-[#00F0FF] hover:underline font-semibold">CLICK</span>
              </p>
              <p className="text-[9px] font-mono text-gray-500">JPG, PNG, WEBP UP TO 10MB</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-[10px] font-mono text-red-400 mt-1 uppercase tracking-wider">
          ⚠ {error}
        </p>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden" 
      />
    </div>
  );
}

// -------------------------------------------------------------
// GALLERY IMAGE UPLOADER
// -------------------------------------------------------------

interface GalleryItem {
  url: string;
  caption: string;
}

interface GalleryImageUploaderProps {
  value: (string | GalleryItem)[];
  onChange: (items: (string | GalleryItem)[]) => void;
  projectSlug: string;
}

export function GalleryImageUploader({ 
  value, 
  onChange, 
  projectSlug 
}: GalleryImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse items safely to object form { url, caption } for rendering/manipulation
  const items: GalleryItem[] = value.map((item) => {
    if (typeof item === 'string') {
      return { url: item, caption: '' };
    }
    return { url: item?.url || '', caption: item?.caption || '' };
  });

  const updateParent = (newItems: GalleryItem[]) => {
    onChange(newItems);
  };

  const validateFiles = (files: File[]): File[] => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const filtered = files.filter(file => {
      if (!validTypes.includes(file.type)) {
        setError('Some files were ignored. Only JPG, JPEG, PNG, and WEBP formats are allowed.');
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Some files were ignored. Maximum file size allowed is 10MB.');
        return false;
      }
      return true;
    });
    return filtered;
  };

  const uploadFiles = async (fileList: FileList) => {
    if (!projectSlug) {
      setError('Please provide a valid project slug before uploading images.');
      return;
    }

    const files = validateFiles(Array.from(fileList));
    if (files.length === 0) return;

    setUploading(true);
    setError(null);

    const uploadedUrls: string[] = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_slug', projectSlug);
        formData.append('field_type', 'gallery');

        const result = await fetchApi('/api/projects/upload-media', {
          method: 'POST',
          body: formData,
        });

        if (result && result.url) {
          uploadedUrls.push(result.url);
        }
      } catch (err: any) {
        console.error('Gallery file upload error:', err);
        setError(`Failed to upload ${file.name}. ${err.message || ''}`);
      }
    }

    if (uploadedUrls.length > 0) {
      const newItems = [
        ...items,
        ...uploadedUrls.map(url => ({ url, caption: '' }))
      ];
      updateParent(newItems);
    }

    setUploading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
    }
  };

  const handleRemove = async (index: number) => {
    const itemToRemove = items[index];
    if (window.confirm(`Are you sure you want to remove this image from the gallery?`)) {
      const updated = items.filter((_, idx) => idx !== index);
      updateParent(updated);

      try {
        await fetchApi('/api/projects/delete-media', {
          method: 'POST',
          body: JSON.stringify({ url: itemToRemove.url })
        });
      } catch (err) {
        console.warn('Failed to delete image file from storage bucket:', err);
      }
    }
  };

  const handleCaptionChange = (index: number, caption: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], caption };
    updateParent(updated);
  };

  const moveItem = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === items.length - 1) return;

    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    const updated = [...items];
    
    // Swap items
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    updateParent(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  // HTML5 Drag-and-drop Reordering within UI items
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItemRef.current = index;
  };

  const handleDragEnd = () => {
    if (dragItemRef.current !== null && dragOverItemRef.current !== null && dragItemRef.current !== dragOverItemRef.current) {
      const updated = [...items];
      const draggedItem = updated[dragItemRef.current];
      // Remove
      updated.splice(dragItemRef.current, 1);
      // Insert
      updated.splice(dragOverItemRef.current, 0, draggedItem);
      
      updateParent(updated);
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="block text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">
          Multi-Image Gallery Showcase
        </label>
        <span className="text-[9px] font-mono text-gray-500">
          {items.length} IMAGES • DRAG TO REORDER
        </span>
      </div>

      {/* Grid of gallery item thumbnails */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-[#111111]/80 p-3.5 border border-white/5 rounded-xl">
          {items.map((item, idx) => (
            <div 
              key={item.url + idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="relative rounded-lg overflow-hidden border border-white/10 bg-[#161616] p-1.5 flex flex-col gap-2 group cursor-grab active:cursor-grabbing hover:border-[#00F0FF]/30 transition-all shadow-md"
            >
              <div className="relative aspect-video rounded overflow-hidden border border-white/5">
                <img 
                  src={item.url} 
                  alt={`Gallery thumbnail ${idx + 1}`} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Visual Delete button - always visible on mobile, nicely styled */}
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded transition-colors z-10 cursor-pointer shadow-lg border border-red-500/30"
                  title="Remove Image"
                >
                  <Trash2 size={11} />
                </button>

                {/* Quick order manipulation helper arrows - always visible, super clean */}
                <div className="absolute bottom-1.5 left-1.5 flex gap-1 z-10 bg-black/60 backdrop-blur-xs p-0.5 rounded border border-white/10">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'left')}
                      className="p-1 text-white hover:text-[#00F0FF] rounded transition-colors cursor-pointer"
                      title="Move Left"
                    >
                      <ArrowLeft size={10} />
                    </button>
                  )}
                  {idx < items.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 'right')}
                      className="p-1 text-white hover:text-[#00F0FF] rounded transition-colors cursor-pointer"
                      title="Move Right"
                    >
                      <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Optional Caption Field */}
              <input
                type="text"
                value={item.caption}
                onChange={(e) => handleCaptionChange(idx, e.target.value)}
                placeholder="Image description (optional)"
                className="w-full bg-[#1e1e1e] border border-white/8 rounded p-1 text-[10px] font-mono text-gray-300 outline-none focus:border-[#00F0FF]/40"
              />
            </div>
          ))}
        </div>
      )}

      {/* Visual Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`h-28 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all p-4 text-center ${
          isDragOver 
            ? 'border-[#00F0FF] bg-[#00F0FF]/5 shadow-[0_0_15px_rgba(0,240,255,0.1)]' 
              : 'border-white/20 bg-white/2 hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/2'
        }`}
      >
        {uploading ? (
          <>
            <Loader2 size={24} className="text-[#00F0FF] animate-spin mb-1" />
            <p className="text-[11px] font-mono text-gray-300">UPLOADING MULTIPLE ASSETS...</p>
            <p className="text-[9px] font-mono text-[#00F0FF] tracking-wider animate-pulse">PROCESSING WEB OPTIMIZATION</p>
          </>
        ) : (
          <>
            <Plus size={24} className="text-[#00F0FF] group-hover:scale-110 transition-transform mb-1" />
            <p className="text-xs font-mono text-gray-300">
              DRAG & DROP MULTIPLE IMAGES OR <span className="text-[#00F0FF] hover:underline font-semibold">BROWSE</span>
            </p>
            <p className="text-[9px] font-mono text-gray-500">JPG, PNG, WEBP UP TO 10MB EACH</p>
          </>
        )}
      </div>

      {error && (
        <p className="text-[10px] font-mono text-red-400 mt-1 uppercase tracking-wider">
          ⚠ {error}
        </p>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="hidden" 
      />
    </div>
  );
}

// -------------------------------------------------------------
// PROFILE IMAGE UPLOADER (Generic File Upload)
// -------------------------------------------------------------

interface ProfileImageUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

export function ProfileImageUploader({
  label,
  value,
  onChange,
}: ProfileImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFile(e.target.files[0]);
    }
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPG, JPEG, PNG, and WEBP formats are allowed.');
      return false;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('Maximum file size allowed is 10MB.');
      return false;
    }
    setError(null);
    return true;
  };

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await fetchApi('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (result && result.url) {
        onChange(result.url);
      } else {
        throw new Error('Upload failed to return public URL.');
      }
    } catch (err: any) {
      console.error('Upload Error:', err);
      setError(err.message || 'An error occurred during image upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    onChange('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="block text-[10px] font-mono uppercase text-[#00F0FF] tracking-wider">
          {label}
        </label>
        {value && (
          <span className="text-[9px] font-mono text-gray-500 uppercase">
            Active Asset
          </span>
        )}
      </div>

      {value ? (
        <div className="rounded-xl overflow-hidden border border-white/10 bg-[#161616] p-2.5 flex flex-col gap-3">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-[16/10] rounded-lg overflow-hidden cursor-pointer group border border-white/5"
            title="Click to replace image"
          >
            <img 
              src={value} 
              alt={label} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white font-mono text-[10px] bg-black/60 px-2 py-1 rounded border border-white/10">
                CLICK TO REPLACE
              </span>
            </div>
            
            {uploading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                <Loader2 size={24} className="text-[#00F0FF] animate-spin" />
                <span className="text-[9px] font-mono text-white animate-pulse">UPLOADING...</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-between items-center pt-0.5">
            <div className="text-[9px] font-mono text-gray-400 truncate max-w-[55%] bg-white/5 px-2 py-1 rounded">
              {value.split('/').pop() || 'profile.webp'}
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-2.5 py-1.5 bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 hover:border-[#00F0FF]/60 rounded-lg text-white font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} className="text-[#00F0FF]" />}
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/60 rounded-lg text-white font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={10} className="text-red-400" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`h-36 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all p-4 text-center ${
            isDragOver 
              ? 'border-[#00F0FF] bg-[#00F0FF]/5 shadow-[0_0_15px_rgba(0,240,255,0.1)]' 
              : 'border-white/20 bg-white/2 hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/2'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="text-[#00F0FF] animate-spin mb-1" />
              <p className="text-[11px] font-mono text-gray-300">UPLOADING IMAGE...</p>
            </>
          ) : (
            <>
              <Upload size={24} className="text-gray-400 group-hover:text-[#00F0FF] mb-1" />
              <p className="text-xs font-mono text-gray-300">
                DRAG & DROP OR <span className="text-[#00F0FF] hover:underline font-semibold">CLICK</span>
              </p>
              <p className="text-[9px] font-mono text-gray-500">JPG, PNG, WEBP UP TO 10MB</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-[10px] font-mono text-red-400 mt-1 uppercase tracking-wider">
          ⚠ {error}
        </p>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden" 
      />
    </div>
  );
}
