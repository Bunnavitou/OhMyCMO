import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// Topology:
//   Internet ──▶ frontend :1111 (public)
//                  │
//                  └─ proxy /api ──▶ backend :1112 (loopback only)
//
// The browser only ever talks to :1111. Same-origin /api calls are proxied
// to the backend over the loopback interface, so the backend never needs
// to be exposed publicly and CORS isn't required.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 1111,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:1112',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 1111,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:1112',
        changeOrigin: true,
      },
    },
  },
})
