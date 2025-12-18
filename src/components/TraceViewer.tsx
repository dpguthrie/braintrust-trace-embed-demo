import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { TraceConfig, TraceViewerMessage } from '../types';

interface TraceViewerProps {
  config: TraceConfig;
  onMessage?: (message: MessageEvent) => void;
  onLoad?: () => void;
  onError?: () => void;
}

export interface TraceViewerRef {
  updateSpan: (rootSpanId: string, selectedSpanId?: string) => void;
  reload: () => void;
}

const TraceViewer = forwardRef<TraceViewerRef, TraceViewerProps>(
  ({ config, onMessage, onLoad, onError }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const buildTraceUrl = (cfg: TraceConfig): string => {
      // Always use /trace route
      const url = new URL(`${cfg.baseUrl}/app/${cfg.org}/p/${cfg.project}/trace`);
      url.searchParams.set('api_key', cfg.apiKey);

      // Default to project_logs if no object_type specified
      const objectType = cfg.objectType || 'project_logs';
      const objectId = cfg.objectId || cfg.projectId;

      url.searchParams.set('object_type', objectType);
      url.searchParams.set('object_id', objectId);
      url.searchParams.set('r', cfg.rootSpanId);

      if (cfg.selectedSpanId) {
        url.searchParams.set('s', cfg.selectedSpanId);
      }

      return url.toString();
    };

    const updateSpan = (rootSpanId: string, selectedSpanId?: string) => {
      if (!iframeRef.current?.contentWindow) {
        console.error('iframe not loaded');
        return;
      }

      const message: TraceViewerMessage = {
        r: rootSpanId,
        ...(selectedSpanId && { s: selectedSpanId }),
      };

      iframeRef.current.contentWindow.postMessage(message, config.baseUrl);
    };

    const reload = () => {
      if (iframeRef.current) {
        iframeRef.current.src = buildTraceUrl(config);
      }
    };

    useImperativeHandle(ref, () => ({
      updateSpan,
      reload,
    }));

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== config.baseUrl) {
          return;
        }

        if (onMessage) {
          onMessage(event);
        }
      };

      window.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [config.baseUrl, onMessage]);

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const handleLoad = () => {
        if (onLoad) {
          onLoad();
        }
      };

      const handleError = () => {
        if (onError) {
          onError();
        }
      };

      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', handleError);

      return () => {
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', handleError);
      };
    }, [onLoad, onError]);

    return (
      <div className="w-full h-full bg-white rounded-lg shadow-sm overflow-hidden">
        <iframe
          ref={iframeRef}
          src={buildTraceUrl(config)}
          className="w-full h-full border-0"
          title="Braintrust Trace Viewer"
        />
      </div>
    );
  }
);

TraceViewer.displayName = 'TraceViewer';

export default TraceViewer;
