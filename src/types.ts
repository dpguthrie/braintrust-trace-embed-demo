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

export interface BTQLResponse {
  data: LogRecord[];
  cursor?: string;
}
