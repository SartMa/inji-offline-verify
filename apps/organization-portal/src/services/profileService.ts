// Profile service for API calls
import { getAccessToken, refreshAccessToken, getWorkerApiUrl } from '@inji-offline-verify/shared-auth';

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface ProfilePhotoResponse {
  success: boolean;
  photo_url?: string;
  message?: string;
  error?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  user?: {
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
  message?: string;
  error?: string;
}

class ProfileService {
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

  async updateProfile(data: UpdateProfileData): Promise<UpdateProfileResponse> {
    const response = await this.fetchWithAuth(`${this.baseUrl}/profile/update/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update profile: ${response.statusText}`);
    }

    return await response.json();
  }

  async uploadProfilePhoto(file: File): Promise<ProfilePhotoResponse> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await this.fetchWithAuth(`${this.baseUrl}/profile/photo/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to upload photo: ${response.statusText}`);
    }

    return await response.json();
  }

  async getProfilePhoto(): Promise<string | null> {
    try {
      const response = await this.fetchWithAuth(`${this.baseUrl}/profile/photo/`, {
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.photo_url || null;
    } catch (error) {
      console.error('Failed to fetch profile photo:', error);
      return null;
    }
  }

  async deleteProfilePhoto(): Promise<ProfilePhotoResponse> {
    const response = await this.fetchWithAuth(`${this.baseUrl}/profile/photo/`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to delete photo: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const profileService = new ProfileService();