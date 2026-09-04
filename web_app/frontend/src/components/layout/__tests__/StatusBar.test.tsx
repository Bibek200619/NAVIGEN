import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../StatusBar';
import type { UseWebSocketReturn } from '../../../hooks/useWebSocket';

/* ------------------------------------------------------------------ */
/* Mock useWebSocket                                                   */
/* ------------------------------------------------------------------ */

const mockUseWebSocket = vi.fn<() => UseWebSocketReturn>();

vi.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: () => mockUseWebSocket(),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function defaultWsReturn(
  overrides: Partial<UseWebSocketReturn> = {},
): UseWebSocketReturn {
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

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Gateway: Connected when connected', () => {
    mockUseWebSocket.mockReturnValue(
      defaultWsReturn({ isConnected: true, status: 'connected' }),
    );

    render(<StatusBar />);

    expect(screen.getByText('Gateway: Connected')).toBeInTheDocument();
  });

  it('shows Gateway: Connecting when connecting', () => {
    mockUseWebSocket.mockReturnValue(
      defaultWsReturn({ status: 'connecting' }),
    );

    render(<StatusBar />);

    expect(screen.getByText('Gateway: Connecting')).toBeInTheDocument();
  });

  it('shows Gateway: Reconnecting when reconnecting', () => {
    mockUseWebSocket.mockReturnValue(
      defaultWsReturn({ status: 'reconnecting' }),
    );

    render(<StatusBar />);

    expect(screen.getByText('Gateway: Reconnecting')).toBeInTheDocument();
  });

  it('shows Gateway: Offline when disconnected', () => {
    mockUseWebSocket.mockReturnValue(defaultWsReturn());

    render(<StatusBar />);

    expect(screen.getByText('Gateway: Offline')).toBeInTheDocument();
  });
});
