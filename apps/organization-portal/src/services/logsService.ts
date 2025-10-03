// Logs service for API calls
import { getAccessToken, refreshAccessToken, getWorkerApiUrl } from '@inji-offline-verify/shared-auth';

export type VerificationStatus = 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';

export interface VerificationLog {
  id: string;
  verification_status: VerificationStatus;
  verified_at: string;
  vc_hash?: string;
  credential_subject?: Record<string, any>;
  error_message?: string;
  organization: string;
  verified_by?: string;
  verified_by_info?: {
    id: string;
    username: string;
    full_name: string;
    email: string;
  };
  synced_at: string;
}

export interface VerificationLogsResponse {
  success: boolean;
  logs: VerificationLog[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
  };
  stats: {
    total_logs: number;
    success_count: number;
    failed_count: number;
    expired_count: number;
    revoked_count: number;
    suspended_count: number;
    unsuccessful_count: number;
  };
  organization?: {
    id: string;
    name: string;
  };
}

export interface GetLogsParams {
  orgId?: string;
  userId?: string;
  status?: VerificationStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface LogsStatsResponse {
  success: boolean;
  stats: {
    total_logs: number;
    success_count: number;
    failed_count: number;
    expired_count: number;
    revoked_count: number;
    suspended_count: number;
    unsuccessful_count: number;
    recent_logs: number; // logs in last 24 hours
  };
}

class LogsService {
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

  async getOrganizationLogs(params: GetLogsParams): Promise<VerificationLogsResponse> {
    const { orgId, userId, status, search, page = 1, pageSize = 20, dateFrom, dateTo } = params;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (userId) queryParams.append('user_id', userId);
    if (status) queryParams.append('status', status);
    if (search) queryParams.append('search', search);
    if (dateFrom) queryParams.append('date_from', dateFrom);
    if (dateTo) queryParams.append('date_to', dateTo);
    queryParams.append('page', page.toString());
    queryParams.append('page_size', pageSize.toString());

    const endpoint = orgId 
      ? `${this.baseUrl}/organizations/${orgId}/logs/?${queryParams}`
      : `${this.baseUrl}/logs/?${queryParams}`;

    const response = await this.fetchWithAuth(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch logs: ${response.statusText}`);
    }

    return response.json();
  }

  async getUserLogs(userId: string, params: Omit<GetLogsParams, 'userId'> = {}): Promise<VerificationLogsResponse> {
    return this.getOrganizationLogs({ ...params, userId });
  }

  async getLogsStats(orgId?: string, userId?: string): Promise<LogsStatsResponse> {
    const queryParams = new URLSearchParams();
    if (userId) queryParams.append('user_id', userId);
    
    const endpoint = orgId 
      ? `${this.baseUrl}/organizations/${orgId}/logs/stats/?${queryParams}`
      : `${this.baseUrl}/logs/stats/?${queryParams}`;

    const response = await this.fetchWithAuth(endpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch logs stats: ${response.statusText}`);
    }

    return response.json();
  }

  async getLogDetail(logId: string): Promise<{success: boolean; log: VerificationLog}> {
    const response = await this.fetchWithAuth(
      `${this.baseUrl}/logs/${logId}/`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch log detail: ${response.statusText}`);
    }

    return response.json();
  }
}

export const logsService = new LogsService();