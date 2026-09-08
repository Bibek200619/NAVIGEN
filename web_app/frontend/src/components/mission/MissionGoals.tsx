import React from 'react';
import { Target, CheckCircle2, Clock } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { Goal } from '../../types/mission';

export interface MissionGoalsProps {
  goals?: Goal[];
  isLoading?: boolean;
  className?: string;
}

export const MissionGoals: React.FC<MissionGoalsProps> = ({
  goals = [],
  isLoading = false,
  className = '',
}) => {
  return (
    <Panel title="Mission Goals" className={className}>
      {isLoading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading mission goals...</div>
      ) : goals.length === 0 ? (
        <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
          <Target className="w-8 h-8 text-slate-600 mb-2" />
          <span className="text-sm font-medium text-slate-300">No goals defined</span>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            No goals defined for this mission.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {goals.map((goal) => {
            const isReached = Boolean(goal.reachedAt);
            const sequenceFormatted = String(goal.sequenceNo).padStart(2, '0');

            return (
              <div
                key={goal.id || goal.sequenceNo}
                className={`p-3 rounded-md border transition-colors ${
                  isReached
                    ? 'bg-slate-950/40 border-slate-800/80'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                {/* Header: Sequence & Status Badge */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold shrink-0">
                      #{goal.sequenceNo}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-200 tracking-wide">
                      GOAL {sequenceFormatted}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isReached ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <StatusBadge
                      status={isReached ? 'Reached' : 'Pending'}
                      variant={isReached ? 'success' : 'warning'}
                    />
                  </div>
                </div>

                {/* Coordinate Readout String (preserves backward compatibility with existing tests) */}
                <div className="mt-2 text-xs font-mono text-slate-200 truncate">
                  <span>
                    X: {goal.position.x.toFixed(2)} | Y: {goal.position.y.toFixed(2)} | Z:{' '}
                    {goal.position.z.toFixed(2)}
                  </span>
                </div>

                {/* Structured Monospace Technical Coordinates Breakdown */}
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/60 font-mono text-[11px]">
                  <div className="bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
                    <span className="text-slate-500 text-[10px] block">X POS</span>
                    <span className="text-slate-200 font-medium">
                      {goal.position.x.toFixed(2)} m
                    </span>
                  </div>
                  <div className="bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
                    <span className="text-slate-500 text-[10px] block">Y POS</span>
                    <span className="text-slate-200 font-medium">
                      {goal.position.y.toFixed(2)} m
                    </span>
                  </div>
                  <div className="bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50">
                    <span className="text-slate-500 text-[10px] block">Z POS</span>
                    <span className="text-slate-200 font-medium">
                      {goal.position.z.toFixed(2)} m
                    </span>
                  </div>
                </div>

                {/* Frame ID Footer */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-slate-500">
                  <span>
                    FRAME: <span className="text-slate-400">{goal.frameId}</span>
                  </span>
                  {goal.reachedAt && (
                    <span className="text-emerald-400/80">
                      Reached:{' '}
                      {new Date(goal.reachedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
};
