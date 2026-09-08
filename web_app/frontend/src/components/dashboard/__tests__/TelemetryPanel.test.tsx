import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TelemetryPanel } from '../TelemetryPanel';
import type { UseTelemetryReturn } from '../../../hooks/useTelemetry';
import type { UseTelemetryHistoryReturn } from '../../../hooks/useTelemetryHistory';

vi.mock('../../../hooks/useTelemetry', () => ({
  useTelemetry: vi.fn(),
}));

vi.mock('../../../hooks/useTelemetryHistory', () => ({
  useTelemetryHistory: vi.fn(),
}));

import { useTelemetry } from '../../../hooks/useTelemetry';
import { useTelemetryHistory } from '../../../hooks/useTelemetryHistory';

const mockUseTelemetry = vi.mocked(useTelemetry);
const mockUseTelemetryHistory = vi.mocked(useTelemetryHistory);

function defaultWsTelemetryReturn(overrides: Partial<UseTelemetryReturn> = {}): UseTelemetryReturn {
  return {
    telemetry: null,
    status: 'disconnected',
    isConnected: false,
    ...overrides,
  };
}

function defaultHistoryReturn(overrides: Partial<UseTelemetryHistoryReturn> = {}): UseTelemetryHistoryReturn {
  return {
    history: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('TelemetryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTelemetry.mockReturnValue(defaultWsTelemetryReturn());
    mockUseTelemetryHistory.mockReturnValue(defaultHistoryReturn());
  });

  it('renders real live telemetry values when present', () => {
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 92.4,
          linearVelocity: 0.85,
          angularVelocity: 0.12,
          isStale: false,
          positionX: 10.5,
          positionY: -4.2,
          positionZ: 0.0,
          yaw: 1.57,
        },
        status: 'connected',
        isConnected: true,
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('92.4%')).toBeInTheDocument();
    expect(screen.getByText('0.85')).toBeInTheDocument();
    expect(screen.getByText('0.12')).toBeInTheDocument();
    expect(screen.getByText('10.50m')).toBeInTheDocument();
    expect(screen.getByText('-4.20m')).toBeInTheDocument();
    expect(screen.getByText('0.00m')).toBeInTheDocument();
    expect(screen.getByText('1.57')).toBeInTheDocument();
  });

  it('renders stale telemetry state properly', () => {
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        telemetry: {
          timestamp: 1700000000000,
          linearVelocity: 0.0,
          isStale: true,
        },
        status: 'connected',
        isConnected: true,
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText('State: Stale')).toBeInTheDocument();
  });

  it('renders history empty state when no historical samples exist', () => {
    mockUseTelemetryHistory.mockReturnValue(
      defaultHistoryReturn({
        history: [],
        isLoading: false,
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('No telemetry history available')).toBeInTheDocument();
  });

  it('renders localized history error without crashing live telemetry', () => {
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 75.0,
          linearVelocity: 0.5,
        },
        status: 'connected',
        isConnected: true,
      }),
    );

    mockUseTelemetryHistory.mockReturnValue(
      defaultHistoryReturn({
        history: [],
        error: new Error('Unauthorized telemetry query'),
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    // Live telemetry still rendered
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    // Localized history error displayed
    expect(screen.getByText(/History unavailable: Unauthorized telemetry query/i)).toBeInTheDocument();
  });

  it('exercises full state lifecycle: connected + live -> stale -> reconnecting -> disconnected -> live again', () => {
    // 1. connected + live
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        status: 'connected',
        isConnected: true,
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 95.0,
          linearVelocity: 1.25,
          angularVelocity: 0.15,
          positionX: 10.0,
          positionY: -5.0,
          positionZ: 0.0,
          yaw: 0.78,
          isStale: false,
        },
      }),
    );

    const { rerender } = render(<TelemetryPanel robotId="robot-1" />);

    // 1. In connected + live state
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('State: Fresh')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('1.25')).toBeInTheDocument();
    expect(screen.getByText('0.15')).toBeInTheDocument();
    expect(screen.getByText('10.00m')).toBeInTheDocument();
    expect(screen.getByText('-5.00m')).toBeInTheDocument();
    expect(screen.queryByText('No telemetry data')).not.toBeInTheDocument();

    // 2. -> stale
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        status: 'connected',
        isConnected: true,
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 95.0,
          linearVelocity: 0.0,
          angularVelocity: 0.05,
          positionX: 10.0,
          positionY: -5.0,
          positionZ: 0.0,
          yaw: 0.78,
          isStale: true,
        },
      }),
    );
    rerender(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText('State: Stale')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.getByText('0.05')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();

    // 3. -> reconnecting
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        status: 'reconnecting',
        isConnected: false,
        telemetry: null,
      }),
    );
    rerender(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('No telemetry data')).toBeInTheDocument();
    expect(screen.getByText('Connection lost. Attempting to reconnect...')).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();

    // 4. -> disconnected
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        status: 'disconnected',
        isConnected: false,
        telemetry: null,
      }),
    );
    rerender(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('No telemetry data')).toBeInTheDocument();
    expect(screen.getByText('WebSocket disconnected. Telemetry unavailable.')).toBeInTheDocument();

    // 5. -> live again
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        status: 'connected',
        isConnected: true,
        telemetry: {
          timestamp: 1700000005000,
          batteryLevel: 91.2,
          linearVelocity: 0.75,
          angularVelocity: -0.2,
          positionX: 12.5,
          positionY: -4.0,
          positionZ: 0.1,
          yaw: 1.15,
          isStale: false,
        },
      }),
    );
    rerender(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('State: Fresh')).toBeInTheDocument();
    expect(screen.getByText('91.2%')).toBeInTheDocument();
    expect(screen.getByText('0.75')).toBeInTheDocument();
    expect(screen.getByText('-0.20')).toBeInTheDocument();
    expect(screen.getByText('12.50m')).toBeInTheDocument();
    expect(screen.getByText('-4.00m')).toBeInTheDocument();
    expect(screen.queryByText('No telemetry data')).not.toBeInTheDocument();
    expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconnecting')).not.toBeInTheDocument();
  });

  it('updates telemetry freshness and data age dynamically as packets update', () => {
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        status: 'connected',
        isConnected: true,
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 80.0,
          linearVelocity: 1.0,
          angularVelocity: 0.0,
          dataAgeMs: 120,
          isStale: false,
        },
      }),
    );

    const { rerender } = render(<TelemetryPanel robotId="robot-1" />);
    expect(screen.getByText('Age: 120 ms')).toBeInTheDocument();

    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        status: 'connected',
        isConnected: true,
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 80.0,
          linearVelocity: 1.0,
          angularVelocity: 0.0,
          dataAgeMs: 4200,
          isStale: true,
        },
      }),
    );
    rerender(<TelemetryPanel robotId="robot-1" />);
    expect(screen.getByText('Age: 4200 ms')).toBeInTheDocument();
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });
});
