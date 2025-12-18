import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import TraceViewer, { type TraceViewerRef } from './components/TraceViewer';
import LogsTable from './components/LogsTable';
import { useLogs } from './hooks/useLogs';
import { fetchProjectByName, slugify } from './api/braintrust';
import type { TraceConfig, LogRecord } from './types';

function App() {
  const traceViewerRef = useRef<TraceViewerRef>(null);

  const [baseConfig, setBaseConfig] = useState({
    baseUrl: import.meta.env.VITE_BRAINTRUST_URL || 'https://www.braintrust.dev',
    org: import.meta.env.VITE_BRAINTRUST_ORG || '',
    projectName: import.meta.env.VITE_BRAINTRUST_PROJECT || '',
    apiKey: import.meta.env.VITE_BRAINTRUST_API_KEY || '',
  });

  const [projectId, setProjectId] = useState('');
  const [fetchingProjectId, setFetchingProjectId] = useState(false);
  const [lastFetchedName, setLastFetchedName] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [panelWidth, setPanelWidth] = useState(50); // percentage
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  const [daysBack, setDaysBack] = useState(30);

  // Calculate project slug from project name
  const projectSlug = useMemo(() => slugify(baseConfig.projectName), [baseConfig.projectName]);

  const [status, setStatus] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | null;
  }>({
    message: '',
    type: null,
  });

  const logsParams = useMemo(() => {
    if (!baseConfig.baseUrl || !baseConfig.apiKey || !projectId) {
      return null;
    }

    return {
      baseUrl: baseConfig.baseUrl,
      apiKey: baseConfig.apiKey,
      projectId,
      limit: 50,
      daysBack,
    };
  }, [baseConfig.baseUrl, baseConfig.apiKey, projectId, daysBack]);

  const { logs, loading, error, refetch } = useLogs(logsParams);

  const traceConfig: TraceConfig | null = useMemo(() => {
    if (!selectedLog || !projectId) return null;

    const rootSpanId = selectedLog.root_span_id || selectedLog.id;

    return {
      baseUrl: baseConfig.baseUrl,
      org: baseConfig.org,
      project: projectSlug,
      apiKey: baseConfig.apiKey,
      projectId,
      rootSpanId,
      // objectType defaults to 'project_logs' and objectId defaults to projectId in TraceViewer
    };
  }, [selectedLog, baseConfig, projectId, projectSlug]);

  const showStatus = (message: string, type: 'success' | 'error' | 'info') => {
    setStatus({ message, type });
    setTimeout(() => {
      setStatus({ message: '', type: null });
    }, 5000);
  };

  // Auto-fetch project ID from project name
  useEffect(() => {
    const autoFetchProjectId = async () => {
      if (!baseConfig.baseUrl || !baseConfig.apiKey || !baseConfig.org || !baseConfig.projectName) {
        return;
      }

      // Skip if already fetching or already fetched this project name
      if (fetchingProjectId || lastFetchedName === baseConfig.projectName) {
        return;
      }

      // Mark this project name as attempted
      setLastFetchedName(baseConfig.projectName);
      setFetchingProjectId(true);

      try {
        // Decode org name in case it's URL-encoded from .env
        const decodedOrg = decodeURIComponent(baseConfig.org);

        const project = await fetchProjectByName(
          baseConfig.baseUrl,
          baseConfig.apiKey,
          decodedOrg,
          baseConfig.projectName
        );

        if (project) {
          setProjectId(project.id);
          // Only show success status if user has interacted with the form
          if (hasAttemptedFetch) {
            showStatus(`Auto-detected project ID from name "${baseConfig.projectName}"`, 'success');
          }
        } else {
          console.warn(`Could not find project "${baseConfig.projectName}" in org "${decodedOrg}"`);
          // Don't show error on auto-fetch, user will see it when they click "Fetch Recent Logs"
        }
      } catch (error) {
        console.error('Failed to fetch project ID:', error);
        // Don't show error on auto-fetch, user will see it when they click "Fetch Recent Logs"
      } finally {
        setFetchingProjectId(false);
      }
    };

    autoFetchProjectId();
  }, [baseConfig.baseUrl, baseConfig.apiKey, baseConfig.org, baseConfig.projectName, fetchingProjectId, lastFetchedName, hasAttemptedFetch]);

  const handleFetchLogs = () => {
    setHasAttemptedFetch(true);

    if (!baseConfig.baseUrl || !baseConfig.org || !baseConfig.projectName || !baseConfig.apiKey) {
      showStatus('Please fill in all base configuration fields', 'error');
      return;
    }

    if (!projectId) {
      const decodedOrg = decodeURIComponent(baseConfig.org);
      showStatus(
        `Could not find project "${baseConfig.projectName}" in org "${decodedOrg}". Please check your credentials.`,
        'error'
      );
      return;
    }

    refetch();
  };

  const handleSelectLog = (log: LogRecord) => {
    setSelectedLog(log);
    showStatus('Trace loaded successfully!', 'success');
  };

  const handleInputChange = (
    field: keyof typeof baseConfig,
    value: string
  ) => {
    // If project name changes, reset project ID and last fetched name to allow re-detection
    if (field === 'projectName' && value !== baseConfig.projectName) {
      setProjectId('');
      setLastFetchedName('');
      setHasAttemptedFetch(true); // User is interacting, show feedback
    }
    setBaseConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const windowWidth = window.innerWidth;
      const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;

      // Constrain between 30% and 80%
      if (newWidth >= 30 && newWidth <= 80) {
        setPanelWidth(newWidth);
      }
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Braintrust Trace Viewer Embed Demo
          </h1>
          <p className="text-sm text-gray-600">
            Browse recent logs and click a row to view the trace
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            <strong>Step 1:</strong> Enter your Braintrust credentials, project name, and lookback period. The project ID will be automatically fetched.
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="baseUrl"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Braintrust Instance URL
                </label>
                <input
                  id="baseUrl"
                  type="text"
                  value={baseConfig.baseUrl}
                  onChange={(e) => handleInputChange('baseUrl', e.target.value)}
                  placeholder="https://www.braintrust.dev"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="apiKey"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  API Key
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={baseConfig.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder="sk_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="org" className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <input
                  id="org"
                  type="text"
                  value={baseConfig.org}
                  onChange={(e) => handleInputChange('org', e.target.value)}
                  placeholder="your-org"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                  {fetchingProjectId && (
                    <span className="ml-2 text-xs text-blue-600">Fetching project ID...</span>
                  )}
                  {projectId && !fetchingProjectId && (
                    <span className="ml-2 text-xs text-green-600">✓ Project ID detected</span>
                  )}
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={baseConfig.projectName}
                  onChange={(e) => handleInputChange('projectName', e.target.value)}
                  placeholder="My Project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Slugified to: {projectSlug || '(empty)'}
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="daysBack" className="block text-sm font-medium text-gray-700 mb-1">
                Lookback Period (Days)
              </label>
              <input
                id="daysBack"
                type="number"
                min="1"
                max="365"
                value={daysBack}
                onChange={(e) => setDaysBack(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))}
                placeholder="30"
                className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Fetch logs from the last {daysBack} day{daysBack !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleFetchLogs}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Fetching Logs...' : 'Fetch Recent Logs'}
              </button>
              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className="px-4 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors"
              >
                {showManualForm ? 'Hide Manual Entry' : 'Manual Entry'}
              </button>
            </div>

            {status.type && (
              <div
                className={`p-3 rounded-md text-sm ${
                  status.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : status.type === 'error'
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {status.message}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md text-sm bg-red-50 text-red-800 border border-red-200">
                <strong>Error:</strong> {error.message}
              </div>
            )}
          </div>
        </div>

        {showManualForm && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Manual Trace Entry</h3>
            <p className="text-sm text-gray-600 mb-4">
              If you have specific trace IDs, you can enter them manually here.
            </p>
            {/* TODO: Add manual form fields */}
            <div className="text-sm text-gray-500 italic">Coming soon...</div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Logs ({logs.length})
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Click a log row to view its trace in the panel
              </p>
            </div>
            <div className="max-h-[calc(100vh-400px)] overflow-auto">
              <LogsTable
                logs={logs}
                onSelectLog={handleSelectLog}
                selectedLogId={selectedLog?.id || selectedLog?.root_span_id}
              />
            </div>
          </div>
        )}

        {traceConfig && (
          <div
            className="fixed right-0 top-0 h-screen bg-white shadow-2xl border-l border-gray-200 animate-slide-in-right z-50"
            style={{ width: isFullscreen ? '100vw' : `${panelWidth}vw` }}
          >
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:w-1.5 transition-all z-10"
              onMouseDown={handleMouseDown}
              title="Drag to resize"
            />

            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Trace Viewer</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-200"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-200"
                  title="Close trace viewer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-52px)]">
              <TraceViewer
                ref={traceViewerRef}
                config={traceConfig}
                onLoad={() => console.log('Trace loaded')}
                onError={() => showStatus('Failed to load trace', 'error')}
                onMessage={(event) => {
                  console.log('Message from trace viewer:', event.data);
                }}
              />
            </div>
          </div>
        )}

        {!traceConfig && !loading && logs.length === 0 && projectId && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No logs found for this project in the last 7 days.</p>
            <p className="text-sm text-gray-400 mt-2">
              Try a different project or check if logs are being sent to Braintrust.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
