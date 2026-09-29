import React from 'react';
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
  className?: string;
}

export const OperationalStatus: React.FC<OperationalStatusProps> = ({
  robotId,
  latestSafetyEvent: propSafety,
  localization: propLocalization,
  isLoadingSafety: propLoadingSafety,
  isLoadingLocalization: propLoadingLocalization,
  safetyError: propSafetyError,
  localizationError: propLocalizationError,
  className = '',
}) => {
  const safetyHook = useSafetyStatus(robotId, { enabled: propSafety === undefined });
  const locHook = useLocalizationStatus(robotId, { enabled: propLocalization === undefined });

  const safetyEvent = propSafety !== undefined ? propSafety : safetyHook.latestEvent;
  const isSafetyLoading = propLoadingSafety !== undefined ? propLoadingSafety : safetyHook.isLoading;
  const safetyError = propSafetyError !== undefined ? propSafetyError : safetyHook.error;

  const localization = propLocalization !== undefined ? propLocalization : locHook.localization;
  const isLocLoading = propLoadingLocalization !== undefined ? propLoadingLocalization : locHook.isLoading;
  const locError = propLocalizationError !== undefined ? propLocalizationError : locHook.error;

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

  const safetyCardClass =
    safetyEvent?.state === 'emergency_stop'
      ? 'operational-card emergency'
      : safetyEvent?.state === 'warning'
        ? 'operational-card warning'
        : 'operational-card';

  const locCardClass =
    localization?.state === 'lost'
      ? 'operational-card emergency'
      : localization?.state === 'relocalizing'
        ? 'operational-card warning'
        : 'operational-card';

  return (
    <section className={`telemetry-summary ${className}`}>
      <header className="section-heading">
        <h2>Operational status</h2>
        <span className="eyebrow">03</span>
      </header>

      <div className={safetyCardClass} data-testid="safety-status-card">
        <header>
          <strong>Safety state</strong>
          {isSafetyLoading ? (
            <span className="meta">Loading…</span>
          ) : safetyError ? (
            <StatusBadge status="Error" variant="danger" />
          ) : (
            <StatusBadge status={safetyBadge.label} variant={safetyBadge.variant} />
          )}
        </header>

        {safetyError ? (
          <p className="meta">Failed to load safety: {safetyError.message}</p>
        ) : safetyEvent ? (
          <>
            {safetyEvent.description && <p>{safetyEvent.description}</p>}
            {safetyEvent.active_triggers && safetyEvent.active_triggers.length > 0 && (
              <p className="meta">
                Triggers: {safetyEvent.active_triggers.join(', ')}
              </p>
            )}
            <p className="meta">Recorded {formatSensorTimestamp(safetyEvent.recorded_at)}</p>
          </>
        ) : (
          <p className="meta">{!robotId ? 'No active robot' : 'No safety events reported'}</p>
        )}
      </div>

      <div className={locCardClass} data-testid="localization-status-card">
        <header>
          <strong>Localization</strong>
          {isLocLoading ? (
            <span className="meta">Loading…</span>
          ) : locError ? (
            <StatusBadge status="Error" variant="danger" />
          ) : (
            <StatusBadge status={locBadge.label} variant={locBadge.variant} />
          )}
        </header>

        {locError ? (
          <p className="meta">Failed to load localization: {locError.message}</p>
        ) : localization ? (
          <dl className="detail-list">
            <div>
              <dt>Features</dt>
              <dd data-testid="tracked-features-val">{localization.tracked_features ?? '—'}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>
                {formatSensorTimestamp(localization.recorded_at ?? localization.received_at)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="meta">{!robotId ? 'No active robot' : 'No localization data'}</p>
        )}
      </div>
    </section>
  );
};
