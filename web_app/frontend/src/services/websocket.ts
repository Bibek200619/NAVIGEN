import { APP_CONFIG } from '../constants/config';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WebSocketEnvelope<T = unknown> {
  schema_version: number;
  event_type: string;
  robot_id: string;
  recorded_at: string;
  received_at: string;
  payload: T;
}

export type MessageHandler<T = unknown> = (data: WebSocketEnvelope<T>) => void;
export type StatusHandler = (status: WebSocketStatus) => void;

/**
 * Production-ready WebSocket service for live telemetry streaming.
 * Handles lifecycle events, exponential backoff reconnects, and message subscriptions.
 */
export class WebSocketService {
  private url: string;
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = 'disconnected';
  private isExplicitlyDisconnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly initialReconnectDelayMs = 1000;
  private readonly maxReconnectDelayMs = 10000;

  private messageListeners: Set<MessageHandler<unknown>> = new Set();
  private statusListeners: Set<StatusHandler> = new Set();

  constructor(url: string = APP_CONFIG.WS_URL) {
    this.url = url;
  }

  public getStatus(): WebSocketStatus {
    return this.status;
  }

  public connect(targetUrl?: string): void {
    if (targetUrl) {
      this.url = targetUrl;
    }

    this.isExplicitlyDisconnected = false;
    this.clearReconnectTimer();

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.reconnectAttempts === 0) {
      this.setStatus('connecting');
    }

    this.cleanupSocket();

    try {
      const socket = new WebSocket(this.url);
      this.ws = socket;

      socket.onopen = () => {
        if (this.ws !== socket) return;
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
        this.setStatus('connected');
      };

      socket.onmessage = (event: MessageEvent) => {
        if (this.ws !== socket) return;
        this.handleMessage(event);
      };

      socket.onerror = (error: Event) => {
        if (this.ws !== socket) return;
        console.error('[WebSocketService] WebSocket error:', error);
      };

      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.handleClose();
      };
    } catch (error) {
      console.error('[WebSocketService] Failed to create WebSocket:', error);
      this.cleanupSocket();
      this.setStatus('disconnected');
      if (!this.isExplicitlyDisconnected) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    this.isExplicitlyDisconnected = true;
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.cleanupSocket();
    this.setStatus('disconnected');
  }

  public send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
      } catch (error) {
        console.error('[WebSocketService] Failed to serialize message:', error);
      }
    } else {
      console.warn('[WebSocketService] Cannot send message: WebSocket is not open');
    }
  }

  public onMessage<T = unknown>(handler: MessageHandler<T>): () => void {
    const genericHandler = handler as MessageHandler<unknown>;
    this.messageListeners.add(genericHandler);
    return () => {
      this.messageListeners.delete(genericHandler);
    };
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusListeners.add(handler);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const rawData = typeof event.data === 'string' ? event.data : String(event.data);
      const parsed = JSON.parse(rawData) as WebSocketEnvelope<unknown>;
      this.messageListeners.forEach((listener) => {
        try {
          listener(parsed);
        } catch (listenerError) {
          console.error('[WebSocketService] Error in message listener:', listenerError);
        }
      });
    } catch (parseError) {
      console.error('[WebSocketService] Failed to parse message JSON:', parseError);
    }
  }

  private handleClose(): void {
    this.cleanupSocket();
    this.setStatus('disconnected');

    if (!this.isExplicitlyDisconnected) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.setStatus('reconnecting');

    const delay = Math.min(
      this.initialReconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanupSocket(): void {
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
  }

  private setStatus(newStatus: WebSocketStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (listenerError) {
          console.error('[WebSocketService] Error in status listener:', listenerError);
        }
      });
    }
  }
}

export const wsService = new WebSocketService();
