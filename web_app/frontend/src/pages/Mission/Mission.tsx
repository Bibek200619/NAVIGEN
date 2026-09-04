import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { MissionStatus } from '../../components/mission/MissionStatus';
import {
  MissionControls,
  type CommandStatus,
  type CommandType,
} from '../../components/mission/MissionControls';
import { MissionHistory } from '../../components/mission/MissionHistory';
import type { Mission } from '../../types/mission';

export const MissionPage: React.FC = () => {
  // Truthful frontend state: no backend mission or command service is connected yet
  const [currentMission] = useState<Mission | null>(null);
  const [commandStatus] = useState<CommandStatus>('ready');
  const [lastCommandType, setLastCommandType] = useState<CommandType | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleSetGoal = () => {
    setLastCommandType('set_goal');
    setFeedbackMessage('Set Goal action triggered. Backend command dispatch endpoint is not yet connected.');
  };

  const handleSoftwareEstop = () => {
    setLastCommandType('software_estop');
    setFeedbackMessage('Software E-Stop action triggered. Backend command dispatch endpoint is not yet connected.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Mission Management</h2>
        <p className="text-xs text-slate-400 mt-1">
          Monitor active missions and issue safe UGV operational commands.
        </p>
      </div>

      {/* Notice communicating backend connection status */}
      <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400">
        <Info className="w-4 h-4 text-sky-400 shrink-0" />
        <span>
          Mission execution and command dispatch services are currently disconnected. Controls are in stand-by mode.
        </span>
      </div>

      {/* Informative feedback banner when an action is triggered */}
      {feedbackMessage && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center justify-between">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-amber-400 hover:text-amber-200 text-xs font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MissionStatus mission={currentMission} />
        <MissionControls
          onSetGoal={handleSetGoal}
          onSoftwareEstop={handleSoftwareEstop}
          commandStatus={commandStatus}
          lastCommandType={lastCommandType}
          hasActiveMission={Boolean(currentMission)}
        />
        <div className="md:col-span-2">
          <MissionHistory />
        </div>
      </div>
    </div>
  );
};

export default MissionPage;
