/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useLocation, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSeo, fetchApi } from "./hooks/useApi";
import { Layout } from "./Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Skills from "./pages/Skills";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Certificates from "./pages/Certificates";
import Testimonials from "./pages/Testimonials";
import Resume from "./pages/Resume";
import Contact from "./pages/Contact";
import SolarEstimator from "./pages/SolarEstimator";
import { AdminLayout, ProtectedRoute, AdminLogin } from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminResume from "./pages/admin/AdminResume";
import AdminTestimonials from "./pages/admin/AdminTestimonials";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminMedia from "./pages/admin/AdminMedia";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSiteSettings from "./pages/admin/AdminSiteSettings";
import AdminSkills from "./pages/admin/AdminSkills";
import Maintenance from "./pages/Maintenance";

function AnimatedRoutes() {
  const queryClient = useQueryClient();
  const { data: seo } = useSeo();
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';

  useEffect(() => {
    // Eagerly prefetch projects, profile, and skills on mount so they load instantly before scrolling
    queryClient.prefetchQuery({
      queryKey: ['projects', lang],
      queryFn: () => fetchApi('/api/projects'),
    });
    queryClient.prefetchQuery({
      queryKey: ['profile', lang],
      queryFn: () => fetchApi('/api/profile'),
    });
    queryClient.prefetchQuery({
      queryKey: ['skills', lang],
      queryFn: () => fetchApi('/api/skills'),
    });
  }, [queryClient, lang]);

  useEffect(() => {
    if (seo?.site_title) {
      document.title = seo.site_title;
    }
    
    if (seo?.google_analytics_id && !document.getElementById('ga-script')) {
      const script = document.createElement('script');
      script.id = 'ga-script';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${seo.google_analytics_id}`;
      script.async = true;
      document.head.appendChild(script);
      const script2 = document.createElement('script');
      script2.innerHTML = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${seo.google_analytics_id}');`;
      document.head.appendChild(script2);
    }

    if (seo?.meta_pixel_id && !document.getElementById('fb-pixel')) {
      const script = document.createElement('script');
      script.id = 'fb-pixel';
      script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${seo.meta_pixel_id}');fbq('track', 'PageView');`;
      document.head.appendChild(script);
    }

    if (seo?.microsoft_clarity_id && !document.getElementById('clarity-script')) {
      const script = document.createElement('script');
      script.id = 'clarity-script';
      script.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window, document, "clarity", "script", "${seo.microsoft_clarity_id}");`;
      document.head.appendChild(script);
    }
  }, [seo]);

  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname.split('/')[1]}>
        {/* Public Routes with Main Layout */}
        {seo?.maintenance_mode ? (
          <Route element={<Outlet />}>
            <Route path="/" element={<Maintenance />} />
            <Route path="*" element={<Maintenance />} />
          </Route>
        ) : (
          <Route element={<Layout><Outlet /></Layout>}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/solar-estimator" element={<SolarEstimator />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/testimonials" element={<Testimonials />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
        )}

        {/* Admin Login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/profile" element={<AdminSettings />} />
            <Route path="/admin/settings" element={<AdminSiteSettings />} />
            <Route path="/admin/projects" element={<AdminProjects />} />
            <Route path="/admin/skills" element={<AdminSkills />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/testimonials" element={<AdminTestimonials />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/resume" element={<AdminResume />} />
            <Route path="/admin/media" element={<AdminMedia />} />
          </Route>
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
