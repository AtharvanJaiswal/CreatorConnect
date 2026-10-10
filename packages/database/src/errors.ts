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
