import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext';
import { buildStructuredData } from '../lib/structuredData';
import { projectsData } from '../data/projects';

export const JsonLd: React.FC = () => {
  const location = useLocation();
  const { profile, contactInfo, projects: apiProjects, testimonials } = useAppData();

  // Combine live API projects with static fallback projects
  const allProjects = useMemo(() => {
    const combined = [...(apiProjects || [])];
    projectsData.forEach((staticP) => {
      if (!combined.some((p) => p.slug === staticP.id || p.id === staticP.id)) {
        combined.push({
          ...staticP,
          slug: staticP.id,
          tech_stack: staticP.techStack,
          thumbnail_url: staticP.image,
          hero_image_url: staticP.image
        });
      }
    });
    return combined;
  }, [apiProjects]);

  const schemaData = useMemo(() => {
    return buildStructuredData({
      route: location.pathname,
      profile,
      contactInfo,
      projects: allProjects,
      testimonials
    });
  }, [location.pathname, profile, contactInfo, allProjects, testimonials]);

  const jsonString = useMemo(() => JSON.stringify(schemaData, null, 2), [schemaData]);

  // Synchronize script tag in document.head for client-side route transitions
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let scriptTag = document.getElementById('json-ld-structured-data') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'json-ld-structured-data';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = jsonString;

    // Dynamically update canonical link if on client
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const currentCanonicalUrl = `${window.location.origin}${location.pathname === '/' ? '' : location.pathname}`;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = currentCanonicalUrl;
  }, [jsonString, location.pathname]);

  return (
    <script
      id="json-ld-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
};
