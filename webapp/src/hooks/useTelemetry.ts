import { useState } from 'react';
import type { TelemetryData } from '../types/telemetry';
import { getMockTelemetry } from '../services/mockTelemetry';

/**
 * Placeholder hook for telemetry data.
 */
export const useTelemetry = () => {
  const [telemetry] = useState<TelemetryData | null>(() => getMockTelemetry());

  return { telemetry, isConnected: Boolean(telemetry) };
};
