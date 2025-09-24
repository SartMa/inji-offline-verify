// Core authentication functions shared across apps

// Type definitions for API responses
interface LoginResponse {
  access?: string;
  refresh?: string;
  token?: string;
  organization?: {
    id: string;
    name: string;
  };
  is_staff?: boolean;
  [key: string]: any;
}

interface UserProfileResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    is_active: boolean;
    last_login: string | null;
    date_joined: string;
  };
  organization?: {
    id: string;
    name: string;
    role: string;
    member_id: string;
  };
  error?: string;
}

export async function login(baseUrl: string, payload: { username: string; password: string; org_name: string }): Promise<LoginResponse> {
  const res = await fetch(`${baseUrl}/worker/api/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.non_field_errors?.[0] || errorData.error || errorData.message || errorData.detail || 'Invalid credentials';
    throw new Error(errorMessage);
  }
  const data: LoginResponse = await res.json();
  setApiBaseUrl(baseUrl);
  if (data?.access || data?.refresh || data?.token) {
    saveTokens({ access: data.access, refresh: data.refresh, legacyToken: data.token });
  }
  return data;
}

export async function loginorg(baseUrl: string, payload: { username: string; password: string; org_name: string }): Promise<LoginResponse> {
  const res = await fetch(`${baseUrl}/organization/api/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.non_field_errors?.[0] || errorData.error || errorData.message || errorData.detail || 'Invalid credentials';
    throw new Error(errorMessage);
  }
  const data: LoginResponse = await res.json();
  setApiBaseUrl(baseUrl);
  if (data?.access || data?.refresh || data?.token) {
    saveTokens({ access: data.access, refresh: data.refresh, legacyToken: data.token });
  }
  return data;
}

export async function googleLogin(baseUrl: string, payload: { access_token: string; org_name: string }): Promise<LoginResponse> {
  const res = await fetch(`${baseUrl}/worker/api/google-login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.non_field_errors?.[0] || `Google login failed: ${res.status}`);
  }
  const data: LoginResponse = await res.json();
  setApiBaseUrl(baseUrl);
  if (data?.access || data?.refresh || data?.token) {
    saveTokens({ access: data.access, refresh: data.refresh, legacyToken: data.token });
  }
  return data;
}

export async function organizationLogin(baseUrl: string, payload: { username: string; password: string; org_name: string }): Promise<LoginResponse> {
  const res = await fetch(`${baseUrl}/organization/api/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.non_field_errors?.[0] || errorData.error || errorData.message || errorData.detail || 'Invalid credentials';
    throw new Error(errorMessage);
  }
  const data: LoginResponse = await res.json();
  setApiBaseUrl(baseUrl);
  if (data?.access || data?.refresh || data?.token) {
    saveTokens({ access: data.access, refresh: data.refresh, legacyToken: data.token });
  }
  return data;
}

// Token/baseUrl helpers for all apps
const ACCESS_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';
const LEGACY_KEY = 'auth.legacyToken';
const BASE_URL_KEY = 'api.baseUrl';
const USER_CACHE_KEY = 'auth.userCache'; // Cache user data for offline use

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

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    throw new Error('API base URL not set');
  }

  const fullUrl = `${baseUrl}${url}`;

  // Set Authorization header
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  options.headers = headers;

  let response = await fetch(fullUrl, options);

  // If unauthorized, try to refresh the token and retry the request once
  if (response.status === 401) {
    console.log('Access token expired. Attempting to refresh...');
    const newToken = await refreshAccessToken(baseUrl);

    if (newToken) {
      console.log('Token refreshed successfully. Retrying request...');
      headers.set('Authorization', `Bearer ${newToken}`);
      options.headers = headers;
      response = await fetch(fullUrl, options); // Retry the request
    } else {
      console.error('Failed to refresh token. User may need to log in again.');
      // Optional: clear tokens and redirect to login
      // clearTokens();
      // window.location.href = '/login';
    }
  }

  return response;
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  } catch {}
}

// Cache user data for offline use
export function cacheUserData(userData: UserProfileResponse) {
  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
      ...userData,
      cachedAt: Date.now()
    }));
  } catch {}
}

// Get cached user data (with expiry check)
export function getCachedUserData(): UserProfileResponse | null {
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const cacheAge = Date.now() - (data.cachedAt || 0);
    const maxAge = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
    
    // Return cached data if it's less than 2 days old
    if (cacheAge < maxAge) {
      return data;
    }
    
    // Remove expired cache
    localStorage.removeItem(USER_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(baseUrl?: string): Promise<string | null> {
  const refresh = getRefreshToken();
  const apiBase = baseUrl || getApiBaseUrl();
  if (!refresh || !apiBase) return null;
  
  try {
    const res = await fetch(`${apiBase}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    if (!res.ok) return null;
    const data: { access?: string } = await res.json();
    if (data?.access) saveTokens({ access: data.access });
    return data?.access ?? null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

export async function getCurrentUser(): Promise<UserProfileResponse | null> {
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();
  
  if (!baseUrl || !token) {
    // If we don't have tokens but we're offline, try to return cached data
    if (!navigator.onLine) {
      return getCachedUserData();
    }
    return null;
  }
  
  // If we're offline, return cached data immediately
  if (!navigator.onLine) {
    const cached = getCachedUserData();
    if (cached) {
      return cached;
    }
  }
  
  try {
    const res = await fetch(`${baseUrl}/worker/api/me/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!res.ok) {
      // Try to refresh token if 401
      if (res.status === 401) {
        const newToken = await refreshAccessToken(baseUrl);
        if (newToken) {
          // Retry with new token
          const retryRes = await fetch(`${baseUrl}/worker/api/me/`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`
            }
          });
          if (retryRes.ok) {
            const userData = await retryRes.json();
            // Cache the fresh data
            cacheUserData(userData);
            return userData;
          }
        }
      }
      
      // If we can't get fresh data but we're offline or have cached data, return it
      if (!navigator.onLine) {
        const cached = getCachedUserData();
        if (cached) {
          return cached;
        }
      }
      
      return null;
    }
    
    const userData = await res.json();
    // Cache the fresh data
    cacheUserData(userData);
    return userData;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    
    // If we're offline or there's a network error, use cached data
    if (!navigator.onLine || (error instanceof Error && error.name === 'TypeError')) {
      const cached = getCachedUserData();
      if (cached) {
        console.log('Using cached user data due to network error');
        return cached;
      }
    }
    
    return null;
  }
}
