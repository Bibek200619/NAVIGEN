import React from 'react';
import { Cpu, RefreshCw, Activity } from 'lucide-react';
import { CameraStatus } from '../../components/sensors/CameraStatus';
import { IMUStatus } from '../../components/sensors/IMUStatus';
import { OdometryStatus } from '../../components/sensors/OdometryStatus';
import { TFStatus } from '../../components/sensors/TFStatus';
import { JointStateStatus } from '../../components/sensors/JointStateStatus';
import { Panel } from '../../components/common/Panel';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useRobotData } from '../../hooks/useRobotData';
import { useSensorStatus } from '../../hooks/useSensorStatus';
import {
  matchSensor,
  KNOWN_SENSOR_TARGETS,
  getSensorBadgeInfo,
  formatSensorTimestamp,
} from '../../utils/sensorMatcher';

export const SensorsPage: React.FC = () => {
  const {
    selectedRobot,
    selectedRobotId,
    isLoading: robotLoading,
    error: robotError,
  } = useRobotData();

  const {
    sensors,
    isLoading: sensorsLoading,
    error: sensorsError,
    refetch,
  } = useSensorStatus(selectedRobotId);

  const isLoading = robotLoading || (selectedRobotId ? sensorsLoading : false);
  const error = robotError || sensorsError;

  // Match known core sensors
  const cameraSensor = matchSensor(sensors, KNOWN_SENSOR_TARGETS.CAMERA);
  const imuSensor = matchSensor(sensors, KNOWN_SENSOR_TARGETS.IMU);
  const odometrySensor = matchSensor(sensors, KNOWN_SENSOR_TARGETS.ODOMETRY);
  const tfSensor = matchSensor(sensors, KNOWN_SENSOR_TARGETS.TF);
  const jointStateSensor = matchSensor(sensors, KNOWN_SENSOR_TARGETS.JOINT_STATES);

  // Identify any additional sensors returned by backend not in the 5 core types
  const matchedIds = new Set(
    [
      cameraSensor?.id,
      imuSensor?.id,
      odometrySensor?.id,
      tfSensor?.id,
      jointStateSensor?.id,
    ].filter(Boolean),
  );
  const additionalSensors = sensors.filter((s) => !matchedIds.has(s.id));

  // Compute sensor health summary
  const activeCount = sensors.filter((s) => s.is_active).length;
  const totalCount = sensors.length > 0 ? sensors.length : 5;

  return (
    <div className="space-y-6">
      {/* Tactical Top Command Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-lg border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-sky-400" />
              <span>Sensor Interfaces</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
              Telemetry Feeds
            </span>
          </div>
          {selectedRobot ? (
            <div className="text-xs font-mono text-slate-400">
              Active Robot: <span className="text-slate-200 font-semibold">{selectedRobot.name}</span>{' '}
              <span className="text-slate-500 font-mono">({selectedRobot.id})</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-mono">
              Fleet Status: No active robot selected
            </div>
          )}
          <p className="text-xs text-slate-400 hidden sm:block">
            Real-time sensor telemetry and interface health
          </p>
        </div>

        {/* Quick Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {selectedRobot && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs font-mono">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400 text-[11px]">Active Feeds:</span>
              <span className="text-slate-200 font-semibold text-[11px]">
                {activeCount} / {totalCount}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            title="Refresh Sensor Telemetry"
            aria-label="Refresh Sensors"
            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-sm font-mono">
          Loading sensor interfaces...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-sm space-y-2">
          <div>Failed to retrieve sensor data: {error.message}</div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded text-xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : !selectedRobot ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-sm space-y-1">
          <div className="font-semibold text-slate-300">No Active Robot</div>
          <div>Connect or select an active robot to view sensor interfaces.</div>
        </div>
      ) : (
        <>
          {sensors.length === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs font-mono">
              No sensor records returned by the backend for robot {selectedRobot.name}. Displaying known interface slots as Unavailable.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CameraStatus sensor={cameraSensor} />
            <IMUStatus sensor={imuSensor} />
            <OdometryStatus sensor={odometrySensor} />
            <TFStatus sensor={tfSensor} />
            <JointStateStatus sensor={jointStateSensor} />

            {/* Render any additional backend sensors */}
            {additionalSensors.map((sensor) => {
              const badge = getSensorBadgeInfo(sensor);
              const frequencyText =
                sensor.frequency_hz != null ? `${sensor.frequency_hz} Hz` : 'Unavailable';
              const lastUpdateText = formatSensorTimestamp(sensor.last_updated_at);

              return (
                <Panel key={sensor.id || sensor.sensor_key} title={sensor.name || sensor.sensor_key}>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-400 truncate max-w-[200px]" title={sensor.topic || 'No topic'}>
                        {sensor.topic || 'No topic'}
                      </span>
                      <StatusBadge status={badge.status} variant={badge.variant} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                      <div>
                        <div className="text-slate-500 font-mono text-[10px] uppercase">Frequency</div>
                        <div className="font-mono text-slate-200 mt-0.5">{frequencyText}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-mono text-[10px] uppercase">Last Update</div>
                        <div className="font-mono text-slate-200 mt-0.5">{lastUpdateText}</div>
                      </div>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default SensorsPage;
