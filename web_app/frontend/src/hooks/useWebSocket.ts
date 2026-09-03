import { useState, useEffect, useCallback } from 'react';
import {
  wsService,
  type WebSocketStatus,
  type WebSocketEnvelope,
} from '../services/websocket';

export interface UseWebSocketReturn<T = unknown> {
  isConnected: boolean;
  status: WebSocketStatus;
  latestMessage: WebSocketEnvelope<T> | null;
  sendMessage: (data: unknown) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * React hook wrapping the singleton WebSocketService for live telemetry & events.
 * Manages connection lifecycle, event subscriptions, and synchronizes state with React.
 */
export const useWebSocket = <T = unknown>(): UseWebSocketReturn<T> => {
  const [status, setStatus] = useState<WebSocketStatus>(() => wsService.getStatus());
  const [latestMessage, setLatestMessage] = useState<WebSocketEnvelope<T> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribeStatus = wsService.onStatusChange((newStatus) => {
      if (isMounted) {
        setStatus(newStatus);
      }
    });

    const unsubscribeMessage = wsService.onMessage<T>((message) => {
      if (isMounted) {
        setLatestMessage(message);
      }
    });

    wsService.connect();

    return () => {
      isMounted = false;
      unsubscribeStatus();
      unsubscribeMessage();
      wsService.disconnect();
    };
  }, []);

  const sendMessage = useCallback((data: unknown) => {
    wsService.send(data);
  }, []);

  const connect = useCallback(() => {
    wsService.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsService.disconnect();
  }, []);

  const isConnected = status === 'connected';

  return {
    isConnected,
    status,
    latestMessage,
    sendMessage,
    connect,
    disconnect,
  };
};
