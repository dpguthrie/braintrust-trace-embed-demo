import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Braces,
  Clock3,
  Coins,
  DatabaseZap,
  RefreshCw,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import type {
  DashboardQuery,
  DashboardQueryResult,
  ModelRow,
  OverviewRow,
  TrafficRow,
  UsageRow,
} from '../types';
import SqlInspector from './SqlInspector';

interface DashboardProps {
  apiKey: string;
  projectId: string;
  projectName: string;
  daysBack: number;
}

const CHART_COLORS = ['#6d5dfc', '#26b6a6', '#f59e0b', '#ef667d', '#43a6f5', '#a78bfa'];
const AXIS_STYLE = { fontSize: 11, fill: '#7b8497' };

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCost(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0 ms';
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
}

function bucketLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Dashboard({
  apiKey,
  projectId,
  projectName,
  daysBack,
}: DashboardProps) {
  const params = useMemo(
    () => (apiKey && projectId ? { apiKey, projectId, daysBack } : null),
    [apiKey, daysBack, projectId],
  );
  const { queries, results, lastUpdated, run, loading } = useDashboard(params);
  const [sqlKey, setSqlKey] = useState<DashboardQuery['key'] | 'all' | null>(null);

  const overview = (results.overview.rows[0] || {}) as OverviewRow;
  const traffic = useMemo(
    () =>
      (results.traffic.rows as TrafficRow[]).map((row) => ({
        bucket: row.bucket || '',
        traces: numberValue(row.trace_count),
        errors: numberValue(row.error_count),
        p95: numberValue(row.p95_duration),
      })),
    [results.traffic.rows],
  );
  const usage = useMemo(
    () =>
      (results.usage.rows as UsageRow[]).map((row) => ({
        bucket: row.bucket || '',
        prompt: numberValue(row.prompt_tokens),
        completion: numberValue(row.completion_tokens),
        total: numberValue(row.total_tokens),
        cost: numberValue(row.estimated_cost),
      })),
    [results.usage.rows],
  );
  const models = useMemo(
    () =>
      (results.models.rows as ModelRow[]).map((row, index) => ({
        name: row.model || 'Unknown',
        calls: numberValue(row.calls),
        tokens: numberValue(row.total_tokens),
        cost: numberValue(row.estimated_cost),
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [results.models.rows],
  );

  const openSql = (key: DashboardQuery['key']) => setSqlKey(key);

  if (!params) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <DatabaseZap className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-slate-900">Connect a Braintrust project</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Add your organization, project, and API key above. This dashboard will run four
          standard SQL queries in parallel and turn the results into an embedded monitor.
        </p>
        <button
          type="button"
          onClick={() => setSqlKey('all')}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-violet-300 hover:text-violet-700"
        >
          <Braces className="h-4 w-4" /> Preview the SQL
        </button>
        {sqlKey && (
          <SqlInspector queries={queries} onClose={() => setSqlKey(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live project data
              </span>
              <span className="text-xs text-slate-400">{daysBack}-day window</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              {projectName || 'Project'} monitor
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              A custom observability surface composed entirely from Braintrust SQL results.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated && (
              <span className="hidden text-xs text-slate-400 sm:inline">
                Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSqlKey('all')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
            >
              <Braces className="h-4 w-4" /> View 4 SQL queries
            </button>
            <button
              type="button"
              onClick={() => void run()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
        <div className="grid border-t border-slate-100 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Traces"
            value={compactNumber(numberValue(overview.trace_count))}
            detail={`${compactNumber(numberValue(overview.llm_calls))} LLM calls`}
            icon={<Activity className="h-4 w-4" />}
            accent="violet"
            result={results.overview}
          />
          <MetricCard
            label="Error events"
            value={compactNumber(numberValue(overview.error_count))}
            detail={
              numberValue(overview.trace_count)
                ? `${((numberValue(overview.error_count) / numberValue(overview.trace_count)) * 100).toFixed(1)} per 100 traces`
                : 'Across all spans'
            }
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="rose"
            result={results.overview}
          />
          <MetricCard
            label="Average duration"
            value={formatDuration(numberValue(overview.avg_duration))}
            detail={`p95 ${formatDuration(numberValue(overview.p95_duration))}`}
            icon={<Timer className="h-4 w-4" />}
            accent="amber"
            result={results.overview}
          />
          <MetricCard
            label="Estimated cost"
            value={formatCost(numberValue(overview.estimated_cost))}
            detail={`${compactNumber(numberValue(overview.total_tokens))} tokens`}
            icon={<Coins className="h-4 w-4" />}
            accent="teal"
            result={results.overview}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Trace volume"
          subtitle="Distinct traces and error events per day"
          icon={<Activity className="h-4 w-4" />}
          result={results.traffic}
          onSql={() => openSql('traffic')}
        >
          <ChartState result={results.traffic} empty={traffic.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={traffic} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="traceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6d5dfc" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#6d5dfc" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef0f4" vertical={false} />
                <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip labelFormatter={(value) => bucketLabel(String(value))} />
                <Area type="monotone" dataKey="traces" name="Traces" stroke="#6d5dfc" strokeWidth={2.5} fill="url(#traceFill)" />
                <Line type="monotone" dataKey="errors" name="Errors" stroke="#ef667d" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartState>
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="p95 trace duration"
          subtitle="Root-span wall-clock latency by day"
          icon={<Clock3 className="h-4 w-4" />}
          result={results.traffic}
          onSql={() => openSql('traffic')}
        >
          <ChartState result={results.traffic} empty={traffic.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={traffic} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef0f4" vertical={false} />
                <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => formatDuration(Number(value))} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value) => [formatDuration(Number(value)), 'p95 duration']} />
                <Area type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2.5} fill="url(#latencyFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartState>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Token consumption"
          subtitle="Prompt and completion tokens on LLM spans"
          icon={<Sparkles className="h-4 w-4" />}
          result={results.usage}
          onSql={() => openSql('usage')}
        >
          <ChartState result={results.usage} empty={usage.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#eef0f4" vertical={false} />
                <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => compactNumber(Number(value))} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value, name) => [compactNumber(Number(value)), name]} />
                <Bar dataKey="prompt" name="Prompt tokens" stackId="tokens" fill="#6d5dfc" radius={[0, 0, 3, 3]} />
                <Bar dataKey="completion" name="Completion tokens" stackId="tokens" fill="#26b6a6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartState>
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="Model mix"
          subtitle="Share of LLM calls by model"
          icon={<Bot className="h-4 w-4" />}
          result={results.models}
          onSql={() => openSql('models')}
        >
          <ChartState result={results.models} empty={models.length === 0}>
            <div className="flex h-full flex-col sm:flex-row sm:items-center">
              <div className="h-40 min-w-0 flex-1 sm:h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={models} dataKey="calls" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="none">
                      {models.map((model) => <Cell key={model.name} fill={model.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [compactNumber(Number(value)), 'Calls']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-2 pb-1 sm:pl-2">
                {models.slice(0, 5).map((model) => (
                  <div key={model.name} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-slate-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: model.color }} />
                      <span className="truncate">{model.name}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">{compactNumber(model.calls)}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartState>
        </Panel>
      </div>

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-teal-50 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-white p-2 text-violet-600 shadow-sm ring-1 ring-violet-100">
              <DatabaseZap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Your data, your interface</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Every metric above came from ordinary SQL over the Braintrust API. Change a
                query, add your own metadata or scores, and this becomes a dashboard tailored
                to your product and your users.
              </p>
            </div>
          </div>
          <a
            href="https://www.braintrust.dev/docs/reference/sql"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900"
          >
            Braintrust SQL reference <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {sqlKey && (
        <SqlInspector
          queries={queries}
          initialKey={sqlKey === 'all' ? undefined : sqlKey}
          onClose={() => setSqlKey(null)}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  accent,
  result,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  accent: 'violet' | 'rose' | 'amber' | 'teal';
  result: DashboardQueryResult;
}) {
  const accentClasses = {
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    teal: 'bg-teal-50 text-teal-600',
  };
  return (
    <div className="border-b border-slate-100 p-5 last:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`rounded-lg p-2 ${accentClasses[accent]}`}>{icon}</span>
      </div>
      <div className="mt-3 flex min-h-9 items-center">
        {result.status === 'loading' && result.rows.length === 0 ? (
          <div className="h-7 w-24 animate-pulse rounded bg-slate-100" />
        ) : result.status === 'error' ? (
          <span className="text-sm font-medium text-rose-600">Query failed</span>
        ) : (
          <span className="text-3xl font-semibold tracking-tight text-slate-950">{value}</span>
        )}
      </div>
      <p className="mt-1 truncate text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  result,
  onSql,
  children,
  className = '',
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  result: DashboardQueryResult;
  onSql: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="text-violet-600">{icon}</span> {title}
          </h3>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {result.durationMs !== undefined && (
            <span className="hidden rounded-full bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-400 sm:inline">
              {result.durationMs} ms
            </span>
          )}
          <button
            type="button"
            onClick={onSql}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
          >
            <Braces className="h-3 w-3" /> SQL
          </button>
        </div>
      </div>
      <div className="h-[280px] px-4 pb-4 pt-2">{children}</div>
    </section>
  );
}

function ChartState({
  result,
  empty,
  children,
}: {
  result: DashboardQueryResult;
  empty: boolean;
  children: ReactNode;
}) {
  if (result.status === 'loading' && result.rows.length === 0) {
    return <div className="h-full animate-pulse rounded-xl bg-slate-50" />;
  }
  if (result.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl bg-rose-50 px-6 text-center">
        <AlertTriangle className="h-5 w-5 text-rose-500" />
        <p className="mt-2 text-sm font-medium text-rose-800">This panel query failed</p>
        <p className="mt-1 line-clamp-3 max-w-md text-xs leading-5 text-rose-600">{result.error}</p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl bg-slate-50 text-center">
        <DatabaseZap className="h-5 w-5 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-600">No data in this window</p>
        <p className="mt-1 text-xs text-slate-400">Try a longer lookback period.</p>
      </div>
    );
  }
  return <>{children}</>;
}
