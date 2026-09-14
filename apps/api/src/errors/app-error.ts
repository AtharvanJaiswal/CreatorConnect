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

// ==============================================================================
// Phase 4 Domain Errors
// ==============================================================================

export class NotFoundError extends AppError {
  constructor(detail = 'The requested resource was not found.') {
    super(404, 'NOT_FOUND', 'Resource Not Found', detail);
  }
}

export class BadRequestError extends AppError {
  constructor(detail = 'The request payload or parameters are invalid.') {
    super(400, 'BAD_REQUEST', 'Bad Request', detail);
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'You are not authorized to perform this operation.') {
    super(403, 'FORBIDDEN', 'Access Forbidden', detail);
  }
}

export class ConflictError extends AppError {
  constructor(detail = 'The operation conflicted with existing resource state.') {
    super(409, 'CONFLICT', 'Resource Conflict', detail);
  }
}

export class OptimisticLockConflictError extends AppError {
  constructor(
    detail = 'The resource has been modified by another process. Please reload and retry.',
  ) {
    super(409, 'OPTIMISTIC_LOCK_CONFLICT', 'Optimistic Concurrency Conflict', detail);
  }
}

export class AssignmentDeadlineExpiredError extends AppError {
  constructor(detail = 'The assignment deadline has passed. New applications are not accepted.') {
    super(400, 'ASSIGNMENT_DEADLINE_EXPIRED', 'Deadline Expired', detail);
  }
}

export class InactiveTaxonomyError extends AppError {
  constructor(detail = 'The selected taxonomy category or skill is inactive.') {
    super(400, 'INACTIVE_TAXONOMY_ENTRY', 'Inactive Taxonomy', detail);
  }
}

export class UploadSizeMismatchError extends AppError {
  constructor(detail = 'Uploaded byte size does not match server-recorded asset size.') {
    super(400, 'UPLOAD_SIZE_MISMATCH', 'Upload Size Mismatch', detail);
  }
}

export class InvalidMediaStateError extends AppError {
  constructor(detail = 'Media asset is not in an acceptable state for this operation.') {
    super(400, 'INVALID_MEDIA_STATE', 'Invalid Media State', detail);
  }
}
