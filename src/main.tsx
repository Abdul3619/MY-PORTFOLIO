import {StrictMode} from 'react';
import {createRoot, hydrateRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider, hydrate } from '@tanstack/react-query';
import './lib/i18n';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { createQueryClient } from './lib/queryClient';
import './index.css';

declare global {
  interface Window {
    __REACT_QUERY_STATE__?: unknown;
  }
}

const queryClient = createQueryClient();

// Seed the cache with the data the server rendered this page with, so hydration matches and nothing is refetched
if (window.__REACT_QUERY_STATE__) {
  hydrate(queryClient, window.__REACT_QUERY_STATE__);
  delete window.__REACT_QUERY_STATE__;
}

const app = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);

const container = document.getElementById('root')!;
if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  // Admin routes (and any page the server could not render) are rendered client-side only
  createRoot(container).render(app);
}
