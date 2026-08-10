import type { DashboardQuery } from '../types';

export function buildDashboardQueries(
  projectId: string,
  daysBack: number,
): DashboardQuery[] {
  const source = `project_logs('${projectId}', shape => 'spans')`;
  const range = `created >= NOW() - INTERVAL ${daysBack} DAY`;

  return [
    {
      key: 'overview',
      name: 'Workspace summary',
      description:
        'Trace volume, LLM calls, errors, token usage, estimated cost, and root-span latency for the selected window.',
      sql: `SELECT
  count_distinct(root_span_id) AS trace_count,
  sum(CASE WHEN span_attributes.type = 'llm' THEN 1 ELSE 0 END) AS llm_calls,
  sum(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS error_count,
  COALESCE(sum(metrics.total_tokens), 0) AS total_tokens,
  COALESCE(sum(estimated_cost()), 0) AS estimated_cost,
  avg(CASE WHEN is_root THEN metrics.duration ELSE NULL END) AS avg_duration,
  percentile(CASE WHEN is_root THEN metrics.duration ELSE NULL END, 0.95) AS p95_duration
FROM ${source}
WHERE ${range}`,
    },
    {
      key: 'traffic',
      name: 'Traffic & reliability',
      description:
        'Daily distinct traces, error events, and p95 root-span duration. One result set powers both reliability charts.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  count_distinct(root_span_id) AS trace_count,
  sum(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS error_count,
  percentile(CASE WHEN is_root THEN metrics.duration ELSE NULL END, 0.95) AS p95_duration
FROM ${source}
WHERE ${range}
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC`,
    },
    {
      key: 'usage',
      name: 'Token & cost usage',
      description:
        'Daily prompt/completion tokens and Braintrust-estimated spend, scoped to LLM spans to avoid double counting.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  COALESCE(sum(metrics.prompt_tokens), 0) AS prompt_tokens,
  COALESCE(sum(metrics.completion_tokens), 0) AS completion_tokens,
  COALESCE(sum(metrics.total_tokens), 0) AS total_tokens,
  COALESCE(sum(estimated_cost()), 0) AS estimated_cost
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'llm'
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC`,
    },
    {
      key: 'models',
      name: 'Model mix',
      description:
        'Top models by LLM call volume with token and estimated-cost totals for each model.',
      sql: `SELECT
  metadata.model AS model,
  count(1) AS calls,
  COALESCE(sum(metrics.total_tokens), 0) AS total_tokens,
  COALESCE(sum(estimated_cost()), 0) AS estimated_cost
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'llm'
  AND metadata.model IS NOT NULL
GROUP BY metadata.model
ORDER BY calls DESC
LIMIT 8`,
    },
  ];
}
