import type { DashboardQuery } from '../types';

export function buildDashboardQueries(
  projectId: string,
  daysBack: number,
): DashboardQuery[] {
  const source = `project_logs('${projectId}', shape => 'spans')`;
  const range = `created >= NOW() - INTERVAL ${daysBack} DAY`;
  const excludeScorers =
    `(span_attributes.purpose IS NULL OR span_attributes.purpose != 'scorer')`;

  return [
    {
      key: 'spans',
      name: 'Spans',
      description:
        'Daily span volume split into LLM calls, tool calls, and all other application spans. Internal scorer spans are excluded like the built-in Monitor preset.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  sum(CASE WHEN span_attributes.type = 'llm' THEN 1 ELSE 0 END) AS llm_calls,
  sum(CASE WHEN span_attributes.type = 'tool' THEN 1 ELSE 0 END) AS tool_calls,
  sum(CASE WHEN span_attributes.type = 'llm' OR span_attributes.type = 'tool' THEN 0 ELSE 1 END) AS other_spans
FROM ${source}
WHERE ${range}
  AND ${excludeScorers}
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC`,
    },
    {
      key: 'latency',
      name: 'Latency',
      description:
        'Daily p50 and p95 root-span duration, computed from metrics.end - metrics.start like Braintrust’s built-in Monitor preset.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  percentile(CASE WHEN is_root THEN metrics.end - metrics.start ELSE NULL END, 0.50) AS p50_duration,
  percentile(CASE WHEN is_root THEN metrics.end - metrics.start ELSE NULL END, 0.95) AS p95_duration
FROM ${source}
WHERE ${range}
  AND ${excludeScorers}
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC`,
    },
    {
      key: 'cost',
      name: 'Total LLM cost',
      description:
        'Daily estimated LLM cost split into uncached prompt, cache-read prompt, cache-write, and completion components.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  COALESCE(sum(estimated_cost_component('promptUncachedTokensCost')), 0) AS prompt_uncached_cost,
  COALESCE(sum(estimated_cost_component('promptCachedTokensCost')), 0) AS prompt_cached_cost,
  COALESCE(sum(estimated_cost_component('promptCacheCreationTokensCost')), 0)
    + COALESCE(sum(estimated_cost_component('promptCacheCreation5mTokensCost')), 0)
    + COALESCE(sum(estimated_cost_component('promptCacheCreation1hTokensCost')), 0) AS cache_write_cost,
  COALESCE(sum(estimated_cost_component('completionTokensCost')), 0) AS completion_cost,
  COALESCE(sum(estimated_cost()), 0) AS total_cost
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'llm'
  AND ${excludeScorers}
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC`,
    },
    {
      key: 'costByModel',
      name: 'Total LLM cost by model',
      description:
        'Daily estimated spend grouped by the model and provider recorded on each LLM span.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  metadata.model AS model,
  metadata.provider AS provider,
  COALESCE(sum(estimated_cost()), 0) AS total_cost
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'llm'
  AND metadata.model IS NOT NULL
  AND ${excludeScorers}
GROUP BY date_trunc('day', created), metadata.model, metadata.provider
ORDER BY bucket ASC`,
    },
    {
      key: 'tokens',
      name: 'Token count',
      description:
        'Daily LLM token usage split into uncached prompt, cache-read prompt, and completion tokens.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  COALESCE(sum(metrics.prompt_tokens), 0) - COALESCE(sum(metrics.prompt_cached_tokens), 0) AS prompt_uncached_tokens,
  COALESCE(sum(metrics.prompt_cached_tokens), 0) AS prompt_cached_tokens,
  COALESCE(sum(metrics.completion_tokens), 0) AS completion_tokens,
  COALESCE(sum(metrics.total_tokens), 0) AS total_tokens
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'llm'
  AND ${excludeScorers}
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC`,
    },
    {
      key: 'scores',
      name: 'Scores',
      description:
        'Average value of every score found in the project. UNPIVOT discovers score names dynamically, so no custom schema is hard-coded.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  score,
  avg(value) AS avg_score
FROM ${source}
UNPIVOT (value FOR score IN (scores))
WHERE ${range}
GROUP BY date_trunc('day', created), score
ORDER BY bucket ASC`,
    },
    {
      key: 'toolExecutions',
      name: 'Tool executions',
      description:
        'Daily tool-call volume grouped by tool name.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  span_attributes.name AS tool,
  count(1) AS executions
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'tool'
  AND span_attributes.name IS NOT NULL
GROUP BY date_trunc('day', created), span_attributes.name
ORDER BY bucket ASC`,
    },
    {
      key: 'toolErrors',
      name: 'Tool error rate',
      description:
        'Daily percentage of tool spans with an error, grouped by tool name.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  span_attributes.name AS tool,
  100 * sum(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) / count(1) AS error_rate
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'tool'
  AND span_attributes.name IS NOT NULL
GROUP BY date_trunc('day', created), span_attributes.name
ORDER BY bucket ASC`,
    },
    {
      key: 'toolDuration',
      name: 'Tool duration (p50)',
      description:
        'Daily median duration of each named tool.',
      sql: `SELECT
  date_trunc('day', created) AS bucket,
  span_attributes.name AS tool,
  percentile(metrics.duration, 0.50) AS p50_tool_duration
FROM ${source}
WHERE ${range}
  AND span_attributes.type = 'tool'
  AND span_attributes.name IS NOT NULL
  AND metrics.duration IS NOT NULL
GROUP BY date_trunc('day', created), span_attributes.name
ORDER BY bucket ASC`,
    },
  ];
}
