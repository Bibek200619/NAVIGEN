import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { ROS_TOPICS } from '../../constants/topics';
import type { SensorStatusResponse } from '../../types/api';
import { getSensorBadgeInfo, formatSensorTimestamp } from '../../utils/sensorMatcher';

export interface TFStatusProps {
  sensor?: SensorStatusResponse | null;
}

export const TFStatus: React.FC<TFStatusProps> = ({ sensor }) => {
  const badge = getSensorBadgeInfo(sensor);
  const topic = sensor?.topic ?? ROS_TOPICS.TF;
  const title = sensor?.name ?? 'TF Status';
  const frequencyText = sensor?.frequency_hz != null ? `${sensor.frequency_hz} Hz` : 'Unavailable';
  const lastUpdateText = formatSensorTimestamp(sensor?.last_updated_at);

  return (
    <Panel title={title}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-slate-400 truncate max-w-[200px]" title={topic}>
            {topic}
          </span>
          <StatusBadge status={badge.status} variant={badge.variant} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
          <div>
            <div className="text-slate-500">Frequency</div>
            <div className="font-mono text-slate-200 mt-0.5">{frequencyText}</div>
          </div>
          <div>
            <div className="text-slate-500">Last Update</div>
            <div className="font-mono text-slate-200 mt-0.5">{lastUpdateText}</div>
          </div>
        </div>
      </div>
    </Panel>
  );
};
