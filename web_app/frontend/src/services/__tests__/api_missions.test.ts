import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../api';

describe('API mission requests', () => {
  afterEach(() => vi.restoreAllMocks());

  it('supports generic mission GET requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    await expect(apiClient.get('/api/v1/missions')).resolves.toEqual({ items: [] });
  });

  it('supports generic command POST requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 200 }));
    await expect(apiClient.post('/api/v1/robots/ugv-01/commands', { command: 'start' })).resolves.toEqual({ accepted: true });
  });
});
