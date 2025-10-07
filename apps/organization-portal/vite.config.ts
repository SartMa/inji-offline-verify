// apps/organization-portal/vite.config.ts

/// <reference types='vitest' />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file from the root directory
  const env = loadEnv(mode, process.cwd(), '');

  const API_HOST = (env.VITE_API_HOST || 'http://localhost:8000').replace(/\/$/, '');
  const ORG_PREFIX = env.VITE_ORGANIZATION_PREFIX || '/organization/api';
  const WORKER_PREFIX = env.VITE_WORKER_PREFIX || '/worker/api';
  const SHARED_PREFIX = env.VITE_SHARED_PREFIX || '/api';
  const PORT = Number(env.ORGANIZATION_PORTAL_PORT ?? '4200');

  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/organization-portal',
    
    // Point to the root .env file
    envDir: '../../',
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : []
    },

    server:{
      port: PORT,
      host: env.ORGANIZATION_PORTAL_HOST ?? 'localhost',
      // Add proxy to forward API requests to the backend
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
    preview:{
      port: PORT,
      host: env.ORGANIZATION_PORTAL_HOST ?? 'localhost',
    },
    plugins: [react()],
    build: {
      outDir: './dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    test: {
      name: 'organization-portal',
      watch: false,
      globals: true,
      environment: 'jsdom',
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: './test-output/vitest/coverage',
        provider: 'v8' as const,
      }
    },
  }
});