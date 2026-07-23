import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { supabase } from '../lib/supabase';

export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  const headers: HeadersInit = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Inject current active language header so backend knows how to translate dynamic content
  const activeLang = i18n.language || 'en';
  headers['x-portfolio-lang'] = activeLang.split('-')[0].toLowerCase();

  // If in admin dashboard, send the draft header so the CMS returns live draft data
  if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/dashboard'))) {
    headers['x-portfolio-draft'] = 'true';
  }

  const response = await fetch(endpoint, {
    credentials: "include",
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  if (!response.ok) {
    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    if (isJson) {
      const errorData = await response.json().catch(() => ({}));
      errorMessage = errorData.error || errorMessage;
    } else {
      if (response.status === 413) {
        errorMessage = "File is too large to upload. Please try a smaller image.";
      } else if (response.status === 502) {
        errorMessage = "Server is currently restarting or unavailable. Please try again.";
      } else {
        errorMessage = `Unexpected server error (${response.status}).`;
      }
    }
    throw new Error(errorMessage);
  }
  if (!isJson) {
    const text = await response.text();
    console.error("Non-JSON response:", text.substring(0, 200));
    throw new Error("Unexpected server response format (expected JSON). Server returned: " + text.substring(0, 100));
  }
  return response.json();
};

export const useProfile = () => {
  const lang = i18n.language || 'en';
  return useQuery({
    queryKey: ['profile', lang],
    queryFn: () => fetchApi('/api/profile'),
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/profile', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
};

export const useProjects = () => {
  const lang = i18n.language || 'en';
  return useQuery({
    queryKey: ['projects', lang],
    queryFn: () => fetchApi('/api/projects'),
  });
};

export const useProject = (slug: string) => {
  const lang = i18n.language || 'en';
  return useQuery({
    queryKey: ['projects', slug, lang],
    queryFn: () => fetchApi(`/api/projects/${slug}`),
    enabled: !!slug,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) => fetchApi(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useCertificates = () => {
  const lang = i18n.language || 'en';
  return useQuery({
    queryKey: ['certificates', lang],
    queryFn: () => fetchApi('/api/certificates'),
  });
};

export const useCreateCertificate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/certificates', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  });
};

export const useDeleteCertificate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/certificates/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certificates'] }),
  });
};

export const useTestimonials = () => {
  const lang = i18n.language || 'en';
  return useQuery({
    queryKey: ['testimonials', lang],
    queryFn: () => fetchApi('/api/testimonials'),
  });
};

export const useAdminTestimonials = () => {
  return useQuery({
    queryKey: ['admin_testimonials'],
    queryFn: () => fetchApi('/api/admin/testimonials'),
  });
};

export const useUpdateTestimonial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) => fetchApi(`/api/testimonials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      queryClient.invalidateQueries({ queryKey: ['admin_testimonials'] });
    },
  });
};

export const useDeleteTestimonial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/testimonials/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      queryClient.invalidateQueries({ queryKey: ['admin_testimonials'] });
    },
  });
};

export const useSubmitContact = () => {
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/contact', { method: 'POST', body: JSON.stringify(data) }),
  });
};

export const useAdminMessages = () => {
  return useQuery({
    queryKey: ['admin_messages'],
    queryFn: () => fetchApi('/api/admin/messages'),
  });
};

export const useAdminAnalytics = () => {
  return useQuery({
    queryKey: ['admin_analytics'],
    queryFn: () => fetchApi('/api/admin/analytics'),
  });
};

// Analytics Tracker
export const trackEvent = async (eventType: string, pageUrl: string, metadata: any = {}) => {
  let sessionId = localStorage.getItem('visitor_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('visitor_session_id', sessionId);
  }
  
  try {
    await fetch('/api/analytics/event', { credentials: 'include', method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: eventType,
        page_url: pageUrl,
        metadata
      })
    });
  } catch (e) {
    console.error("Failed to track event", e);
  }
};

// CMS Hooks
export const useServices = () => {
  const lang = i18n.language || 'en';
  return useQuery({ queryKey: ['services', lang], queryFn: () => fetchApi('/api/services') });
};
export const useAbout = () => {
  const lang = i18n.language || 'en';
  return useQuery({ queryKey: ['about', lang], queryFn: () => fetchApi('/api/about') });
};
export const useSkills = () => {
  const lang = i18n.language || 'en';
  return useQuery({ queryKey: ['skills', lang], queryFn: () => fetchApi('/api/skills') });
};
export const useSeo = () => useQuery({ queryKey: ['seo'], queryFn: () => fetchApi('/api/seo') });
export const useContactInfo = () => useQuery({ queryKey: ['contact_info'], queryFn: () => fetchApi('/api/contact_info') });

// Admin CMS Mutation Hooks
export const useUpdateSeo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/seo', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seo'] }),
  });
};
export const useUpdateContactInfo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/contact_info', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact_info'] }),
  });
};

export const useResumeExperience = () => {
  const lang = i18n.language || 'en';
  return useQuery({ queryKey: ['resume_experience', lang], queryFn: () => fetchApi('/api/resume_experience') });
};
export const useResumeEducation = () => {
  const lang = i18n.language || 'en';
  return useQuery({ queryKey: ['resume_education', lang], queryFn: () => fetchApi('/api/resume_education') });
};

// Admin Mutations for About Sections
export const useCreateAbout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/about', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['about'] }),
  });
};
export const useUpdateAbout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/about/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['about'] }),
  });
};
export const useDeleteAbout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/about/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['about'] }),
  });
};

// Admin Mutations for Resume Experience
export const useCreateResumeExperience = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/resume_experience', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume_experience'] }),
  });
};
export const useUpdateResumeExperience = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/resume_experience/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume_experience'] }),
  });
};
export const useDeleteResumeExperience = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/resume_experience/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume_experience'] }),
  });
};

// Admin Mutations for Resume Education
export const useCreateResumeEducation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/resume_education', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume_education'] }),
  });
};
export const useUpdateResumeEducation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/resume_education/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume_education'] }),
  });
};
export const useDeleteResumeEducation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/resume_education/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resume_education'] }),
  });
};
