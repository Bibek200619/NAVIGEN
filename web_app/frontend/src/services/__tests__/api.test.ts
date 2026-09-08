import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from '../api';
import { APP_CONFIG } from '../../constants/config';

describe('apiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.setTokenProvider(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getStatus calls /api/v1/status without auth by default', async () => {
    const mockStatus = {
      status: 'ok',
      version: '1',
      database: 'connected',
      ugv_bridge: 'connected',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockStatus),
    } as Response);

    const result = await apiClient.getStatus();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${APP_CONFIG.API_BASE_URL}/api/v1/status`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      }),
    );
    expect(result).toEqual(mockStatus);
  });

  it('getRobots serializes limit and offset into URLSearchParams', async () => {
    const mockPage = {
      items: [],
      total: 0,
      limit: 10,
      offset: 20,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockPage),
    } as Response);

    const result = await apiClient.getRobots({ limit: 10, offset: 20 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${APP_CONFIG.API_BASE_URL}/api/v1/robots?limit=10&offset=20`,
      expect.any(Object),
    );
    expect(result).toEqual(mockPage);
  });

  it('getRobot encodes robot ID', async () => {
    const mockRobot = {
      id: 'ugv/alpha 1',
      name: 'Alpha',
      slug: 'alpha',
      status: 'idle',
      connection_status: 'connected',
      last_seen_at: null,
      description: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockRobot),
    } as Response);

    await apiClient.getRobot('ugv/alpha 1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${APP_CONFIG.API_BASE_URL}/api/v1/robots/ugv%2Falpha%201`,
      expect.any(Object),
    );
  });

  it('getRobotTelemetry serializes from, to, and limit parameters', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([]),
    } as Response);

    await apiClient.getRobotTelemetry('robot-1', {
      from: '2026-01-01T00:00:00Z',
      to: '2026-01-02T00:00:00Z',
      limit: 50,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${APP_CONFIG.API_BASE_URL}/api/v1/robots/robot-1/telemetry?from=2026-01-01T00%3A00%3A00Z&to=2026-01-02T00%3A00%3A00Z&limit=50`,
      expect.any(Object),
    );
  });

  it('getRobotSafety passes limit parameter', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([]),
    } as Response);

    await apiClient.getRobotSafety('robot-1', { limit: 25 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${APP_CONFIG.API_BASE_URL}/api/v1/robots/robot-1/safety?limit=25`,
      expect.any(Object),
    );
  });

  it('getRobotSensors calls /api/v1/robots/{id}/sensors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([]),
    } as Response);

    await apiClient.getRobotSensors('robot-1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${APP_CONFIG.API_BASE_URL}/api/v1/robots/robot-1/sensors`,
      expect.any(Object),
    );
  });

  it('getRobotLocalization returns null when response is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    } as Response);

    const result = await apiClient.getRobotLocalization('robot-1');

    expect(result).toBeNull();
  });

  it('handles backend ErrorResponse format', async () => {
    const errorBody = {
      error: {
        code: 'not_found',
        message: 'Robot not found',
        details: { robot_id: 'bad-id' },
        request_id: 'req-123',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => errorBody,
    } as Response);

    await expect(apiClient.getRobot('bad-id')).rejects.toThrow(ApiError);
    await expect(apiClient.getRobot('bad-id')).rejects.toMatchObject({
      message: 'Robot not found',
      status: 404,
      statusText: 'Not Found',
      code: 'not_found',
      details: { robot_id: 'bad-id' },
      requestId: 'req-123',
    });
  });

  it('attaches Bearer token when tokenProvider is configured', async () => {
    apiClient.setTokenProvider(() => 'test-bearer-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({}),
    } as Response);

    await apiClient.getRobots();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-bearer-token',
        }),
      }),
    );
  });

  it('attaches explicit token passed in request options', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({}),
    } as Response);

    await apiClient.getRobots(undefined, { token: 'explicit-token' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer explicit-token',
        }),
      }),
    );
  });
});
