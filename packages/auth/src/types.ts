import type { RoleType, UserStatus } from '@creatorconnect/contracts';

/**
 * Verified user identity attached to request context.
 */
export interface UserIdentity {
  id: string;
  supabaseAuthId: string;
  email: string;
  roles: RoleType[];
  status: UserStatus;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Decoded payload from a cryptographically verified JWT.
 */
export interface AuthTokenPayload {
  sub: string;
  email: string;
  exp: number;
  iss: string;
  aud: string;
  roles?: string[];
  [key: string]: unknown;
}

/**
 * Abstract provider interface decoupling identity verification from vendor SDKs.
 */
export interface IAuthenticationProvider {
  verifyToken(token: string): Promise<AuthTokenPayload>;
}
