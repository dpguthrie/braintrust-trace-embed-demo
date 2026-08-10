# Braintrust Embed Lab

A React + TypeScript demo showing two ways to bring Braintrust observability into an application you already own:

1. Build a completely custom dashboard by sending SQL to Braintrust's `/btql` endpoint.
2. Embed Braintrust's full trace viewer when users need span-level detail.

The central idea is simple: Braintrust stores rich trace data and exposes it through SQL, so your product can present that data in whatever interface best serves its users.

## What the demo includes

- **Custom recreation of Braintrust's built-in Monitor view** with spans, latency, LLM cost, tokens, scores, and tool analytics
- **Parallel dashboard execution** using nine independent `/btql` requests and `Promise.allSettled`
- **Exact SQL inspection** for the entire dashboard or an individual chart, including the resolved project ID and time window
- **Modern charts** powered by Recharts
- **Isolated panel failures** so one incompatible query does not blank the whole dashboard
- **Trace explorer** that queries recent root spans with SQL and opens the selected trace in an embedded Braintrust iframe
- **API-key discovery** with searchable organization and project selectors shared by both experiences
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
VITE_BRAINTRUST_API_KEY=sk_your_api_key

# Optional preferred organization when the key has access to multiple organizations
VITE_BRAINTRUST_ORG=your-org
```

Then start the app:

```bash
pnpm dev
```

Open `http://localhost:5173`. You can also leave `.env` unset, enter only an API key in the UI, and choose from the organizations and projects that key can access.

## How project discovery works

The app follows the same API-key discovery pattern as Braintrust's CLI:

1. `POST /api/apikey/login` returns the organizations available to the credential, including each organization ID and API URL.
2. `GET /v1/project` returns every project the credential can read, including its `org_id`.
3. The app launches both requests together, joins projects to organizations by `org_id`, and populates searchable selectors.

If the key is scoped to one organization, that organization is selected automatically. Project selection is always explicit: the dashboard does not issue SQL until the user chooses a project by name or ID.

## How the custom dashboard works

The dashboard defines nine SQL queries in [`src/dashboard/queries.ts`](src/dashboard/queries.ts). They reproduce the metric families in Braintrust's built-in **All data** Monitor view:

| Query | Powers | Standard Braintrust fields used |
| --- | --- | --- |
| Spans | Other spans, LLM calls, and tool calls | `span_attributes.type`, `count` |
| Latency | Daily p50 and p95 root-span duration | `metrics.end - metrics.start`, `percentile` |
| Total LLM cost | Prompt/cache/completion cost breakdown | `estimated_cost_component()` |
| Cost by model | Daily model/provider spend | `estimated_cost()`, `metadata.model`, `metadata.provider` |
| Token count | Uncached, cache-read, and completion tokens | `metrics.*_tokens` |
| Scores | Every project score as a trend line | `UNPIVOT(scores)`, `avg` |
| Tool executions | Tool-call volume by name | `span_attributes.type`, `span_attributes.name` |
| Tool error rate | Error percentage by tool | `error`, conditional aggregation |
| Tool duration | Median duration by tool | `percentile(metrics.duration, 0.5)` |

When the project or lookback window changes, the queries are rebuilt with the real values. [`src/hooks/useDashboard.ts`](src/hooks/useDashboard.ts) launches all nine requests together:

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

`Promise.allSettled` is deliberate: the requests execute concurrently, but each result keeps its own loading, success, error, and duration state. A project without scores or tool spans, for example, can still render the rest of the Monitor.

Like Braintrust's built-in Spans, Latency, LLM cost, and Token presets, these queries exclude internal spans created by online scorers:

```sql
span_attributes.purpose IS NULL
OR span_attributes.purpose != 'scorer'
```

The score query uses `UNPIVOT` to discover arbitrary score keys at runtime, so the chart is not tied to names such as `Response Quality` or `Routing Accuracy`.

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

The latency chart is built from an ordinary SQL query:

```sql
SELECT
  date_trunc('day', created) AS bucket,
  percentile(CASE WHEN is_root THEN metrics.end - metrics.start ELSE NULL END, 0.50) AS p50_duration,
  percentile(CASE WHEN is_root THEN metrics.end - metrics.start ELSE NULL END, 0.95) AS p95_duration
FROM project_logs('<PROJECT_ID>', shape => 'spans')
WHERE created >= NOW() - INTERVAL 30 DAY
  AND (span_attributes.purpose IS NULL OR span_attributes.purpose != 'scorer')
GROUP BY date_trunc('day', created)
ORDER BY bucket ASC
```

Open **View 9 SQL queries** in the app—or the **SQL** button on any panel—to see exactly what was sent to Braintrust and copy it into the Braintrust SQL sandbox.

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
  ├── Connection discovery
  │     ├── POST /api/apikey/login
  │     ├── GET /api/v1/project (in parallel)
  │     └── Searchable organization and project selectors
  │
  ├── Custom dashboard
  │     ├── 9 SQL queries start in parallel
  │     ├── POST /api/btql
  │     └── Recharts renders returned JSON rows
  │
  └── Trace explorer
        ├── SQL query fetches recent root spans
        ├── User selects a trace
        └── Braintrust trace viewer opens in an iframe

Same-origin relay
  ├── POST https://www.braintrust.dev/api/apikey/login
  ├── GET https://api.braintrust.dev/v1/project
  └── POST https://api.braintrust.dev/btql
```

## Project structure

```text
src/
├── api/braintrust.ts              # Access discovery, SQL execution, recent logs
├── components/
│   ├── Dashboard.tsx              # Monitor-style Recharts visualizations
│   ├── SearchableSelect.tsx       # Accessible combobox used for orgs/projects
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
├── apikey/login.js                # Vercel relay for API-key organization discovery
├── btql.js                        # Vercel relay for SQL requests
└── v1/project.js                  # Vercel relay for accessible project discovery
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
