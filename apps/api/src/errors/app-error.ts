import {
  AuthError,
  AuthInvalidTokenError,
  AuthTokenExpiredError,
  AuthInsufficientRoleError,
} from '@creatorconnect/auth';

export { AuthError, AuthInvalidTokenError, AuthTokenExpiredError, AuthInsufficientRoleError };

/**
 * Base Application Error adhering to RFC 7807 problem details fields.
 */
export class AppError extends AuthError {
  constructor(statusCode: number, code: string, title: string, detail: string) {
    super(statusCode, code, title, detail);
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

export class RateLimitExceededError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, detail = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMIT_EXCEEDED', 'Rate Limit Exceeded', detail);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class RateLimiterDegradedError extends AppError {
  constructor(
    detail = 'Security-sensitive operation unavailable due to rate limiter infrastructure outage.',
  ) {
    super(503, 'RATE_LIMIT_UNAVAILABLE', 'Service Unavailable', detail);
  }
}

// ==============================================================================
// Phase 5 Messaging & Moderation Domain Errors
// ==============================================================================
// Phase 5 Messaging Errors (Re-exported from @creatorconnect/database)
// ==============================================================================

export {
  MessagingError,
  ConversationNotFoundError,
  NotConversationParticipantError,
  DuplicateClientMessageIdError,
  UserBlockedError,
  AttachmentNotFoundError,
  AttachmentNotActiveError,
  AttachmentLimitExceededError,
  SelfMessagingNotAllowedError,
  SelfBlockNotAllowedError,
  InvalidMessageCursorError,
  UserNotFoundError,
} from '@creatorconnect/database';

export class SelfReportNotAllowedError extends AppError {
  constructor(detail = 'You cannot submit an abuse report against yourself.') {
    super(400, 'SELF_REPORT_NOT_ALLOWED', 'Self Report Not Allowed', detail);
  }
}

export class MessageNotFoundError extends AppError {
  constructor(detail = 'The requested message was not found.') {
    super(404, 'MESSAGE_NOT_FOUND', 'Message Not Found', detail);
  }
}

export class MessageNotEditableError extends AppError {
  constructor(detail = 'Message cannot be edited (edit window expired or message deleted).') {
    super(400, 'MESSAGE_NOT_EDITABLE', 'Message Not Editable', detail);
  }
}

export class MessageDeletedError extends AppError {
  constructor(detail = 'The message has been deleted.') {
    super(410, 'MESSAGE_DELETED', 'Message Deleted', detail);
  }
}

export {
  NotificationError,
  NotificationNotFoundError,
  InvalidNotificationCursorError,
  NotificationAccessDeniedError,
  InvalidNotificationPreferenceError,
} from '@creatorconnect/database';

// ==============================================================================
// Phase 6 Payments & Financial Ledger Domain Errors
// ==============================================================================

export class UnbalancedLedgerEntryError extends AppError {
  constructor(detail = 'Ledger transaction is unbalanced: total debits must equal total credits.') {
    super(400, 'UNBALANCED_LEDGER_TRANSACTION', 'Unbalanced Ledger Transaction', detail);
  }
}

export class InvalidLedgerAmountError extends AppError {
  constructor(detail = 'Ledger amounts must be positive integer minor units.') {
    super(400, 'INVALID_LEDGER_AMOUNT', 'Invalid Ledger Amount', detail);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(detail = 'Idempotency key reused with a different request payload.') {
    super(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency Conflict', detail);
  }
}

export class WebhookSignatureVerificationError extends AppError {
  constructor(detail = 'Webhook signature verification failed.') {
    super(400, 'INVALID_WEBHOOK_SIGNATURE', 'Invalid Webhook Signature', detail);
  }
}

export class PaymentIntentStateError extends AppError {
  constructor(detail = 'Payment intent is not in an acceptable state for this operation.') {
    super(400, 'INVALID_PAYMENT_INTENT_STATE', 'Invalid Payment Intent State', detail);
  }
}

export class PaymentProviderError extends AppError {
  constructor(detail = 'Payment provider communication or processing error.') {
    super(502, 'PAYMENT_PROVIDER_ERROR', 'Payment Provider Error', detail);
  }
}

// ==============================================================================
// Phase 6 Increment 3: Disputes, Cancellations & Financial Recovery Errors
// ==============================================================================

export class DisputeNotFoundError extends AppError {
  constructor(detail = 'Dispute not found.') {
    super(404, 'DISPUTE_NOT_FOUND', 'Dispute Not Found', detail);
  }
}

export class DisputeStateError extends AppError {
  constructor(detail = 'Operation rejected: Dispute is not in a valid state for this action.') {
    super(400, 'INVALID_DISPUTE_STATE', 'Invalid Dispute State', detail);
  }
}

export class SelfDisputeResolutionNotAllowedError extends AppError {
  constructor(
    detail = 'Administrators who are participants in a project cannot arbitrate or resolve their own dispute.',
  ) {
    super(403, 'SELF_DISPUTE_RESOLUTION_NOT_ALLOWED', 'Self Dispute Resolution Prohibited', detail);
  }
}

export class NotDisputeParticipantError extends AppError {
  constructor(detail = 'You are not an authorized participant in this dispute.') {
    super(403, 'NOT_DISPUTE_PARTICIPANT', 'Not Dispute Participant', detail);
  }
}

export class ProjectNotDisputableError extends AppError {
  constructor(detail = 'Project is not eligible for disputes in its current status.') {
    super(400, 'PROJECT_NOT_DISPUTABLE', 'Project Not Disputable', detail);
  }
}

export class DisputeAlreadyOpenError extends AppError {
  constructor(detail = 'An active dispute is already open for this project.') {
    super(409, 'DISPUTE_ALREADY_OPEN', 'Dispute Already Open', detail);
  }
}

export class CancellationNotFoundError extends AppError {
  constructor(detail = 'Cancellation request not found.') {
    super(404, 'CANCELLATION_NOT_FOUND', 'Cancellation Not Found', detail);
  }
}

export class CancellationStateError extends AppError {
  constructor(detail = 'Cancellation request is not in a valid state for this operation.') {
    super(400, 'INVALID_CANCELLATION_STATE', 'Invalid Cancellation State', detail);
  }
}

export class ProjectCancellationConflictError extends AppError {
  constructor(
    detail = 'A pending cancellation request or active dispute already exists for this project.',
  ) {
    super(409, 'PROJECT_CANCELLATION_CONFLICT', 'Cancellation Conflict', detail);
  }
}

export class RefundNotFoundError extends AppError {
  constructor(detail = 'Refund record not found.') {
    super(404, 'REFUND_NOT_FOUND', 'Refund Not Found', detail);
  }
}

export class RefundExceedsCapturableAmountError extends AppError {
  constructor(
    detail = 'Requested refund amount exceeds total refundable amount or remaining escrow balance.',
  ) {
    super(400, 'REFUND_EXCEEDS_CAPTURABLE_AMOUNT', 'Refund Exceeds Capturable Amount', detail);
  }
}

export class RefundStateError extends AppError {
  constructor(detail = 'Payment intent is not eligible for refunds in its current status.') {
    super(400, 'INVALID_REFUND_STATE', 'Invalid Refund State', detail);
  }
}

export class FinancialReconciliationRequiredError extends AppError {
  constructor(
    detail = 'Financial state requires manual reconciliation due to conflicting provider records.',
  ) {
    super(409, 'FINANCIAL_RECONCILIATION_REQUIRED', 'Financial Reconciliation Required', detail);
  }
}
