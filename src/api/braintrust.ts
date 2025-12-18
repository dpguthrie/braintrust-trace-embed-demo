import type { BTQLResponse, LogRecord } from '../types';

export interface FetchLogsParams {
  baseUrl: string;
  apiKey: string;
  projectId: string;
  limit?: number;
  daysBack?: number;
}

export interface Project {
  id: string;
  name: string;
  org_id: string;
  created: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export async function fetchProjectByName(
  _baseUrl: string,
  apiKey: string,
  orgName: string,
  projectName: string
): Promise<Project | null> {
  try {
    // Use relative path - will be proxied through serverless function in production
    const url = new URL('/api/v1/project', window.location.origin);

    // Add query parameters for filtering
    url.searchParams.set('project_name', projectName);
    url.searchParams.set('org_name', orgName);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const data = await response.json();

    // The API should return the matching project directly
    const project = data.objects?.[0];

    return project || null;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
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

  // Use proxy endpoint to avoid CORS issues and keep API key secure
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
