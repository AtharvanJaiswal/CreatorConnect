/**
 * Base Authentication Error adhering to RFC 7807 problem details fields.
 */
export class AuthError extends Error {
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
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class AuthInvalidTokenError extends AuthError {
  constructor(detail = 'Invalid or malformed authentication token.') {
    super(401, 'AUTH_INVALID_TOKEN', 'Invalid Authentication Token', detail);
  }
}

export class AuthTokenExpiredError extends AuthError {
  constructor(detail = 'Authentication token has expired.') {
    super(401, 'AUTH_TOKEN_EXPIRED', 'Authentication Token Expired', detail);
  }
}

export class AuthInsufficientRoleError extends AuthError {
  constructor(detail = 'You do not have the required permissions to access this resource.') {
    super(403, 'AUTH_INSUFFICIENT_ROLE', 'Insufficient Permissions', detail);
  }
}
