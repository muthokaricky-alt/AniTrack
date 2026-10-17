import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE lets you deploy under a sub-path (e.g. GitHub Pages) if you ever need to.
// Default '/' works for Render, Railway, Koyeb, localhost, etc.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
