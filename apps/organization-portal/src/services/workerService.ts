import { getAccessToken, getApiBaseUrl, refreshAccessToken } from '@inji-offline-verify/shared-auth';

export interface RegisterWorkerPayload {
  org_name: string;
  username: string;
  password: string;
  email: string;
  full_name: string;
  phone_number: string;
  gender?: 'M' | 'F' | 'O' | string;
  dob?: string; // YYYY-MM-DD
}

class WorkerService {
  private get baseUrl() {
    return getApiBaseUrl() || 'http://127.0.0.1:8000';
  }

  private async getAuthHeaders() {
    let token = getAccessToken();
    
    // If no token, try to refresh
    if (!token) {
      token = await refreshAccessToken();
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // If unauthorized, try to refresh token and retry once
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const newHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
          ...options.headers,
        };
        const retryResponse = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
        
        // If still unauthorized after refresh, logout user
        if (retryResponse.status === 401) {
          console.warn('Session expired - logging out user');
          // Import dynamically to avoid circular dependencies
          const { logoutService } = await import('./logoutService');
          await logoutService.logout();
          throw new Error('Session expired. Please login again.');
        }
        
        return retryResponse;
      } else {
        // If refresh failed, logout user
        console.warn('Token refresh failed - logging out user');
        const { logoutService } = await import('./logoutService');
        await logoutService.logout();
        throw new Error('Session expired. Please login again.');
      }
    }

    return response;
  }

  async registerWorker(payload: RegisterWorkerPayload) {
    const response = await this.fetchWithAuth(`${this.baseUrl}/worker/api/register/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Failed to register worker: ${response.status}`);
    }
    
    return response.json();
  }
}

export const workerService = new WorkerService();

// Keep the legacy function for backward compatibility
export async function registerWorker(payload: RegisterWorkerPayload) {
  return workerService.registerWorker(payload);
}
