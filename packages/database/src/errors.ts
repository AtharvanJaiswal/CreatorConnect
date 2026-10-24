/**
 * Base Messaging Database Error adhering to RFC 7807 problem details fields.
 */
export class MessagingError extends Error {
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

export class ConversationNotFoundError extends MessagingError {
  constructor(detail = 'The requested conversation was not found.') {
    super(404, 'CONVERSATION_NOT_FOUND', 'Conversation Not Found', detail);
  }
}

export class NotConversationParticipantError extends MessagingError {
  constructor(detail = 'You are not an active participant in this conversation.') {
    super(403, 'NOT_CONVERSATION_PARTICIPANT', 'Not a Conversation Participant', detail);
  }
}

export class DuplicateClientMessageIdError extends MessagingError {
  constructor(
    detail = 'A message with this clientMessageId already exists with a different payload.',
  ) {
    super(409, 'DUPLICATE_CLIENT_MESSAGE_ID', 'Duplicate Client Message ID', detail);
  }
}

export class UserBlockedError extends MessagingError {
  constructor(detail = 'Communication between these users is blocked.') {
    super(403, 'USER_BLOCKED', 'User Interaction Blocked', detail);
  }
}

export class AttachmentNotFoundError extends MessagingError {
  constructor(detail = 'One or more attachment media assets were not found.') {
    super(404, 'ATTACHMENT_NOT_FOUND', 'Attachment Not Found', detail);
  }
}

export class AttachmentNotActiveError extends MessagingError {
  constructor(detail = 'Media asset is quarantined or not in ACTIVE state.') {
    super(400, 'ATTACHMENT_NOT_ACTIVE', 'Attachment Not Active', detail);
  }
}

export class AttachmentLimitExceededError extends MessagingError {
  constructor(detail = 'Exceeded maximum allowed attachments per message (limit: 10).') {
    super(400, 'MESSAGE_ATTACHMENT_LIMIT_EXCEEDED', 'Attachment Limit Exceeded', detail);
  }
}

export class SelfMessagingNotAllowedError extends MessagingError {
  constructor(detail = 'You cannot start a direct conversation with yourself.') {
    super(400, 'SELF_MESSAGING_NOT_ALLOWED', 'Self Messaging Not Allowed', detail);
  }
}

export class SelfBlockNotAllowedError extends MessagingError {
  constructor(detail = 'You cannot block your own user account.') {
    super(400, 'SELF_BLOCK_NOT_ALLOWED', 'Self Block Not Allowed', detail);
  }
}

export class InvalidMessageCursorError extends MessagingError {
  constructor(detail = 'The pagination cursor is invalid or malformed.') {
    super(400, 'INVALID_MESSAGE_CURSOR', 'Invalid Message Cursor', detail);
  }
}

export class UserNotFoundError extends MessagingError {
  constructor(detail = 'The specified user was not found.') {
    super(404, 'USER_NOT_FOUND', 'User Not Found', detail);
  }
}

export class UserSuspendedError extends MessagingError {
  constructor(detail = 'Account is suspended. Access denied.') {
    super(403, 'USER_SUSPENDED', 'Account Suspended', detail);
  }
}

export class MessageNotFoundError extends MessagingError {
  constructor(detail = 'The requested message was not found or access is denied.') {
    super(404, 'MESSAGE_NOT_FOUND', 'Message Not Found', detail);
  }
}

export class MessageNotEditableError extends MessagingError {
  constructor(detail = 'Message cannot be edited after the 15-minute edit window or if deleted.') {
    super(400, 'MESSAGE_NOT_EDITABLE', 'Message Not Editable', detail);
  }
}

export class MessageDeletedError extends MessagingError {
  constructor(detail = 'The requested message has already been deleted.') {
    super(400, 'MESSAGE_DELETED', 'Message Deleted', detail);
  }
}

export class SelfReportNotAllowedError extends MessagingError {
  constructor(detail = 'You cannot report your own account or your own content.') {
    super(400, 'SELF_REPORT_NOT_ALLOWED', 'Self Report Not Allowed', detail);
  }
}

export class ReportTargetNotFoundError extends MessagingError {
  constructor(detail = 'The specified report target entity was not found.') {
    super(404, 'REPORT_TARGET_NOT_FOUND', 'Report Target Not Found', detail);
  }
}

export class DuplicateReportError extends MessagingError {
  constructor(
    detail = 'A pending report for this target has already been submitted and is under review.',
  ) {
    super(409, 'DUPLICATE_REPORT', 'Duplicate Report', detail);
  }
}

export class MessageRequestNotFoundError extends MessagingError {
  constructor(detail = 'The requested message request was not found or access is denied.') {
    super(404, 'MESSAGE_REQUEST_NOT_FOUND', 'Message Request Not Found', detail);
  }
}

export class DuplicateMessageRequestError extends MessagingError {
  constructor(detail = 'A pending message request already exists between these users.') {
    super(409, 'DUPLICATE_MESSAGE_REQUEST', 'Duplicate Message Request', detail);
  }
}

export class MessageRequestCooldownActiveError extends MessagingError {
  constructor(
    detail = 'A cooldown period is active. You cannot send a message request to this user at this time.',
  ) {
    super(409, 'MESSAGE_REQUEST_COOLDOWN_ACTIVE', 'Message Request Cooldown Active', detail);
  }
}

export class MessageRequestInvalidStateError extends MessagingError {
  constructor(detail = 'The message request is not in a valid state for this action.') {
    super(409, 'MESSAGE_REQUEST_INVALID_STATE', 'Invalid Message Request State', detail);
  }
}

export class SelfMessageRequestNotAllowedError extends MessagingError {
  constructor(detail = 'You cannot send a message request to yourself.') {
    super(400, 'SELF_MESSAGE_REQUEST_NOT_ALLOWED', 'Self Message Request Not Allowed', detail);
  }
}

export class MessageRequestLimitExceededError extends MessagingError {
  constructor(
    detail = 'You have exceeded the maximum allowed message requests for this time window.',
  ) {
    super(429, 'MESSAGE_REQUEST_LIMIT_EXCEEDED', 'Message Request Limit Exceeded', detail);
  }
}

export class InvalidMessageRequestInputError extends MessagingError {
  constructor(detail = 'The message request input is invalid or malformed.') {
    super(400, 'INVALID_MESSAGE_REQUEST_INPUT', 'Invalid Message Request Input', detail);
  }
}

export class MessageRequestRequiredError extends MessagingError {
  constructor(
    detail = 'Direct conversation requires an accepted message request or a qualifying commercial relationship.',
  ) {
    super(403, 'MESSAGE_REQUEST_REQUIRED', 'Message Request Required', detail);
  }
}

/**
 * Base Notification Database Error adhering to RFC 7807 problem details fields.
 */
export class NotificationError extends Error {
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

export class NotificationNotFoundError extends NotificationError {
  constructor(detail = 'The requested notification was not found.') {
    super(404, 'NOTIFICATION_NOT_FOUND', 'Notification Not Found', detail);
  }
}

export class InvalidNotificationCursorError extends NotificationError {
  constructor(detail = 'The notification pagination cursor is invalid or malformed.') {
    super(400, 'INVALID_NOTIFICATION_CURSOR', 'Invalid Notification Cursor', detail);
  }
}

export class NotificationAccessDeniedError extends NotificationError {
  constructor(detail = 'You do not have permission to access this notification.') {
    super(403, 'NOTIFICATION_ACCESS_DENIED', 'Notification Access Denied', detail);
  }
}

export class InvalidNotificationPreferenceError extends NotificationError {
  constructor(detail = 'The requested notification preference configuration is invalid.') {
    super(400, 'INVALID_NOTIFICATION_PREFERENCE', 'Invalid Notification Preference', detail);
  }
}
