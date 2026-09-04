import { APP_CONFIG } from '../constants/config';
import type {
  Robot,
  RobotTelemetryResponse,
  SensorStatusResponse,
  SafetyEventResponse,
  LocalizationStatusResponse,
  SystemStatusResponse,
  Page,
  ListRobotsParams,
  GetTelemetryParams,
  GetSafetyParams,
  MissionResponse,
  MissionDetailResponse,
  MissionGoalResponse,
  CommandResponse,
  CommandCreate,
  ListMissionsParams,
  MissionCreate,
  MissionUpdate,
} from '../types/api';

export type TokenProvider = () => string | null | Promise<string | null>;

export interface RequestOptions {
  headers?: Record<string, string>;
  token?: string | null;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    statusText: string,
    options?: { code?: string; details?: unknown; requestId?: string },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.code = options?.code;
    this.details = options?.details;
    this.requestId = options?.requestId;
  }
}

function buildQueryString(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Generates a cryptographically secure idempotency key.
 * Uses crypto.randomUUID() or crypto.getRandomValues(). Never uses Math.random().
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  throw new Error('Cryptographically secure random number generation is not available');
}

/**
 * Typed REST API client for backend communication.
 */
export const apiClient = {
  baseUrl: APP_CONFIG.API_BASE_URL,
  tokenProvider: null as TokenProvider | null,

  setTokenProvider(provider: TokenProvider | null): void {
    this.tokenProvider = provider;
  },

  async getAuthHeader(options?: RequestOptions): Promise<Record<string, string>> {
    const token = options?.token ?? (this.tokenProvider ? await this.tokenProvider() : null);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  },

  async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      let errorDetails: unknown;
      let requestId: string | undefined;

      try {
        const errorJson = await response.json();
        if (errorJson?.error && typeof errorJson.error === 'object') {
          errorMessage = errorJson.error.message || errorMessage;
          errorCode = errorJson.error.code;
          errorDetails = errorJson.error.details;
          requestId = errorJson.error.request_id;
        } else if (typeof errorJson?.detail === 'string') {
          errorMessage = errorJson.detail;
        } else if (Array.isArray(errorJson?.detail)) {
          errorMessage = errorJson.detail
            .map((item: { msg?: string }) => item.msg || JSON.stringify(item))
            .join('; ');
          errorDetails = errorJson.detail;
        }
      } catch {
        // Fall back to HTTP status message when response is not JSON
      }

      throw new ApiError(errorMessage, response.status, response.statusText, {
        code: errorCode,
        details: errorDetails,
        requestId,
      });
    }

    const text = await response.text();
    if (!text) {
      return null as T;
    }
    return JSON.parse(text) as T;
  },

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    const authHeader = await this.getAuthHeader(options);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Accept: 'application/json',
        ...authHeader,
        ...options?.headers,
      },
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  },

  async post<T>(endpoint: string, data: unknown, options?: RequestOptions): Promise<T> {
    const authHeader = await this.getAuthHeader(options);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeader,
        ...options?.headers,
      },
      body: JSON.stringify(data),
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  },

  async patch<T>(endpoint: string, data: unknown, options?: RequestOptions): Promise<T> {
    const authHeader = await this.getAuthHeader(options);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeader,
        ...options?.headers,
      },
      body: JSON.stringify(data),
      signal: options?.signal,
    });
    return this.handleResponse<T>(response);
  },

  // ------------------------------------------------------------------
  // Typed backend endpoints
  // ------------------------------------------------------------------

  async getStatus(options?: RequestOptions): Promise<SystemStatusResponse> {
    return this.get<SystemStatusResponse>('/api/v1/status', options);
  },

  async getRobots(params?: ListRobotsParams, options?: RequestOptions): Promise<Page<Robot>> {
    const query = buildQueryString(params ? {
      limit: params.limit,
      offset: params.offset,
    } : undefined);
    return this.get<Page<Robot>>(`/api/v1/robots${query}`, options);
  },

  async getRobot(robotId: string, options?: RequestOptions): Promise<Robot> {
    return this.get<Robot>(`/api/v1/robots/${encodeURIComponent(robotId)}`, options);
  },

  async getRobotTelemetry(
    robotId: string,
    params?: GetTelemetryParams,
    options?: RequestOptions,
  ): Promise<RobotTelemetryResponse[]> {
    const query = buildQueryString(params ? {
      from: params.from,
      to: params.to,
      limit: params.limit,
    } : undefined);
    return this.get<RobotTelemetryResponse[]>(
      `/api/v1/robots/${encodeURIComponent(robotId)}/telemetry${query}`,
      options,
    );
  },

  async getRobotSafety(
    robotId: string,
    params?: GetSafetyParams,
    options?: RequestOptions,
  ): Promise<SafetyEventResponse[]> {
    const query = buildQueryString(params ? {
      limit: params.limit,
    } : undefined);
    return this.get<SafetyEventResponse[]>(
      `/api/v1/robots/${encodeURIComponent(robotId)}/safety${query}`,
      options,
    );
  },

  async getRobotSensors(
    robotId: string,
    options?: RequestOptions,
  ): Promise<SensorStatusResponse[]> {
    return this.get<SensorStatusResponse[]>(
      `/api/v1/robots/${encodeURIComponent(robotId)}/sensors`,
      options,
    );
  },

  async getRobotLocalization(
    robotId: string,
    options?: RequestOptions,
  ): Promise<LocalizationStatusResponse | null> {
    return this.get<LocalizationStatusResponse | null>(
      `/api/v1/robots/${encodeURIComponent(robotId)}/localization`,
      options,
    );
  },

  async getMissions(
    params?: ListMissionsParams,
    options?: RequestOptions,
  ): Promise<Page<MissionResponse>> {
    const query = buildQueryString(params ? {
      robot_id: params.robot_id,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    } : undefined);
    return this.get<Page<MissionResponse>>(`/api/v1/missions${query}`, options);
  },

  async getMission(
    missionId: string,
    options?: RequestOptions,
  ): Promise<MissionDetailResponse> {
    return this.get<MissionDetailResponse>(
      `/api/v1/missions/${encodeURIComponent(missionId)}`,
      options,
    );
  },

  async getMissionGoals(
    missionId: string,
    options?: RequestOptions,
  ): Promise<MissionGoalResponse[]> {
    return this.get<MissionGoalResponse[]>(
      `/api/v1/missions/${encodeURIComponent(missionId)}/goals`,
      options,
    );
  },

  async createMission(
    data: MissionCreate,
    options?: RequestOptions,
  ): Promise<MissionDetailResponse> {
    return this.post<MissionDetailResponse>('/api/v1/missions', data, options);
  },

  async updateMission(
    missionId: string,
    data: MissionUpdate,
    options?: RequestOptions,
  ): Promise<MissionResponse> {
    return this.patch<MissionResponse>(
      `/api/v1/missions/${encodeURIComponent(missionId)}`,
      data,
      options,
    );
  },

  async createRobotCommand(
    robotId: string,
    command: CommandCreate,
    options?: RequestOptions & { idempotencyKey?: string },
  ): Promise<CommandResponse> {
    const key = options?.idempotencyKey || generateIdempotencyKey();
    const headers = {
      'Idempotency-Key': key,
      ...options?.headers,
    };
    return this.post<CommandResponse>(
      `/api/v1/robots/${encodeURIComponent(robotId)}/commands`,
      command,
      {
        ...options,
        headers,
      },
    );
  },

  async getCommand(commandId: string, options?: RequestOptions): Promise<CommandResponse> {
    return this.get<CommandResponse>(
      `/api/v1/commands/${encodeURIComponent(commandId)}`,
      options,
    );
  },
};
