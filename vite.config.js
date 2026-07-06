import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// Topology:
//   Internet ──▶ frontend :3001 (public)
//                  │
//                  └─ proxy /api ──▶ backend :3002 (loopback only)
//
// The browser only ever talks to :3001. Same-origin /api calls are proxied
// to the backend over the loopback interface, so the backend never needs
// to be exposed publicly and CORS isn't required.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'router'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler'))
            return 'react'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('tesseract.js')) return 'tesseract'
          return 'vendor'
        },
      },
    },
  },
})
