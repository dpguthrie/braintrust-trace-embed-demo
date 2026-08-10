import { useEffect, useMemo, useState } from 'react';
import { Check, Code2, Copy, X } from 'lucide-react';
import type { DashboardQuery } from '../types';

interface SqlInspectorProps {
  queries: DashboardQuery[];
  initialKey?: DashboardQuery['key'];
  onClose: () => void;
}

export default function SqlInspector({
  queries,
  initialKey,
  onClose,
}: SqlInspectorProps) {
  const initialIndex = useMemo(
    () => Math.max(0, queries.findIndex((query) => query.key === initialKey)),
    [initialKey, queries],
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [copied, setCopied] = useState(false);
  const active = queries[activeIndex] || queries[0];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const copySql = async () => {
    if (!active) return;
    await navigator.clipboard.writeText(active.sql);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#10151f] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard SQL queries"
      >
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              <Code2 className="h-4 w-4" />
              Sent to Braintrust /btql
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              The SQL behind this dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              These are the exact, fully resolved queries executed by this application.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close SQL inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/40 px-3 py-2">
          {queries.map((query, index) => (
            <button
              key={query.key}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                activeIndex === index
                  ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {query.name}
            </button>
          ))}
        </div>

        {active && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-3">
              <p className="max-w-3xl text-sm leading-6 text-slate-400">{active.description}</p>
              <button
                type="button"
                onClick={copySql}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-violet-400/50 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy SQL'}
              </button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto p-5 text-[13px] leading-6 text-slate-200">
              <code>{active.sql}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
