// Organization service for API calls
import { getAccessToken, refreshAccessToken, getWorkerApiUrl } from '@inji-offline-verify/shared-auth';

export interface OrganizationMember {
  id: string;
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'ADMIN' | 'USER';
  role_display: string;
  full_name?: string;
  phone_number?: string;
  gender?: 'M' | 'F' | 'O';
  gender_display?: string;
  dob?: string;
  created_at: string;
  is_active: boolean;
  last_login?: string;
  date_joined: string;
}

export interface OrganizationUsersResponse {
  success: boolean;
  organization: {
    id: string;
    name: string;
  };
  members: OrganizationMember[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
  };
  stats: {
    total_members: number;
    admin_count: number;
    user_count: number;
    active_members: number;
  };
}

export interface GetOrganizationUsersParams {
  orgId: string;
  role?: 'ADMIN' | 'USER';
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateMemberData {
  role?: 'ADMIN' | 'USER';
  full_name?: string;
  phone_number?: string;
  gender?: 'M' | 'F' | 'O';
  dob?: string;
}

class OrganizationService {
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

  async getOrganizationUsers(params: GetOrganizationUsersParams): Promise<OrganizationUsersResponse> {
    const { orgId, role, search, page = 1, pageSize = 20 } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (role) queryParams.append('role', role);
    if (search) queryParams.append('search', search);
    queryParams.append('page', page.toString());
    queryParams.append('page_size', pageSize.toString());

    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organizations/${orgId}/users/?${queryParams}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch organization users: ${response.statusText}`);
    }

    return response.json();
  }

  async getOrganizationUserDetail(orgId: string, memberId: string): Promise<{success: boolean; member: OrganizationMember}> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organizations/${orgId}/users/${memberId}/`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch user detail: ${response.statusText}`);
    }

    return response.json();
  }

  async updateOrganizationUser(
    orgId: string, 
    memberId: string, 
    data: UpdateMemberData
  ): Promise<{success: boolean; member: OrganizationMember}> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organizations/${orgId}/users/${memberId}/update/`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update user: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteOrganizationUser(orgId: string, memberId: string): Promise<{success: boolean; message: string}> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organizations/${orgId}/users/${memberId}/delete/`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to delete user: ${response.statusText}`);
    }

    return response.json();
  }
}

export const organizationService = new OrganizationService();