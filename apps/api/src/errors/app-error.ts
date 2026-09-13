/**
 * Base Application Error adhering to RFC 7807 problem details fields.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly title: string;
  public readonly detail: string;

  constructor(statusCode: number, code: string, title: string, detail: string) {
    super(detail);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.title = title;
    this.detail = detail;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthInvalidTokenError extends AppError {
  constructor(detail = 'Invalid or malformed authentication token.') {
    super(401, 'AUTH_INVALID_TOKEN', 'Invalid Authentication Token', detail);
  }
}

export class AuthTokenExpiredError extends AppError {
  constructor(detail = 'Authentication token has expired.') {
    super(401, 'AUTH_TOKEN_EXPIRED', 'Authentication Token Expired', detail);
  }
}

export class AuthInsufficientRoleError extends AppError {
  constructor(detail = 'You do not have the required permissions to access this resource.') {
    super(403, 'AUTH_INSUFFICIENT_ROLE', 'Insufficient Permissions', detail);
  }
}

export class UserSuspendedError extends AppError {
  constructor(detail = 'Account is suspended. Access denied.') {
    super(403, 'USER_SUSPENDED', 'Account Suspended', detail);
  }
}

export class UserDeactivatedError extends AppError {
  constructor(detail = 'Account is deactivated. Access denied.') {
    super(403, 'USER_DEACTIVATED', 'Account Deactivated', detail);
  }
}

export class IdentityNotSyncedError extends AppError {
  constructor(
    detail = 'Identity exists in authentication provider but has not been synchronized.',
  ) {
    super(401, 'IDENTITY_NOT_SYNCED', 'Identity Not Provisioned', detail);
  }
}

export class IdentityEmailConflictError extends AppError {
  constructor(
    detail = 'An account with this email address already exists under another identity.',
  ) {
    super(409, 'IDENTITY_EMAIL_CONFLICT', 'Identity Email Conflict', detail);
  }
}

export class RoleEscalationAttemptError extends AppError {
  constructor(detail = 'Requested role cannot be self-assigned.') {
    super(400, 'ROLE_ESCALATION_ATTEMPT', 'Unauthorized Role Assignment', detail);
  }
}

export class LastAdminLockoutError extends AppError {
  constructor(
    detail = 'Operation rejected: At least one active administrator must remain on the platform.',
  ) {
    super(400, 'LAST_ADMIN_LOCKOUT_PREVENTED', 'Last Admin Lockout Prevented', detail);
  }
}
