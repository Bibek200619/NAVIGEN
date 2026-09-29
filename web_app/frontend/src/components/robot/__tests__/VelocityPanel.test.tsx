import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VelocityPanel } from '../VelocityPanel';
import type { UseTelemetryReturn } from '../../../hooks/useTelemetry';

/* ------------------------------------------------------------------ */
/* Mock useTelemetry                                                   */
/* ------------------------------------------------------------------ */

const mockUseTelemetry = vi.fn<() => UseTelemetryReturn>();

vi.mock('../../../hooks/useTelemetry', () => ({
  useTelemetry: () => mockUseTelemetry(),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function defaultTelemetryReturn(
  overrides: Partial<UseTelemetryReturn> = {},
): UseTelemetryReturn {
  return {
    telemetry: null,
    isConnected: false,
    status: 'disconnected',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('VelocityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when telemetry is null', () => {
    mockUseTelemetry.mockReturnValue(defaultTelemetryReturn());

    render(<VelocityPanel />);

    expect(screen.getByText('No velocity telemetry')).toBeInTheDocument();
  });

  it('renders live linear velocity value', () => {
    mockUseTelemetry.mockReturnValue(
      defaultTelemetryReturn({
        telemetry: {
          timestamp: Date.now(),
          linearVelocity: 1.5,
          angularVelocity: 0.0,
          isStale: false,
        },
        isConnected: true,
        status: 'connected',
      }),
    );

    render(<VelocityPanel />);

    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.getByText('m/s')).toBeInTheDocument();
  });

  it('renders live angular velocity value', () => {
    mockUseTelemetry.mockReturnValue(
      defaultTelemetryReturn({
        telemetry: {
          timestamp: Date.now(),
          linearVelocity: 0.0,
          angularVelocity: 0.75,
          isStale: false,
        },
        isConnected: true,
        status: 'connected',
      }),
    );

    render(<VelocityPanel />);

    expect(screen.getByText('0.75')).toBeInTheDocument();
    expect(screen.getByText('rad/s')).toBeInTheDocument();
  });

  it('shows dashes when velocity fields are undefined', () => {
    mockUseTelemetry.mockReturnValue(
      defaultTelemetryReturn({
        telemetry: {
          timestamp: Date.now(),
          isStale: false,
        },
        isConnected: true,
        status: 'connected',
      }),
    );

    render(<VelocityPanel />);

    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('displays Stale badge when telemetry is stale', () => {
    mockUseTelemetry.mockReturnValue(
      defaultTelemetryReturn({
        telemetry: {
          timestamp: Date.now(),
          linearVelocity: 0,
          angularVelocity: 0,
          isStale: true,
        },
        isConnected: true,
        status: 'connected',
      }),
    );

    render(<VelocityPanel />);

    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('displays Live badge when telemetry is fresh', () => {
    mockUseTelemetry.mockReturnValue(
      defaultTelemetryReturn({
        telemetry: {
          timestamp: Date.now(),
          linearVelocity: 1.0,
          angularVelocity: 0.5,
          isStale: false,
        },
        isConnected: true,
        status: 'connected',
      }),
    );

    render(<VelocityPanel />);

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('displays Unavailable badge when no telemetry exists', () => {
    mockUseTelemetry.mockReturnValue(defaultTelemetryReturn());

    render(<VelocityPanel />);

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
});
