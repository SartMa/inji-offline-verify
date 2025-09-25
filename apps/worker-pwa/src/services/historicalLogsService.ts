import { authenticatedFetch } from './authService';

// Type definitions
export interface HistoricalLogItem {
  id: string;
  verification_status: 'SUCCESS' | 'FAILED';
  verified_at: string;
  vc_hash: string | null;
  credential_subject: any | null;
  error_message: string | null;
  verified_by: {
    id: number;
    username: string;
    email: string;
  };
  synced_at: string;
}

export interface HistoricalLogsResponse {
  success: boolean;
  organization: {
    id: string;
    name: string;
  };
  user: {
    id: number;
    username: string;
  };
  logs: HistoricalLogItem[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
  };
  time_range: {
    days_back: number;
    start_date: string;
    end_date: string;
  };
  stats: {
    total_logs: number;
    success_count: number;
    failed_count: number;
    success_rate: number;
  };
  error?: string;
}

export interface FetchHistoricalLogsOptions {
  days?: number; // Number of days to fetch back (default: 3, max: 14)
  page?: number; // Page number for pagination
  pageSize?: number; // Number of items per page
}

/**
 * Fetches historical verification logs from the server for the authenticated worker
 * @param options Configuration options for the fetch
 * @returns Promise with historical logs data
 */
export async function fetchHistoricalLogs(options: FetchHistoricalLogsOptions = {}): Promise<HistoricalLogsResponse> {
  const { days = 3, page = 1, pageSize = 100 } = options;
  
  try {
    // Construct query parameters
    const params = new URLSearchParams({
      days: days.toString(),
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    const response = await authenticatedFetch(`/worker/api/historical-logs/?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || errorData.detail || 'Failed to fetch historical logs';
      throw new Error(errorMessage);
    }

    const data: HistoricalLogsResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch historical logs:', error);
    // Return error response in the expected format
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      organization: { id: '', name: '' },
      user: { id: 0, username: '' },
      logs: [],
      pagination: {
        current_page: 1,
        total_pages: 0,
        total_count: 0,
        page_size: pageSize,
        has_next: false,
        has_previous: false,
      },
      time_range: {
        days_back: days,
        start_date: '',
        end_date: '',
      },
      stats: {
        total_logs: 0,
        success_count: 0,
        failed_count: 0,
        success_rate: 0,
      },
    };
  }
}

/**
 * Converts a HistoricalLogItem to the LogItem format used by StorageLogs component
 */
export function convertHistoricalLogToLogItem(historicalLog: HistoricalLogItem, index: number) {
  return {
    id: parseInt(historicalLog.id.replace(/-/g, '').slice(0, 8), 16) || index, // Convert UUID to number for UI consistency
    status: historicalLog.verification_status === 'SUCCESS' ? 'success' as const : 'failure' as const,
    synced: true, // Historical logs from server are always considered synced
    timestamp: new Date(historicalLog.verified_at).getTime(),
    hash: historicalLog.vc_hash || '-',
  };
}

/**
 * Converts HistoricalLogItem to VerificationRecord format for IndexedDB storage
 */
export function convertHistoricalLogToVerificationRecord(historicalLog: HistoricalLogItem) {
  return {
    uuid: historicalLog.id, // Use the UUID from server
    verified_at: historicalLog.verified_at,
    synced: true, // Historical logs from server are already synced
    verification_status: historicalLog.verification_status,
    vc_hash: historicalLog.vc_hash,
    credential_subject: historicalLog.credential_subject,
    error_message: historicalLog.error_message,
  };
}

/**
 * Cache configuration for historical logs
 */
const CACHE_KEY = 'historicalLogs.cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache duration

interface CachedHistoricalData {
  data: HistoricalLogsResponse;
  timestamp: number;
  days: number;
}

/**
 * Gets cached historical logs if available and not expired
 */
export function getCachedHistoricalLogs(days: number): HistoricalLogsResponse | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const cachedData: CachedHistoricalData = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired or for different days
    if (now - cachedData.timestamp > CACHE_DURATION || cachedData.days !== days) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return cachedData.data;
  } catch (error) {
    console.warn('Failed to read historical logs cache:', error);
    return null;
  }
}

/**
 * Caches historical logs data
 */
export function cacheHistoricalLogs(data: HistoricalLogsResponse, days: number): void {
  try {
    const cacheData: CachedHistoricalData = {
      data,
      timestamp: Date.now(),
      days,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache historical logs:', error);
  }
}

/**
 * Clears the historical logs cache
 */
export function clearHistoricalLogsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to clear historical logs cache:', error);
  }
}

/**
 * Fetches historical logs with caching support
 */
export async function fetchHistoricalLogsWithCache(options: FetchHistoricalLogsOptions = {}): Promise<HistoricalLogsResponse> {
  const { days = 3 } = options;
  
  // Try to get from cache first
  const cached = getCachedHistoricalLogs(days);
  if (cached && cached.success) {
    console.log('Using cached historical logs');
    return cached;
  }
  
  // Fetch fresh data
  const data = await fetchHistoricalLogs(options);
  
  // Cache successful responses
  if (data.success) {
    cacheHistoricalLogs(data, days);
  }
  
  return data;
}