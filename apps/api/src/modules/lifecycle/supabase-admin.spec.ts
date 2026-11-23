import { describe, it, expect, vi } from 'vitest';
import { SupabaseAdminService, MockSupabaseAdminService } from './supabase-admin.service.js';

describe('SupabaseAdminService — Identity Cleanup & Idempotent Retry', () => {
  it('deletes an existing identity via MockSupabaseAdminService', async () => {
    const mock = new MockSupabaseAdminService();
    mock.users.add('sub_existing_123');

    const result = await mock.deleteUserIdentity('sub_existing_123');
    expect(result.deleted).toBe(true);
    expect(result.alreadyAbsent).toBe(false);
    expect(mock.users.has('sub_existing_123')).toBe(false);
  });

  it('treats already absent identity as idempotent success', async () => {
    const mock = new MockSupabaseAdminService();

    const result = await mock.deleteUserIdentity('sub_never_existed_456');
    expect(result.deleted).toBe(true);
    expect(result.alreadyAbsent).toBe(true);
  });

  it('handles 404 response as idempotent success in HTTP adapter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'User not found',
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseAdminService({
      supabaseUrl: 'https://test.supabase.co',
      serviceRoleKey: 'test-key',
    });

    const result = await service.deleteUserIdentity('sub_target_404');
    expect(result.deleted).toBe(true);
    expect(result.alreadyAbsent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('retries transient 500 server errors with exponential backoff and succeeds', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        };
      }
      return {
        ok: true,
        status: 200,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseAdminService({
      supabaseUrl: 'https://test.supabase.co',
      serviceRoleKey: 'test-key',
      baseDelayMs: 10,
      maxRetries: 3,
    });

    const result = await service.deleteUserIdentity('sub_retry_success');
    expect(result.deleted).toBe(true);
    expect(callCount).toBe(3);

    vi.unstubAllGlobals();
  });

  it('fails immediately without retry on permanent 400/401/403 errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid Service Role API Key',
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseAdminService({
      supabaseUrl: 'https://test.supabase.co',
      serviceRoleKey: 'bad-key',
      maxRetries: 3,
    });

    await expect(service.deleteUserIdentity('sub_perm_error')).rejects.toThrow(
      /permanent status 401/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('fails definitively with retry exhaustion when server returns persistent 500 errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new SupabaseAdminService({
      supabaseUrl: 'https://test.supabase.co',
      serviceRoleKey: 'test-key',
      baseDelayMs: 5,
      maxRetries: 2,
    });

    await expect(service.deleteUserIdentity('sub_exhausted')).rejects.toThrow(
      /Failed to delete Supabase identity sub_exhausted after 2 retries/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3); // Initial attempt + 2 retries

    vi.unstubAllGlobals();
  });
});
