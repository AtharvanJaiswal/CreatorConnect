import type { Socket } from 'socket.io';
import type { PrismaClient } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { defaultJwtVerifier, type JwtVerifier, type UserIdentity } from '@creatorconnect/auth';
import type { Logger } from 'pino';

export interface AuthenticatedSocketData {
  user: UserIdentity;
}

export type AuthenticatedSocket = Socket<any, any, any, AuthenticatedSocketData>;

export interface SocketAuthOptions {
  jwtVerifier?: JwtVerifier | undefined;
  prisma?: PrismaClient | undefined;
  logger?: Logger | undefined;
}

/**
 * Socket.IO Handshake Authentication Middleware.
 * Enforces cryptographic token validation via @creatorconnect/auth and
 * authoritative PostgreSQL account-status checking.
 *
 * Security Invariants:
 * 1. Client-supplied query/auth user IDs are strictly ignored.
 * 2. Tokens are accepted via handshake.auth.token or handshake.headers.authorization.
 * 3. PostgreSQL is the authoritative source of truth for account status (SUSPENDED / DEACTIVATED fail closed).
 * 4. Tokens and raw credentials are NEVER logged.
 */
export function createSocketAuthMiddleware(options: SocketAuthOptions = {}) {
  const jwtVerifier = options.jwtVerifier || defaultJwtVerifier;
  const prisma = options.prisma || getPrismaClient();
  const logger = options.logger;

  return async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
    try {
      // 1. Extract token from documented handshake mechanisms
      let token: string | undefined;

      const authObject = socket.handshake.auth as Record<string, unknown> | undefined;
      if (authObject && typeof authObject.token === 'string') {
        token = authObject.token.trim();
      } else if (
        socket.handshake.headers.authorization &&
        typeof socket.handshake.headers.authorization === 'string'
      ) {
        token = socket.handshake.headers.authorization.trim();
      }

      if (!token) {
        const error = new Error('Authentication token missing or malformed.');
        (error as any).data = { code: 'AUTH_INVALID_TOKEN' };
        return next(error);
      }

      // Strip leading 'Bearer ' if provided
      if (token.startsWith('Bearer ')) {
        token = token.substring(7).trim();
      }

      if (!token) {
        const error = new Error('Authentication token missing or malformed.');
        (error as any).data = { code: 'AUTH_INVALID_TOKEN' };
        return next(error);
      }

      // 2. Cryptographically verify JWT using shared verifier
      const tokenPayload = await jwtVerifier.verifyToken(token);

      // 3. PostgreSQL is the authoritative source of truth for account status
      const user = await prisma.user.findUnique({
        where: { supabaseAuthId: tokenPayload.sub },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user) {
        const error = new Error('User profile not synchronized with platform.');
        (error as any).data = { code: 'IDENTITY_NOT_SYNCED' };
        return next(error);
      }

      if (user.status === 'SUSPENDED') {
        const error = new Error('Account is suspended. Access denied.');
        (error as any).data = { code: 'USER_SUSPENDED' };
        return next(error);
      }

      if (user.status === 'DEACTIVATED') {
        const error = new Error('Account is deactivated. Access denied.');
        (error as any).data = { code: 'USER_DEACTIVATED' };
        return next(error);
      }

      if (user.status !== 'ACTIVE') {
        const error = new Error('Account is not in active state.');
        (error as any).data = { code: 'USER_SUSPENDED' };
        return next(error);
      }

      const roles = user.userRoles.map((ur) => ur.role.name);

      // 4. Attach verified principal exclusively from DB/JWT (never trusting handshake input)
      socket.data.user = {
        id: user.id,
        email: user.email,
        roles: roles as any,
        status: user.status as any,
      };

      if (logger) {
        logger.debug(
          { socketId: socket.id, userId: user.id },
          'Socket handshake authenticated successfully',
        );
      }

      return next();
    } catch (err: any) {
      if (logger) {
        logger.warn(
          {
            socketId: socket.id,
            errorCode: err?.code || err?.name,
            errorMessage: err?.message,
          },
          'Socket handshake authentication rejected',
        );
      }

      const clientError = new Error(err.message || 'Authentication failed.');
      (clientError as any).data = {
        code: err.code || 'AUTH_INVALID_TOKEN',
      };
      return next(clientError);
    }
  };
}
