export interface TraceConfig {
  baseUrl: string;
  org: string;
  project: string;
  apiKey: string;
  projectId: string;    // Project UUID - used as object_id when object_type=project_logs
  objectType?: string;  // Optional - defaults to 'project_logs' for project logs
  objectId?: string;    // Optional - defaults to projectId for project logs
  rootSpanId: string;
  selectedSpanId?: string;
}

export interface TraceViewerMessage {
  r?: string;
  s?: string;
}

export interface TraceViewerProps {
  config: TraceConfig;
  onMessage?: (message: MessageEvent) => void;
}

export interface SpanAttributes {
  name?: string;
  type?: string;
  [key: string]: unknown;
}

export interface LogMetrics {
  start?: number;
  end?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface LogRecord {
  id: string;
  root_span_id?: string;
  span_id?: string;
  created: string | number;
  span_attributes?: SpanAttributes | string;
  metadata?: Record<string, unknown>;
  metrics?: LogMetrics;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  tags?: string[];
}

export interface BTQLResponse<T = LogRecord> {
  data: T[];
  cursor?: string;
}

export interface DashboardQuery {
  key:
    | 'spans'
    | 'latency'
    | 'cost'
    | 'costByModel'
    | 'tokens'
    | 'scores'
    | 'toolExecutions'
    | 'toolErrors'
    | 'toolDuration';
  name: string;
  description: string;
  sql: string;
}

export interface MonitorRow {
  bucket?: string | null;
  other_spans?: number | null;
  llm_calls?: number | null;
  tool_calls?: number | null;
  p50_duration?: number | null;
  p95_duration?: number | null;
  prompt_uncached_cost?: number | null;
  prompt_cached_cost?: number | null;
  cache_write_cost?: number | null;
  completion_cost?: number | null;
  total_cost?: number | null;
  model?: string | null;
  provider?: string | null;
  prompt_uncached_tokens?: number | null;
  prompt_cached_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  score?: string | null;
  avg_score?: number | null;
  tool?: string | null;
  executions?: number | null;
  error_rate?: number | null;
  p50_tool_duration?: number | null;
}

export type DashboardRows = Record<DashboardQuery['key'], MonitorRow[]>;

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DashboardQueryResult {
  key: DashboardQuery['key'];
  status: QueryStatus;
  rows: MonitorRow[];
  durationMs?: number;
  error?: string;
}

export type DashboardResults = Record<DashboardQuery['key'], DashboardQueryResult>;
