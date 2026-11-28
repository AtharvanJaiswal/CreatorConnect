import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './api-client';

describe('ApiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds relative URL and serializes query parameters correctly', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      } as Response);
    });

    const result = await apiClient.get<{ success: boolean }>('/api/v1/test', {
      params: { page: 1, search: 'editor', empty: undefined, nil: null },
    });

    expect(capturedUrl).toContain('/api/v1/test?page=1&search=editor');
    expect(result).toEqual({ success: true });
  });

  it('injects Bearer token into Authorization header when provided', async () => {
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ ok: true }),
      } as Response);
    });

    await apiClient.post('/api/v1/secure', { action: 'test' }, { token: 'jwt-token-xyz' });

    expect(capturedHeaders['Authorization']).toBe('Bearer jwt-token-xyz');
    expect(capturedHeaders['Content-Type']).toBe('application/json');
  });

  it('parses RFC 7807 Problem Details on HTTP error responses', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            type: 'https://creatorconnect.in/errors/forbidden',
            title: 'Insufficient Permissions',
            status: 403,
            detail: 'You do not have users.suspend administrative capability.',
          }),
      } as Response);
    });

    try {
      await apiClient.post('/api/v1/admin/users/123/suspend', {});
      expect.fail('Should have failed');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).message).toBe(
        'You do not have users.suspend administrative capability.',
      );
    }
  });

  it('parses RFC 7807 application/problem+json error responses into ApiError.problem', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/problem+json; charset=utf-8' }),
        json: () =>
          Promise.resolve({
            type: 'https://api.creatorconnect.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'Missing required permission: audit.read',
            code: 'FORBIDDEN',
          }),
      } as Response);
    });

    try {
      await apiClient.get('/api/v1/admin/audit');
      expect.fail('Should have failed');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).problem?.code).toBe('FORBIDDEN');
      expect((err as ApiError).message).toBe('Missing required permission: audit.read');
    }
  });

  it('handles 204 No Content without attempting JSON parsing', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
      } as Response);
    });

    const res = await apiClient.delete('/api/v1/admin/roles/role-1');
    expect(res).toBeNull();
  });

  it('uses relative same-origin URL in browser even when NEXT_PUBLIC_API_URL is set', async () => {
    const prevEnv = process.env.NEXT_PUBLIC_API_URL;
    const prevWin = (globalThis as { window?: unknown }).window;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    if (!prevWin) {
      (globalThis as { window?: unknown }).window = { __TEST_ACCESS_TOKEN__: 'tok' };
    }

    let capturedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ items: [] }),
      } as Response);
    });

    try {
      const { apiClient: freshClient } = await import('./api-client?browser-test=' + Date.now());
      await freshClient.get('/api/v1/admin/audit');
      expect(capturedUrl).toBe('/api/v1/admin/audit');
    } finally {
      process.env.NEXT_PUBLIC_API_URL = prevEnv;
      if (!prevWin) {
        delete (globalThis as { window?: unknown }).window;
      }
    }
  });
});
