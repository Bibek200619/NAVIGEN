import React from 'react';
import { GitBranch, Box } from 'lucide-react';
import { Panel } from '../common/Panel';

export const TFTree: React.FC = () => {
  return (
    <Panel title="Transform (TF) Tree">
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-mono">
          <span className="text-slate-500">ROOT FRAME:</span>
          <span className="text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">
            odom (fixed)
          </span>
        </div>

        {/* Visual Frame Hierarchy */}
        <div className="p-3 bg-slate-950/60 rounded border border-slate-800 space-y-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-200">
            <Box className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold">base_link</span>
            <span className="text-[10px] text-slate-500">(robot base origin)</span>
          </div>

          <div className="pl-5 space-y-1.5 border-l border-slate-800 ml-1.5 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3 h-3 text-slate-600" />
              <span>camera_link</span>
              <span className="text-[10px] text-slate-500 font-sans">[optical frame]</span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-3 h-3 text-slate-600" />
              <span>imu_link</span>
              <span className="text-[10px] text-slate-500 font-sans">[inertial unit]</span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-3 h-3 text-slate-600" />
              <span>wheel_left_link, wheel_right_link</span>
              <span className="text-[10px] text-slate-500 font-sans">[traction]</span>
            </div>
          </div>
        </div>

        {/* Baseline text string preserved */}
        <div className="text-[11px] font-mono text-slate-500">
          base_link → camera_link, imu_link, wheel links
        </div>
      </div>
    </Panel>
  );
};
