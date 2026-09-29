import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import type { SensorStatusResponse } from '../types/api';

export interface UseSensorStatusOptions {
  enabled?: boolean;
}

export interface UseSensorStatusReturn {
  sensors: SensorStatusResponse[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to retrieve sensor status list for a specific robot.
 * Only triggers network request when a valid robotId is present.
 */
export const useSensorStatus = (
  robotId: string | null | undefined,
  options: UseSensorStatusOptions = {},
): UseSensorStatusReturn => {
  const { enabled = true } = options;
  const [sensors, setSensors] = useState<SensorStatusResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(robotId && enabled));
  const [error, setError] = useState<Error | null>(null);

  const fetchSensors = useCallback(async () => {
    if (!robotId || !enabled) {
      setSensors([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.getRobotSensors(robotId);
      setSensors(data ?? []);
    } catch (err) {
      const actualError = err instanceof Error ? err : new Error(String(err));
      setError(actualError);
      setSensors([]);
    } finally {
      setIsLoading(false);
    }
  }, [robotId, enabled]);

  useEffect(() => {
    if (!robotId || !enabled) {
      return;
    }

    let isCancelled = false;

    apiClient
      .getRobotSensors(robotId)
      .then((data) => {
        if (!isCancelled) {
          setSensors(data ?? []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const actualError = err instanceof Error ? err : new Error(String(err));
          setError(actualError);
          setSensors([]);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [robotId, enabled]);

  return {
    sensors,
    isLoading,
    error,
    refetch: fetchSensors,
  };
};
