import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import type { Robot } from '../types/api';

export interface UseRobotDataReturn {
  robots: Robot[];
  selectedRobot: Robot | null;
  selectedRobotId: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setSelectedRobot: (robot: Robot | null) => void;
}

/**
 * Hook to retrieve registered robots from the backend REST API.
 * Defaults selectedRobot to the first returned robot when available.
 */
export const useRobotData = (): UseRobotDataReturn => {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRobots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await apiClient.getRobots();
      const items = page?.items ?? [];
      setRobots(items);
      if (items.length > 0) {
        setSelectedRobot(items[0]);
      } else {
        setSelectedRobot(null);
      }
    } catch (err) {
      const actualError = err instanceof Error ? err : new Error(String(err));
      setError(actualError);
      setRobots([]);
      setSelectedRobot(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    apiClient
      .getRobots()
      .then((page) => {
        if (!isCancelled) {
          const items = page?.items ?? [];
          setRobots(items);
          if (items.length > 0) {
            setSelectedRobot(items[0]);
          } else {
            setSelectedRobot(null);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const actualError = err instanceof Error ? err : new Error(String(err));
          setError(actualError);
          setRobots([]);
          setSelectedRobot(null);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    robots,
    selectedRobot,
    selectedRobotId: selectedRobot?.id ?? null,
    isLoading,
    error,
    refetch: fetchRobots,
    setSelectedRobot,
  };
};
