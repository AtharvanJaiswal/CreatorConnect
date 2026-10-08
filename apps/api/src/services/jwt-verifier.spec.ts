import { describe, expect, it, beforeAll } from 'vitest';
import * as jose from 'jose';
import { JwtVerifier } from './jwt-verifier.js';
import {
  createTestJwt,
  createTestKeySet,
  getOrCreateTestAuthKeys,
} from '../../../../tests/fixtures/auth-test-helper.js';

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

  describe('F-01 Production Hardening & Algorithm Governance', () => {
    it('enforces production boot guard: rejects non-HTTPS issuer when NODE_ENV=production', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        expect(
          () =>
            new JwtVerifier({
              issuer: 'http://insecure.supabase.co/auth/v1',
            }),
        ).toThrow(/Production boot guard failure: SUPABASE_JWT_ISSUER must be a valid HTTPS URL/);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('enforces production boot guard: rejects localhost issuer when NODE_ENV=production', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        expect(
          () =>
            new JwtVerifier({
              issuer: 'https://localhost.supabase.co/auth/v1',
            }),
        ).toThrow(/cannot reference localhost/);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('rejects algorithm "none" explicitly', async () => {
      // Craft an unverified token with alg: none
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'test-key-01' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'hacker_123',
          iss: 'https://localhost.supabase.co/auth/v1',
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;

      await expect(verifier.verifyToken(unsignedToken)).rejects.toThrow(
        /Algorithm 'none' is not permitted/,
      );
    });

    it('rejects symmetric HMAC algorithms (HS256) explicitly', async () => {
      const secret = new TextEncoder().encode('super-secret-hmac-key-at-least-32-chars-long');
      const hsToken = await new jose.SignJWT({
        sub: 'hmac_user',
        iss: 'https://localhost.supabase.co/auth/v1',
        aud: 'authenticated',
      })
        .setProtectedHeader({ alg: 'HS256', kid: 'test-key-01' })
        .setExpirationTime('1h')
        .sign(secret);

      await expect(verifier.verifyToken(hsToken)).rejects.toThrow(
        /Algorithm 'HS256' is not permitted/,
      );
    });

    it('ignores untrusted jku header parameter and does not fetch keys from it', async () => {
      // Token specifies a fake jku pointing to an attacker server
      const { privateKey } = await getOrCreateTestAuthKeys();
      const maliciousToken = await new jose.SignJWT({
        sub: 'jku_user',
        iss: 'https://localhost.supabase.co/auth/v1',
        aud: 'authenticated',
      })
        .setProtectedHeader({
          alg: 'ES256',
          kid: 'test-key-01',
          jku: 'https://attacker.evil.com/jwks.json',
        })
        .setExpirationTime('1h')
        .sign(privateKey);

      // Verifier still verifies with its own configured key set, not the jku!
      const decoded = await verifier.verifyToken(maliciousToken);
      expect(decoded.sub).toBe('jku_user');
    });

    it('ignores untrusted x5u header parameter', async () => {
      const { privateKey } = await getOrCreateTestAuthKeys();
      const maliciousToken = await new jose.SignJWT({
        sub: 'x5u_user',
        iss: 'https://localhost.supabase.co/auth/v1',
        aud: 'authenticated',
      })
        .setProtectedHeader({
          alg: 'ES256',
          kid: 'test-key-01',
          x5u: 'https://attacker.evil.com/cert.pem',
        })
        .setExpirationTime('1h')
        .sign(privateKey);

      const decoded = await verifier.verifyToken(maliciousToken);
      expect(decoded.sub).toBe('x5u_user');
    });

    it('rejects fixture token when verifier is configured against remote production JWKS endpoint', async () => {
      // In production mode, verifier queries remote JWKS (which does not contain test-key-01)
      const emptyRemoteVerifier = new JwtVerifier({
        jwksUrl: 'https://production.supabase.co/auth/v1/.well-known/jwks.json',
        issuer: 'https://production.supabase.co/auth/v1',
        // Mock remote resolver to return empty keys
        localKeySet: async () => {
          throw new Error('Key not found in remote JWKS');
        },
      });

      const fixtureToken = await createTestJwt({
        sub: 'fixture_user',
        iss: 'https://production.supabase.co/auth/v1',
      });

      await expect(emptyRemoteVerifier.verifyToken(fixtureToken)).rejects.toThrow(
        /Token verification failed/,
      );
    });
  });
});
