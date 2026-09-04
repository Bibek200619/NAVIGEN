import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRobot } from '../useRobot';
import type { WebSocketEnvelope } from '../../services/websocket';
import type { UseWebSocketReturn } from '../useWebSocket';
import type { RobotConnectionStatus } from '../../types/robot';

/* ------------------------------------------------------------------ */
/* Mock useWebSocket                                                   */
/* ------------------------------------------------------------------ */

interface RobotTelemetryPayload {
  connection_status?: RobotConnectionStatus;
  linear_velocity?: number;
  angular_velocity?: number;
  battery_level_pct?: number;
  is_stale?: boolean;
}

const mockUseWebSocket = vi.fn<() => UseWebSocketReturn<RobotTelemetryPayload>>();

vi.mock('../useWebSocket', () => ({
  useWebSocket: () => mockUseWebSocket(),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function defaultReturn(
  overrides: Partial<UseWebSocketReturn<RobotTelemetryPayload>> = {},
): UseWebSocketReturn<RobotTelemetryPayload> {
  return {
    isConnected: false,
    status: 'disconnected',
    latestMessage: null,
    sendMessage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

function makeEnvelope(
  payload: RobotTelemetryPayload,
  overrides: Partial<WebSocketEnvelope<RobotTelemetryPayload>> = {},
): WebSocketEnvelope<RobotTelemetryPayload> {
  return {
    schema_version: 1,
    event_type: 'robot.telemetry',
    robot_id: 'ugv-01',
    recorded_at: '2026-01-01T00:00:00.000Z',
    received_at: '2026-01-01T00:00:01.000Z',
    payload,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('useRobot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null robotState initially', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());

    const { result } = renderHook(() => useRobot());

    expect(result.current.robotState).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('maps robot.telemetry to RobotState correctly', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());
    const { result, rerender } = renderHook(() => useRobot());

    const envelope = makeEnvelope({
      connection_status: 'connected',
      linear_velocity: 2.0,
      angular_velocity: 0.5,
      battery_level_pct: 90,
      is_stale: false,
    });

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: envelope }),
    );
    rerender();

    const state = result.current.robotState;
    expect(state).not.toBeNull();
    expect(state!.id).toBe('ugv-01');
    expect(state!.connectionStatus).toBe('connected');
    expect(state!.isStale).toBe(false);
    expect(state!.velocity).toEqual({ linear: 2.0, angular: 0.5 });
  });

  it('ignores unrelated event types', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());
    const { result, rerender } = renderHook(() => useRobot());

    const unrelated = makeEnvelope(
      { battery_level_pct: 50 },
      { event_type: 'system.heartbeat' },
    );

    mockUseWebSocket.mockReturnValue(defaultReturn({ latestMessage: unrelated }));
    rerender();

    expect(result.current.robotState).toBeNull();
  });

  it('creates no velocity object when both velocity fields are undefined', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());
    const { result, rerender } = renderHook(() => useRobot());

    const envelope = makeEnvelope({
      connection_status: 'connected',
      is_stale: false,
    });

    mockUseWebSocket.mockReturnValue(defaultReturn({ latestMessage: envelope }));
    rerender();

    const state = result.current.robotState;
    expect(state).not.toBeNull();
    expect(state!.velocity).toBeUndefined();
  });

  it('maps stale state correctly', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());
    const { result, rerender } = renderHook(() => useRobot());

    const envelope = makeEnvelope({ is_stale: true });

    mockUseWebSocket.mockReturnValue(defaultReturn({ latestMessage: envelope }));
    rerender();

    expect(result.current.robotState!.isStale).toBe(true);
  });
});
