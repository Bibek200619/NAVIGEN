import { APP_CONFIG } from '../constants/config';

type MessageHandler = (data: unknown) => void;

/**
 * Placeholder WebSocket client for future real-time telemetry communication.
 */
export class WebSocketService {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners: MessageHandler[] = [];

  constructor(url: string = APP_CONFIG.WS_URL) {
    this.url = url;
  }

  connect(): void {
    // Placeholder - connection logic will be implemented with backend
    console.debug(`[WebSocketService] Connect target: ${this.url}`);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }
}

export const wsService = new WebSocketService();
