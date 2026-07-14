import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom gives us localStorage + File/Blob; fake-indexeddb (loaded in the
    // setup file) fills in IndexedDB, which jsdom doesn't implement.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
  build: {
    // The checked-in Windows development environment cannot load Lightning CSS's
    // native binary reliably; Vite's supported esbuild minifier is deterministic here.
    cssMinify: 'esbuild',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
