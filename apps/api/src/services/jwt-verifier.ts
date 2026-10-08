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
  private jwksUrlStr: string | undefined;

  constructor(options: JwtVerifierOptions = {}) {
    const rawIssuer = 'issuer' in options ? options.issuer : process.env.SUPABASE_JWT_ISSUER;
    this.issuer =
      rawIssuer && rawIssuer.trim() ? rawIssuer.trim().replace(/^["']|["']$/g, '') : undefined;

    this.audience = options.audience || 'authenticated';
    this.clockTolerance = options.clockTolerance ?? 60;

    this.jwksUrlStr =
      options.jwksUrl ||
      process.env.SUPABASE_JWKS_URL ||
      (this.issuer ? `${this.issuer.replace(/\/$/, '')}/.well-known/jwks.json` : undefined);

    // Boot Guard: Enforce strict production configuration invariants
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      if (!this.issuer) {
        throw new Error(
          'Production boot guard failure: SUPABASE_JWT_ISSUER is required in production mode.',
        );
      }
      if (
        !this.issuer.startsWith('https://') ||
        this.issuer.includes('localhost') ||
        this.issuer.includes('127.0.0.1')
      ) {
        throw new Error(
          `Production boot guard failure: SUPABASE_JWT_ISSUER must be a valid HTTPS URL and cannot reference localhost. Received: ${this.issuer}`,
        );
      }
      if (
        this.jwksUrlStr &&
        (!this.jwksUrlStr.startsWith('https://') ||
          this.jwksUrlStr.includes('localhost') ||
          this.jwksUrlStr.includes('127.0.0.1'))
      ) {
        throw new Error(
          `Production boot guard failure: SUPABASE_JWKS_URL must be a valid HTTPS URL and cannot reference localhost. Received: ${this.jwksUrlStr}`,
        );
      }
    }

    // Non-production guard: Insecure HTTP JWKS requires explicit ALLOW_HTTP_JWKS=true
    if (!isProduction && this.jwksUrlStr && this.jwksUrlStr.startsWith('http://')) {
      const isAllowed =
        process.env.ALLOW_HTTP_JWKS === 'true' ||
        process.env.NODE_ENV === 'test' ||
        !!process.env.VITEST;
      if (!isAllowed) {
        throw new Error(
          `Non-production guard failure: HTTP JWKS URL requires ALLOW_HTTP_JWKS=true. Received: ${this.jwksUrlStr}`,
        );
      }
    }

    if (options.localKeySet) {
      this.getKeySet = options.localKeySet;
    } else {
      if (!this.jwksUrlStr) {
        // If neither JWKS URL nor issuer is provided, initialize a noop resolver that fails closed
        this.getKeySet = async () => {
          throw new AuthInvalidTokenError('JWKS key set is not configured.');
        };
      } else {
        const jwksUrl = new URL(this.jwksUrlStr);
        this.getKeySet = jose.createRemoteJWKSet(jwksUrl, {
          cacheMaxAge: 10 * 60 * 1000, // 10 minutes
          cooldownDuration: 30 * 1000, // 30 seconds between refreshes for unknown kid
        });
      }
    }
  }

  /**
   * Sets a custom key set provider (used for dependency injection / composition root).
   */
  public setKeySet(getKeySet: jose.JWTVerifyGetKey): void {
    this.getKeySet = getKeySet;
  }

  /**
   * Cryptographically verifies an incoming JWT token against trusted JWKS keys.
   *
   * SECURITY: Issuer validation is MANDATORY. If SUPABASE_JWT_ISSUER is not
   * configured, verification FAILS CLOSED.
   */
  public async verifyToken(token: string): Promise<AuthTokenPayload> {
    if (!token || typeof token !== 'string') {
      throw new AuthInvalidTokenError('Authentication token missing or malformed.');
    }

    // FAIL CLOSED: issuer must always be configured.
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

    // Ignore jku and x5u parameters — never allow token header to dictate key retrieval endpoint

    try {
      const verifyOptions: jose.JWTVerifyOptions = {
        algorithms: ALLOWED_ALGORITHMS,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
        // Exact match against configured issuer (never derived from token payload)
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
