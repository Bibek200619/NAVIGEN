import { useSyncExternalStore } from 'react';
import { APP_CONFIG } from '../constants/config';
let accessToken = APP_CONFIG.SIMULATION ? 'navigen-local-simulation' : '';
const listeners = new Set<() => void>();
export const getAccessToken = () => accessToken;
export function setAccessToken(token: string) {
  accessToken = token.trim();
  listeners.forEach((listener) => listener());
}
export function useAccessToken() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getAccessToken);
}
