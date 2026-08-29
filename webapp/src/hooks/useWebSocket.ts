import { useState } from 'react';
import { wsService } from '../services/websocket';

/**
 * Placeholder hook for WebSocket connection status and messages.
 */
export const useWebSocket = () => {
  const [isConnected] = useState(false);

  return {
    isConnected,
    sendMessage: (data: unknown) => wsService.send(data),
  };
};
