import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import {
  type Mission,
  type Goal,
  mapMissionResponseToMission,
} from '../types/mission';

export interface UseMissionDetailOptions {
  enabled?: boolean;
}

export interface UseMissionDetailReturn {
  mission: Mission | null;
  goals: Goal[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to retrieve mission detail and associated goals.
 * Guards against missing missionId.
 */
export const useMissionDetail = (
  missionId: string | null | undefined,
  options: UseMissionDetailOptions = {},
): UseMissionDetailReturn => {
  const { enabled = true } = options;
  const [mission, setMission] = useState<Mission | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(missionId && enabled));
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!missionId || !enabled) {
      setMission(null);
      setGoals([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detail = await apiClient.getMission(missionId);
      const mapped = mapMissionResponseToMission(detail);
      setMission(mapped);
      setGoals(mapped.goals ?? []);
    } catch (err) {
      const actualError = err instanceof Error ? err : new Error(String(err));
      setError(actualError);
      setMission(null);
      setGoals([]);
    } finally {
      setIsLoading(false);
    }
  }, [missionId, enabled]);

  useEffect(() => {
    if (!missionId || !enabled) {
      return;
    }

    let isCancelled = false;

    apiClient
      .getMission(missionId)
      .then((detail) => {
        if (!isCancelled) {
          const mapped = mapMissionResponseToMission(detail);
          setMission(mapped);
          setGoals(mapped.goals ?? []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const actualError = err instanceof Error ? err : new Error(String(err));
          setError(actualError);
          setMission(null);
          setGoals([]);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [missionId, enabled]);

  return {
    mission,
    goals,
    isLoading,
    error,
    refetch: fetchDetail,
  };
};
