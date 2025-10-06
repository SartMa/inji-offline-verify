// apps/worker-pwa/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Centralized env-driven host & prefixes
  const API_HOST = (process.env.VITE_API_HOST || 'http://localhost:8000').replace(/\/$/, '')
  const ORG_PREFIX = process.env.VITE_ORGANIZATION_PREFIX || '/organization/api'
  const WORKER_PREFIX = process.env.VITE_WORKER_PREFIX || '/worker/api'
  const SHARED_PREFIX = process.env.VITE_SHARED_PREFIX || '/api'

  // Get port from env, with a fallback from your .env file
  const port = parseInt(process.env.WORKER_PWA_PORT || '3000', 10);

  // Escape host for RegExp
  const esc = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

  // Build regex patterns Workbox will understand (must be pure literals at build time)
  const apiHostPattern = new RegExp(`^${esc(API_HOST)}(${esc(ORG_PREFIX)}|${esc(WORKER_PREFIX)}|${esc(SHARED_PREFIX)})/.*`)

  return {
    envDir: '../../',
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : []
    },
    
    server: {
      port: port, // <-- Use the port from your .env file
      host: 'localhost', // <-- Explicitly set the host
      proxy: {
        [ORG_PREFIX]: {
          target: API_HOST,
          changeOrigin: true,
          secure: false,
        },
        [WORKER_PREFIX]: {
          target: API_HOST,
          changeOrigin: true,
          secure: false,
        },
        [SHARED_PREFIX]: {
          target: API_HOST,
          changeOrigin: true,
          secure: false,
        },
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'vite.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,tsx,jsx,ts}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
          runtimeCaching: [
            {
              // All API calls (org, worker, shared) network-first
              urlPattern: apiHostPattern,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
              }
            },
              {
                urlPattern: /\.(?:png|jpg|jpeg|svg)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images',
                  expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }
                }
              }
          ]
        },
        manifest: {
          name: 'Inji Offline Verify',
          short_name: 'Inji Verify',
          description: 'Offline Verifiable Credentials Verification',
          theme_color: '#ed6c02',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait-primary',
          icons: [
            { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'favicon.ico', sizes: '48x48', type: 'image/x-icon', purpose: 'any' },
          ],
        },
        devOptions: { enabled: true, type: 'module' }
      })
    ],
  }
})