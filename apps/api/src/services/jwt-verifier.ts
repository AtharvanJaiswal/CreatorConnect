import * as jose from 'jose';
import type { AuthTokenPayload, IAuthenticationProvider } from '@creatorconnect/auth';
import { AuthInvalidTokenError, AuthTokenExpiredError } from '../errors/app-error.js';

export interface JwtVerifierOptions {
  jwksUrl?: string;
  issuer?: string;
  audience?: string;
  clockTolerance?: number; // in seconds
  localKeySet?: jose.JWTVerifyGetKey;
}

const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

export class JwtVerifier implements IAuthenticationProvider {
  private getKeySet: jose.JWTVerifyGetKey;
  private issuer: string | undefined;
  private audience: string;
  private clockTolerance: number;

  constructor(options: JwtVerifierOptions = {}) {
    // Determine raw issuer:
    // - If options.issuer was explicitly provided (even as empty string), use it.
    // - Only fall back to SUPABASE_JWT_ISSUER env var if issuer was NOT provided in options at all.
    // This ensures `new JwtVerifier({ issuer: '' })` is treated as "unconfigured" and fails
    // closed, rather than accidentally inheriting the env var's issuer value.
    const rawIssuer = 'issuer' in options ? options.issuer : process.env.SUPABASE_JWT_ISSUER;
    // Normalize empty/whitespace to undefined so the fail-closed guard fires.
    this.issuer = rawIssuer && rawIssuer.trim() ? rawIssuer.trim() : undefined;

    this.audience = options.audience || 'authenticated';
    this.clockTolerance = options.clockTolerance ?? 60;

    if (options.localKeySet) {
      this.getKeySet = options.localKeySet;
    } else {
      const jwksUrlStr =
        options.jwksUrl ||
        process.env.SUPABASE_JWKS_URL ||
        'https://localhost.supabase.co/auth/v1/.well-known/jwks.json';

      const jwksUrl = new URL(jwksUrlStr);
      this.getKeySet = jose.createRemoteJWKSet(jwksUrl, {
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes
        cooldownDuration: 30 * 1000, // 30 seconds between refreshes for unknown kid
      });
    }
  }

  /**
   * Sets a custom key set provider (used for test fixtures / offline mocking).
   */
  public setKeySet(getKeySet: jose.JWTVerifyGetKey): void {
    this.getKeySet = getKeySet;
  }

  /**
   * Cryptographically verifies an incoming JWT token against trusted JWKS keys.
   *
   * SECURITY: Issuer validation is MANDATORY. If SUPABASE_JWT_ISSUER is not
   * configured, verification FAILS CLOSED — no token is accepted. This prevents
   * accepting tokens from arbitrary issuers due to misconfiguration.
   */
  public async verifyToken(token: string): Promise<AuthTokenPayload> {
    if (!token || typeof token !== 'string') {
      throw new AuthInvalidTokenError('Authentication token missing or malformed.');
    }

    // FAIL CLOSED: issuer must always be configured. A missing issuer is a
    // configuration error — do NOT skip validation and accept all issuers.
    if (!this.issuer) {
      throw new AuthInvalidTokenError(
        'JWT issuer is not configured. Token verification is disabled until issuer is provided.',
      );
    }

    // Inspect header without verification to validate algorithms and kid presence
    let protectedHeader: jose.ProtectedHeaderParameters;
    try {
      protectedHeader = jose.decodeProtectedHeader(token);
    } catch {
      throw new AuthInvalidTokenError('Token header is not valid base64url JSON.');
    }

    if (!protectedHeader.alg || !ALLOWED_ALGORITHMS.includes(protectedHeader.alg)) {
      throw new AuthInvalidTokenError(
        `Algorithm '${protectedHeader.alg}' is not permitted. Allowed: ${ALLOWED_ALGORITHMS.join(', ')}`,
      );
    }

    if (!protectedHeader.kid) {
      throw new AuthInvalidTokenError(
        'Token is missing mandatory "kid" (Key ID) header parameter.',
      );
    }

    try {
      const verifyOptions: jose.JWTVerifyOptions = {
        algorithms: ALLOWED_ALGORITHMS,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
        // Issuer is always set — the fail-closed guard above ensures this.issuer is truthy.
        issuer: this.issuer,
      };

      const { payload } = await jose.jwtVerify(token, this.getKeySet, verifyOptions);

      if (!payload.sub) {
        throw new AuthInvalidTokenError('Token payload is missing subject claim (sub).');
      }

      const audClaim = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;

      return {
        ...payload,
        sub: payload.sub,
        email: (payload.email as string) || '',
        exp: payload.exp || 0,
        iss: payload.iss || '',
        aud: (audClaim as string) || '',
      };
    } catch (err: unknown) {
      if (err instanceof AuthInvalidTokenError) {
        throw err;
      }

      if (err && typeof err === 'object' && 'code' in err) {
        const joseError = err as { code: string; message: string };
        if (joseError.code === 'ERR_JWT_EXPIRED') {
          throw new AuthTokenExpiredError('Authentication token has expired.');
        }
        if (
          joseError.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
          joseError.code === 'ERR_JWKS_NO_MATCHING_KEY'
        ) {
          throw new AuthInvalidTokenError('Cryptographic signature verification failed.');
        }
      }

      throw new AuthInvalidTokenError('Token verification failed.');
    }
  }
}

export const defaultJwtVerifier = new JwtVerifier();
