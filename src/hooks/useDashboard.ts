import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { executeSql } from '../api/braintrust';
import { buildDashboardQueries } from '../dashboard/queries';
import type {
  DashboardQuery,
  DashboardRow,
  DashboardResults,
  DashboardRows,
} from '../types';

interface UseDashboardParams {
  apiKey: string;
  projectId: string;
  daysBack: number;
}

function emptyResult(key: DashboardQuery['key']) {
  return { key, status: 'idle' as const, rows: [] as DashboardRow[] };
}

function createEmptyResults(): DashboardResults {
  return {
    overview: emptyResult('overview'),
    traffic: emptyResult('traffic'),
    usage: emptyResult('usage'),
    models: emptyResult('models'),
  };
}

export function useDashboard(params: UseDashboardParams | null) {
  const queries = useMemo(
    () => buildDashboardQueries(params?.projectId || 'YOUR_PROJECT_ID', params?.daysBack || 30),
    [params?.projectId, params?.daysBack],
  );
  const [results, setResults] = useState<DashboardResults>(createEmptyResults);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestId = useRef(0);

  const run = useCallback(async () => {
    if (!params) {
      setResults(createEmptyResults());
      setLastUpdated(null);
      return;
    }

    const currentRequest = ++requestId.current;
    setResults((current) => {
      const next = { ...current } as DashboardResults;
      for (const query of queries) {
        next[query.key] = {
          key: query.key,
          status: 'loading',
          rows: current[query.key].rows,
        };
      }
      return next;
    });

    // Every panel is independent, so all SQL requests start together. allSettled
    // keeps a single unsupported field from blanking the rest of the dashboard.
    const settled = await Promise.allSettled(
      queries.map(async (query) => {
        const started = performance.now();
        const rows = await executeSql<DashboardRows[typeof query.key][number]>({
          apiKey: params.apiKey,
          query: query.sql,
        });
        return { query, rows, durationMs: Math.round(performance.now() - started) };
      }),
    );

    if (currentRequest !== requestId.current) return;

    setResults((current) => {
      const next = { ...current } as DashboardResults;
      settled.forEach((result, index) => {
        const query = queries[index];
        if (result.status === 'fulfilled') {
          next[query.key] = {
            key: query.key,
            status: 'success',
            rows: result.value.rows,
            durationMs: result.value.durationMs,
          };
        } else {
          next[query.key] = {
            key: query.key,
            status: 'error',
            rows: [],
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'The SQL query failed.',
          };
        }
      });
      return next;
    });
    setLastUpdated(new Date());
  }, [params, queries]);

  useEffect(() => {
    const timer = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(timer);
  }, [run]);

  return {
    queries,
    results,
    lastUpdated,
    run,
    loading: Object.values(results).some((result) => result.status === 'loading'),
  };
}
