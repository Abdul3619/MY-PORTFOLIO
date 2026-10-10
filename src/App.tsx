/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route, useLocation, Outlet, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { AppDataProvider, useAppData } from "./contexts/AppDataContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./Layout";
import { applyUserLanguage } from "./lib/i18n";
import { getRouteMeta, getSiteTitle } from "./lib/seo";
import Home from "./pages/Home";
import About from "./pages/About";
import Skills from "./pages/Skills";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Certificates from "./pages/Certificates";
import Testimonials from "./pages/Testimonials";
import Resume from "./pages/Resume";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import { AdminLayout, ProtectedRoute, AdminLogin } from "./components/admin/AdminLayout";
import Maintenance from "./pages/Maintenance";
const AtelierFit = lazy(() => import("./pages/AtelierFit"));
const StitchBook = lazy(() => import("./pages/StitchBook"));
const PhoneFrameShowcase = lazy(() => import("./pages/PhoneFrameShowcase"));

// Admin pages are code-split so public visitors never download the CMS (and its charting libraries)
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminOutreach = lazy(() => import("./pages/admin/AdminOutreach"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminResume = lazy(() => import("./pages/admin/AdminResume"));
const AdminTestimonials = lazy(() => import("./pages/admin/AdminTestimonials"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));
const AdminSiteSettings = lazy(() => import("./pages/admin/AdminSiteSettings"));
const AdminSkills = lazy(() => import("./pages/admin/AdminSkills"));
const AdminAccount = lazy(() => import("./pages/admin/AdminAccount"));

function adminPage(Page: ComponentType) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#00F0FF]/20 border-t-[#00F0FF] rounded-full animate-spin" />
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}

function AnimatedRoutes() {
  const { seo, profile } = useAppData();
  const location = useLocation();

  // The server always renders in English; switch to the visitor's language once hydrated
  useEffect(() => {
    applyUserLanguage();
  }, []);

  // Keep the tab title in step with the page (the server renders the same titles; see src/lib/seo.ts).
  // Project pages set their own title in ProjectDetail.
  useEffect(() => {
    if (!seo && !profile) return;
    const meta = getRouteMeta(location.pathname, seo, profile);
    if (meta) document.title = meta.title;
    else if (!/^\/projects\/[^/]+\/?$/.test(location.pathname)) document.title = getSiteTitle(seo, profile);
  }, [seo, profile, location.pathname]);

  useEffect(() => {
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

    // The HTML template (app.html) already loads Plausible; don't inject a second tracker (it would double count page views)
    if (seo?.plausible_domain && !document.getElementById('plausible-script') && !document.querySelector('script[src*="plausible.io"]')) {
      const script = document.createElement('script');
      script.id = 'plausible-script';
      script.defer = true;
      script.setAttribute('data-domain', seo.plausible_domain);
      script.src = 'https://plausible.io/js/script.js';
      document.head.appendChild(script);
    }
  }, [seo, profile]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Routes location={location}>
      {/* Public Routes with Main Layout */}
      {seo?.maintenance_mode ? (
        <Route element={<Outlet />}>
          <Route path="/" element={<Maintenance />} />
          <Route path="*" element={<Maintenance />} />
        </Route>
      ) : (
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/testimonials" element={<Testimonials />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      )}

      {/* AtelierFit: a full-screen app-like route, intentionally outside the main site's <Layout /> (no header/
          footer) so the QR-scanned experience reads as its own app rather than a page on the portfolio. */}
      <Route path="/atelierfit" element={adminPage(AtelierFit)} />
      {/* StitchBook: the desktop-app project, same full-screen/no-<Layout> treatment as AtelierFit. */}
      <Route path="/stitchbook" element={adminPage(StitchBook)} />
      {/* PhoneFrame showcase: an interactive configurator project for the realistic iPhone mockup
          component itself, same full-screen/no-<Layout> treatment as AtelierFit/StitchBook. */}
      <Route path="/phoneframe" element={adminPage(PhoneFrameShowcase)} />

      {/* Folded into StitchBook's own Manage tab, which visitors can open too -- redirect any old bookmark/link
          there before the admin login gate. */}
      <Route path="/admin/atelierfit" element={<Navigate to="/stitchbook?tab=manage" replace />} />
      <Route path="/admin/inventory" element={<Navigate to="/stitchbook?tab=manage" replace />} />

      {/* Admin Login */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={adminPage(AdminDashboard)} />
          <Route path="/admin/profile" element={adminPage(AdminSiteSettings)} />
          <Route path="/admin/settings" element={adminPage(AdminSiteSettings)} />
          <Route path="/admin/projects" element={adminPage(AdminProjects)} />
          <Route path="/admin/skills" element={adminPage(AdminSkills)} />
          <Route path="/admin/leads" element={adminPage(AdminLeads)} />
          <Route path="/admin/outreach" element={adminPage(AdminOutreach)} />
          <Route path="/admin/testimonials" element={adminPage(AdminTestimonials)} />
          <Route path="/admin/reviews" element={adminPage(AdminReviews)} />
          <Route path="/admin/messages" element={adminPage(AdminMessages)} />
          <Route path="/admin/analytics" element={adminPage(AdminAnalytics)} />
          <Route path="/admin/resume" element={adminPage(AdminResume)} />
          <Route path="/admin/media" element={adminPage(AdminMedia)} />
          <Route path="/admin/account" element={adminPage(AdminAccount)} />
        </Route>
      </Route>
    </Routes>
  );
}

// The router is provided by the entry point: BrowserRouter on the client, StaticRouter on the server
export default function App() {
  // Hide the pure-CSS first-paint skeleton (app.html) now that React has actually taken over --
  // fades it out, then removes it from the DOM so it never lingers or intercepts input.
  useEffect(() => {
    const skeleton = document.getElementById("initial-skeleton");
    if (!skeleton) return;
    skeleton.classList.add("initial-skeleton-hide");
    const timeout = setTimeout(() => skeleton.remove(), 600);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <ThemeProvider>
      <BackgroundProvider>
        <AppDataProvider>
          <AnimatedRoutes />
        </AppDataProvider>
      </BackgroundProvider>
    </ThemeProvider>
  );
}
