import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { useSafetyStatus } from '../../hooks/useSafetyStatus';
import { useLocalizationStatus } from '../../hooks/useLocalizationStatus';
import type { SafetyEventResponse, LocalizationStatusResponse } from '../../types/api';
import { formatSensorTimestamp } from '../../utils/sensorMatcher';

export interface OperationalStatusProps {
  robotId?: string | null;
  latestSafetyEvent?: SafetyEventResponse | null;
  localization?: LocalizationStatusResponse | null;
  isLoadingSafety?: boolean;
  isLoadingLocalization?: boolean;
  safetyError?: Error | null;
  localizationError?: Error | null;
}

export const OperationalStatus: React.FC<OperationalStatusProps> = ({
  robotId,
  latestSafetyEvent: propSafety,
  localization: propLocalization,
  isLoadingSafety: propLoadingSafety,
  isLoadingLocalization: propLoadingLocalization,
  safetyError: propSafetyError,
  localizationError: propLocalizationError,
}) => {
  const safetyHook = useSafetyStatus(robotId, { enabled: propSafety === undefined });
  const locHook = useLocalizationStatus(robotId, { enabled: propLocalization === undefined });

  const safetyEvent = propSafety !== undefined ? propSafety : safetyHook.latestEvent;
  const isSafetyLoading = propLoadingSafety !== undefined ? propLoadingSafety : safetyHook.isLoading;
  const safetyError = propSafetyError !== undefined ? propSafetyError : safetyHook.error;

  const localization = propLocalization !== undefined ? propLocalization : locHook.localization;
  const isLocLoading = propLoadingLocalization !== undefined ? propLoadingLocalization : locHook.isLoading;
  const locError = propLocalizationError !== undefined ? propLocalizationError : locHook.error;

  // Compute Safety visual state
  const getSafetyBadge = () => {
    if (!robotId || !safetyEvent) {
      return { label: 'UNAVAILABLE', variant: 'default' as const };
    }
    switch (safetyEvent.state) {
      case 'ok':
        return { label: 'OK', variant: 'success' as const };
      case 'warning':
        return { label: 'WARNING', variant: 'warning' as const };
      case 'emergency_stop':
        return { label: 'EMERGENCY STOP', variant: 'danger' as const };
      default:
        return { label: 'UNKNOWN', variant: 'default' as const };
    }
  };

  // Compute Localization visual state
  const getLocalizationBadge = () => {
    if (!robotId || !localization) {
      return { label: 'Unavailable', variant: 'default' as const };
    }
    switch (localization.state) {
      case 'tracking':
        return { label: 'Tracking', variant: 'success' as const };
      case 'relocalizing':
        return { label: 'Relocalizing', variant: 'warning' as const };
      case 'lost':
        return { label: 'Lost', variant: 'danger' as const };
      case 'initializing':
        return { label: 'Initializing', variant: 'info' as const };
      default:
        return { label: 'Unknown', variant: 'default' as const };
    }
  };

  const safetyBadge = getSafetyBadge();
  const locBadge = getLocalizationBadge();

  return (
    <Panel title="Operational Status">
      <div className="space-y-4">
        {/* Safety Section */}
        <div
          className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-2 text-xs"
          data-testid="safety-status-card"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">Safety State</span>
            {isSafetyLoading ? (
              <span className="text-slate-400 font-mono">Loading...</span>
            ) : safetyError ? (
              <StatusBadge status="Error" variant="danger" />
            ) : (
              <StatusBadge status={safetyBadge.label} variant={safetyBadge.variant} />
            )}
          </div>

          {safetyError ? (
            <div className="text-rose-400 text-[11px]">Failed to load safety: {safetyError.message}</div>
          ) : safetyEvent ? (
            <div className="space-y-1 pt-1 border-t border-slate-800/80 text-[11px]">
              {safetyEvent.description && (
                <div className="text-slate-300">
                  <span className="text-slate-500">Note: </span>
                  {safetyEvent.description}
                </div>
              )}
              {safetyEvent.active_triggers && safetyEvent.active_triggers.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500">Triggers:</span>
                  {safetyEvent.active_triggers.map((trigger) => (
                    <span
                      key={trigger}
                      className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded font-mono text-[10px]"
                    >
                      {trigger}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-slate-500 font-mono text-[10px] pt-1">
                <span>Recorded</span>
                <span>{formatSensorTimestamp(safetyEvent.recorded_at)}</span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-[11px]">
              {!robotId ? 'No active robot' : 'No safety events reported'}
            </div>
          )}
        </div>

        {/* Localization Section */}
        <div
          className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-2 text-xs"
          data-testid="localization-status-card"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">Localization</span>
            {isLocLoading ? (
              <span className="text-slate-400 font-mono">Loading...</span>
            ) : locError ? (
              <StatusBadge status="Error" variant="danger" />
            ) : (
              <StatusBadge status={locBadge.label} variant={locBadge.variant} />
            )}
          </div>

          {locError ? (
            <div className="text-rose-400 text-[11px]">Failed to load localization: {locError.message}</div>
          ) : localization ? (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
              <div>
                <div className="text-slate-500">Features</div>
                <div className="font-mono text-slate-200 mt-0.5" data-testid="tracked-features-val">
                  {localization.tracked_features ?? '--'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Updated</div>
                <div className="font-mono text-slate-200 mt-0.5">
                  {formatSensorTimestamp(localization.recorded_at ?? localization.received_at)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-[11px]">
              {!robotId ? 'No active robot' : 'No localization data'}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};
