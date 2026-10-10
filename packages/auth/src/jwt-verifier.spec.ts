import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as jose from 'jose';
import { JwtVerifier } from './jwt-verifier.js';
import { AuthInvalidTokenError, AuthTokenExpiredError } from './errors.js';

describe('JwtVerifier in @creatorconnect/auth', () => {
  let es256KeyPair: jose.GenerateKeyPairResult<jose.KeyLike>;
  let rs256KeyPair: jose.GenerateKeyPairResult<jose.KeyLike>;
  let es256PublicJwk: jose.JWK;
  let rs256PublicJwk: jose.JWK;
  let verifier: JwtVerifier;

  // Remote JWKS mock test server
  let mockJwksServer: http.Server;
  let mockJwksUrl: string;
  let jwksRequestCount = 0;
  let jwksStatusCode = 200;
  let jwksResponseBody: string;

  const TEST_ISSUER = 'https://auth.creatorconnect.local/auth/v1';
  const TEST_AUDIENCE = 'authenticated';

  beforeAll(async () => {
    es256KeyPair = await jose.generateKeyPair('ES256');
    rs256KeyPair = await jose.generateKeyPair('RS256');

    es256PublicJwk = {
      ...(await jose.exportJWK(es256KeyPair.publicKey)),
      kid: 'es256-test-key-01',
      alg: 'ES256',
      use: 'sig',
    };

    rs256PublicJwk = {
      ...(await jose.exportJWK(rs256KeyPair.publicKey)),
      kid: 'rs256-test-key-01',
      alg: 'RS256',
      use: 'sig',
    };

    jwksResponseBody = JSON.stringify({ keys: [es256PublicJwk, rs256PublicJwk] });

    // Start local HTTP server to test remote JWKS fetching, caching, and error resilience
    mockJwksServer = http.createServer((_req, res) => {
      jwksRequestCount++;
      res.writeHead(jwksStatusCode, { 'Content-Type': 'application/json' });
      res.end(jwksResponseBody);
    });

    await new Promise<void>((resolve) => {
      mockJwksServer.listen(0, '127.0.0.1', () => {
        const addr = mockJwksServer.address() as AddressInfo;
        mockJwksUrl = `http://127.0.0.1:${addr.port}/.well-known/jwks.json`;
        resolve();
      });
    });

    const keySet: jose.JWTVerifyGetKey = async (protectedHeader) => {
      if (protectedHeader.kid === 'es256-test-key-01') {
        return es256KeyPair.publicKey;
      }
      if (protectedHeader.kid === 'rs256-test-key-01') {
        return rs256KeyPair.publicKey;
      }
      throw new Error(`Unknown test kid: ${protectedHeader.kid}`);
    };

    verifier = new JwtVerifier({
      localKeySet: keySet,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      clockTolerance: 60,
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      mockJwksServer.close(() => resolve());
    });
  });

  async function createToken(
    payload: Record<string, unknown>,
    options: {
      key?: jose.KeyLike;
      alg?: string;
      kid?: string | null;
      issuer?: string;
      audience?: string;
      expiresIn?: string | number;
    } = {},
  ): Promise<string> {
    const signingKey = options.key || es256KeyPair.privateKey;
    const alg = options.alg || 'ES256';
    const kid = options.kid !== undefined ? options.kid : 'es256-test-key-01';

    const jwt = new jose.SignJWT(payload)
      .setProtectedHeader({
        alg,
        ...(kid !== null ? { kid } : {}),
      })
      .setAudience(options.audience || TEST_AUDIENCE)
      .setIssuer(options.issuer || TEST_ISSUER)
      .setIssuedAt();

    if (typeof payload.sub === 'string' && payload.sub.length > 0) {
      jwt.setSubject(payload.sub);
    } else if (payload.sub === undefined) {
      jwt.setSubject('default-user-sub');
    }

    if (typeof options.expiresIn === 'number') {
      jwt.setExpirationTime(options.expiresIn);
    } else {
      jwt.setExpirationTime(options.expiresIn || '1h');
    }

    return await jwt.sign(signingKey);
  }

  describe('Valid Token Verification', () => {
    it('successfully verifies a valid ES256 signed token', async () => {
      const token = await createToken({
        sub: 'usr_es256_001',
        email: 'creator@example.com',
        roles: ['CREATOR'],
      });

      const payload = await verifier.verifyToken(token);
      expect(payload.sub).toBe('usr_es256_001');
      expect(payload.email).toBe('creator@example.com');
      expect(payload.aud).toBe(TEST_AUDIENCE);
      expect(payload.iss).toBe(TEST_ISSUER);
      expect(payload.roles).toEqual(['CREATOR']);
      expect(payload.exp).toBeGreaterThan(0);
    });

    it('successfully verifies a valid RS256 signed token', async () => {
      const token = await createToken(
        {
          sub: 'usr_rs256_002',
          email: 'brand@example.com',
        },
        {
          key: rs256KeyPair.privateKey,
          alg: 'RS256',
          kid: 'rs256-test-key-01',
        },
      );

      const payload = await verifier.verifyToken(token);
      expect(payload.sub).toBe('usr_rs256_002');
      expect(payload.email).toBe('brand@example.com');
      expect(payload.iss).toBe(TEST_ISSUER);
    });
  });

  describe('Invalid Signatures', () => {
    it('rejects tokens signed by untrusted keys', async () => {
      const untrustedPair = await jose.generateKeyPair('ES256');
      const token = await createToken(
        { sub: 'untrusted_user' },
        {
          key: untrustedPair.privateKey,
          kid: 'es256-test-key-01', // claims valid kid but signed with wrong key
        },
      );

      await expect(verifier.verifyToken(token)).rejects.toThrow(AuthInvalidTokenError);
      await expect(verifier.verifyToken(token)).rejects.toThrow(
        /Cryptographic signature verification failed/,
      );
    });

    it('rejects tokens with tampered payloads', async () => {
      const token = await createToken({ sub: 'legit_user' });
      const parts = token.split('.');
      // Tamper with payload segment
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: 'tampered_user', iss: TEST_ISSUER, aud: TEST_AUDIENCE }),
      ).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      await expect(verifier.verifyToken(tamperedToken)).rejects.toThrow(AuthInvalidTokenError);
    });
  });

  describe('Expiration & Clock Tolerance', () => {
    it('rejects expired tokens past clock tolerance', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 300; // expired 5m ago
      const token = await createToken(
        { sub: 'expired_user', email: 'expired@example.com' },
        { expiresIn: pastExp },
      );

      await expect(verifier.verifyToken(token)).rejects.toThrow(AuthTokenExpiredError);
      await expect(verifier.verifyToken(token)).rejects.toThrow(/Authentication token has expired/);
    });

    it('accepts tokens with slight clock skew within 60s leeway', async () => {
      const slightlyPastExp = Math.floor(Date.now() / 1000) - 20; // expired 20s ago (within 60s leeway)
      const token = await createToken(
        { sub: 'leeway_user', email: 'leeway@example.com' },
        { expiresIn: slightlyPastExp },
      );

      const payload = await verifier.verifyToken(token);
      expect(payload.sub).toBe('leeway_user');
    });

    it('enforces custom strict clock tolerance', async () => {
      const strictVerifier = new JwtVerifier({
        localKeySet: async () => es256KeyPair.publicKey,
        issuer: TEST_ISSUER,
        clockTolerance: 5, // only 5s tolerance
      });

      const expiredPastStrictTolerance = Math.floor(Date.now() / 1000) - 15; // 15s ago
      const token = await createToken(
        { sub: 'strict_user' },
        { expiresIn: expiredPastStrictTolerance },
      );

      await expect(strictVerifier.verifyToken(token)).rejects.toThrow(AuthTokenExpiredError);
    });
  });

  describe('Malformed Tokens & Claims', () => {
    it('rejects empty or non-string tokens', async () => {
      await expect(verifier.verifyToken('')).rejects.toThrow(AuthInvalidTokenError);
      await expect(verifier.verifyToken('' as any)).rejects.toThrow(
        /Authentication token missing or malformed/,
      );
    });

    it('rejects malformed token strings that are not valid base64url JSON', async () => {
      await expect(verifier.verifyToken('invalid.jwt.token')).rejects.toThrow(
        AuthInvalidTokenError,
      );
      await expect(verifier.verifyToken('not-a-token')).rejects.toThrow(
        /Token header is not valid base64url JSON/,
      );
    });

    it('rejects tokens without mandatory kid header parameter', async () => {
      const token = await createToken({ sub: 'no_kid_user' }, { kid: null });

      await expect(verifier.verifyToken(token)).rejects.toThrow(AuthInvalidTokenError);
      await expect(verifier.verifyToken(token)).rejects.toThrow(
        /missing mandatory "kid" \(Key ID\) header parameter/,
      );
    });

    it('rejects tokens missing the subject claim (sub)', async () => {
      const token = await createToken({ email: 'nosub@example.com', sub: '' });

      await expect(verifier.verifyToken(token)).rejects.toThrow(AuthInvalidTokenError);
      await expect(verifier.verifyToken(token)).rejects.toThrow(/missing subject claim \(sub\)/);
    });
  });

  describe('Algorithm Governance & Header Injection Protections', () => {
    it('rejects alg "none" explicitly', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'es256-test-key-01' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'none_user',
          iss: TEST_ISSUER,
          aud: TEST_AUDIENCE,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;

      await expect(verifier.verifyToken(unsignedToken)).rejects.toThrow(
        /Algorithm 'none' is not permitted/,
      );
    });

    it('rejects symmetric HMAC algorithms (HS256)', async () => {
      const secret = new TextEncoder().encode('symmetric-secret-key-at-least-32-chars-long');
      const hsToken = await new jose.SignJWT({ sub: 'hmac_user' })
        .setProtectedHeader({ alg: 'HS256', kid: 'es256-test-key-01' })
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .setExpirationTime('1h')
        .sign(secret);

      await expect(verifier.verifyToken(hsToken)).rejects.toThrow(
        /Algorithm 'HS256' is not permitted/,
      );
    });

    it('ignores untrusted jku header parameter without fetching from it', async () => {
      const token = await new jose.SignJWT({ sub: 'jku_user' })
        .setProtectedHeader({
          alg: 'ES256',
          kid: 'es256-test-key-01',
          jku: 'https://attacker.evil.com/jwks.json',
        })
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .setExpirationTime('1h')
        .sign(es256KeyPair.privateKey);

      // Verifies using localKeySet, ignoring attacker jku
      const payload = await verifier.verifyToken(token);
      expect(payload.sub).toBe('jku_user');
    });

    it('ignores untrusted x5u header parameter', async () => {
      const token = await new jose.SignJWT({ sub: 'x5u_user' })
        .setProtectedHeader({
          alg: 'ES256',
          kid: 'es256-test-key-01',
          x5u: 'https://attacker.evil.com/cert.pem',
        })
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .setExpirationTime('1h')
        .sign(es256KeyPair.privateKey);

      const payload = await verifier.verifyToken(token);
      expect(payload.sub).toBe('x5u_user');
    });
  });

  describe('Issuer & Audience Validation (Fail-Closed)', () => {
    it('rejects tokens with mismatched issuer', async () => {
      const token = await createToken(
        { sub: 'wrong_issuer_user' },
        { issuer: 'https://wrong-issuer.com/auth/v1' },
      );

      await expect(verifier.verifyToken(token)).rejects.toThrow(AuthInvalidTokenError);
    });

    it('rejects tokens with mismatched audience', async () => {
      const token = await createToken({ sub: 'wrong_aud_user' }, { audience: 'wrong-audience' });

      await expect(verifier.verifyToken(token)).rejects.toThrow(AuthInvalidTokenError);
    });

    it('fails closed when issuer is empty or unconfigured', async () => {
      const unconfiguredVerifier = new JwtVerifier({
        localKeySet: async () => es256KeyPair.publicKey,
        issuer: '', // empty
      });

      const token = await createToken({ sub: 'any_user' });
      await expect(unconfiguredVerifier.verifyToken(token)).rejects.toThrow(
        /JWT issuer is not configured/,
      );
    });

    it('fails closed when issuer is whitespace only', async () => {
      const whitespaceVerifier = new JwtVerifier({
        localKeySet: async () => es256KeyPair.publicKey,
        issuer: '   ',
      });

      const token = await createToken({ sub: 'any_user' });
      await expect(whitespaceVerifier.verifyToken(token)).rejects.toThrow(
        /JWT issuer is not configured/,
      );
    });
  });

  describe('Boot Guards', () => {
    it('enforces production boot guard: rejects missing or non-HTTPS issuer when NODE_ENV=production', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        expect(() => new JwtVerifier({ issuer: 'http://insecure.example.com/auth/v1' })).toThrow(
          /Production boot guard failure: SUPABASE_JWT_ISSUER must be a valid HTTPS URL/,
        );
        expect(() => new JwtVerifier({ issuer: 'https://localhost/auth/v1' })).toThrow(
          /cannot reference localhost/,
        );
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('enforces production boot guard: rejects HTTP JWKS in production', () => {
      const origEnv = process.env.NODE_ENV;
      const origAllow = process.env.ALLOW_HTTP_JWKS;
      try {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_HTTP_JWKS = 'true';
        expect(
          () =>
            new JwtVerifier({
              issuer: 'https://auth.creatorconnect.com/auth/v1',
              jwksUrl: 'http://insecure-jwks.internal/keys.json',
            }),
        ).toThrow(/Production boot guard failure: SUPABASE_JWKS_URL must be a valid HTTPS URL/);
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.ALLOW_HTTP_JWKS = origAllow;
      }
    });
  });

  describe('JWKS Failures & Cache Behavior', () => {
    it('initializes a fail-closed resolver when neither JWKS URL nor issuer is provided', async () => {
      const noKeySetVerifier = new JwtVerifier({
        // no localKeySet, no jwksUrl, no issuer
      });

      // Calling the underlying key set directly fails closed
      await expect(
        (noKeySetVerifier as any).getKeySet({ alg: 'ES256', kid: 'any' }),
      ).rejects.toThrow(/JWKS key set is not configured/);
    });

    it('handles remote JWKS HTTP error responses by failing closed', async () => {
      jwksStatusCode = 500;
      jwksResponseBody = 'Internal Server Error';

      const remoteFailVerifier = new JwtVerifier({
        issuer: TEST_ISSUER,
        jwksUrl: mockJwksUrl,
      });

      const token = await createToken({ sub: 'remote_fail_user' });
      await expect(remoteFailVerifier.verifyToken(token)).rejects.toThrow(AuthInvalidTokenError);
    });

    it('caches remote JWKS keys so multiple verifications reuse cached keys without re-fetching', async () => {
      jwksStatusCode = 200;
      jwksResponseBody = JSON.stringify({ keys: [es256PublicJwk, rs256PublicJwk] });
      jwksRequestCount = 0; // reset counter

      const remoteCachingVerifier = new JwtVerifier({
        issuer: TEST_ISSUER,
        jwksUrl: mockJwksUrl,
        cacheMaxAge: 600000,
      });

      const token1 = await createToken({ sub: 'cached_user_1' });
      const token2 = await createToken({ sub: 'cached_user_2' });
      const token3 = await createToken({ sub: 'cached_user_3' });

      // Verify three separate tokens
      const payload1 = await remoteCachingVerifier.verifyToken(token1);
      const payload2 = await remoteCachingVerifier.verifyToken(token2);
      const payload3 = await remoteCachingVerifier.verifyToken(token3);

      expect(payload1.sub).toBe('cached_user_1');
      expect(payload2.sub).toBe('cached_user_2');
      expect(payload3.sub).toBe('cached_user_3');

      // The remote JWKS endpoint must have been fetched exactly once!
      expect(jwksRequestCount).toBe(1);
    });

    it('allows overriding key set resolver via setKeySet() for dependency injection', async () => {
      const diVerifier = new JwtVerifier({
        issuer: TEST_ISSUER,
        localKeySet: async () => {
          throw new Error('Initial resolver error');
        },
      });

      const token = await createToken({ sub: 'di_user' });
      await expect(diVerifier.verifyToken(token)).rejects.toThrow(AuthInvalidTokenError);

      // Inject working key set
      diVerifier.setKeySet(async (header) => {
        if (header.kid === 'es256-test-key-01') return es256KeyPair.publicKey;
        throw new Error('Unknown kid');
      });

      const verified = await diVerifier.verifyToken(token);
      expect(verified.sub).toBe('di_user');
    });
  });
});
