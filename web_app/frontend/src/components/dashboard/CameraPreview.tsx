import React from 'react';
import { CameraOff, VideoOff, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { ROS_TOPICS } from '../../constants/topics';

export type CameraPreviewState =
  | 'loading'
  | 'live'
  | 'stale'
  | 'disconnected'
  | 'unavailable'
  | 'error';

export interface CameraMetadata {
  resolution?: string | null;
  fps?: number | null;
  frameAgeMs?: number | null;
  latencyMs?: number | null;
  topic?: string | null;
  cameraName?: string | null;
}

export interface CameraPreviewProps {
  state?: CameraPreviewState;
  metadata?: CameraMetadata | null;
  imageSrc?: string | null;
  children?: React.ReactNode;
  error?: string | Error | null;
  onRetry?: () => void;
  className?: string;
  title?: string;
  aspectRatio?: 'auto' | 'video';
}

const getCameraStatusBadgeConfig = (state: CameraPreviewState) => {
  switch (state) {
    case 'live':
      return { label: 'Live', variant: 'success' as const };
    case 'stale':
      return { label: 'Stale', variant: 'warning' as const };
    case 'loading':
      return { label: 'Loading', variant: 'info' as const };
    case 'disconnected':
      return { label: 'Disconnected', variant: 'danger' as const };
    case 'error':
      return { label: 'Error', variant: 'danger' as const };
    case 'unavailable':
    default:
      return { label: 'Unavailable', variant: 'default' as const };
  }
};

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  state = 'unavailable',
  metadata,
  imageSrc = null,
  children,
  error = null,
  onRetry,
  className = '',
  title = 'Camera Preview',
  aspectRatio = 'auto',
}) => {
  const badgeConfig = getCameraStatusBadgeConfig(state);
  const topic = metadata?.topic ?? ROS_TOPICS.CAMERA_IMAGE_RAW;
  const cameraName = metadata?.cameraName;
  const errorMessage = error instanceof Error ? error.message : error;

  // Metadata formatting - strictly truthful, displays "N/A" when value is unavailable
  const resolutionText = metadata?.resolution ? metadata.resolution : 'N/A';
  const fpsText = metadata?.fps != null ? `${metadata.fps} FPS` : 'N/A';
  const latencyOrAgeMs = metadata?.frameAgeMs ?? metadata?.latencyMs;
  const latencyText = latencyOrAgeMs != null ? `${latencyOrAgeMs} ms` : 'N/A';
  const topicText = topic || 'N/A';

  const viewportHeightClass = aspectRatio === 'video' ? 'aspect-video w-full' : 'h-60 w-full';

  // Check if a real visual source is provided
  const hasSource = Boolean(imageSrc || children);

  return (
    <Panel title={title} className={className}>
      <div className="space-y-3">
        {/* Header: Topic/Name and Status Badge */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2 truncate max-w-[220px]">
            {cameraName && (
              <span className="font-semibold text-slate-200 text-xs truncate" title={cameraName}>
                {cameraName}
              </span>
            )}
            <span
              className="font-mono text-slate-400 text-[11px] truncate"
              title={topicText}
            >
              {topicText}
            </span>
          </div>
          <StatusBadge status={badgeConfig.label} variant={badgeConfig.variant} />
        </div>

        {/* Viewport Area */}
        <div
          role="region"
          aria-label="Camera preview viewport"
          className={`relative ${viewportHeightClass} flex flex-col items-center justify-center bg-slate-950 rounded border border-slate-800 text-center px-4 overflow-hidden`}
          data-testid="camera-preview-viewport"
        >
          {/* Viewfinder Corner Reticle Marks */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-slate-700/70 pointer-events-none" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-slate-700/70 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-slate-700/70 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-slate-700/70 pointer-events-none" />

          {hasSource ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt={cameraName ? `${cameraName} stream feed` : 'Camera Preview Feed'}
                  className="w-full h-full object-contain"
                />
              )}
              {children}
              {state === 'stale' && (
                <div
                  className="absolute top-2 left-2 right-2 p-1.5 bg-amber-500/20 border border-amber-500/30 rounded text-[11px] text-amber-300 backdrop-blur-sm flex items-center justify-center gap-1.5"
                  data-testid="camera-stale-banner"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Stale feed{latencyOrAgeMs != null ? `: ${latencyOrAgeMs} ms old` : ''}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              {state === 'loading' && (
                <div className="flex flex-col items-center space-y-2">
                  <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
                  <div className="text-xs font-semibold text-slate-200">
                    Loading Camera Stream...
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Establishing connection to camera feed
                  </div>
                </div>
              )}

              {state === 'live' && (
                <div className="flex flex-col items-center space-y-2">
                  <VideoOff className="w-7 h-7 text-slate-500" />
                  <div className="text-xs font-semibold text-slate-200">
                    Waiting for camera source
                  </div>
                  <div className="text-[11px] text-slate-500 max-w-xs">
                    No video stream or frame received
                  </div>
                </div>
              )}

              {state === 'stale' && (
                <div className="flex flex-col items-center space-y-2">
                  <Clock className="w-7 h-7 text-amber-400" />
                  <div className="text-xs font-semibold text-slate-200">
                    Camera Feed Stale
                  </div>
                  <div className="text-[11px] text-amber-400/80">
                    {latencyOrAgeMs != null
                      ? `Last frame received ${latencyOrAgeMs} ms ago.`
                      : 'Last frame exceeds freshness threshold.'}
                  </div>
                </div>
              )}

              {state === 'disconnected' && (
                <div className="flex flex-col items-center space-y-2">
                  <CameraOff className="w-7 h-7 text-rose-400" />
                  <div className="text-xs font-semibold text-slate-200">
                    Camera Disconnected
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Camera connection is unavailable.
                  </div>
                </div>
              )}

              {state === 'unavailable' && (
                <div className="flex flex-col items-center space-y-2">
                  <VideoOff className="w-7 h-7 text-slate-500" />
                  <div className="text-xs font-semibold text-slate-300">
                    Camera preview unavailable
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Waiting for camera source
                  </div>
                </div>
              )}

              {state === 'error' && (
                <div className="flex flex-col items-center space-y-1.5">
                  <AlertCircle className="w-7 h-7 text-rose-400" />
                  <div className="text-xs font-semibold text-slate-200">
                    Camera Feed Error
                  </div>
                  {errorMessage && (
                    <div className="text-[11px] text-rose-400 max-w-xs truncate" title={errorMessage}>
                      {errorMessage}
                    </div>
                  )}
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      aria-label="Retry Camera"
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Camera</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Resolution</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs truncate">{resolutionText}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Framerate</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs truncate">{fpsText}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Latency / Age</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs truncate">{latencyText}</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Topic</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs truncate" title={topicText}>{topicText}</div>
          </div>
        </div>
      </div>
    </Panel>
  );
};
