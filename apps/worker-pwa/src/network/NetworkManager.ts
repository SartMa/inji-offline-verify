// Minimal network manager with retry and auth header support
import { getAccessToken, refreshAccessToken, getApiBaseUrl } from '@inji-offline-verify/shared-auth';

export interface RequestOptions extends RequestInit {
  retry?: number;
  retryDelayMs?: number;
  auth?: boolean;
}

export class NetworkManager {
  static async fetch(path: string, options: RequestOptions = {}) {
    const base = getApiBaseUrl();
    const url = path.startsWith('http') ? path : `${base}${path}`;
    const retry = options.retry ?? 2;
    const delay = options.retryDelayMs ?? 400;
    const auth = options.auth ?? true;

    let headers: HeadersInit = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    let token = auth ? getAccessToken() : null;
    if (token && auth) headers = { ...headers, Authorization: `Bearer ${token}` };

    let lastErr: any;
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const res = await fetch(url!, { ...options, headers });
        if (res.status === 401 && auth) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            headers = { ...headers, Authorization: `Bearer ${refreshed}` };
            continue; // retry loop
          }
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (e) {
        lastErr = e;
        if (attempt < retry) await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }
}
