import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketService, wsService, type WebSocketEnvelope } from '../websocket';

/* ------------------------------------------------------------------ */
/* Mock WebSocket Infrastructure                                       */
/* ------------------------------------------------------------------ */

const SafeCloseEvent =
  typeof globalThis.CloseEvent !== 'undefined'
    ? globalThis.CloseEvent
    : (class CloseEvent extends Event {
        code: number;
        reason: string;
        constructor(type: string, init?: { code?: number; reason?: string }) {
          super(type);
          this.code = init?.code ?? 1000;
          this.reason = init?.reason ?? '';
        }
      } as unknown as typeof globalThis.CloseEvent);

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  /* Test simulation helpers */
  triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  triggerMessage(data: unknown): void {
    if (this.onmessage) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.onmessage(new MessageEvent('message', { data: payload }));
    }
  }

  triggerError(error: Event = new Event('error')): void {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  triggerClose(code = 1000, reason = 'Normal closure'): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new SafeCloseEvent('close', { code, reason }) as CloseEvent);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Test Suite                                                         */
/* ------------------------------------------------------------------ */

describe('WebSocketService', () => {
  const originalWebSocket = globalThis.WebSocket;
  let service: WebSocketService;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    service = new WebSocketService('ws://test.navigen.local/ws');
  });

  afterEach(() => {
    service.disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
    MockWebSocket.instances = [];
    globalThis.WebSocket = originalWebSocket;
  });

  describe('connection/open behavior', () => {
    it('initializes with disconnected status', () => {
      expect(service.getStatus()).toBe('disconnected');
      expect(MockWebSocket.instances.length).toBe(0);
    });

    it('transitions to connecting on connect() and creates a WebSocket instance', () => {
      const statusChanges: string[] = [];
      service.onStatusChange((status) => statusChanges.push(status));

      service.connect();

      expect(service.getStatus()).toBe('connecting');
      expect(statusChanges).toEqual(['connecting']);
      expect(MockWebSocket.instances.length).toBe(1);
      expect(MockWebSocket.instances[0].url).toBe('ws://test.navigen.local/ws');
    });

    it('transitions to connected when socket opens', () => {
      const statusChanges: string[] = [];
      service.onStatusChange((status) => statusChanges.push(status));

      service.connect();
      const socket = MockWebSocket.instances[0];

      socket.triggerOpen();

      expect(service.getStatus()).toBe('connected');
      expect(statusChanges).toEqual(['connecting', 'connected']);
    });

    it('is idempotent when already CONNECTING or OPEN', () => {
      service.connect();
      expect(MockWebSocket.instances.length).toBe(1);

      // Calling connect while still CONNECTING should not create a new socket
      service.connect();
      expect(MockWebSocket.instances.length).toBe(1);

      // Transition to OPEN
      MockWebSocket.instances[0].triggerOpen();
      expect(service.getStatus()).toBe('connected');

      // Calling connect while OPEN should not create a new socket
      service.connect();
      expect(MockWebSocket.instances.length).toBe(1);
    });

    it('allows updating the target URL on connect(targetUrl)', () => {
      service.connect('ws://alternate.navigen.local/ws');
      expect(MockWebSocket.instances[0].url).toBe('ws://alternate.navigen.local/ws');
    });

    it('handles socket error events without crashing', () => {
      service.connect();
      const socket = MockWebSocket.instances[0];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      socket.triggerError();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebSocketService] WebSocket error:'),
        expect.any(Event),
      );

      consoleSpy.mockRestore();
    });

    it('handles WebSocket instantiation failure and schedules reconnect', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.WebSocket = class ThrowingWebSocket {
        constructor() {
          throw new Error('Connection refused by system policy');
        }
      } as unknown as typeof WebSocket;

      service.connect();

      expect(service.getStatus()).toBe('reconnecting');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebSocketService] Failed to create WebSocket:'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('incoming message parsing/dispatch', () => {
    it('parses valid JSON envelopes and dispatches to registered message listeners', () => {
      const messages: WebSocketEnvelope[] = [];
      service.onMessage((msg) => messages.push(msg));

      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      const sampleEnvelope: WebSocketEnvelope = {
        schema_version: 1,
        event_type: 'robot.telemetry',
        robot_id: 'ugv-01',
        recorded_at: '2026-09-04T12:00:00.000Z',
        received_at: '2026-09-04T12:00:01.000Z',
        payload: { battery_level_pct: 95, linear_velocity: 1.2 },
      };

      socket.triggerMessage(sampleEnvelope);

      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual(sampleEnvelope);
    });

    it('dispatches to multiple listeners and supports unsubscription', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = service.onMessage(listener1);
      service.onMessage(listener2);

      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      const envelope: WebSocketEnvelope = {
        schema_version: 1,
        event_type: 'robot.telemetry',
        robot_id: 'ugv-01',
        recorded_at: '2026-09-04T12:00:00.000Z',
        received_at: '2026-09-04T12:00:01.000Z',
        payload: {},
      };

      socket.triggerMessage(envelope);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      // Unsubscribe listener 1
      unsub1();

      socket.triggerMessage(envelope);
      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Still called
    });

    it('safely handles non-JSON or malformed messages without throwing', () => {
      const listener = vi.fn();
      service.onMessage(listener);

      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      socket.triggerMessage('INVALID_NON_JSON_STRING');

      expect(listener).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebSocketService] Failed to parse message JSON'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('isolates listener errors so one failing listener does not block others', () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Listener explosion');
      });
      const healthyListener = vi.fn();

      service.onMessage(faultyListener);
      service.onMessage(healthyListener);

      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      socket.triggerMessage({ schema_version: 1, event_type: 'ping', robot_id: 'ugv-01', recorded_at: '', received_at: '', payload: {} });

      expect(faultyListener).toHaveBeenCalledTimes(1);
      expect(healthyListener).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebSocketService] Error in message listener'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('sending messages', () => {
    it('serializes and sends data when socket is OPEN', () => {
      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      service.send({ command: 'start_stream' });
      expect(socket.sentMessages).toEqual([JSON.stringify({ command: 'start_stream' })]);

      service.send('plain text message');
      expect(socket.sentMessages).toEqual([
        JSON.stringify({ command: 'start_stream' }),
        'plain text message',
      ]);
    });

    it('warns and does not send if socket is not OPEN', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      service.connect(); // in CONNECTING state, not OPEN
      service.send({ action: 'ping' });

      expect(MockWebSocket.instances[0].sentMessages.length).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send message: WebSocket is not open'),
      );

      warnSpy.mockRestore();
    });
  });

  describe('close/disconnect behavior', () => {
    it('cleans up and sets disconnected status on explicit disconnect() without scheduling reconnect', () => {
      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      expect(service.getStatus()).toBe('connected');

      service.disconnect();

      expect(service.getStatus()).toBe('disconnected');
      expect(socket.readyState).toBe(MockWebSocket.CLOSED);

      // Advance timers to verify no reconnect was scheduled
      vi.advanceTimersByTime(30000);
      expect(MockWebSocket.instances.length).toBe(1);
      expect(service.getStatus()).toBe('disconnected');
    });

    it('triggers reconnect scheduling when socket closes unexpectedly', () => {
      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      // Socket closes unexpectedly
      socket.triggerClose(1006, 'Abnormal closure');

      expect(service.getStatus()).toBe('reconnecting');
    });
  });

  describe('reconnect scheduling and exponential backoff', () => {
    it('applies exponential backoff on consecutive reconnect attempts (1s, 2s, 4s, 8s, up to 10s max)', () => {
      service.connect();
      let socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      // 1st unexpected close -> 1st reconnect scheduled in 1000ms (1000 * 2^0)
      socket.triggerClose();
      expect(service.getStatus()).toBe('reconnecting');
      expect(MockWebSocket.instances.length).toBe(1);

      vi.advanceTimersByTime(999);
      expect(MockWebSocket.instances.length).toBe(1); // Not reconnected yet

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(2); // 1st reconnect attempt triggered
      socket = MockWebSocket.instances[1];

      // 2nd unexpected close -> 2nd reconnect scheduled in 2000ms (1000 * 2^1)
      socket.triggerClose();
      expect(service.getStatus()).toBe('reconnecting');

      vi.advanceTimersByTime(1999);
      expect(MockWebSocket.instances.length).toBe(2);

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(3); // 2nd reconnect attempt triggered
      socket = MockWebSocket.instances[2];

      // 3rd unexpected close -> 3rd reconnect scheduled in 4000ms (1000 * 2^2)
      socket.triggerClose();

      vi.advanceTimersByTime(3999);
      expect(MockWebSocket.instances.length).toBe(3);

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(4); // 3rd reconnect attempt triggered
      socket = MockWebSocket.instances[3];

      // 4th unexpected close -> 4th reconnect scheduled in 8000ms (1000 * 2^3)
      socket.triggerClose();

      vi.advanceTimersByTime(7999);
      expect(MockWebSocket.instances.length).toBe(4);

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(5); // 4th reconnect attempt triggered
      socket = MockWebSocket.instances[4];

      // 5th unexpected close -> capped at 10000ms max delay
      socket.triggerClose();

      vi.advanceTimersByTime(9999);
      expect(MockWebSocket.instances.length).toBe(5);

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(6); // Reconnect fired at max delay
    });
  });

  describe('successful reconnection', () => {
    it('resets reconnect attempts and delay back to 1s upon successful connection', () => {
      service.connect();
      let socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      // Close 1: schedules reconnect in 1000ms
      socket.triggerClose();
      vi.advanceTimersByTime(1000);
      socket = MockWebSocket.instances[1];

      // Close 2: schedules reconnect in 2000ms
      socket.triggerClose();
      vi.advanceTimersByTime(2000);
      socket = MockWebSocket.instances[2];

      // Reconnect succeeds!
      socket.triggerOpen();
      expect(service.getStatus()).toBe('connected');

      // Now if it drops again in the future, delay should be reset to 1000ms (not 4000ms)
      socket.triggerClose();
      expect(service.getStatus()).toBe('reconnecting');

      vi.advanceTimersByTime(999);
      expect(MockWebSocket.instances.length).toBe(3);

      vi.advanceTimersByTime(1);
      expect(MockWebSocket.instances.length).toBe(4); // Triggered at 1000ms, proving reset!
    });
  });

  describe('reconnect cancellation', () => {
    it('cancels pending reconnect timer if disconnect() is called while reconnecting', () => {
      service.connect();
      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();

      // Drops connection -> scheduled reconnect in 1000ms
      socket.triggerClose();
      expect(service.getStatus()).toBe('reconnecting');

      // User or system explicitly disconnects before 1000ms
      vi.advanceTimersByTime(500);
      service.disconnect();

      expect(service.getStatus()).toBe('disconnected');

      // Advance well past the reconnect timer
      vi.advanceTimersByTime(10000);
      expect(MockWebSocket.instances.length).toBe(1); // No new socket was created
      expect(service.getStatus()).toBe('disconnected');
    });
  });

  describe('status listener management', () => {
    it('notifies status listeners and respects unsubscription', () => {
      const listener = vi.fn();
      const unsubscribe = service.onStatusChange(listener);

      service.connect();
      expect(listener).toHaveBeenCalledWith('connecting');

      const socket = MockWebSocket.instances[0];
      socket.triggerOpen();
      expect(listener).toHaveBeenCalledWith('connected');

      unsubscribe();

      socket.triggerClose();
      // Listener should not be called with 'reconnecting' after unsubscription
      expect(listener).not.toHaveBeenCalledWith('reconnecting');
    });

    it('handles exceptions in status listeners gracefully', () => {
      const badListener = vi.fn(() => {
        throw new Error('Status listener failure');
      });
      const goodListener = vi.fn();

      const unsubBad = service.onStatusChange(badListener);
      const unsubGood = service.onStatusChange(goodListener);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.connect();

      expect(badListener).toHaveBeenCalledWith('connecting');
      expect(goodListener).toHaveBeenCalledWith('connecting');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebSocketService] Error in status listener'),
        expect.any(Error),
      );

      unsubBad();
      unsubGood();
      consoleSpy.mockRestore();
    });
  });

  describe('exported singleton wsService', () => {
    it('is an instance of WebSocketService', () => {
      expect(wsService).toBeInstanceOf(WebSocketService);
    });
  });
});
