import { useState, useEffect, useCallback } from 'react';
import { fetchRecentLogs, type FetchLogsParams } from '../api/braintrust';
import type { LogRecord } from '../types';

interface UseLogsResult {
  logs: LogRecord[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useLogs(params: FetchLogsParams | null): UseLogsResult {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!params) {
      setLogs([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchRecentLogs(params);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch logs'));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
  };
}
