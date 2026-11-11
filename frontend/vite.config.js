// Vite config: the React plugin, a dev proxy for /api and an optional sub-path for deploys.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE lets you deploy under a sub-path if you ever need to. Default '/' suits Render, Railway, localhost.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  server: { proxy: { '/api': 'http://localhost:5000' } },
  build: { chunkSizeWarningLimit: 1000 }
});
