// Revoked VC service for organization revoked VC management
import { getAccessToken, getApiBaseUrl, refreshAccessToken } from '@inji-offline-verify/shared-auth';

export interface OrganizationRevokedVC {
  id: string;
  vc_id: string;
  issuer: string;
  subject: string | null;
  metadata: any; // Full VC JSON
  reason: string | null;
  revoked_at: string;
  organization: string;
}

export interface OrganizationRevokedVCsResponse {
  organization_id: string;
  revoked_vcs: OrganizationRevokedVC[];
}

export interface CreateRevokedVCData {
  organization_id: string;
  vc_json: any; // Full VC JSON object
  reason?: string;
}

export interface UpdateRevokedVCData {
  organization_id: string;
  vc_json: any; // Full VC JSON object
  reason?: string;
}

class RevokedVCService {
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

  /**
   * Fetch all organization revoked VCs
   */
  async getOrganizationRevokedVCs(organizationId?: string): Promise<OrganizationRevokedVCsResponse> {
    const params = new URLSearchParams();
    if (organizationId) {
      params.append('organization_id', organizationId);
    }
    
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organization/api/revoked-vcs/?${params.toString()}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.detail || `Failed to fetch organization revoked VCs: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new revoked VC using the upsert endpoint
   */
  async addRevokedVC(data: CreateRevokedVCData): Promise<any> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organization/api/revoked-vcs/upsert/`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `Failed to add revoked VC: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update an existing revoked VC using the upsert endpoint
   */
  async updateRevokedVC(data: UpdateRevokedVCData): Promise<any> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organization/api/revoked-vcs/upsert/`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `Failed to update revoked VC: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a revoked VC by vc_id (remove from revocation list)
   */
  async deleteRevokedVC(vcId: string): Promise<void> {
    const encodedVcId = encodeURIComponent(vcId);
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/organization/api/revoked-vcs/${encodedVcId}/`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `Failed to remove revoked VC: ${response.statusText}`);
    }
  }
}

const revokedVCService = new RevokedVCService();

// Export the service methods for easier importing
export const getOrganizationRevokedVCs = (organizationId?: string) => revokedVCService.getOrganizationRevokedVCs(organizationId);
export const addRevokedVC = (data: CreateRevokedVCData) => revokedVCService.addRevokedVC(data);
export const updateRevokedVC = (data: UpdateRevokedVCData) => revokedVCService.updateRevokedVC(data);
export const deleteRevokedVC = (vcId: string) => revokedVCService.deleteRevokedVC(vcId);

export default revokedVCService;