import {
  messagingRepository,
  type IMessagingRepository,
  conversationAuthorizationService,
  type IConversationAuthorizationService,
  getPrismaClient,
  type PrismaClient,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  CreateDirectConversationInput,
  DirectConversationResponse,
  ListConversationsQuery,
  ListConversationsResponse,
  ListMessagesQuery,
  ListMessagesResponse,
  SendMessageInput,
  MessageResponse,
  MarkReadInput,
  MarkReadResponse,
  CreateBlockInput,
  UserBlockResponse,
  ListBlocksQuery,
  ListBlocksResponse,
  CreateReportInput,
  ReportResponse,
  EditMessageInput,
  AttachmentDownloadResponse,
  CreateMessageRequestInput,
  DeclineMessageRequestInput,
  MessageRequestResponse,
  AcceptMessageRequestResponse,
  ListMessageRequestsQuery,
  ListMessageRequestsResponse,
} from '@creatorconnect/contracts';
import {
  MessageRequestNotFoundError,
  InvalidMessageRequestInputError,
} from '@creatorconnect/database';
import {
  S3StorageService,
  MockStorageService,
  type IStorageService,
} from '../media/storage.service.js';

export class MessagingService {
  constructor(
    private repo: IMessagingRepository = messagingRepository,
    private authService: IConversationAuthorizationService = conversationAuthorizationService,
    private prisma: PrismaClient = getPrismaClient(),
    public storage: IStorageService = process.env.NODE_ENV === 'test'
      ? new MockStorageService()
      : new S3StorageService(),
  ) {}

  /**
   * Creates or retrieves a direct conversation between the authenticated user and a recipient.
   */
  public async createOrGetDirectConversation(
    initiatorUserId: string,
    input: CreateDirectConversationInput,
  ): Promise<DirectConversationResponse> {
    await this.authService.assertCanStartDirectConversation(initiatorUserId, input.recipientId);

    const context: { assignmentId?: string; applicationId?: string } = {};
    if (input.assignmentId !== undefined) context.assignmentId = input.assignmentId;
    if (input.applicationId !== undefined) context.applicationId = input.applicationId;

    return await this.repo.createOrGetDirectConversation(
      initiatorUserId,
      input.recipientId,
      Object.keys(context).length > 0 ? context : undefined,
    );
  }

  /**
   * Lists the authenticated user's active conversations.
   */
  public async listUserConversations(
    userId: string,
    query?: ListConversationsQuery,
  ): Promise<ListConversationsResponse> {
    const params: { limit?: number; cursor?: string } = {};
    if (query?.limit !== undefined) params.limit = query.limit;
    if (query?.cursor !== undefined) params.cursor = query.cursor;

    return await this.repo.listUserConversations(
      userId,
      Object.keys(params).length > 0 ? params : undefined,
    );
  }

  /**
   * Gets a specific direct conversation by ID for an active participant.
   */
  public async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<DirectConversationResponse> {
    await this.authService.assertCanAccessConversation(conversationId, userId);
    return await this.repo.getConversationById(conversationId, userId);
  }

  /**
   * Retrieves paginated messages for an active conversation participant.
   */
  public async listMessages(
    conversationId: string,
    userId: string,
    query?: ListMessagesQuery,
  ): Promise<ListMessagesResponse> {
    await this.authService.assertCanReadMessages(conversationId, userId);

    const params: {
      conversationId: string;
      userId: string;
      cursor?: string;
      limit?: number;
      direction?: 'prev' | 'next';
    } = {
      conversationId,
      userId,
    };
    if (query?.cursor !== undefined) params.cursor = query.cursor;
    if (query?.limit !== undefined) params.limit = query.limit;
    if (query?.direction !== undefined) params.direction = query.direction;

    return await this.repo.listMessages(params);
  }

  /**
   * Sends a message within a conversation with client-side idempotency.
   */
  public async sendMessage(
    conversationId: string,
    senderId: string,
    input: SendMessageInput,
  ): Promise<MessageResponse> {
    await this.authService.assertCanSendMessage(conversationId, senderId);

    const params: {
      conversationId: string;
      senderId: string;
      clientMessageId: string;
      content: string;
      mediaAssetIds?: string[];
    } = {
      conversationId,
      senderId,
      clientMessageId: input.clientMessageId,
      content: input.content,
    };
    if (input.mediaAssetIds !== undefined) {
      params.mediaAssetIds = input.mediaAssetIds;
    }

    return await this.repo.sendMessage(params);
  }

  /**
   * Updates the read receipt pointer for an active conversation participant.
   */
  public async markConversationRead(
    conversationId: string,
    userId: string,
    input: MarkReadInput,
  ): Promise<MarkReadResponse> {
    await this.authService.assertCanMarkConversationRead(conversationId, userId);
    return await this.repo.markConversationRead(conversationId, userId, input.sequence);
  }

  /**
   * Blocks another user.
   */
  public async blockUser(blockerId: string, input: CreateBlockInput): Promise<UserBlockResponse> {
    await this.authService.assertCanBlockUser(blockerId, input.targetUserId);
    return await this.repo.blockUser(blockerId, input.targetUserId, input.reason);
  }

  /**
   * Unblocks a user by target user ID or block ID.
   */
  public async unblockUser(blockerId: string, targetIdOrBlockId: string): Promise<void> {
    // Check if targetIdOrBlockId is a block record ID or a target user ID
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { id: targetIdOrBlockId, blockerId },
          { blockedId: targetIdOrBlockId, blockerId },
        ],
      },
    });

    const targetUserId = block ? block.blockedId : targetIdOrBlockId;
    await this.repo.unblockUser(blockerId, targetUserId);
  }

  /**
   * Lists blocks initiated by the authenticated user.
   */
  public async listBlocks(userId: string, query?: ListBlocksQuery): Promise<ListBlocksResponse> {
    const params: { limit?: number; cursor?: string } = {};
    if (query?.limit !== undefined) params.limit = query.limit;
    if (query?.cursor !== undefined) params.cursor = query.cursor;

    return await this.repo.listBlocks(userId, Object.keys(params).length > 0 ? params : undefined);
  }

  /**
   * Edits a message within the 15-minute edit window.
   */
  public async editMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    input: EditMessageInput,
  ): Promise<MessageResponse> {
    await this.authService.assertCanAccessConversation(conversationId, userId);
    return await this.repo.editMessage({
      conversationId,
      messageId,
      userId,
      content: input.content,
    });
  }

  /**
   * Soft-deletes a message.
   */
  public async deleteMessage(
    conversationId: string,
    messageId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    if (!isAdmin) {
      await this.authService.assertCanAccessConversation(conversationId, userId);
    }
    await this.repo.deleteMessage({
      conversationId,
      messageId,
      userId,
      isAdmin,
    });
  }

  /**
   * Creates an abuse report against a user, message, or assignment.
   */
  public async createReport(reporterId: string, input: CreateReportInput): Promise<ReportResponse> {
    return await this.repo.createReport(reporterId, input);
  }

  /**
   * Generates a short-lived signed download URL for an active message attachment.
   * Enforces conversation participant authorization, ACTIVE media status, and bidirectional block checks.
   * Records a security audit log event for ATTACHMENT_DOWNLOADED.
   */
  public async getAttachmentDownloadUrl(
    attachmentId: string,
    userId: string,
    conversationId?: string,
    auditMeta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
  ): Promise<AttachmentDownloadResponse> {
    const { mediaAsset, conversationId: authConversationId } =
      await this.authService.assertCanAccessAttachment(attachmentId, userId, conversationId);

    const expiresInSeconds = 900; // 15 minutes configurable short-lived signed URL
    const downloadUrl = await this.storage.getDownloadUrl(
      mediaAsset.storageKey,
      expiresInSeconds,
      true,
    );

    try {
      await this.prisma.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId,
          action: 'ATTACHMENT_DOWNLOADED',
          entity: 'MessageAttachment',
          entityId: attachmentId,
          ipAddress: auditMeta?.ipAddress ?? null,
          userAgent: auditMeta?.userAgent ?? null,
          metadata: {
            conversationId: conversationId ?? authConversationId,
            mediaAssetId: mediaAsset.id,
            fileSize: mediaAsset.byteSize,
            mimeType: mediaAsset.mimeType,
          },
        },
      });
    } catch {
      // Safe fallback: non-critical audit log failure does not block authorized download
    }

    return {
      attachmentId,
      mediaAssetId: mediaAsset.id,
      fileName: mediaAsset.originalName,
      fileSize: mediaAsset.byteSize,
      mimeType: mediaAsset.mimeType,
      downloadUrl,
      expiresInSeconds,
    };
  }

  /**
   * Formats a database MessageRequest into the shared MessageRequestResponse contract.
   */
  public formatMessageRequest(r: any): MessageRequestResponse {
    return {
      id: r.id,
      senderId: r.senderId,
      recipientId: r.recipientId,
      conversationId: r.conversationId ?? null,
      initialMessage: r.initialMessage,
      status: r.status,
      declinedReason: r.declinedReason ?? null,
      expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : r.expiresAt,
      respondedAt: r.respondedAt
        ? r.respondedAt instanceof Date
          ? r.respondedAt.toISOString()
          : r.respondedAt
        : null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
      ...(r.senderProfile ? { senderProfile: r.senderProfile } : {}),
    };
  }

  /**
   * Submits an introductory message request with a single text message (max 500 chars).
   */
  public async createMessageRequest(
    senderId: string,
    input: CreateMessageRequestInput,
  ): Promise<MessageRequestResponse> {
    const trimmed = (input.initialMessage || '').trim();
    if (!trimmed || trimmed.length > 500) {
      throw new InvalidMessageRequestInputError(
        'Initial message must be between 1 and 500 characters.',
      );
    }
    if (/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/.test(input.initialMessage)) {
      throw new InvalidMessageRequestInputError(
        'Initial message contains disallowed control characters.',
      );
    }

    const created = await this.repo.createMessageRequest({
      senderId,
      recipientId: input.recipientId,
      initialMessage: trimmed,
    });

    return this.formatMessageRequest(created);
  }

  /**
   * Retrieves a message request by ID, enforcing participant authorization and anti-enumeration.
   */
  public async getMessageRequestById(
    id: string,
    viewerUserId: string,
  ): Promise<MessageRequestResponse> {
    const request = await this.repo.getMessageRequestById(id, viewerUserId);
    if (!request) {
      throw new MessageRequestNotFoundError();
    }
    return this.formatMessageRequest(request);
  }

  /**
   * Lists message requests with keyset cursor pagination.
   */
  public async listMessageRequests(
    userId: string,
    query?: ListMessageRequestsQuery,
  ): Promise<ListMessageRequestsResponse> {
    const params: {
      userId: string;
      direction?: 'incoming' | 'outgoing';
      status?: any;
      limit?: number;
      cursor?: string;
    } = { userId };
    if (query?.direction !== undefined) params.direction = query.direction;
    if (query?.status !== undefined) params.status = query.status;
    if (query?.limit !== undefined) params.limit = query.limit;
    if (query?.cursor !== undefined) params.cursor = query.cursor;

    const result = await this.repo.listMessageRequests(params);

    return {
      items: result.items.map((item) => this.formatMessageRequest(item)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  /**
   * Accepts an incoming message request atomically, creating a direct conversation and sequence 1 message.
   */
  public async acceptMessageRequest(
    id: string,
    recipientId: string,
  ): Promise<AcceptMessageRequestResponse> {
    const result = await this.repo.acceptMessageRequest(id, recipientId);
    return {
      request: this.formatMessageRequest(result.request),
      conversation: result.conversation,
    };
  }

  /**
   * Declines an incoming message request, initiating a 30-day decline cooldown.
   */
  public async declineMessageRequest(
    id: string,
    recipientId: string,
    input?: DeclineMessageRequestInput,
  ): Promise<MessageRequestResponse> {
    const reason = input?.reason?.trim();
    if (reason && /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/.test(reason)) {
      throw new InvalidMessageRequestInputError(
        'Decline reason contains disallowed control characters.',
      );
    }
    const result = await this.repo.declineMessageRequest(id, recipientId, reason || undefined);
    return this.formatMessageRequest(result);
  }

  /**
   * Cancels a pending outgoing message request, initiating a 24-hour anti-churn cooldown.
   */
  public async cancelMessageRequest(id: string, senderId: string): Promise<MessageRequestResponse> {
    const result = await this.repo.cancelMessageRequest(id, senderId);
    return this.formatMessageRequest(result);
  }
}

export const messagingService = new MessagingService();
