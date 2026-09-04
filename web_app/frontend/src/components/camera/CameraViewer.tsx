import React from 'react';
import { VideoOff } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { ROS_TOPICS } from '../../constants/topics';

export interface CameraViewerProps {
  className?: string;
  imageSrc?: string | null;
  children?: React.ReactNode;
}

export const CameraViewer: React.FC<CameraViewerProps> = ({
  className = '',
  imageSrc = null,
  children,
}) => {
  const hasSource = Boolean(imageSrc || children);

  return (
    <Panel title="Primary Camera Stream" className={className}>
      <div className="space-y-3">
        {/* Header: Topic & Status Badge */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <span
            className="font-mono text-slate-400 text-[11px] truncate"
            title={ROS_TOPICS.CAMERA_IMAGE_RAW}
          >
            {ROS_TOPICS.CAMERA_IMAGE_RAW}
          </span>
          <StatusBadge status="Unavailable" variant="default" />
        </div>

        {/* Viewport Area */}
        <div
          role="region"
          aria-label="Primary camera stream display"
          className="relative aspect-video w-full flex flex-col items-center justify-center bg-slate-950 rounded border border-slate-800 text-center px-4 overflow-hidden"
        >
          {/* Viewfinder Corner Reticle Marks */}
          <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t-2 border-l-2 border-slate-700/70 pointer-events-none" />
          <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t-2 border-r-2 border-slate-700/70 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b-2 border-l-2 border-slate-700/70 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b-2 border-r-2 border-slate-700/70 pointer-events-none" />

          {hasSource ? (
            <div className="w-full h-full flex items-center justify-center">
              {imageSrc && (
                <img
                  src={imageSrc}
                  alt="Primary Camera Stream"
                  className="w-full h-full object-contain"
                />
              )}
              {children}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 text-slate-500">
              <VideoOff className="w-8 h-8 text-slate-600" />
              <div className="text-xs font-semibold text-slate-300">
                Camera preview unavailable
              </div>
              <div className="text-[11px] text-slate-500">
                Waiting for camera source
              </div>
              {/* Baseline placeholder text preserved */}
              <div className="text-[10px] font-mono text-slate-600 mt-1">
                Camera Stream Viewport
              </div>
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Resolution</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs">N/A</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Framerate</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs">N/A</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Latency</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs">N/A</div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Topic</div>
            <div className="font-mono text-slate-200 mt-0.5 text-xs truncate" title={ROS_TOPICS.CAMERA_IMAGE_RAW}>
              {ROS_TOPICS.CAMERA_IMAGE_RAW}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
};
