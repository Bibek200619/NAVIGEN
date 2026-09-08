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

  it('successively updates telemetry state when new packets arrive (packet A -> packet B)', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn({ isConnected: true, status: 'connected' }));
    const { result, rerender } = renderHook(() => useTelemetry());

    expect(result.current.telemetry).toBeNull();

    // Packet A arrives
    const packetA = makeEnvelope(
      {
        battery_level_pct: 95,
        linear_velocity: 1.2,
        angular_velocity: 0.1,
        connection_status: 'connected',
        is_stale: false,
      },
      { received_at: '2026-01-01T00:00:01.000Z' },
    );

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: packetA }),
    );
    rerender();

    expect(result.current.telemetry).toEqual({
      timestamp: Date.parse('2026-01-01T00:00:01.000Z'),
      batteryLevel: 95,
      linearVelocity: 1.2,
      angularVelocity: 0.1,
      connectionStatus: 'connected',
      isStale: false,
    });

    // Packet B arrives with updated values
    const packetB = makeEnvelope(
      {
        battery_level_pct: 92,
        linear_velocity: 2.4,
        angular_velocity: -0.3,
        connection_status: 'connected',
        is_stale: false,
      },
      { received_at: '2026-01-01T00:00:02.500Z' },
    );

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: packetB }),
    );
    rerender();

    expect(result.current.telemetry).toEqual({
      timestamp: Date.parse('2026-01-01T00:00:02.500Z'),
      batteryLevel: 92,
      linearVelocity: 2.4,
      angularVelocity: -0.3,
      connectionStatus: 'connected',
      isStale: false,
    });
  });

  it('replaces previous telemetry state and does not retain stale fields when omitted in subsequent packet', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn({ isConnected: true, status: 'connected' }));
    const { result, rerender } = renderHook(() => useTelemetry());

    // Packet A: all fields populated
    const packetA = makeEnvelope(
      {
        battery_level_pct: 90,
        linear_velocity: 1.5,
        angular_velocity: 0.25,
        connection_status: 'connected',
        is_stale: false,
      },
      { received_at: '2026-01-01T00:00:01.000Z' },
    );

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: packetA }),
    );
    rerender();

    expect(result.current.telemetry).toEqual({
      timestamp: Date.parse('2026-01-01T00:00:01.000Z'),
      batteryLevel: 90,
      linearVelocity: 1.5,
      angularVelocity: 0.25,
      connectionStatus: 'connected',
      isStale: false,
    });

    // Packet B: only linear_velocity and is_stale provided; omitted fields must be undefined
    const packetB = makeEnvelope(
      {
        linear_velocity: 0.0,
        is_stale: true,
      },
      { received_at: '2026-01-01T00:00:03.000Z' },
    );

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: packetB }),
    );
    rerender();

    const telemetry = result.current.telemetry;
    expect(telemetry).not.toBeNull();
    expect(telemetry!.timestamp).toBe(Date.parse('2026-01-01T00:00:03.000Z'));
    expect(telemetry!.linearVelocity).toBe(0.0);
    expect(telemetry!.isStale).toBe(true);
    // Explicitly verify stale fields from Packet A are NOT retained
    expect(telemetry!.batteryLevel).toBeUndefined();
    expect(telemetry!.angularVelocity).toBeUndefined();
    expect(telemetry!.connectionStatus).toBeUndefined();
  });

  it('retains previous telemetry state when an unrelated non-telemetry envelope arrives', () => {
    mockUseWebSocket.mockReturnValue(defaultReturn({ isConnected: true, status: 'connected' }));
    const { result, rerender } = renderHook(() => useTelemetry());

    const packetA = makeEnvelope(
      {
        battery_level_pct: 88,
        linear_velocity: 1.1,
        angular_velocity: 0.0,
      },
      { received_at: '2026-01-01T00:00:01.000Z' },
    );

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: packetA }),
    );
    rerender();

    expect(result.current.telemetry?.batteryLevel).toBe(88);

    // Unrelated envelope
    const unrelated = makeEnvelope(
      { battery_level_pct: 50 },
      { event_type: 'system.heartbeat', received_at: '2026-01-01T00:00:02.000Z' },
    );

    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: unrelated }),
    );
    rerender();

    // Previous telemetry is retained rather than being cleared or corrupted
    expect(result.current.telemetry?.batteryLevel).toBe(88);
    expect(result.current.telemetry?.linearVelocity).toBe(1.1);
  });

  it('reflects WebSocket connection status changes along with telemetry updates', () => {
    // 1. Initial connecting
    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: false, status: 'connecting', latestMessage: null }),
    );
    const { result, rerender } = renderHook(() => useTelemetry());

    expect(result.current.status).toBe('connecting');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.telemetry).toBeNull();

    // 2. Connected with live packet
    const livePacket = makeEnvelope(
      { battery_level_pct: 99, linear_velocity: 0.5, is_stale: false },
      { received_at: '2026-01-01T00:00:01.000Z' },
    );
    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: true, status: 'connected', latestMessage: livePacket }),
    );
    rerender();

    expect(result.current.status).toBe('connected');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.telemetry?.batteryLevel).toBe(99);

    // 3. Reconnecting
    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: false, status: 'reconnecting', latestMessage: livePacket }),
    );
    rerender();

    expect(result.current.status).toBe('reconnecting');
    expect(result.current.isConnected).toBe(false);

    // 4. Disconnected
    mockUseWebSocket.mockReturnValue(
      defaultReturn({ isConnected: false, status: 'disconnected', latestMessage: livePacket }),
    );
    rerender();

    expect(result.current.status).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
  });
});
