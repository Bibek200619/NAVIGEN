import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import type { MissionStatus } from '../types/api';
import { type Mission, mapMissionResponseToMission } from '../types/mission';

export interface UseMissionsOptions {
  status?: MissionStatus;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export interface UseMissionsReturn {
  missions: Mission[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to retrieve missions list for a specific robot.
 * Guards against missing robotId.
 */
export const useMissions = (
  robotId: string | null | undefined,
  options: UseMissionsOptions = {},
): UseMissionsReturn => {
  const { status, limit = 50, offset = 0, enabled = true } = options;
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(robotId && enabled));
  const [error, setError] = useState<Error | null>(null);

  const fetchMissions = useCallback(async () => {
    if (!robotId || !enabled) {
      setMissions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const page = await apiClient.getMissions({
        robot_id: robotId,
        status,
        limit,
        offset,
      });
      const items = page?.items ?? [];
      setMissions(items.map(mapMissionResponseToMission));
    } catch (err) {
      const actualError = err instanceof Error ? err : new Error(String(err));
      setError(actualError);
      setMissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [robotId, status, limit, offset, enabled]);

  useEffect(() => {
    if (!robotId || !enabled) {
      return;
    }

    let isCancelled = false;

    apiClient
      .getMissions({
        robot_id: robotId,
        status,
        limit,
        offset,
      })
      .then((page) => {
        if (!isCancelled) {
          const items = page?.items ?? [];
          setMissions(items.map(mapMissionResponseToMission));
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const actualError = err instanceof Error ? err : new Error(String(err));
          setError(actualError);
          setMissions([]);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [robotId, status, limit, offset, enabled]);

  return {
    missions,
    isLoading,
    error,
    refetch: fetchMissions,
  };
};
