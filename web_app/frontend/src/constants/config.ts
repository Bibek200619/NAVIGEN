const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const APP_CONFIG = {
  SIMULATION:
    import.meta.env.DEV && import.meta.env.VITE_SIMULATION_MODE === 'true',
  API_BASE_URL: apiUrl,
  WS_URL:
    import.meta.env.VITE_WS_URL ||
    `${apiUrl ? apiUrl.replace(/^http/, 'ws') : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`}/ws/v1/telemetry`,
} as const;
