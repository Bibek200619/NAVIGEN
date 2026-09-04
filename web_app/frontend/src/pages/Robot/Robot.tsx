import React from 'react';
import { Bot, Cpu } from 'lucide-react';
import { RobotOverview } from '../../components/robot/RobotOverview';
import { PosePanel } from '../../components/robot/PosePanel';
import { VelocityPanel } from '../../components/robot/VelocityPanel';
import { TFTree } from '../../components/robot/TFTree';

export const RobotPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Tactical Top Command Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-lg border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5 text-sky-400" />
              <span>Robot Status & Configuration</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
              Kinematics & Frames
            </span>
          </div>
          <p className="text-xs text-slate-400">
            UGV Subsystem Diagnostics, Velocity Metrics & Coordinate Transforms
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs font-mono text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Chassis: Differential Drive UGV</span>
          </div>
        </div>
      </div>

      {/* Main Diagnostic Panels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RobotOverview />
        <PosePanel />
        <VelocityPanel />
        <TFTree />
      </div>
    </div>
  );
};

export default RobotPage;
