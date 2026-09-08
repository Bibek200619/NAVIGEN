import { describe, it, expect } from 'vitest';
import { WebSocketService } from '../websocket';

describe('WebSocketService', () => {
  it('starts disconnected and exposes the configured status', () => {
    const service = new WebSocketService('ws://example.test');
    expect(service.getStatus()).toBe('disconnected');
  });

  it('does not send while disconnected', () => {
    const service = new WebSocketService('ws://example.test');
    expect(() => service.send({ type: 'ping' })).not.toThrow();
    service.disconnect();
    expect(service.getStatus()).toBe('disconnected');
  });
});
