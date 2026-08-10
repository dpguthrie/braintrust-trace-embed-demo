# Braintrust Embed Lab

A React + TypeScript demo showing two ways to bring Braintrust observability into an application you already own:

1. Build a completely custom dashboard by sending SQL to Braintrust's `/btql` endpoint.
2. Embed Braintrust's full trace viewer when users need span-level detail.

The central idea is simple: Braintrust stores rich trace data and exposes it through SQL, so your product can present that data in whatever interface best serves its users.

## What the demo includes

- **Custom project monitor** with trace volume, error events, latency, token consumption, estimated cost, and model mix
- **Parallel dashboard execution** using four independent `/btql` requests and `Promise.allSettled`
- **Exact SQL inspection** for the entire dashboard or an individual chart, including the resolved project ID and time window
- **Modern charts** powered by Recharts
- **Isolated panel failures** so one incompatible query does not blank the whole dashboard
- **Trace explorer** that queries recent root spans with SQL and opens the selected trace in an embedded Braintrust iframe
- **Shared configuration** for the dashboard and trace viewer
- **Responsive UI** built with Tailwind CSS

## Stack

- React 19 and TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide icons
- Braintrust SQL via `POST /btql`

## Quick start

Install dependencies:

```bash
pnpm install
```

Optionally create a local `.env` file:

```bash
cp .env.example .env
```

```env
VITE_BRAINTRUST_URL=https://www.braintrust.dev
VITE_BRAINTRUST_ORG=your-org
VITE_BRAINTRUST_PROJECT=your-project
VITE_BRAINTRUST_API_KEY=sk_your_api_key
```

Then start the app:

```bash
pnpm dev
```

Open `http://localhost:5173`. You can also leave `.env` unset and enter the connection details in the UI.

## How the custom dashboard works

The dashboard defines four SQL queries in [`src/dashboard/queries.ts`](src/dashboard/queries.ts):

| Query | Powers | Standard Braintrust fields used |
| --- | --- | --- |
| Workspace summary | KPI cards | `root_span_id`, `is_root`, `metrics.*`, `error`, `estimated_cost()` |
| Traffic & reliability | Trace volume, errors, p95 latency | `date_trunc`, `count_distinct`, `percentile` |
| Token & cost usage | Stacked token chart | `metrics.prompt_tokens`, `metrics.completion_tokens`, `estimated_cost()` |
| Model mix | Model distribution | `metadata.model`, `span_attributes.type` |

When the project or lookback window changes, the queries are rebuilt with the real values. [`src/hooks/useDashboard.ts`](src/hooks/useDashboard.ts) launches all four requests together:

```typescript
const settled = await Promise.allSettled(
  queries.map(async (query) => {
    const rows = await executeSql({
      apiKey,
      query: query.sql,
    });
    return { query, rows };
  }),
);
```

`Promise.allSettled` is deliberate: the requests execute concurrently, but each result keeps its own loading, success, error, and duration state. A project with no `metadata.model`, for example, can still render the other monitor panels.

The client sends standard SQL in the request body:

```typescript
await fetch('/api/btql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query, fmt: 'json' }),
});
```

The Vite development proxy and Vercel function relay that request to `https://api.braintrust.dev/btql` to avoid browser CORS restrictions.

## Example SQL

The traffic chart is built from an ordinary SQL query:

```sql
SELECT
  date_trunc('day', created) AS bucket,
  count_distinct(root_span_id) AS trace_count,
  sum(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS error_count,
  percentile(CASE WHEN is_root THEN metrics.duration ELSE NULL END, 0.95) AS p95_duration
FROM project_logs('<PROJECT_ID>', shape => 'spans')
WHERE created >= NOW() - INTERVAL 30 DAY
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC
```

Open **View 4 SQL queries** in the app—or the **SQL** button on any panel—to see exactly what was sent to Braintrust and copy it into the Braintrust SQL sandbox.

Braintrust recommends SQL syntax for new queries. The API path remains `/btql` for compatibility, but the query language in this demo is SQL, not the legacy pipe-delimited BTQL syntax.

## How the trace viewer works

The trace explorer first fetches recent root spans:

```sql
SELECT *
FROM project_logs('<PROJECT_ID>')
WHERE created >= NOW() - INTERVAL 30 DAY
  AND is_root
ORDER BY _pagination_key DESC
LIMIT 50
```

Selecting a row builds a Braintrust trace URL with the project and root span IDs, then renders it through the reusable [`TraceViewer`](src/components/TraceViewer.tsx) iframe component. The side panel can be resized, expanded, reloaded, and closed without leaving the host application.

## Architecture

```text
Browser
  ├── Custom dashboard
  │     ├── 4 SQL queries start in parallel
  │     ├── POST /api/btql
  │     └── Recharts renders returned JSON rows
  │
  └── Trace explorer
        ├── SQL query fetches recent root spans
        ├── User selects a trace
        └── Braintrust trace viewer opens in an iframe

Same-origin relay
  └── POST https://api.braintrust.dev/btql
```

## Project structure

```text
src/
├── api/braintrust.ts              # Project lookup, SQL execution, recent logs
├── components/
│   ├── Dashboard.tsx              # KPI cards and Recharts visualizations
│   ├── SqlInspector.tsx           # Exact-query modal and copy action
│   ├── LogsTable.tsx              # Recent root-span browser
│   └── TraceViewer.tsx            # Reusable Braintrust iframe
├── dashboard/queries.ts           # Dashboard SQL and panel metadata
├── hooks/
│   ├── useDashboard.ts            # Parallel query orchestration
│   └── useLogs.ts                 # Trace-list query lifecycle
├── App.tsx                        # Shared configuration and app shell
└── types.ts                       # API, dashboard, and trace types

api/
├── btql.js                        # Vercel relay for SQL requests
└── v1/project.js                  # Vercel relay for project lookup
```

## Security notes

This repository is an interactive demo, so it accepts an API key in the browser and passes that key to the same-origin relay and embedded trace URL. The demo does not persist the key.

For a production application:

- Keep Braintrust credentials on your server and derive access from your application's authenticated user.
- Authorize which projects and queries each user can access.
- Prefer narrowly scoped or temporary credentials for iframe access.
- Add rate limits, request-size limits, audit logging, and an allowlist if users can provide arbitrary SQL.
- Select the correct Braintrust API base URL for your organization's data-plane region.

## Validation

```bash
pnpm type-check
pnpm lint
pnpm build
```

## Learn more

- [Braintrust SQL reference](https://www.braintrust.dev/docs/reference/sql)
- [Query by SQL API](https://www.braintrust.dev/docs/api-reference/query)
- [Braintrust documentation](https://www.braintrust.dev/docs)
