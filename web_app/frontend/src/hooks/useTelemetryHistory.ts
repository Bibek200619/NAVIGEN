import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import type { RobotTelemetryResponse, GetTelemetryParams } from '../types/api';

export interface UseTelemetryHistoryOptions extends GetTelemetryParams {
  enabled?: boolean;
}

export interface UseTelemetryHistoryReturn {
  history: RobotTelemetryResponse[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to retrieve historical telemetry samples for a specific robot.
 * Only triggers network request when a valid robotId is present.
 */
export const useTelemetryHistory = (
  robotId: string | null | undefined,
  options: UseTelemetryHistoryOptions = {},
): UseTelemetryHistoryReturn => {
  const { limit = 100, from, to, enabled = true } = options;
  const [history, setHistory] = useState<RobotTelemetryResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(robotId && enabled));
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!robotId || !enabled) {
      setHistory([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.getRobotTelemetry(robotId, { limit, from, to });
      // Preserve backend ordering
      setHistory(data ?? []);
    } catch (err) {
      const actualError = err instanceof Error ? err : new Error(String(err));
      setError(actualError);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [robotId, limit, from, to, enabled]);

  useEffect(() => {
    if (!robotId || !enabled) {
      return;
    }

    let isCancelled = false;

    apiClient
      .getRobotTelemetry(robotId, { limit, from, to })
      .then((data) => {
        if (!isCancelled) {
          setHistory(data ?? []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const actualError = err instanceof Error ? err : new Error(String(err));
          setError(actualError);
          setHistory([]);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [robotId, limit, from, to, enabled]);

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory,
  };
};
