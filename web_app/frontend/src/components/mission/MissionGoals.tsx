import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { Goal } from '../../types/mission';

export interface MissionGoalsProps {
  goals?: Goal[];
  isLoading?: boolean;
}

export const MissionGoals: React.FC<MissionGoalsProps> = ({ goals = [], isLoading = false }) => {
  return (
    <Panel title="Mission Goals">
      {isLoading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading mission goals...</div>
      ) : goals.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500">
          No goals defined for this mission.
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {goals.map((goal) => {
            const isReached = Boolean(goal.reachedAt);
            return (
              <div
                key={goal.id || goal.sequenceNo}
                className="p-2.5 bg-slate-950/60 rounded-md border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                    #{goal.sequenceNo}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-[11px] text-slate-200 truncate">
                      X: {goal.position.x.toFixed(2)} | Y: {goal.position.y.toFixed(2)} | Z:{' '}
                      {goal.position.z.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      frame: {goal.frameId}
                    </span>
                  </div>
                </div>
                <StatusBadge
                  status={isReached ? 'Reached' : 'Pending'}
                  variant={isReached ? 'success' : 'warning'}
                />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
};
