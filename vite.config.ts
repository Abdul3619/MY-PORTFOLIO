import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ isSsrBuild }) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: null,
    },
    ssr: {
      // Bundle all dependencies into the SSR build so the server renderer is self-contained
      // (the Vercel function only ships dist/server, not node_modules for these packages).
      noExternal: isSsrBuild ? true : undefined,
    },
    build: {
      chunkSizeWarningLimit: 3000,
      // The HTML template is deliberately not named index.html: static hosts (Vercel included) serve an
      // index.html for "/" before any rewrite runs, which would bypass server-side rendering.
      rollupOptions: isSsrBuild ? undefined : { input: path.resolve(__dirname, 'app.html') },
    },
  };
});
