import { APP_CONFIG } from '../constants/config';
import { getAccessToken } from './session';
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${APP_CONFIG.API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error?.message || `Request failed (${response.status}).`,
      response.status,
    );
  }
  return response;
}
export const apiClient = {
  baseUrl: APP_CONFIG.API_BASE_URL,
  async get<T>(endpoint: string): Promise<T> {
    return (await apiFetch(endpoint)).json();
  },
  async post<T>(endpoint: string, data: unknown): Promise<T> {
    return (
      await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    ).json();
  },
};
