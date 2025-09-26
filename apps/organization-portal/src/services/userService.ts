// Service to get current user's organization information
import { getAccessToken, refreshAccessToken, getWorkerApiUrl } from '@inji-offline-verify/shared-auth';

export interface UserOrganization {
  id: string;
  name: string;
  role: 'ADMIN' | 'USER';
  member_id: string;
}

export interface CurrentUserResponse {
  success: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string | null;
    is_active: boolean;
    last_login: string | null;
    date_joined: string;
  };
  organization: UserOrganization;
}

class UserService {
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

  async getCurrentUser(): Promise<CurrentUserResponse> {
    const response = await this.fetchWithAuth(`${this.baseUrl}/me/`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch current user: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Store organization ID in localStorage for quick access
    if (data.organization?.id) {
      localStorage.setItem('organizationId', data.organization.id);
      localStorage.setItem('organizationName', data.organization.name);
      localStorage.setItem('userRole', data.organization.role);
    }

    return data;
  }

  getCurrentOrganizationId(): string | null {
    return localStorage.getItem('organizationId');
  }

  getCurrentOrganizationName(): string | null {
    return localStorage.getItem('organizationName');
  }

  getCurrentUserRole(): string | null {
    return localStorage.getItem('userRole');
  }
}

export const userService = new UserService();