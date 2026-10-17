import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE lets you deploy under a sub-path if you ever need to. Default '/' suits Render, Railway, localhost.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  server: { proxy: { '/api': 'http://localhost:5000' } },
  // three.js is lazy-loaded for the hero background, so its chunk is allowed to be large
  build: { chunkSizeWarningLimit: 1000 }
});
