import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { aiChatController } from './src/server/ai/AIChatController.js'

function aiChatApiPlugin() {
  return {
    name: 'borneo-tracker-ai-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/ai/chat', (req, res) => {
        aiChatController.handleNodeRequest(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/ai/chat', (req, res) => {
        aiChatController.handleNodeRequest(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), aiChatApiPlugin()],
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
