import type { LogRecord } from '../types';
import { parseSpanAttributes } from '../api/braintrust';

interface LogsTableProps {
  logs: LogRecord[];
  onSelectLog: (log: LogRecord) => void;
  selectedLogId?: string;
}

function formatDate(created: string | number): string {
  const date = typeof created === 'number' ? new Date(created) : new Date(created);
  return date.toLocaleString();
}

function formatDuration(metrics?: { duration?: number }): string {
  if (metrics?.duration === undefined || metrics.duration === null) return '-';
  const duration = metrics.duration;
  if (duration < 1) return `${Math.round(duration * 1000)}ms`;
  return `${duration.toFixed(duration < 10 ? 2 : 1)}s`;
}

export default function LogsTable({ logs, onSelectLog, selectedLogId }: LogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-sm font-medium">No traces found</p>
        <p className="text-xs mt-1 text-slate-400">Try a longer lookback window or check the project connection.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
          <tr>
            <th
              scope="col"
              className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
            >
              Type
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
            >
              Created
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
            >
              Duration
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
            >
              Tags
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {logs.map((log) => {
            const spanAttrs = parseSpanAttributes(log.span_attributes);
            const isSelected = log.id === selectedLogId || log.root_span_id === selectedLogId;

            return (
              <tr
                key={log.id}
                onClick={() => onSelectLog(log)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-violet-50 hover:bg-violet-100/70'
                    : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-slate-900">
                  {spanAttrs.name || log.id.substring(0, 8)}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                    {spanAttrs.type || 'trace'}
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                  {formatDate(log.created)}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-xs tabular-nums text-slate-500">
                  {formatDuration(log.metrics)}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-500">
                  {log.tags && log.tags.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {log.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-violet-50 text-violet-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {log.tags.length > 2 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                          +{log.tags.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-sm">
                  {log.error ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700">
                      Error
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                      Success
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
