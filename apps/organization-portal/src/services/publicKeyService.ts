// Public Key service for organization public key management
import { getAccessToken, refreshAccessToken, getOrganizationApiUrl } from '@inji-offline-verify/shared-auth';

export interface OrganizationPublicKey {
  id: string;
  key_id: string;
  key_type: string;
  public_key_multibase: string;
  public_key_hex: string | null;
  public_key_jwk: any | null;
  controller: string;
  purpose: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  is_active: boolean;
}

export interface OrganizationPublicKeysResponse {
  organization_id: string | null;
  did: string | null;
  keys: OrganizationPublicKey[];
}

export interface CreatePublicKeyData {
  organization_id: string;
  key_id: string;
  controller: string;
  key_type?: string;
  public_key_multibase?: string;
  public_key_hex?: string;
  public_key_jwk?: any;
  purpose?: string;
  is_active?: boolean;
}

export interface UpdatePublicKeyData {
  organization_id: string;
  key_id: string;
  controller?: string;
  key_type?: string;
  public_key_multibase?: string;
  public_key_hex?: string;
  public_key_jwk?: any;
  purpose?: string;
  is_active?: boolean;
}

class PublicKeyService {
  private get baseUrl() {
    return getOrganizationApiUrl();
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
   * Fetch all organization public keys
   */
  async getOrganizationPublicKeys(): Promise<OrganizationPublicKeysResponse> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/public-keys/`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch organization public keys: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new public key using the upsert endpoint
   */
  async createPublicKey(data: CreatePublicKeyData): Promise<any> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/public-keys/upsert/`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to create public key: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update an existing public key using the upsert endpoint
   */
  async updatePublicKey(data: UpdatePublicKeyData): Promise<any> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/public-keys/upsert/`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update public key: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a public key by key_id
   */
  async deletePublicKey(keyId: string): Promise<void> {
    const encodedKeyId = encodeURIComponent(keyId);
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/public-keys/${encodedKeyId}/`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to delete public key: ${response.statusText}`);
    }
  }
}

const publicKeyService = new PublicKeyService();

// Export the service methods for easier importing
export const getOrganizationPublicKeys = () => publicKeyService.getOrganizationPublicKeys();
export const createPublicKey = (data: CreatePublicKeyData) => publicKeyService.createPublicKey(data);
export const updatePublicKey = (data: UpdatePublicKeyData) => publicKeyService.updatePublicKey(data);
export const deletePublicKey = (keyId: string) => publicKeyService.deletePublicKey(keyId);

export default publicKeyService;