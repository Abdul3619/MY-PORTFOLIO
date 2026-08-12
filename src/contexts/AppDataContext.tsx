import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useProfile, useSeo, useContactInfo, useServices, useSkills, useProjects, useCertificates, useTestimonials } from '../hooks/useApi';

interface AppDataContextType {
  profile: any;
  seo: any;
  contactInfo: any;
  services: any[];
  skills: any[];
  projects: any[];
  certificates: any[];
  testimonials: any[];
  isLoading: boolean;
  isError: boolean;
  refetchAll: () => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const projectsChannel = supabase
      .channel('public:projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      })
      .subscribe();

    const skillsChannel = supabase
      .channel('public:skills')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skills' }, () => {
        queryClient.invalidateQueries({ queryKey: ['skills'] });
      })
      .subscribe();

    const testimonialsChannel = supabase
      .channel('public:testimonials')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testimonials' }, () => {
        queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectsChannel);
      supabase.removeChannel(skillsChannel);
      supabase.removeChannel(testimonialsChannel);
    };
  }, [queryClient]);

  const profileQuery = useProfile();
  const seoQuery = useSeo();
  const contactQuery = useContactInfo();
  const servicesQuery = useServices();
  const skillsQuery = useSkills();
  const projectsQuery = useProjects();
  const certsQuery = useCertificates();
  const testimonialsQuery = useTestimonials();

  const isLoading = 
    profileQuery.isLoading || 
    seoQuery.isLoading || 
    contactQuery.isLoading || 
    servicesQuery.isLoading || 
    skillsQuery.isLoading || 
    projectsQuery.isLoading || 
    certsQuery.isLoading || 
    testimonialsQuery.isLoading;

  const isError = 
    profileQuery.isError || 
    seoQuery.isError || 
    contactQuery.isError;

  const refetchAll = () => {
    profileQuery.refetch();
    seoQuery.refetch();
    contactQuery.refetch();
    servicesQuery.refetch();
    skillsQuery.refetch();
    projectsQuery.refetch();
    certsQuery.refetch();
    testimonialsQuery.refetch();
  };

  const value = {
    profile: profileQuery.data,
    seo: seoQuery.data,
    contactInfo: contactQuery.data,
    services: servicesQuery.data || [],
    skills: skillsQuery.data || [],
    projects: projectsQuery.data || [],
    certificates: certsQuery.data || [],
    testimonials: testimonialsQuery.data || [],
    isLoading,
    isError,
    refetchAll,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
