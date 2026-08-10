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
  key: 'overview' | 'traffic' | 'usage' | 'models';
  name: string;
  description: string;
  sql: string;
}

export interface OverviewRow {
  trace_count?: number | null;
  llm_calls?: number | null;
  error_count?: number | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
  avg_duration?: number | null;
  p95_duration?: number | null;
}

export interface TrafficRow {
  bucket?: string;
  trace_count?: number | null;
  error_count?: number | null;
  p95_duration?: number | null;
}

export interface UsageRow {
  bucket?: string;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
}

export interface ModelRow {
  model?: string | null;
  calls?: number | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
}

export type DashboardRows = {
  overview: OverviewRow[];
  traffic: TrafficRow[];
  usage: UsageRow[];
  models: ModelRow[];
};

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export type DashboardRow = OverviewRow | TrafficRow | UsageRow | ModelRow;

export interface DashboardQueryResult {
  key: DashboardQuery['key'];
  status: QueryStatus;
  rows: DashboardRow[];
  durationMs?: number;
  error?: string;
}

export type DashboardResults = Record<DashboardQuery['key'], DashboardQueryResult>;
