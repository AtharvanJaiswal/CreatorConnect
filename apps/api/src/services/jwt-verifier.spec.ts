import { describe, expect, it, beforeAll } from 'vitest';
import * as jose from 'jose';
import { JwtVerifier } from './jwt-verifier.js';
import {
  createTestJwt,
  createTestKeySet,
  getOrCreateTestAuthKeys,
} from '../test-utils/auth-test-helper.js';

describe('JwtVerifier', () => {
  let verifier: JwtVerifier;

  beforeAll(async () => {
    const keySet = await createTestKeySet();
    verifier = new JwtVerifier({
      localKeySet: keySet,
      issuer: 'https://localhost.supabase.co/auth/v1',
      audience: 'authenticated',
      clockTolerance: 60,
    });
  });

  it('successfully verifies a valid ES256 token', async () => {
    const token = await createTestJwt({
      sub: 'user_test_123',
      email: 'verified@creatorconnect.com',
    });

    const payload = await verifier.verifyToken(token);
    expect(payload.sub).toBe('user_test_123');
    expect(payload.email).toBe('verified@creatorconnect.com');
  });

  it('rejects disallowed symmetric algorithms (HS256)', async () => {
    const secret = new TextEncoder().encode('insecure-shared-secret-key-12345678');
    const token = await new jose.SignJWT({ email: 'attacker@evil.com' })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key-01' })
      .setSubject('attacker_sub')
      .setAudience('authenticated')
      .setIssuer('https://localhost.supabase.co/auth/v1')
      .setExpirationTime('1h')
      .sign(secret);

    await expect(verifier.verifyToken(token)).rejects.toThrow(/Algorithm 'HS256' is not permitted/);
  });

  it('rejects tokens without mandatory kid header', async () => {
    const { privateKey } = await getOrCreateTestAuthKeys();
    const token = await new jose.SignJWT({ email: 'no-kid@example.com' })
      .setProtectedHeader({ alg: 'ES256' }) // no kid!
      .setSubject('sub_no_kid')
      .setAudience('authenticated')
      .setIssuer('https://localhost.supabase.co/auth/v1')
      .setExpirationTime('1h')
      .sign(privateKey);

    await expect(verifier.verifyToken(token)).rejects.toThrow(/missing mandatory "kid"/);
  });

  it('rejects expired tokens (beyond clock tolerance)', async () => {
    // Expired 10 minutes ago
    const pastExp = Math.floor(Date.now() / 1000) - 600;
    const token = await createTestJwt({
      sub: 'expired_user',
      email: 'expired@example.com',
      exp: pastExp,
    });

    await expect(verifier.verifyToken(token)).rejects.toThrow(/Authentication token has expired/);
  });

  it('accepts tokens with slight clock skew within 60s leeway', async () => {
    // Expired 30 seconds ago (within 60s leeway)
    const slightlyPastExp = Math.floor(Date.now() / 1000) - 30;
    const token = await createTestJwt({
      sub: 'leeway_user',
      email: 'leeway@example.com',
      exp: slightlyPastExp,
    });

    const payload = await verifier.verifyToken(token);
    expect(payload.sub).toBe('leeway_user');
  });

  it('rejects tokens with invalid signatures from untrusted keys', async () => {
    const { privateKey: untrustedKey } = await jose.generateKeyPair('ES256');
    const token = await createTestJwt(
      { sub: 'untrusted_user', email: 'untrusted@example.com' },
      { overridePrivateKey: untrustedKey },
    );

    await expect(verifier.verifyToken(token)).rejects.toThrow(/signature verification failed/);
  });

  it('rejects tokens with mismatched audience', async () => {
    const token = await createTestJwt({
      sub: 'wrong_aud_user',
      aud: 'wrong-audience',
    });

    await expect(verifier.verifyToken(token)).rejects.toThrow(/Token verification failed/);
  });

  it('rejects malformed token strings', async () => {
    await expect(verifier.verifyToken('not.a.valid.jwt.token')).rejects.toThrow(
      /Token header is not valid base64url JSON/,
    );
  });

  // ---------------------------------------------------------------------------
  // Fix M1 regression tests — issuer validation is mandatory and fail-closed
  // ---------------------------------------------------------------------------

  it('rejects tokens with a wrong issuer (issuer mismatch)', async () => {
    // Token claims a different issuer than the one trusted by the verifier.
    const token = await createTestJwt({
      sub: 'wrong_iss_user',
      iss: 'https://attacker.evil.com/auth/v1',
    });

    await expect(verifier.verifyToken(token)).rejects.toThrow(/Token verification failed/);
  });

  it('fails closed when issuer is explicitly empty (treats as absent — no tokens accepted)', async () => {
    // An empty string issuer is normalized to undefined, triggering fail-closed behavior.
    const keySet = await createTestKeySet();
    const unconfiguredVerifier = new JwtVerifier({
      localKeySet: keySet,
      issuer: '', // empty → normalized to undefined → fail closed
      audience: 'authenticated',
    });

    const token = await createTestJwt({ sub: 'any_sub', email: 'any@test.com' });

    await expect(unconfiguredVerifier.verifyToken(token)).rejects.toThrow(
      /JWT issuer is not configured/,
    );
  });

  it('fails closed when issuer is only whitespace (treated as absent)', async () => {
    const keySet = await createTestKeySet();
    const whitespaceIssuerVerifier = new JwtVerifier({
      localKeySet: keySet,
      issuer: '   ', // whitespace only → normalized to undefined → fail closed
      audience: 'authenticated',
    });

    const token = await createTestJwt({ sub: 'any_sub', email: 'any@test.com' });

    await expect(whitespaceIssuerVerifier.verifyToken(token)).rejects.toThrow(
      /JWT issuer is not configured/,
    );
  });

  it('no client-controlled value can become the trusted issuer (issuer fixed at construction time)', async () => {
    // The trusted issuer is always read from server config (options/env), never from the token.
    // When issuer is explicitly set to empty string in options, the env var fallback is bypassed
    // (simulating a deployment where SUPABASE_JWT_ISSUER was not set).
    // The verifier must reject even a token with a "plausible" iss claim.
    const keySet = await createTestKeySet();
    const noIssuerVerifier = new JwtVerifier({
      localKeySet: keySet,
      issuer: '', // explicitly empty → env var NOT used → normalizes to undefined → fail closed
      audience: 'authenticated',
    });

    const token = await createTestJwt({
      sub: 'attacker_sub',
      iss: 'https://localhost.supabase.co/auth/v1', // correct-looking issuer in token claim
    });

    // Must be rejected — verifier has no trusted issuer configured regardless
    // of what the token's iss claim contains.
    await expect(noIssuerVerifier.verifyToken(token)).rejects.toThrow(
      /JWT issuer is not configured/,
    );
  });
});
