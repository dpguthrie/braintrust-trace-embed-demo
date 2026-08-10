import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  ChevronDown,
  Code2,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  PanelRightClose,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { fetchProjectByName } from './api/braintrust';
import LogsTable from './components/LogsTable';
import TraceViewer, { type TraceViewerRef } from './components/TraceViewer';
import { useLogs } from './hooks/useLogs';
import type { LogRecord, TraceConfig } from './types';

type View = 'dashboard' | 'traces';

const Dashboard = lazy(() => import('./components/Dashboard'));

function App() {
  const traceViewerRef = useRef<TraceViewerRef>(null);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [baseConfig, setBaseConfig] = useState({
    baseUrl: import.meta.env.VITE_BRAINTRUST_URL || 'https://www.braintrust.dev',
    org: import.meta.env.VITE_BRAINTRUST_ORG || '',
    projectName: import.meta.env.VITE_BRAINTRUST_PROJECT || '',
    apiKey: import.meta.env.VITE_BRAINTRUST_API_KEY || '',
  });
  const [projectId, setProjectId] = useState('');
  const [resolvingProject, setResolvingProject] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [daysBack, setDaysBack] = useState(30);
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
  const [panelWidth, setPanelWidth] = useState(54);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [toast, setToast] = useState('');

  const canResolve = Boolean(
    baseConfig.baseUrl && baseConfig.apiKey && baseConfig.org && baseConfig.projectName,
  );

  const resolveProject = useCallback(async () => {
    if (!canResolve) {
      setProjectId('');
      return;
    }
    setResolvingProject(true);
    setConnectionError('');
    try {
      const project = await fetchProjectByName(
        baseConfig.baseUrl,
        baseConfig.apiKey,
        decodeURIComponent(baseConfig.org),
        baseConfig.projectName,
      );
      if (!project) {
        setProjectId('');
        setConnectionError(`No project named “${baseConfig.projectName}” was found.`);
        return;
      }
      setProjectId(project.id);
      setIsConfigCollapsed(true);
    } catch (error) {
      setProjectId('');
      setConnectionError(
        error instanceof Error ? error.message : 'Could not connect to Braintrust.',
      );
    } finally {
      setResolvingProject(false);
    }
  }, [baseConfig, canResolve]);

  useEffect(() => {
    if (!canResolve) return;
    const timer = window.setTimeout(() => void resolveProject(), 450);
    return () => window.clearTimeout(timer);
  }, [canResolve, resolveProject]);

  const logsParams = useMemo(() => {
    if (activeView !== 'traces' || !baseConfig.apiKey || !projectId) return null;
    return {
      baseUrl: baseConfig.baseUrl,
      apiKey: baseConfig.apiKey,
      projectId,
      limit: 50,
      daysBack,
    };
  }, [activeView, baseConfig.apiKey, baseConfig.baseUrl, daysBack, projectId]);

  const { logs, loading: logsLoading, error: logsError, refetch: refetchLogs } = useLogs(logsParams);

  const traceConfig: TraceConfig | null = useMemo(() => {
    if (!selectedLog || !projectId) return null;
    return {
      baseUrl: baseConfig.baseUrl,
      org: baseConfig.org,
      project: baseConfig.projectName,
      apiKey: baseConfig.apiKey,
      projectId,
      rootSpanId: selectedLog.root_span_id || selectedLog.id,
    };
  }, [baseConfig, projectId, selectedLog]);

  const traceUrl = useMemo(() => {
    if (!traceConfig) return null;
    const url = new URL(
      `${traceConfig.baseUrl}/app/${encodeURIComponent(traceConfig.org)}/p/${encodeURIComponent(traceConfig.project)}/trace`,
    );
    url.searchParams.set('api_key', '••••••••');
    url.searchParams.set('object_type', 'project_logs');
    url.searchParams.set('object_id', traceConfig.projectId);
    url.searchParams.set('r', traceConfig.rootSpanId);
    return url.toString();
  }, [traceConfig]);

  const traceUrlWithKey = useMemo(() => {
    if (!traceConfig) return null;
    const url = new URL(
      `${traceConfig.baseUrl}/app/${encodeURIComponent(traceConfig.org)}/p/${encodeURIComponent(traceConfig.project)}/trace`,
    );
    url.searchParams.set('api_key', traceConfig.apiKey);
    url.searchParams.set('object_type', 'project_logs');
    url.searchParams.set('object_id', traceConfig.projectId);
    url.searchParams.set('r', traceConfig.rootSpanId);
    return url.toString();
  }, [traceConfig]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };

  const updateConfig = (field: keyof typeof baseConfig, value: string) => {
    setBaseConfig((current) => ({ ...current, [field]: value }));
    if (field === 'projectName' || field === 'org' || field === 'apiKey') {
      setProjectId('');
      setSelectedLog(null);
    }
  };

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isResizing) return;
      const width = ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      if (width >= 34 && width <= 82) setPanelWidth(width);
    },
    [isResizing],
  );

  useEffect(() => {
    if (!isResizing) return;
    const stop = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stop);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stop);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleMouseMove, isResizing]);

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-slate-950 text-white shadow-sm">
              <span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-violet-500" />
              <Sparkles className="relative h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-950">Braintrust Embed Lab</p>
              <p className="hidden text-[11px] text-slate-400 sm:block">Composable observability for your product</p>
            </div>
          </div>
          <a
            href="https://www.braintrust.dev/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-violet-700"
          >
            Braintrust docs <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-violet-200">
              <Code2 className="h-3.5 w-3.5" /> One API, any embedded experience
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-5xl">
              Bring Braintrust observability into the apps you already use.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Embed the full trace viewer when you need every detail. Build a completely custom
              monitor when you need product-native analytics. Braintrust gives you both—and the
              dashboard starts with ordinary SQL.
            </p>
          </div>
        </section>

        <section className="relative -mt-4 mx-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg sm:mx-6">
          <button
            type="button"
            onClick={() => setIsConfigCollapsed((collapsed) => !collapsed)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Settings2 className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">Braintrust connection</h2>
                  {projectId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">
                  {projectId ? `${baseConfig.org} / ${baseConfig.projectName}` : 'Choose the project that powers both experiences'}
                </p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${isConfigCollapsed ? '-rotate-90' : ''}`} />
          </button>

          {!isConfigCollapsed && (
            <div className="border-t border-slate-100 px-5 pb-5 pt-4 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <ConfigField label="App URL" className="xl:col-span-1">
                  <input value={baseConfig.baseUrl} onChange={(event) => updateConfig('baseUrl', event.target.value)} placeholder="https://www.braintrust.dev" className="config-input" />
                </ConfigField>
                <ConfigField label="Organization">
                  <input value={baseConfig.org} onChange={(event) => updateConfig('org', event.target.value)} placeholder="acme" className="config-input" />
                </ConfigField>
                <ConfigField label="Project">
                  <input value={baseConfig.projectName} onChange={(event) => updateConfig('projectName', event.target.value)} placeholder="production-agent" className="config-input" />
                </ConfigField>
                <ConfigField label="API key">
                  <input type="password" value={baseConfig.apiKey} onChange={(event) => updateConfig('apiKey', event.target.value)} placeholder="sk-••••••••" className="config-input" />
                </ConfigField>
                <ConfigField label="Lookback">
                  <div className="flex gap-2">
                    <select value={daysBack} onChange={(event) => setDaysBack(Number(event.target.value))} className="config-input">
                      <option value={7}>Last 7 days</option>
                      <option value={14}>Last 14 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={90}>Last 90 days</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void resolveProject()}
                      disabled={!canResolve || resolvingProject}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-violet-600 px-3 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Connect to project"
                    >
                      {resolvingProject ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                    </button>
                  </div>
                </ConfigField>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] leading-5 text-slate-400">
                  Credentials are relayed to Braintrust for this session and are not persisted by the demo.
                </p>
                {connectionError && <p className="text-xs font-medium text-rose-600">{connectionError}</p>}
              </div>
            </div>
          )}
        </section>

        <div className="mt-7 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
          <ViewTab active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} icon={<BarChart3 className="h-4 w-4" />} label="Custom dashboard" />
          <ViewTab active={activeView === 'traces'} onClick={() => setActiveView('traces')} icon={<Search className="h-4 w-4" />} label="Trace explorer" />
        </div>

        <div className="mt-5">
          {activeView === 'dashboard' ? (
            <Suspense fallback={<DashboardFallback />}>
              <Dashboard apiKey={baseConfig.apiKey} projectId={projectId} projectName={baseConfig.projectName} daysBack={daysBack} />
            </Suspense>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">Trace explorer</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Query recent root spans with SQL, then open Braintrust’s trace viewer directly inside this app.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refetchLogs()}
                  disabled={!projectId || logsLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh traces
                </button>
              </div>
              {!projectId ? (
                <div className="px-6 py-20 text-center">
                  <Search className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">Connect a project to browse traces</p>
                  <p className="mt-1 text-xs text-slate-400">The trace viewer uses the same connection as the dashboard.</p>
                </div>
              ) : logsError ? (
                <div className="m-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{logsError.message}</div>
              ) : logsLoading && logs.length === 0 ? (
                <div className="space-y-2 p-5">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-50" />)}</div>
              ) : (
                <div className="max-h-[620px] overflow-auto">
                  <LogsTable logs={logs} onSelectLog={(log) => setSelectedLog(log)} selectedLogId={selectedLog?.id || selectedLog?.root_span_id} />
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {traceConfig && (
        <aside
          className="fixed right-0 top-0 z-50 h-screen border-l border-slate-200 bg-white shadow-2xl"
          style={{ width: isFullscreen ? '100vw' : `${panelWidth}vw` }}
        >
          {!isFullscreen && (
            <button
              type="button"
              onMouseDown={() => setIsResizing(true)}
              className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize transition hover:bg-violet-500/40"
              aria-label="Resize trace viewer"
            />
          )}
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-violet-50 p-1.5 text-violet-600"><Activity className="h-4 w-4" /></span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Embedded trace viewer</h2>
                    <p className="text-[10px] text-slate-400">Rendered by Braintrust</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton label="Reload trace" onClick={() => traceViewerRef.current?.reload()}><RefreshCw className="h-4 w-4" /></IconButton>
                  <IconButton label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => setIsFullscreen((value) => !value)}>
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </IconButton>
                  <IconButton label="Close trace viewer" onClick={() => setSelectedLog(null)}><PanelRightClose className="h-4 w-4" /></IconButton>
                </div>
              </div>
              {traceUrl && traceUrlWithKey && (
                <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2">
                  <code className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{traceUrl}</code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(traceUrlWithKey);
                      showToast('Trace URL copied');
                    }}
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-violet-700"
                    aria-label="Copy trace URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <TraceViewer ref={traceViewerRef} config={traceConfig} />
            </div>
          </div>
        </aside>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white shadow-xl">
          <Copy className="h-3.5 w-3.5" /> {toast}
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss"><X className="h-3 w-3 text-slate-400" /></button>
        </div>
      )}
    </div>
  );
}

function ConfigField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition sm:flex-none ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {icon} {label}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800">
      {children}
    </button>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-5">
      <div className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-[340px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-[340px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}

export default App;
