import React from 'react';
import { Compass } from 'lucide-react';
import { Panel } from '../common/Panel';

export const PosePanel: React.FC = () => {
  return (
    <Panel title="Pose (Position & Orientation)">
      <div className="space-y-3">
        {/* Reference Frame Subtitle */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-mono">
          <span className="text-slate-500">REFERENCE:</span>
          <span className="text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            odom → base_link (ref)
          </span>
        </div>

        {/* Structured Metric Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block">X POS</span>
            <span className="text-slate-200 font-semibold text-sm">0.00</span>
            <span className="text-[10px] text-slate-500 ml-1">m</span>
          </div>
          <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Y POS</span>
            <span className="text-slate-200 font-semibold text-sm">0.00</span>
            <span className="text-[10px] text-slate-500 ml-1">m</span>
          </div>
          <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Z POS</span>
            <span className="text-slate-200 font-semibold text-sm">0.00</span>
            <span className="text-[10px] text-slate-500 ml-1">m</span>
          </div>
        </div>

        {/* Orientation & Readout */}
        <div className="p-2.5 bg-slate-950/60 rounded border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Orientation (Yaw):</span>
          </div>
          <span className="text-slate-200 font-semibold">0.0°</span>
        </div>

        {/* Baseline text string preserved */}
        <div className="text-[11px] font-mono text-slate-500 text-center">
          Position: X: 0.00, Y: 0.00, Z: 0.00 | Yaw: 0.0°
        </div>
      </div>
    </Panel>
  );
};
