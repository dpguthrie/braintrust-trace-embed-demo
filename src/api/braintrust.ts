import type { BTQLResponse, LogRecord } from '../types';

export interface FetchLogsParams {
  baseUrl: string;
  apiKey: string;
  projectId: string;
  limit?: number;
  daysBack?: number;
}

export interface ExecuteSqlParams {
  apiKey: string;
  query: string;
  signal?: AbortSignal;
}

export interface Project {
  id: string;
  name: string;
  org_id: string;
  created: string;
}

export interface Organization {
  id: string;
  name: string;
  api_url?: string | null;
}

export interface ConnectionCatalog {
  organizations: Organization[];
  projects: Project[];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

async function responseError(response: Response, resource: string): Promise<Error> {
  const detail = await response.text();
  return new Error(
    `Could not load ${resource} (${response.status})${detail ? `: ${detail}` : ''}`,
  );
}

function readObjectList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'objects' in payload &&
    Array.isArray(payload.objects)
  ) {
    return payload.objects as T[];
  }
  throw new Error('Braintrust returned an unexpected list response.');
}

export async function fetchOrganizations(
  apiKey: string,
  signal?: AbortSignal,
): Promise<Organization[]> {
  const response = await fetch('/api/apikey/login', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!response.ok) throw await responseError(response, 'organizations');

  const payload = (await response.json()) as { org_info?: Organization[] };
  if (!Array.isArray(payload.org_info)) {
    throw new Error('Braintrust returned an unexpected organization response.');
  }
  return payload.org_info;
}

export async function fetchProjects(
  apiKey: string,
  signal?: AbortSignal,
): Promise<Project[]> {
  const response = await fetch('/api/v1/project', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!response.ok) throw await responseError(response, 'projects');
  return readObjectList<Project>(await response.json());
}

export async function fetchConnectionCatalog(
  apiKey: string,
  signal?: AbortSignal,
): Promise<ConnectionCatalog> {
  const [organizations, projects] = await Promise.all([
    fetchOrganizations(apiKey, signal),
    fetchProjects(apiKey, signal),
  ]);

  return {
    organizations: [...organizations].sort((a, b) => a.name.localeCompare(b.name)),
    projects: [...projects].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function fetchRecentLogs(params: FetchLogsParams): Promise<LogRecord[]> {
  const { apiKey, projectId, limit = 20, daysBack = 30 } = params;

  const query = `
    SELECT *
    FROM project_logs('${projectId}')
    WHERE created >= NOW() - INTERVAL ${daysBack} DAY
      AND is_root
    ORDER BY _pagination_key DESC
    LIMIT ${limit}
  `;

  // Use the same-origin relay endpoint to avoid browser CORS restrictions.
  // In dev: proxied through Vite dev server
  // In production: proxied through serverless function
  const apiEndpoint = '/api/btql';

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      fmt: 'json',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch logs: ${response.status} ${errorText}`);
  }

  const result: BTQLResponse = await response.json();
  return result.data || [];
}

export async function executeSql<T>({
  apiKey,
  query,
  signal,
}: ExecuteSqlParams): Promise<T[]> {
  const response = await fetch('/api/btql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, fmt: 'json' }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Braintrust SQL returned ${response.status}: ${detail}`);
  }

  const result = (await response.json()) as BTQLResponse<T>;
  return result.data || [];
}

export function parseSpanAttributes(spanAttributes: unknown): {
  name?: string;
  type?: string;
} {
  if (typeof spanAttributes === 'string') {
    try {
      const parsed = JSON.parse(spanAttributes);
      return {
        name: parsed.name,
        type: parsed.type,
      };
    } catch {
      return {};
    }
  }

  if (typeof spanAttributes === 'object' && spanAttributes !== null) {
    return {
      name: (spanAttributes as Record<string, unknown>).name as string | undefined,
      type: (spanAttributes as Record<string, unknown>).type as string | undefined,
    };
  }

  return {};
}
