import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelemetry } from '../useTelemetry';
import type { UseWebSocketReturn } from '../useWebSocket';
import type { WebSocketEnvelope } from '../../services/websocket';

const mockUseWebSocket = vi.fn<() => UseWebSocketReturn>();
const socketDefaults = { sendMessage: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
vi.mock('../useWebSocket', () => ({ useWebSocket: () => mockUseWebSocket() }));

describe('useTelemetry', () => {
  it('returns no telemetry before a packet arrives', () => {
    mockUseWebSocket.mockReturnValue({ isConnected: false, status: 'disconnected', latestMessage: null, ...socketDefaults });
    const { result } = renderHook(() => useTelemetry());
    expect(result.current.telemetry).toBeNull();
    expect(result.current.status).toBe('disconnected');
  });

  it('maps a robot telemetry envelope', () => {
    const packet: WebSocketEnvelope = {
      schema_version: 1, event_type: 'robot.telemetry', robot_id: 'ugv-01',
      recorded_at: '2026-01-01T00:00:00Z', received_at: '2026-01-01T00:00:01Z',
      payload: { battery_level_pct: 85, linear_velocity: 1.5, angular_velocity: 0.75, connection_status: 'connected', is_stale: false },
    };
    mockUseWebSocket.mockReturnValue({ isConnected: true, status: 'connected', latestMessage: null, ...socketDefaults });
    const { result, rerender } = renderHook(() => useTelemetry());
    mockUseWebSocket.mockReturnValue({ isConnected: true, status: 'connected', latestMessage: packet, ...socketDefaults });
    rerender();
    expect(result.current.telemetry).toMatchObject({ batteryLevel: 85, linearVelocity: 1.5, angularVelocity: 0.75, connectionStatus: 'connected' });
    expect(result.current.isConnected).toBe(true);
  });
});
