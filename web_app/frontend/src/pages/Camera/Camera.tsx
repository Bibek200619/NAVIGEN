import React from 'react';
import { Video, Eye } from 'lucide-react';
import { CameraViewer } from '../../components/camera/CameraViewer';
import { ROS_TOPICS } from '../../constants/topics';

export const CameraPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Tactical Top Command Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-lg border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Video className="w-5 h-5 text-sky-400" />
              <span>Camera Feed</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
              Primary Viewport
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time UGV visual feed & forward sensor viewport
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs font-mono text-slate-400">
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>Feed: {ROS_TOPICS.CAMERA_IMAGE_RAW}</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl">
        <CameraViewer />
      </div>
    </div>
  );
};

export default CameraPage;
