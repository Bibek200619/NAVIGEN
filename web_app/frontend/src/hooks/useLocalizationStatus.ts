import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import type { LocalizationStatusResponse } from '../types/api';

export interface UseLocalizationStatusOptions {
  enabled?: boolean;
}

export interface UseLocalizationStatusReturn {
  localization: LocalizationStatusResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to retrieve localization status for a specific robot.
 * Only triggers network request when a valid robotId is present.
 */
export const useLocalizationStatus = (
  robotId: string | null | undefined,
  options: UseLocalizationStatusOptions = {},
): UseLocalizationStatusReturn => {
  const { enabled = true } = options;
  const [localization, setLocalization] = useState<LocalizationStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(robotId && enabled));
  const [error, setError] = useState<Error | null>(null);

  const fetchLocalization = useCallback(async () => {
    if (!robotId || !enabled) {
      setLocalization(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.getRobotLocalization(robotId);
      setLocalization(data ?? null);
    } catch (err) {
      const actualError = err instanceof Error ? err : new Error(String(err));
      setError(actualError);
      setLocalization(null);
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
      .getRobotLocalization(robotId)
      .then((data) => {
        if (!isCancelled) {
          setLocalization(data ?? null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const actualError = err instanceof Error ? err : new Error(String(err));
          setError(actualError);
          setLocalization(null);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [robotId, enabled]);

  return {
    localization,
    isLoading,
    error,
    refetch: fetchLocalization,
  };
};
