import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient, ApiError } from '../api';

describe('API client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('performs GET requests through apiClient', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(apiClient.get('/health')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/health'), expect.objectContaining({ headers: expect.any(Object) }));
  });

  it('performs JSON POST requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: '1' }), { status: 200 }));
    await expect(apiClient.post('/items', { name: 'item' })).resolves.toEqual({ id: '1' });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/items'), expect.objectContaining({ method: 'POST' }));
  });

  it('normalizes failed responses as ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Denied' } }), { status: 403, statusText: 'Forbidden' }));
    await expect(apiClient.get('/private')).rejects.toEqual(expect.objectContaining({ status: 403, message: 'Denied' }));
    expect(ApiError).toBeDefined();
  });
});
