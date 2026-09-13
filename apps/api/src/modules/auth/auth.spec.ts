import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';

describe('Auth Sync Integration Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Inject mock local key set into defaultJwtVerifier so API routes verify test tokens locally
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests to /api/v1/auth/sync with 401 AUTH_INVALID_TOKEN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      payload: {},
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
  });

  it('provisions a new user with default CREATOR role on first sync (201 Created)', async () => {
    const sub = `sub_test_${Date.now()}`;
    const email = `creator_${Date.now()}@test.com`;

    const token = await createTestJwt({ sub, email });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.isNewUser).toBe(true);
    expect(body.user.supabaseAuthId).toBe(sub);
    expect(body.user.email).toBe(email);
    expect(body.user.roles).toContain('CREATOR');
    expect(body.user.status).toBe('ACTIVE');
  });

  it('idempotently returns existing user on repeated sync with same sub (200 OK)', async () => {
    const sub = `sub_idempotent_${Date.now()}`;
    const email = `idempotent_${Date.now()}@test.com`;

    const token = await createTestJwt({ sub, email });

    // First call: creates user
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredRole: 'BRAND' },
    });
    expect(res1.statusCode).toBe(201);

    // Second call: returns existing user
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredRole: 'BRAND' },
    });
    expect(res2.statusCode).toBe(200);
    const body = res2.json();
    expect(body.isNewUser).toBe(false);
    expect(body.user.id).toBe(res1.json().user.id);
  });

  it('rejects email collisions with 409 IDENTITY_EMAIL_CONFLICT (never merge accounts)', async () => {
    const sharedEmail = `collision_${Date.now()}@test.com`;
    const sub1 = `sub_first_${Date.now()}`;
    const sub2 = `sub_second_${Date.now()}`;

    const token1 = await createTestJwt({ sub: sub1, email: sharedEmail });
    const token2 = await createTestJwt({ sub: sub2, email: sharedEmail });

    // First user creates account with sharedEmail
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token1}` },
      payload: {},
    });
    expect(res1.statusCode).toBe(201);

    // Second user with different sub attempts sync with same email -> strictly rejected!
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token2}` },
      payload: {},
    });

    expect(res2.statusCode).toBe(409);
    const body = res2.json();
    expect(body.code).toBe('IDENTITY_EMAIL_CONFLICT');
  });

  it('rejects client attempts to self-assign ADMIN with 400 ROLE_ESCALATION_ATTEMPT', async () => {
    const sub = `sub_hacker_${Date.now()}`;
    const email = `hacker_${Date.now()}@test.com`;

    const token = await createTestJwt({ sub, email });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredRole: 'ADMIN' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('ROLE_ESCALATION_ATTEMPT');
  });

  it('rejects invalid/unknown preferredRole with 400 ROLE_ESCALATION_ATTEMPT', async () => {
    const sub = `sub_unknown_${Date.now()}`;
    const email = `unknown_${Date.now()}@test.com`;

    const token = await createTestJwt({ sub, email });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredRole: 'SUPER_ADMIN' },
    });

    expect(res.statusCode).toBe(400);
  });
});
