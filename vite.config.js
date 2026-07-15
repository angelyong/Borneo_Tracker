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
  },
  build: {
    // The main bundle (React + Leaflet + ECharts + all pages) sits ~1.7 MB,
    // above Vite's default 500 kB notice. This only raises the warning line —
    // it does not change load speed. Revisit with route-level lazy-loading if
    // first-load time becomes a concern.
    chunkSizeWarningLimit: 1800,
  },
})
