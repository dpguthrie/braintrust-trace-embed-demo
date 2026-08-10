import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Blocks,
  Braces,
  ChartNoAxesColumn,
  CircleAlert,
  DollarSign,
  Gauge,
  Hexagon,
  MessageCircle,
  RefreshCw,
  Timer,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboard } from '../hooks/useDashboard';
import type {
  DashboardQuery,
  DashboardQueryResult,
  MonitorRow,
} from '../types';
import SqlInspector from './SqlInspector';

interface DashboardProps {
  apiKey: string;
  projectId: string;
  projectName: string;
  daysBack: number;
}

type MonitorKey = DashboardQuery['key'];
type ChartPoint = { bucket: string; [key: string]: string | number };
type SeriesItem = { key: string; name: string; color: string; value: number };

const PALETTE = [
  '#8b5cf6',
  '#3425e8',
  '#f29345',
  '#9f2caf',
  '#5b74f9',
  '#83c735',
  '#ef762f',
  '#14a79b',
];
const AXIS_STYLE = { fontSize: 11, fill: '#777b86' };
const GRID_COLOR = '#eceef2';

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function integer(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function cost(value: number): string {
  if (value > 0 && value < 0.01) return `$${value.toFixed(4)}`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function duration(value: number): string {
  if (value > 0 && value < 1) return `${Math.round(value * 1000)}ms`;
  return `${value.toFixed(value < 10 ? 1 : 0)}s`;
}

function percent(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

function bucketLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
}

function total(rows: MonitorRow[], key: keyof MonitorRow): number {
  return rows.reduce((sum, row) => sum + numberValue(row[key]), 0);
}

function mean(rows: MonitorRow[], key: keyof MonitorRow): number {
  const values = rows.map((row) => numberValue(row[key])).filter((value) => value > 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function buildDynamicSeries(
  rows: MonitorRow[],
  nameKey: 'model' | 'score' | 'tool',
  valueKey: keyof MonitorRow,
  aggregate: 'sum' | 'mean' = 'sum',
  label?: (row: MonitorRow) => string,
): { data: ChartPoint[]; series: SeriesItem[] } {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const name = label?.(row) || String(row[nameKey] || 'Unknown');
    const values = grouped.get(name) || [];
    values.push(numberValue(row[valueKey]));
    grouped.set(name, values);
  }

  const ranked = [...grouped.entries()]
    .map(([name, values]) => ({
      name,
      value:
        aggregate === 'mean'
          ? values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
          : values.reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((item, index) => ({
      ...item,
      key: `series_${index}`,
      color: PALETTE[index % PALETTE.length],
    }));

  const keyByName = new Map(ranked.map((item) => [item.name, item.key]));
  const points = new Map<string, ChartPoint>();
  for (const row of rows) {
    const bucket = String(row.bucket || '');
    const name = label?.(row) || String(row[nameKey] || 'Unknown');
    const seriesKey = keyByName.get(name);
    if (!bucket || !seriesKey) continue;
    const point = points.get(bucket) || { bucket };
    point[seriesKey] = numberValue(point[seriesKey]) + numberValue(row[valueKey]);
    points.set(bucket, point);
  }

  for (const point of points.values()) {
    for (const item of ranked) {
      if (point[item.key] === undefined) point[item.key] = 0;
    }
  }

  return {
    data: [...points.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    series: ranked,
  };
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
  const [sqlKey, setSqlKey] = useState<MonitorKey | 'all' | null>(null);

  const spans = useMemo(
    () =>
      results.spans.rows.map((row) => ({
        bucket: String(row.bucket || ''),
        other: numberValue(row.other_spans),
        llm: numberValue(row.llm_calls),
        tool: numberValue(row.tool_calls),
      })),
    [results.spans.rows],
  );
  const latency = useMemo(
    () =>
      results.latency.rows.map((row) => ({
        bucket: String(row.bucket || ''),
        p95: numberValue(row.p95_duration),
        p50: numberValue(row.p50_duration),
      })),
    [results.latency.rows],
  );
  const llmCost = useMemo(
    () =>
      results.cost.rows.map((row) => ({
        bucket: String(row.bucket || ''),
        uncached: numberValue(row.prompt_uncached_cost),
        completion: numberValue(row.completion_cost),
        cached: numberValue(row.prompt_cached_cost),
        cacheWrite: numberValue(row.cache_write_cost),
      })),
    [results.cost.rows],
  );
  const tokens = useMemo(
    () =>
      results.tokens.rows.map((row) => ({
        bucket: String(row.bucket || ''),
        uncached: numberValue(row.prompt_uncached_tokens),
        cached: numberValue(row.prompt_cached_tokens),
        completion: numberValue(row.completion_tokens),
      })),
    [results.tokens.rows],
  );
  const modelCost = useMemo(
    () =>
      buildDynamicSeries(
        results.costByModel.rows,
        'model',
        'total_cost',
        'sum',
        (row) => String(row.model || row.provider || 'Unknown'),
      ),
    [results.costByModel.rows],
  );
  const scores = useMemo(() => {
    const normalized = results.scores.rows.map((row) => ({
      ...row,
      avg_score: numberValue(row.avg_score) * 100,
    }));
    return buildDynamicSeries(normalized, 'score', 'avg_score', 'mean');
  }, [results.scores.rows]);
  const toolExecutions = useMemo(
    () => buildDynamicSeries(results.toolExecutions.rows, 'tool', 'executions'),
    [results.toolExecutions.rows],
  );
  const toolErrors = useMemo(
    () => buildDynamicSeries(results.toolErrors.rows, 'tool', 'error_rate', 'mean'),
    [results.toolErrors.rows],
  );
  const toolDuration = useMemo(
    () => buildDynamicSeries(results.toolDuration.rows, 'tool', 'p50_tool_duration', 'mean'),
    [results.toolDuration.rows],
  );

  if (!params) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Activity className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-slate-900">Connect a Braintrust project</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          The custom Monitor recreation runs nine standard SQL queries in parallel across
          spans, latency, cost, tokens, scores, and tool behavior.
        </p>
        <button
          type="button"
          onClick={() => setSqlKey('all')}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-violet-300 hover:text-violet-700"
        >
          <Braces className="h-4 w-4" /> Preview the SQL
        </button>
        {sqlKey && <SqlInspector queries={queries} onClose={() => setSqlKey(null)} />}
      </div>
    );
  }

  const openSql = (key: MonitorKey) => setSqlKey(key);
  const spanLegend: SeriesItem[] = [
    { key: 'other', name: 'Other spans', color: '#8b5cf6', value: total(results.spans.rows, 'other_spans') },
    { key: 'llm', name: 'LLM calls', color: '#3425e8', value: total(results.spans.rows, 'llm_calls') },
    { key: 'tool', name: 'Tool calls', color: '#f29345', value: total(results.spans.rows, 'tool_calls') },
  ];
  const costLegend: SeriesItem[] = [
    { key: 'uncached', name: 'Cost (Prompt uncached)', color: '#f29345', value: total(results.cost.rows, 'prompt_uncached_cost') },
    { key: 'completion', name: 'Cost (Completion)', color: '#3425e8', value: total(results.cost.rows, 'completion_cost') },
    { key: 'cached', name: 'Cost (Prompt cache read)', color: '#8b5cf6', value: total(results.cost.rows, 'prompt_cached_cost') },
    { key: 'cacheWrite', name: 'Cost (Cache write)', color: '#9f2caf', value: total(results.cost.rows, 'cache_write_cost') },
  ].filter((item) => item.value > 0);
  const tokenLegend: SeriesItem[] = [
    { key: 'uncached', name: 'Prompt (uncached)', color: '#f29345', value: total(results.tokens.rows, 'prompt_uncached_tokens') },
    { key: 'cached', name: 'Prompt (cache read)', color: '#8b5cf6', value: total(results.tokens.rows, 'prompt_cached_tokens') },
    { key: 'completion', name: 'Completion', color: '#3425e8', value: total(results.tokens.rows, 'completion_tokens') },
  ];

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live project data · {daysBack}-day window
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {projectName || 'Project'} · All data
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            A custom application recreation of Braintrust’s built-in Monitor view.
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
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-violet-300 hover:text-violet-700"
          >
            <Braces className="h-4 w-4" /> View 9 SQL queries
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MonitorCard title="Spans" icon={<MessageCircle />} result={results.spans} onSql={() => openSql('spans')} empty={spans.length === 0} legend={<Legend totalLabel="Total" totalValue={spanLegend.reduce((sum, item) => sum + item.value, 0)} series={spanLegend} format={integer} />}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spans} margin={{ top: 12, right: 6, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickFormatter={compactNumber} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value, name) => [integer(Number(value)), name]} />
              <Bar dataKey="other" name="Other spans" stackId="spans" fill="#8b5cf6" />
              <Bar dataKey="llm" name="LLM calls" stackId="spans" fill="#3425e8" />
              <Bar dataKey="tool" name="Tool calls" stackId="spans" fill="#f29345" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MonitorCard>

        <MonitorCard title="Latency" icon={<Gauge />} result={results.latency} onSql={() => openSql('latency')} empty={latency.length === 0} legend={<Legend series={[
          { key: 'p95', name: 'P95', color: '#ef762f', value: mean(results.latency.rows, 'p95_duration') },
          { key: 'p50', name: 'P50', color: '#5b74f9', value: mean(results.latency.rows, 'p50_duration') },
        ]} format={duration} />}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latency} margin={{ top: 12, right: 6, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickFormatter={(value) => duration(Number(value))} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value, name) => [duration(Number(value)), name]} />
              <Line type="monotone" dataKey="p95" name="P95" stroke="#ef762f" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="p50" name="P50" stroke="#5b74f9" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </MonitorCard>

        <MonitorCard title="Total LLM cost" icon={<DollarSign />} result={results.cost} onSql={() => openSql('cost')} empty={llmCost.length === 0} legend={<Legend totalLabel="Total" totalValue={costLegend.reduce((sum, item) => sum + item.value, 0)} series={costLegend} format={cost} maxVisible={4} />}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={llmCost} margin={{ top: 12, right: 6, left: -4, bottom: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickFormatter={(value) => cost(Number(value))} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value, name) => [cost(Number(value)), name]} />
              <Bar dataKey="uncached" name="Prompt uncached" stackId="cost" fill="#f29345" />
              <Bar dataKey="completion" name="Completion" stackId="cost" fill="#3425e8" />
              <Bar dataKey="cached" name="Prompt cache read" stackId="cost" fill="#8b5cf6" />
              <Bar dataKey="cacheWrite" name="Cache write" stackId="cost" fill="#9f2caf" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MonitorCard>

        <MonitorCard title="Total LLM cost by model" icon={<ChartNoAxesColumn />} result={results.costByModel} onSql={() => openSql('costByModel')} empty={modelCost.data.length === 0} legend={<Legend totalLabel="Total (Model / Provider)" totalValue={modelCost.series.reduce((sum, item) => sum + item.value, 0)} series={modelCost.series} format={cost} />}>
          <DynamicBarChart data={modelCost.data} series={modelCost.series} format={cost} />
        </MonitorCard>

        <MonitorCard title="Token count" icon={<Blocks />} result={results.tokens} onSql={() => openSql('tokens')} empty={tokens.length === 0} legend={<Legend totalLabel="Total" totalValue={tokenLegend.reduce((sum, item) => sum + item.value, 0)} series={tokenLegend} format={integer} />}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tokens} margin={{ top: 12, right: 6, left: -4, bottom: 0 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickFormatter={compactNumber} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value, name) => [integer(Number(value)), name]} />
              <Bar dataKey="uncached" name="Prompt uncached" stackId="tokens" fill="#f29345" />
              <Bar dataKey="cached" name="Prompt cache read" stackId="tokens" fill="#8b5cf6" />
              <Bar dataKey="completion" name="Completion" stackId="tokens" fill="#3425e8" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MonitorCard>

        <MonitorCard title="Scores" icon={<span className="text-xl font-medium">%</span>} result={results.scores} onSql={() => openSql('scores')} empty={scores.data.length === 0} legend={<Legend series={scores.series} format={percent} />}>
          <DynamicLineChart data={scores.data} series={scores.series} format={percent} domain={[0, 100]} />
        </MonitorCard>

        <MonitorCard title="Tool executions" icon={<Hexagon />} result={results.toolExecutions} onSql={() => openSql('toolExecutions')} empty={toolExecutions.data.length === 0} legend={<Legend totalLabel="Total" totalValue={toolExecutions.series.reduce((sum, item) => sum + item.value, 0)} series={toolExecutions.series} format={integer} />}>
          <DynamicBarChart data={toolExecutions.data} series={toolExecutions.series} format={integer} />
        </MonitorCard>

        <MonitorCard title="Tool error rate" icon={<CircleAlert />} result={results.toolErrors} onSql={() => openSql('toolErrors')} empty={toolErrors.data.length === 0} legend={<Legend series={toolErrors.series} format={percent} />}>
          <DynamicLineChart data={toolErrors.data} series={toolErrors.series} format={percent} />
        </MonitorCard>

        <MonitorCard title="Tool duration (p50)" icon={<Timer />} result={results.toolDuration} onSql={() => openSql('toolDuration')} empty={toolDuration.data.length === 0} legend={<Legend series={toolDuration.series} format={duration} />}>
          <DynamicLineChart data={toolDuration.data} series={toolDuration.series} format={duration} />
        </MonitorCard>
      </div>

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

function MonitorCard({
  title,
  icon,
  result,
  onSql,
  empty,
  children,
  legend,
}: {
  title: string;
  icon: ReactNode;
  result: DashboardQueryResult;
  onSql: () => void;
  empty: boolean;
  children: ReactNode;
  legend: ReactNode;
}) {
  return (
    <section className="flex min-h-[470px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h3 className="flex items-center gap-2.5 text-base font-medium text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center text-slate-900 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {result.durationMs !== undefined && (
            <span className="hidden text-[10px] text-slate-400 lg:inline">{result.durationMs}ms</span>
          )}
          <button type="button" onClick={onSql} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-violet-700">
            <Braces className="h-3 w-3" /> SQL
          </button>
        </div>
      </div>
      <div className="h-[270px] px-3 pt-2">
        <ChartState result={result} empty={empty}>{children}</ChartState>
      </div>
      <div className="mt-auto px-5 pb-5 pt-2">
        {result.status !== 'error' && !empty ? legend : null}
      </div>
    </section>
  );
}

function Legend({
  series,
  format,
  totalLabel,
  totalValue,
  maxVisible = 3,
}: {
  series: SeriesItem[];
  format: (value: number) => string;
  totalLabel?: string;
  totalValue?: number;
  maxVisible?: number;
}) {
  const visible = series.slice(0, maxVisible);
  return (
    <div className="space-y-2.5 text-sm">
      {totalLabel && totalValue !== undefined && (
        <div className="flex items-center justify-between gap-3 font-medium text-slate-900">
          <span className="flex min-w-0 items-center gap-2.5"><span className="h-2.5 w-2.5 shrink-0 bg-slate-500" /> <span className="truncate">{totalLabel}</span></span>
          <span className="shrink-0 tabular-nums">{format(totalValue)}</span>
        </div>
      )}
      {visible.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-3 text-slate-700">
          <span className="flex min-w-0 items-center gap-2.5"><span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: item.color }} /> <span className="truncate">{item.name}</span></span>
          <span className="shrink-0 font-medium tabular-nums text-slate-900">{format(item.value)}</span>
        </div>
      ))}
      {series.length > maxVisible && <p className="pl-5 text-xs text-slate-400">{series.length - maxVisible} more</p>}
    </div>
  );
}

function DynamicBarChart({ data, series, format }: { data: ChartPoint[]; series: SeriesItem[]; format: (value: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 6, left: -4, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickFormatter={(value) => compactNumber(Number(value))} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value, name) => [format(Number(value)), name]} />
        {series.map((item, index) => (
          <Bar key={item.key} dataKey={item.key} name={item.name} stackId="dynamic" fill={item.color} radius={index === series.length - 1 ? [2, 2, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function DynamicLineChart({ data, series, format, domain }: { data: ChartPoint[]; series: SeriesItem[]; format: (value: number) => string; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 6, left: -4, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={bucketLabel} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis domain={domain} tickFormatter={(value) => format(Number(value))} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <Tooltip labelFormatter={(value) => bucketLabel(String(value))} formatter={(value, name) => [format(Number(value)), name]} />
        {series.map((item) => (
          <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={2.4} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartState({ result, empty, children }: { result: DashboardQueryResult; empty: boolean; children: ReactNode }) {
  if (result.status === 'loading' && result.rows.length === 0) {
    return <div className="h-full animate-pulse rounded-xl bg-slate-50" />;
  }
  if (result.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl bg-rose-50 px-6 text-center">
        <CircleAlert className="h-5 w-5 text-rose-500" />
        <p className="mt-2 text-sm font-medium text-rose-800">This Monitor query failed</p>
        <p className="mt-1 line-clamp-3 max-w-md text-xs leading-5 text-rose-600">{result.error}</p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <ChartNoAxesColumn className="h-5 w-5 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-600">No data in this window</p>
        <p className="mt-1 text-xs text-slate-400">This chart will populate when matching spans arrive.</p>
      </div>
    );
  }
  return <>{children}</>;
}
