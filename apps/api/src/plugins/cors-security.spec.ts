import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('CORS Production Fail-Closed Security (SEC-02)', () => {
  it('fails closed on startup in production when CORS_ORIGIN is missing', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGIN;

      await expect(buildApp()).rejects.toThrow(
        /Production boot guard failure: CORS_ORIGIN environment variable is required and cannot be empty in production mode/,
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origCors !== undefined) process.env.CORS_ORIGIN = origCors;
      else delete process.env.CORS_ORIGIN;
    }
  });

  it('fails closed on startup in production when CORS_ORIGIN is empty or whitespace', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = '   ';

      await expect(buildApp()).rejects.toThrow(
        /Production boot guard failure: CORS_ORIGIN environment variable is required and cannot be empty in production mode/,
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origCors !== undefined) process.env.CORS_ORIGIN = origCors;
      else delete process.env.CORS_ORIGIN;
    }
  });

  it('fails closed on startup in production when CORS_ORIGIN contains only commas/empty values', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = ', ,  ,';

      await expect(buildApp()).rejects.toThrow(
        /Production boot guard failure: CORS_ORIGIN must contain at least one valid origin in production mode/,
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origCors !== undefined) process.env.CORS_ORIGIN = origCors;
      else delete process.env.CORS_ORIGIN;
    }
  });

  it('fails closed on startup in production when CORS_ORIGIN contains wildcard "*"', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = '*';

      await expect(buildApp()).rejects.toThrow(
        /Production boot guard failure: Wildcard CORS origin \("\*"\) is prohibited when credentials are enabled/,
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origCors !== undefined) process.env.CORS_ORIGIN = origCors;
      else delete process.env.CORS_ORIGIN;
    }
  });

  it('successfully boots in production with valid single CORS_ORIGIN', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://creatorconnect.com';

      const app = await buildApp();
      expect(app).toBeDefined();

      const res = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://creatorconnect.com',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBe('https://creatorconnect.com');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      await app.close();
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origCors !== undefined) process.env.CORS_ORIGIN = origCors;
      else delete process.env.CORS_ORIGIN;
    }
  });

  it('successfully boots in production with multiple comma-separated trimmed origins', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://app.creatorconnect.com, https://admin.creatorconnect.com ';

      const app = await buildApp();
      expect(app).toBeDefined();

      const res1 = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://app.creatorconnect.com',
          'access-control-request-method': 'GET',
        },
      });
      expect(res1.headers['access-control-allow-origin']).toBe('https://app.creatorconnect.com');

      const res2 = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://admin.creatorconnect.com',
          'access-control-request-method': 'GET',
        },
      });
      expect(res2.headers['access-control-allow-origin']).toBe('https://admin.creatorconnect.com');

      // Unauthorized origin
      const res3 = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://attacker.evil.com',
          'access-control-request-method': 'GET',
        },
      });
      expect(res3.headers['access-control-allow-origin']).toBeUndefined();

      await app.close();
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origCors !== undefined) process.env.CORS_ORIGIN = origCors;
      else delete process.env.CORS_ORIGIN;
    }
  });

  it('preserves non-production development and E2E configuration usability', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
      process.env.NODE_ENV = 'development';
      process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:3001,http://localhost:3002';

      const app = await buildApp();
      expect(app).toBeDefined();

      const res = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:3002',
          'access-control-request-method': 'GET',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3002');
      await app.close();
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origCors !== undefined) process.env.CORS_ORIGIN = origCors;
      else delete process.env.CORS_ORIGIN;
    }
  });
});
