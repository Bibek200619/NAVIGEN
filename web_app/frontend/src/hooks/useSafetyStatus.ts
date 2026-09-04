import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import type { SafetyEventResponse, GetSafetyParams } from '../types/api';

export interface UseSafetyStatusOptions extends GetSafetyParams {
  enabled?: boolean;
}

export interface UseSafetyStatusReturn {
  safetyEvents: SafetyEventResponse[];
  latestEvent: SafetyEventResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to retrieve safety events for a specific robot.
 * Preserves backend returned order.
 * Only triggers network request when a valid robotId is present.
 */
export const useSafetyStatus = (
  robotId: string | null | undefined,
  options: UseSafetyStatusOptions = {},
): UseSafetyStatusReturn => {
  const { limit = 10, enabled = true } = options;
  const [safetyEvents, setSafetyEvents] = useState<SafetyEventResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(robotId && enabled));
  const [error, setError] = useState<Error | null>(null);

  const fetchSafety = useCallback(async () => {
    if (!robotId || !enabled) {
      setSafetyEvents([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.getRobotSafety(robotId, { limit });
      const events = data ?? [];
      setSafetyEvents(events);
    } catch (err) {
      const actualError = err instanceof Error ? err : new Error(String(err));
      setError(actualError);
      setSafetyEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [robotId, limit, enabled]);

  useEffect(() => {
    if (!robotId || !enabled) {
      return;
    }

    let isCancelled = false;

    apiClient
      .getRobotSafety(robotId, { limit })
      .then((data) => {
        if (!isCancelled) {
          setSafetyEvents(data ?? []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const actualError = err instanceof Error ? err : new Error(String(err));
          setError(actualError);
          setSafetyEvents([]);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [robotId, limit, enabled]);

  return {
    safetyEvents,
    latestEvent: safetyEvents.length > 0 ? safetyEvents[0] : null,
    isLoading,
    error,
    refetch: fetchSafety,
  };
};
