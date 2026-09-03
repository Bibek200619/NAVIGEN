export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ROBOT: '/robot',
  MISSION: '/mission',
  SENSORS: '/sensors',
  CAMERA: '/camera',
  LOGS: '/logs',
  SETTINGS: '/settings',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
