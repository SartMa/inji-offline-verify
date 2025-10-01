import { getAccessToken, refreshAccessToken, getOrganizationApiUrl } from '@inji-offline-verify/shared-auth';

export interface OrganizationStatusListCredential {
  id: string;
  status_list_id: string;
  issuer: string;
  purposes: string[];
  version: number;
  issuance_date?: string | null;
  encoded_list_hash: string;
  full_credential: any;
  created_at: string;
  updated_at: string;
}

export interface OrganizationStatusListCredentialsResponse {
  organization_id: string;
  status_list_credentials: OrganizationStatusListCredential[];
}

class StatusListCredentialService {
  private get baseUrl() {
    return getOrganizationApiUrl();
  }

  private async getAuthHeaders() {
    let token = getAccessToken();

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

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newToken}`,
            ...options.headers,
          },
        });

        if (retryResponse.status === 401) {
          const { logoutService } = await import('./logoutService');
          await logoutService.logout();
          throw new Error('Session expired. Please login again.');
        }

        return retryResponse;
      }

      const { logoutService } = await import('./logoutService');
      await logoutService.logout();
      throw new Error('Session expired. Please login again.');
    }

    return response;
  }

  async getOrganizationStatusListCredentials(organizationId?: string): Promise<OrganizationStatusListCredentialsResponse> {
    const params = new URLSearchParams();
    if (organizationId) {
      params.append('organization_id', organizationId);
    }

    const response = await this.fetchWithAuth(`${this.baseUrl}/status-list-credentials/?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.detail || `Failed to fetch status list credentials: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteStatusListCredential(statusListId: string): Promise<void> {
    const encodedId = encodeURIComponent(statusListId);
    const response = await this.fetchWithAuth(`${this.baseUrl}/status-list-credentials/${encodedId}/`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.detail || `Failed to delete status list credential: ${response.statusText}`);
    }
  }
}

const statusListCredentialService = new StatusListCredentialService();

export const getOrganizationStatusListCredentials = (organizationId?: string) =>
  statusListCredentialService.getOrganizationStatusListCredentials(organizationId);

export const deleteStatusListCredential = (statusListId: string) =>
  statusListCredentialService.deleteStatusListCredential(statusListId);

export default statusListCredentialService;
