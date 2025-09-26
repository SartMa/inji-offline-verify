// Centralized configuration for API URLs and environment-specific settings

// Safe environment reader that works in Vite, Node, and browser runtime (window.__ENV__)
function readEnv(key: string, fallback = ""): string {
  // 1) Vite build-time variables (import.meta.env)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viteEnv: any = (import.meta as any)?.env;
    if (viteEnv && typeof viteEnv[key] !== 'undefined') {
      return String(viteEnv[key]);
    }
  } catch {
    // ignore - not running under Vite
  }

  // 2) Node/process environment (SSR/build tools)
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] !== 'undefined') {
    return String(process.env[key]);
  }

  // 3) Optional runtime injection into window
  if (typeof window !== 'undefined' && (window as any).__ENV__ && (window as any).__ENV__[key]) {
    return String((window as any).__ENV__[key]);
  }

  return fallback;
}

function normalizeBase(url: string): string {
  // Remove trailing slash
  return url.replace(/\/$/, "");
}

// packages/shared-auth/src/config.ts

export function getApiHost(): string {
  // In development, the Vite proxy handles API requests, so we use a relative path.
  // The 'import.meta.env.DEV' is a variable provided by Vite.
  if (import.meta.env.DEV) {
    return ''; // Return empty string for relative paths
  }

  // In production, we use the explicitly defined host.
  const explicit = readEnv('VITE_API_HOST');
  if (explicit) return normalizeBase(explicit);

  // Fallback for production if no explicit host is set
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  
  return '';
}

// ... (the rest of the file remains the same)

export function getOrganizationPrefix(): string {
  return readEnv('VITE_ORGANIZATION_PREFIX', '/organization/api');
}

export function getWorkerPrefix(): string {
  return readEnv('VITE_WORKER_PREFIX', '/worker/api');
}

export function getSharedPrefix(): string {
  return readEnv('VITE_SHARED_PREFIX', '/api');
}

// Back-compat helper for existing services that expect a "baseUrl" (host only)
// Note: The legacy getApiBaseUrl() is provided by authService (localStorage-backed).
// Here we avoid exporting a duplicate to prevent name collisions.

// New helpers that return full base URL (host + prefix). Optional path will be appended.
export function getOrganizationApiUrl(path = ''): string {
  return `${getApiHost()}${getOrganizationPrefix()}${path}`;
}

export function getWorkerApiUrl(path = ''): string {
  return `${getApiHost()}${getWorkerPrefix()}${path}`;
}

export function getSharedApiUrl(path = ''): string {
  return `${getApiHost()}${getSharedPrefix()}${path}`;
}

// Simple diagnostic (no-op in production builds unless enabled)
export function logConfig(debug = false): void {
  if (!debug) return;
  // eslint-disable-next-line no-console
  console.log('ENV CONFIG', {
    host: getApiHost(),
    orgPrefix: getOrganizationPrefix(),
    workerPrefix: getWorkerPrefix(),
    sharedPrefix: getSharedPrefix(),
  });
}
