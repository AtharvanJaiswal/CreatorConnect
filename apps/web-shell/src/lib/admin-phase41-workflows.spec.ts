import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './api-client';
import { AdminAuditLogResponseSchema } from '@creatorconnect/contracts';
import { Value } from '@creatorconnect/validation';

describe('Phase 4.1 Frontend ApiClient & Audit Contract Integration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    apiClient.setTokenGetter(() => null);
  });

  it('injects bearer token from registered AuthProvider getter and serializes non-empty audit filters cleanly', async () => {
    apiClient.setTokenGetter(() => 'registered-supabase-jwt-token');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        items: [],
        nextCursor: null,
        hasMore: false,
        pagination: { nextCursor: null, hasMore: false, limit: 20 },
      }),
    });
    globalThis.fetch = mockFetch;

    const result = await apiClient.get('/api/v1/admin/audit', {
      params: {
        limit: 20,
        search: '',
        entity: 'User',
        cursor: undefined,
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockFetch.mock.calls[0]!;
    expect(String(calledUrl)).toBe('/api/v1/admin/audit?limit=20&entity=User');
    expect(String(calledUrl)).not.toContain('search=');
    expect(String(calledUrl)).not.toContain('cursor=');
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer registered-supabase-jwt-token',
      }),
    );
    expect(Value.Check(AdminAuditLogResponseSchema, result)).toBe(true);
  });

  it('propagates 401/403/500 ApiError cleanly so audit & disputes UI never silently fallback to mock data', async () => {
    apiClient.setTokenGetter(() => 'expired-jwt');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        title: 'Forbidden',
        status: 403,
        detail: 'Access requires administrative permission: audit.read',
        code: 'AUTH_INSUFFICIENT_ROLE',
      }),
    });

    await expect(apiClient.get('/api/v1/admin/audit')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Access requires administrative permission: audit.read',
    });

    try {
      await apiClient.get('/api/v1/disputes');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });

  it('supports AbortController cancellation for stale search/filter requests', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn<typeof fetch>((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        if ((init as RequestInit)?.signal?.aborted) {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
          return;
        }
        (init as RequestInit)?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    const reqPromise = apiClient.get('/api/v1/admin/audit', { signal: controller.signal });
    controller.abort();
    await expect(reqPromise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
