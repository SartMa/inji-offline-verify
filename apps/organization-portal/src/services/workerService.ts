import { getAccessToken, refreshAccessToken, getWorkerApiUrl } from '@inji-offline-verify/shared-auth';

export interface RegisterWorkerPayload {
  org_name?: string; // optional; UI shows fixed organization and service injects organization_id
  username: string;
  password: string;
  email: string;
  full_name: string;
  phone_number: string;
  gender?: 'M' | 'F' | 'O' | string;
  dob?: string; // YYYY-MM-DD
  organization_id?: string; // preferred identifier sent automatically when available
}

class WorkerService {
  private get baseUrl() {
    return getWorkerApiUrl();
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
    // Try to include organization_id automatically from current session context
    let enriched: RegisterWorkerPayload = { ...payload };
    try {
      const { userService } = await import('./userService');
      const orgId = userService.getCurrentOrganizationId();
      if (orgId) {
        enriched.organization_id = orgId;
      }
    } catch (e) {
      // ignore if userService not available
    }

    const response = await this.fetchWithAuth(`${this.baseUrl}/register/`, {
      method: 'POST',
      body: JSON.stringify(enriched),
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
