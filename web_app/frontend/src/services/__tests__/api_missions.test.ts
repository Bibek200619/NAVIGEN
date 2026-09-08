import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, generateIdempotencyKey } from '../api';
import type {
  MissionResponse,
  MissionDetailResponse,
  CommandResponse,
  CommandCreate,
} from '../../types/api';

describe('apiClient mission and command endpoints', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    apiClient.setTokenProvider(null);
  });

  it('generates a valid cryptographically secure idempotency key', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();

    expect(typeof key1).toBe('string');
    expect(key1.length).toBeGreaterThanOrEqual(8);
    expect(key1).not.toBe(key2);
  });

  it('GET /api/v1/missions correctly serializes query params', async () => {
    const mockMissionsPage = {
      items: [
        {
          id: 'm-1',
          robot_id: 'r-1',
          name: 'Patrol Mission',
          description: null,
          status: 'pending',
          created_by: 'u-1',
          started_at: null,
          completed_at: null,
          failure_reason: null,
          created_at: '2026-09-04T12:00:00Z',
          updated_at: '2026-09-04T12:00:00Z',
        } as MissionResponse,
      ],
      total: 1,
      limit: 20,
      offset: 0,
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockMissionsPage),
    });
    globalThis.fetch = fetchMock;

    const result = await apiClient.getMissions({
      robot_id: 'r-1',
      status: 'pending',
      limit: 20,
      offset: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/missions?');
    expect(url).toContain('robot_id=r-1');
    expect(url).toContain('status=pending');
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=0');
    expect(result).toEqual(mockMissionsPage);
  });

  it('GET /api/v1/missions/{mission_id} calls the detail endpoint', async () => {
    const mockDetail: MissionDetailResponse = {
      id: 'm-100',
      robot_id: 'r-1',
      name: 'Survey Route',
      description: 'Waypoint surveying',
      status: 'in_progress',
      created_by: 'u-1',
      started_at: '2026-09-04T12:00:00Z',
      completed_at: null,
      failure_reason: null,
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
      goals: [
        {
          id: 'g-1',
          mission_id: 'm-100',
          sequence_no: 1,
          frame_id: 'map',
          position_x: 5.0,
          position_y: 10.0,
          position_z: 0.0,
          orientation_x: 0.0,
          orientation_y: 0.0,
          orientation_z: 0.0,
          orientation_w: 1.0,
          reached_at: null,
          created_at: '2026-09-04T12:00:00Z',
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockDetail),
    });
    globalThis.fetch = fetchMock;

    const result = await apiClient.getMission('m-100');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/missions/m-100');
    expect(result).toEqual(mockDetail);
  });

  it('POST /api/v1/robots/{robot_id}/commands includes Idempotency-Key and payload', async () => {
    const mockResponse: CommandResponse = {
      id: 'cmd-1',
      robot_id: 'r-1',
      mission_id: 'm-1',
      requested_by: 'u-1',
      command_type: 'set_goal',
      status: 'accepted',
      request_payload: { frame_id: 'map' },
      response_payload: null,
      rejection_reason: null,
      failure_reason: null,
      requested_at: '2026-09-04T12:00:00Z',
      acknowledged_at: '2026-09-04T12:00:01Z',
      executed_at: null,
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:01Z',
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
    });
    globalThis.fetch = fetchMock;

    const commandData: CommandCreate = {
      mission_id: 'm-1',
      command_type: 'set_goal',
      payload: {
        frame_id: 'map',
        position: { x: 1, y: 2, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
    };

    const result = await apiClient.createRobotCommand('r-1', commandData);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/robots/r-1/commands');
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBeDefined();
    expect(init.headers['Idempotency-Key'].length).toBeGreaterThanOrEqual(8);
    expect(JSON.parse(init.body)).toEqual(commandData);
    expect(result).toEqual(mockResponse);
  });
});
