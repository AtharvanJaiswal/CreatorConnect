import type {
  ListConversationsResponse,
  DirectConversationResponse,
  CreateDirectConversationInput,
  MarkReadResponse,
  ListMessagesResponse,
  MessageResponse,
  SendMessageInput,
  EditMessageInput,
  AttachmentDownloadResponse,
  UserBlockResponse,
  ListBlocksResponse,
  CreateReportInput,
  ReportResponse,
  ConversationParticipantResponse,
  MessageRequestResponse,
  AcceptMessageRequestResponse,
  CreateMessageRequestInput,
  DeclineMessageRequestInput,
  ListMessageRequestsQuery,
  ListMessageRequestsResponse,
  MessageRequestStatus,
} from '@creatorconnect/contracts';

const API_BASE_URL =
  typeof window !== 'undefined'
    ? ''
    : process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface RetryOptions {
  maxRetries?: number | undefined;
  baseDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
  jitterMs?: number | undefined;
  timeoutMs?: number | undefined;
  isIdempotent?: boolean | undefined;
  signal?: AbortSignal | undefined;
  randomFn?: (() => number) | undefined;
  nowFn?: (() => number) | undefined;
}

/**
 * Calculates bounded exponential backoff delay with jitter (Section 8.4 formula):
 * d_k = min(d_max, d_0 * 2^k) + J_k
 */
export function calculateBackoffDelayMs(
  attempt: number,
  options?:
    | {
        baseDelayMs?: number | undefined;
        maxDelayMs?: number | undefined;
        jitterMs?: number | undefined;
        randomFn?: (() => number) | undefined;
      }
    | undefined,
): number {
  const d0 = Math.max(options?.baseDelayMs ?? 150, 10);
  const dMax = Math.max(options?.maxDelayMs ?? 3000, d0);
  const jitterMax = Math.max(options?.jitterMs ?? 100, 0);
  const random = options?.randomFn ?? Math.random;

  const normalizedAttempt = Math.max(0, Math.min(attempt, 10));
  const exponential = Math.min(dMax, d0 * Math.pow(2, normalizedAttempt));
  const jitter = jitterMax > 0 ? Math.floor(random() * jitterMax) : 0;

  return Math.min(dMax, exponential + jitter);
}

/**
 * Parses HTTP Retry-After header into milliseconds delay.
 * Supports both integer seconds and HTTP-date strings with injectable clock.
 */
export function parseRetryAfterHeader(
  headerValue: string | null | undefined,
  nowFn: () => number = Date.now,
): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (/^\d+$/.test(trimmed)) {
    const sec = parseInt(trimmed, 10);
    return isNaN(sec) ? null : Math.max(0, sec * 1000);
  }
  const parsedDate = new Date(trimmed).getTime();
  if (!isNaN(parsedDate)) {
    return Math.max(0, parsedDate - nowFn());
  }
  return null;
}

export class MessagingWorkflowService {
  constructor(private baseUrl: string = API_BASE_URL) {}

  /**
   * Internal fetch wrapper with bounded exponential backoff, jitter,
   * Retry-After header compliance, permanent error discrimination, AbortSignal support,
   * deterministic clock injection, and total-deadline elapsed-time budget protection.
   */
  async fetchWithRetry(
    url: string,
    init: RequestInit = {},
    options: RetryOptions = {},
  ): Promise<Response> {
    const maxRetries = options.maxRetries ?? 2;
    const isIdempotent = options.isIdempotent ?? (init.method === 'GET' || init.method === 'HEAD');
    const nowFn = options.nowFn ?? Date.now;
    const timeoutMs = options.timeoutMs ?? 15000;
    const startTime = nowFn();

    let attempt = 0;
    while (true) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      // Check if total deadline was exhausted across previous retries
      const elapsedMs = nowFn() - startTime;
      if (attempt > 0 && elapsedMs >= timeoutMs) {
        throw new DOMException(
          `Retry total deadline exceeded (${timeoutMs}ms budget exhausted after ${attempt} retries)`,
          'TimeoutError',
        );
      }

      try {
        const fetchInit: RequestInit = { ...init };
        const activeSignal = options.signal ?? init.signal;
        if (activeSignal) {
          fetchInit.signal = activeSignal;
        }
        const res = await fetch(url, fetchInit);

        if (res.ok) {
          return res;
        }

        // Status 4xx (except 408 Request Timeout and 429 Too Many Requests) are permanent client errors.
        // We MUST NOT retry permanent errors (e.g. 400, 401, 403, 404, 409, 422).
        const isTransientStatus = res.status === 408 || res.status === 429 || res.status >= 500;
        if (!isTransientStatus || !isIdempotent || attempt >= maxRetries) {
          return res;
        }

        // Check if remaining total deadline allows a delay wait
        const currentElapsed = nowFn() - startTime;
        const remainingBudgetMs = timeoutMs - currentElapsed;
        if (remainingBudgetMs <= 0) {
          return res;
        }

        const retryAfterMs = parseRetryAfterHeader(res.headers?.get?.('Retry-After'), nowFn);
        let delayMs =
          retryAfterMs !== null
            ? Math.min(options.maxDelayMs ?? 5000, retryAfterMs)
            : calculateBackoffDelayMs(attempt, {
                baseDelayMs: options.baseDelayMs,
                maxDelayMs: options.maxDelayMs,
                jitterMs: options.jitterMs,
                randomFn: options.randomFn,
              });

        // Cap delay within remaining total deadline budget
        if (delayMs > remainingBudgetMs) {
          delayMs = remainingBudgetMs;
        }

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          if (activeSignal) {
            activeSignal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true },
            );
          }
        });

        attempt++;
      } catch (err: unknown) {
        if (options.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          throw err;
        }

        if (!isIdempotent || attempt >= maxRetries) {
          throw err;
        }

        const currentElapsed = nowFn() - startTime;
        const remainingBudgetMs = timeoutMs - currentElapsed;
        if (remainingBudgetMs <= 0) {
          throw err;
        }

        let delayMs = calculateBackoffDelayMs(attempt, {
          baseDelayMs: options.baseDelayMs,
          maxDelayMs: options.maxDelayMs,
          jitterMs: options.jitterMs,
          randomFn: options.randomFn,
        });

        if (delayMs > remainingBudgetMs) {
          delayMs = remainingBudgetMs;
        }

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          const activeSignal = options.signal ?? init.signal;
          if (activeSignal) {
            activeSignal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true },
            );
          }
        });

        attempt++;
      }
    }
  }

  private getAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Fetches the authenticated user's active conversations.
   */
  async listConversations(
    options: { cursor?: string; limit?: number } = {},
    token?: string,
  ): Promise<ListConversationsResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/v1/conversations${queryStr}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to list conversations.');
    }

    return await res.json();
  }

  /**
   * Fetches metadata for a specific conversation by ID.
   */
  async getConversation(id: string, token?: string): Promise<DirectConversationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/conversations/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Conversation not found or access denied.');
    }

    return await res.json();
  }

  /**
   * Creates a new direct conversation or retrieves an existing one.
   */
  async createDirectConversation(
    input: CreateDirectConversationInput,
    token?: string,
  ): Promise<DirectConversationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/conversations`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to initialize conversation.');
    }

    return await res.json();
  }

  /**
   * Marks a conversation as read up to the specified monotonic sequence.
   */
  async markConversationRead(
    conversationId: string,
    sequence: string,
    token?: string,
  ): Promise<MarkReadResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/read`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify({ sequence }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update read pointer.');
    }

    return await res.json();
  }

  /**
   * Fetches messages for a conversation using keyset cursor pagination.
   */
  async listMessages(
    conversationId: string,
    options: {
      cursor?: string;
      limit?: number;
      direction?: 'prev' | 'next';
      signal?: AbortSignal;
    } = {},
    token?: string,
  ): Promise<ListMessagesResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.direction) params.set('direction', options.direction);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/messages${queryStr}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      },
      {
        signal: options.signal,
        isIdempotent: true,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch messages.');
    }

    return await res.json();
  }

  /**
   * Sends a message with clientMessageId idempotency.
   * Safe to retry because backend enforces deduplication on clientMessageId.
   */
  async sendMessage(
    conversationId: string,
    input: SendMessageInput,
    token?: string,
    signal?: AbortSignal,
  ): Promise<MessageResponse> {
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(input),
      },
      {
        signal,
        isIdempotent: true,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to send message.');
    }

    return await res.json();
  }

  /**
   * Edits message content within the 15-minute edit window.
   */
  async editMessage(
    conversationId: string,
    messageId: string,
    input: EditMessageInput,
    token?: string,
  ): Promise<MessageResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(input),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to edit message.');
    }

    return await res.json();
  }

  /**
   * Soft-deletes a message for all participants.
   */
  async deleteMessage(conversationId: string, messageId: string, token?: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders(token),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete message.');
    }
  }

  /**
   * Generates a short-lived presigned download URL for an active message attachment.
   */
  async getAttachmentDownload(
    conversationId: string,
    attachmentId: string,
    token?: string,
  ): Promise<AttachmentDownloadResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Attachment access denied or not found.');
    }

    return await res.json();
  }

  /**
   * Blocks a user, preventing further messaging and new conversation creation.
   * Calls POST /api/v1/blocks
   */
  async blockUser(
    targetUserId: string,
    reason?: string,
    token?: string,
  ): Promise<UserBlockResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/blocks`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify({
        targetUserId,
        ...(reason ? { reason } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to block participant.');
    }

    return await res.json();
  }

  /**
   * Unblocks a user by target user ID or block record ID.
   * Calls DELETE /api/v1/blocks/:id
   */
  async unblockUser(targetUserId: string, token?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/blocks/${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to unblock participant.');
    }
  }

  /**
   * Lists users blocked by the authenticated user.
   * Calls GET /api/v1/blocks
   */
  async listBlocks(token?: string): Promise<ListBlocksResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/blocks`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to retrieve block list.');
    }

    return await res.json();
  }

  /**
   * Checks whether the current user has blocked the specified peer.
   */
  async checkBlockStatus(
    peerUserId: string,
    token?: string,
  ): Promise<{ isBlocked: boolean; blockId?: string }> {
    try {
      const data = await this.listBlocks(token);
      const match = data.items.find((item) => item.blockedId === peerUserId);
      if (match) {
        return { isBlocked: true, blockId: match.id };
      }
      return { isBlocked: false };
    } catch {
      return { isBlocked: false };
    }
  }

  /**
   * Submits an abuse report against a user, message, or assignment.
   * Calls POST /api/v1/reports
   */
  async submitReport(
    input: CreateReportInput,
    token?: string,
    signal?: AbortSignal,
  ): Promise<ReportResponse> {
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/reports`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(input),
      },
      {
        signal,
        isIdempotent: false,
        maxRetries: 1,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit abuse report.');
    }

    return await res.json();
  }

  /**
   * Lists message requests with optional direction (incoming/outgoing) and status filtering.
   */
  async listMessageRequests(
    options: ListMessageRequestsQuery = {},
    token?: string,
  ): Promise<ListMessageRequestsResponse> {
    const params = new URLSearchParams();
    if (options.direction) params.set('direction', options.direction);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/chat/requests${queryStr}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      },
      {
        isIdempotent: true,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || 'Failed to list message requests.');
      (error as any).status = res.status;
      throw error;
    }

    return await res.json();
  }

  /**
   * Retrieves dossier for a specific message request by ID.
   */
  async getMessageRequest(id: string, token?: string): Promise<MessageRequestResponse> {
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/chat/requests/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      },
      {
        isIdempotent: true,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || 'Message request not found or access denied.');
      (error as any).status = res.status;
      throw error;
    }

    return await res.json();
  }

  /**
   * Submits a new message request introductory proposal to a peer.
   */
  async createMessageRequest(
    input: CreateMessageRequestInput,
    token?: string,
  ): Promise<MessageRequestResponse> {
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/chat/requests`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(input),
      },
      {
        isIdempotent: false,
        maxRetries: 0, // Do not auto-retry creation to prevent double-proposals
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || 'Failed to submit message request.');
      (error as any).status = res.status;
      (error as any).code = err.code || err.type;
      throw error;
    }

    return await res.json();
  }

  /**
   * Accepts an incoming message request, creating the direct conversation atomically.
   */
  async acceptMessageRequest(id: string, token?: string): Promise<AcceptMessageRequestResponse> {
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/chat/requests/${encodeURIComponent(id)}/accept`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(token),
      },
      {
        isIdempotent: true, // Server-side acceptance is idempotent
        maxRetries: 1,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || 'Failed to accept message request.');
      (error as any).status = res.status;
      (error as any).code = err.code || err.type;
      throw error;
    }

    return await res.json();
  }

  /**
   * Declines an incoming message request with optional reason.
   */
  async declineMessageRequest(
    id: string,
    input?: DeclineMessageRequestInput,
    token?: string,
  ): Promise<MessageRequestResponse> {
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/chat/requests/${encodeURIComponent(id)}/decline`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(input || {}),
      },
      {
        isIdempotent: true,
        maxRetries: 1,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || 'Failed to decline message request.');
      (error as any).status = res.status;
      (error as any).code = err.code || err.type;
      throw error;
    }

    return await res.json();
  }

  /**
   * Cancels an outgoing pending message request.
   */
  async cancelMessageRequest(id: string, token?: string): Promise<MessageRequestResponse> {
    const res = await this.fetchWithRetry(
      `${this.baseUrl}/api/v1/chat/requests/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(token),
      },
      {
        isIdempotent: true,
        maxRetries: 1,
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || 'Failed to cancel message request.');
      (error as any).status = res.status;
      (error as any).code = err.code || err.type;
      throw error;
    }

    return await res.json();
  }
}

export const messagingWorkflowService = new MessagingWorkflowService();

/**
 * Formats a message request expiration date into a human-readable countdown.
 */
export function formatMessageRequestExpiry(
  expiresAt: string,
  nowMs: number = Date.now(),
): { isExpired: boolean; label: string } {
  try {
    const expiryTime = new Date(expiresAt).getTime();
    if (isNaN(expiryTime)) {
      return { isExpired: false, label: '' };
    }
    const diffMs = expiryTime - nowMs;
    if (diffMs <= 0) {
      return { isExpired: true, label: 'Expired' };
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) {
      return { isExpired: false, label: `Expires in ${diffDays} days` };
    }
    if (diffDays === 1) {
      return { isExpired: false, label: 'Expires in 1 day' };
    }
    if (diffHours >= 1) {
      return { isExpired: false, label: `Expires in ${diffHours}h` };
    }
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return { isExpired: false, label: `Expires in ${diffMinutes}m` };
  } catch {
    return { isExpired: false, label: '' };
  }
}

/**
 * Maps message request status to visual badge styling matching the Stitch warm palette.
 */
export function formatMessageRequestStatus(status: MessageRequestStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Pending Response',
        badgeClass: 'bg-[#FFF8E1] text-[#7A5800] border-[#FFE082]',
      };
    case 'ACCEPTED':
      return {
        label: 'Accepted',
        badgeClass: 'bg-[#E8F5E9] text-[#1B5E20] border-[#C8E6C9]',
      };
    case 'DECLINED':
      return {
        label: 'Declined',
        badgeClass: 'bg-[#FFEBEE] text-[#B71C1C] border-[#FFCDD2]',
      };
    case 'EXPIRED':
      return {
        label: 'Expired',
        badgeClass: 'bg-[#F5F5F5] text-[#616161] border-[#E0E0E0]',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-[#F5F5F5] text-[#616161] border-[#E0E0E0]',
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-[#F5F5F5] text-[#616161] border-[#E0E0E0]',
      };
  }
}

/**
 * 15-Minute Edit / Delete Window Constant (900,000 ms).
 * Strictly mirrors backend EDIT_WINDOW_MS.
 */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Validates whether a message is eligible for sender modification (edit/delete)
 * based on the 15-minute server window rule and soft-deletion state.
 */
export function isMessageEditable(
  createdAt: string,
  deletedAt?: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (deletedAt) return false;
  try {
    const createdTime = new Date(createdAt).getTime();
    if (isNaN(createdTime)) return false;
    return nowMs - createdTime <= MESSAGE_EDIT_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Returns the whole number of minutes remaining in the 15-minute modification window.
 */
export function getMessageEditTimeRemainingMinutes(
  createdAt: string,
  nowMs: number = Date.now(),
): number {
  try {
    const createdTime = new Date(createdAt).getTime();
    if (isNaN(createdTime)) return 0;
    const remainingMs = MESSAGE_EDIT_WINDOW_MS - (nowMs - createdTime);
    if (remainingMs <= 0) return 0;
    return Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  } catch {
    return 0;
  }
}

/**
 * Formats an ISO timestamp for display within chat message bubbles (e.g., "10:14 AM").
 */
export function formatMessageTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Formats an ISO timestamp into a day separator string for message stream grouping
 * (e.g. "Wednesday, May 19, 2025" or "Today", "Yesterday").
 */
export function formatMessageDateSeparator(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    if (isToday) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Formats an ISO date string into an inbox-appropriate time or date label.
 */
export function formatConversationTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Retrieves the peer participant record in a conversation relative to the authenticated user.
 */
export function getPeerParticipant(
  conversation: DirectConversationResponse,
  currentUserId?: string,
): ConversationParticipantResponse | null {
  if (!conversation.participants || conversation.participants.length === 0) {
    return null;
  }
  if (!currentUserId) {
    return conversation.participants[0] ?? null;
  }
  const peer = conversation.participants.find((p) => p.userId !== currentUserId);
  return peer ?? conversation.participants[0] ?? null;
}

/**
 * Identifies the peer participant user ID in a conversation relative to the authenticated user.
 */
export function getPeerParticipantId(
  conversation: DirectConversationResponse,
  currentUserId?: string,
): string | null {
  const peer = getPeerParticipant(conversation, currentUserId);
  return peer?.userId ?? null;
}

/**
 * Determines the authoritative display name for a conversation or peer.
 */
export function getPeerDisplayName(
  conversation: DirectConversationResponse,
  currentUserId?: string,
): string {
  if (conversation.title) {
    return conversation.title;
  }
  const peer = getPeerParticipant(conversation, currentUserId);
  if (peer?.profile?.displayName) {
    return peer.profile.displayName;
  }
  if (peer?.userId) {
    return `User ${peer.userId.slice(0, 8)}`;
  }
  return 'Direct Conversation';
}

export type SafeMediaType = 'image' | 'video' | 'pdf' | 'unsupported';

/**
 * Categorizes media MIME types into safe in-browser presentation stages.
 * Security Note: SVG is intentionally categorized as 'unsupported' for raw direct rendering
 * to prevent embedded script execution from untrusted uploads.
 */
export function categorizeMediaType(
  mimeType?: string | null,
  fileName?: string | null,
): SafeMediaType {
  if (!mimeType) return 'unsupported';
  const lowerMime = mimeType.toLowerCase();
  const lowerExt = fileName ? fileName.split('.').pop()?.toLowerCase() : '';

  // Block active vector/script extensions regardless of declared MIME
  if (lowerExt === 'svg' || lowerExt === 'html' || lowerExt === 'htm' || lowerExt === 'js') {
    return 'unsupported';
  }

  // Safe raster images
  if (
    lowerMime === 'image/jpeg' ||
    lowerMime === 'image/jpg' ||
    lowerMime === 'image/png' ||
    lowerMime === 'image/webp' ||
    lowerMime === 'image/gif' ||
    lowerMime === 'image/avif'
  ) {
    return 'image';
  }

  // Safe video stream formats
  if (lowerMime === 'video/mp4' || lowerMime === 'video/webm' || lowerMime === 'video/quicktime') {
    return 'video';
  }

  // Safe PDF vector document
  if (lowerMime === 'application/pdf') {
    return 'pdf';
  }

  return 'unsupported';
}

/**
 * Formats byte size into human-readable notation (e.g. "4.8 MB").
 */
export function formatFileSize(byteSize: number): string {
  if (!byteSize || isNaN(byteSize) || byteSize < 0) return '0 B';
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`;
  if (byteSize < 1024 * 1024 * 1024) return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${(byteSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
