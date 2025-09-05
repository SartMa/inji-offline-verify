export async function registerOrganization(baseUrl: string, payload: {
  org_name: string;
  org_did: string;
  admin_username: string;
  admin_password: string;
  admin_email?: string;
}) {
  const res = await fetch(`${baseUrl}/api/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status}`);
  const data = await res.json();
  // Optional: persist baseUrl and tokens for later client calls
  setApiBaseUrl(baseUrl);
  if (data?.access || data?.refresh || data?.token) {
    saveTokens({ access: data.access, refresh: data.refresh, legacyToken: data.token });
  }
  if (data?.organization) saveOrg(data.organization);
  return data;
}

export async function login(baseUrl: string, payload: { username: string; password: string; org_name: string }) {
  const res = await fetch(`${baseUrl}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  setApiBaseUrl(baseUrl);
  if (data?.access || data?.refresh || data?.token) {
    saveTokens({ access: data.access, refresh: data.refresh, legacyToken: data.token });
  }
  if (data?.organization) saveOrg(data.organization);
  return data;
}

// Token/baseUrl helpers for PWA
const ACCESS_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';
const LEGACY_KEY = 'auth.legacyToken';
const BASE_URL_KEY = 'api.baseUrl';
const ORG_KEY = 'auth.organization';

export function setApiBaseUrl(baseUrl: string) {
  try { localStorage.setItem(BASE_URL_KEY, baseUrl.replace(/\/$/, '')); } catch {}
}

export function getApiBaseUrl(): string | null {
  try { return localStorage.getItem(BASE_URL_KEY); } catch { return null; }
}

export function saveTokens(opts: { access?: string; refresh?: string; legacyToken?: string }) {
  try {
    if (opts.access) localStorage.setItem(ACCESS_KEY, opts.access);
    if (opts.refresh) localStorage.setItem(REFRESH_KEY, opts.refresh);
    if (opts.legacyToken) localStorage.setItem(LEGACY_KEY, opts.legacyToken);
  } catch {}
}

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export function saveOrg(org: any) {
  try { localStorage.setItem(ORG_KEY, JSON.stringify(org)); } catch {}
}

export function getOrg(): any | null {
  try { const v = localStorage.getItem(ORG_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

export async function refreshAccessToken(baseUrl?: string): Promise<string | null> {
  const refresh = getRefreshToken();
  const apiBase = baseUrl || getApiBaseUrl();
  if (!refresh || !apiBase) return null;
  const res = await fetch(`${apiBase}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh })
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.access) saveTokens({ access: data.access });
  return data?.access ?? null;
}