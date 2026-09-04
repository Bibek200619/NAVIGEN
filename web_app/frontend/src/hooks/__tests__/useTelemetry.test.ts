import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelemetry } from '../useTelemetry';
import type { WebSocketEnvelope } from '../../services/websocket';
import type { UseWebSocketReturn } from '../useWebSocket';

/* ------------------------------------------------------------------ */
/* Mock useWebSocket                                                   */
/* ------------------------------------------------------------------ */

interface TelemetryPayload {
  connection_status?: 'connected' | 'disconnected' | 'connecting';
  linear_velocity?: number;
  angular_velocity?: number;
  battery_level_pct?: number;
  is_stale?: boolean;
}

const mockUseWebSocket = vi.fn<() => UseWebSocketReturn<TelemetryPayload>>();

vi.mock('../useWebSocket', () => ({
  useWebSocket: () => mockUseWebSocket(),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function defaultReturn(
  overrides: Partial<UseWebSocketReturn<TelemetryPayload>> = {},
): UseWebSocketReturn<TelemetryPayload> {
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
  payload: TelemetryPayload,
  overrides: Partial<WebSocketEnvelope<TelemetryPayload>> = {},
): WebSocketEnvelope<TelemetryPayload> {
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

describe('useTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null telemetry initially when no message is available', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());

    const { result } = renderHook(() => useTelemetry());

    expect(result.current.telemetry).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.status).toBe('disconnected');
  });

  it('maps a valid robot.telemetry message to TelemetryData', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());
    const { result, rerender } = renderHook(() => useTelemetry());
    expect(result.current.telemetry).toBeNull();

    const envelope = makeEnvelope({
      connection_status: 'connected',
      linear_velocity: 1.5,
      angular_velocity: 0.75,
      battery_level_pct: 85,
      is_stale: false,
    });

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: envelope }),
    );
    rerender();

    const telemetry = result.current.telemetry;
    expect(telemetry).not.toBeNull();
    expect(telemetry!.batteryLevel).toBe(85);
    expect(telemetry!.linearVelocity).toBe(1.5);
    expect(telemetry!.angularVelocity).toBe(0.75);
    expect(telemetry!.connectionStatus).toBe('connected');
    expect(telemetry!.isStale).toBe(false);
    expect(telemetry!.timestamp).toBe(Date.parse('2026-01-01T00:00:01.000Z'));
  });

  it('ignores unrelated WebSocket event types', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());
    const { result, rerender } = renderHook(() => useTelemetry());

    const unrelated = makeEnvelope(
      { battery_level_pct: 50 },
      { event_type: 'system.heartbeat' },
    );

    mockUseWebSocket.mockReturnValue(defaultReturn({ latestMessage: unrelated }));
    rerender();

    expect(result.current.telemetry).toBeNull();
  });

  it('handles missing optional payload fields without crashing', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn());
    const { result, rerender } = renderHook(() => useTelemetry());

    const envelope = makeEnvelope({});

    mockUseWebSocket.mockReturnValue(defaultReturn({ latestMessage: envelope }));
    rerender();

    const telemetry = result.current.telemetry;
    expect(telemetry).not.toBeNull();
    expect(telemetry!.batteryLevel).toBeUndefined();
    expect(telemetry!.linearVelocity).toBeUndefined();
    expect(telemetry!.angularVelocity).toBeUndefined();
    expect(telemetry!.connectionStatus).toBeUndefined();
    expect(telemetry!.isStale).toBeUndefined();
  });

  it('passes through WebSocket status and isConnected from the underlying hook', () => {
    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected' }),
    );

    const { result } = renderHook(() => useTelemetry());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.status).toBe('connected');
  });
});
