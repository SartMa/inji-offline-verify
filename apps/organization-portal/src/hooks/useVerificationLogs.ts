import { useState, useEffect } from 'react';
import { logsService, VerificationLogsResponse, LogsStatsResponse, GetLogsParams } from '../services/logsService';

export interface UseLogsOptions extends GetLogsParams {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useLogs(options: UseLogsOptions = {}) {
  const [data, setData] = useState<VerificationLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async (params?: GetLogsParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const finalParams = { ...options, ...params };
      const response = await logsService.getOrganizationLogs(finalParams);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.enabled !== false) {
      fetchLogs();
    }
  }, [
    options.orgId,
    options.userId,
    options.status,
    options.search,
    options.page,
    options.pageSize,
    options.dateFrom,
    options.dateTo,
    options.enabled,
  ]);

  const refetch = (params?: GetLogsParams) => fetchLogs(params);

  return {
    data,
    loading,
    error,
    refetch,
  };
}

export function useLogsStats(orgId?: string) {
  const [data, setData] = useState<LogsStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await logsService.getLogsStats(orgId);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchStats();
    }
  }, [orgId]);

  const refetch = () => fetchStats();

  return {
    data,
    loading,
    error,
    refetch,
  };
}