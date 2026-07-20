import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './lib/i18n';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

const queryClient = new QueryClient();

const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === "string" && args[0].includes("THREE.Clock: This module has been deprecated")) {
    return;
  }
  originalWarn(...args);
};


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
