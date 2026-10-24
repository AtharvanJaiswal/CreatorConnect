import {
  PrismaClient,
  Prisma,
  type Conversation,
  type ConversationParticipant,
  type Message,
  type MessageAttachment,
  type MessageRequest,
  type MessageRequestStatus,
} from '@prisma/client';
import { getPrismaClient } from './index.js';
import { generateUuidV7 } from '@creatorconnect/utils';
import {
  decodeMessageCursor,
  encodeMessageCursor,
  type MessageResponse,
  type DirectConversationResponse,
  type ListMessagesResponse,
  type ListConversationsResponse,
  type MarkReadResponse,
  type UserBlockResponse,
  type ListBlocksResponse,
  type CreateReportInput,
  type ReportResponse,
  type ConversationParticipantProfile,
} from '@creatorconnect/contracts';
import {
  ConversationNotFoundError,
  DuplicateClientMessageIdError,
  UserBlockedError,
  AttachmentNotFoundError,
  AttachmentNotActiveError,
  AttachmentLimitExceededError,
  SelfMessagingNotAllowedError,
  SelfBlockNotAllowedError,
  InvalidMessageCursorError,
  MessageNotFoundError,
  MessageNotEditableError,
  SelfReportNotAllowedError,
  ReportTargetNotFoundError,
  NotConversationParticipantError,
  DuplicateReportError,
  MessageRequestNotFoundError,
  DuplicateMessageRequestError,
  MessageRequestCooldownActiveError,
  MessageRequestInvalidStateError,
  SelfMessageRequestNotAllowedError,
  MessageRequestLimitExceededError,
  InvalidMessageRequestInputError,
  UserNotFoundError,
} from './errors.js';

export const PARTICIPANT_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  creatorProfile: {
    select: {
      locationCity: true,
      locationCountry: true,
      isVerified: true,
      deletedAt: true,
    },
  },
  brandProfile: {
    select: {
      companyName: true,
      isVerified: true,
      deletedAt: true,
    },
  },
  professionalProfile: {
    select: {
      headline: true,
      locationCity: true,
      locationCountry: true,
      deletedAt: true,
    },
  },
  podcasterProfile: {
    select: {
      podcastName: true,
      deletedAt: true,
    },
  },
  userRoles: {
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
} as const;

export type ParticipantWithUser = ConversationParticipant & {
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    creatorProfile?: {
      locationCity: string | null;
      locationCountry: string | null;
      isVerified: boolean;
      deletedAt: Date | null;
    } | null;
    brandProfile?: {
      companyName: string | null;
      isVerified: boolean;
      deletedAt: Date | null;
    } | null;
    professionalProfile?: {
      headline: string | null;
      locationCity: string | null;
      locationCountry: string | null;
      deletedAt: Date | null;
    } | null;
    podcasterProfile?: { podcastName: string | null; deletedAt: Date | null } | null;
    userRoles?: Array<{ role: { name: string } }>;
  } | null;
};

export interface IMessagingRepository {
  createOrGetDirectConversation(
    initiatorUserId: string,
    recipientUserId: string,
    context?: { assignmentId?: string; applicationId?: string },
  ): Promise<DirectConversationResponse>;

  sendMessage(params: {
    conversationId: string;
    senderId: string;
    clientMessageId: string;
    content: string;
    mediaAssetIds?: string[];
  }): Promise<MessageResponse>;

  editMessage(params: {
    conversationId: string;
    messageId: string;
    userId: string;
    content: string;
  }): Promise<MessageResponse>;

  deleteMessage(params: {
    conversationId: string;
    messageId: string;
    userId: string;
    isAdmin: boolean;
  }): Promise<void>;

  listMessages(params: {
    conversationId: string;
    userId: string;
    cursor?: string;
    limit?: number;
    direction?: 'prev' | 'next';
  }): Promise<ListMessagesResponse>;

  getConversationById(conversationId: string, userId: string): Promise<DirectConversationResponse>;

  listUserConversations(
    userId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<ListConversationsResponse>;

  markConversationRead(
    conversationId: string,
    userId: string,
    sequence: string | bigint,
  ): Promise<MarkReadResponse>;

  blockUser(blockerId: string, blockedId: string, reason?: string): Promise<UserBlockResponse>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  listBlocks(
    blockerId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<ListBlocksResponse>;
  isBlocked(userA: string, userB: string): Promise<boolean>;

  createReport(reporterId: string, input: CreateReportInput): Promise<ReportResponse>;

  createMessageRequest(params: {
    senderId: string;
    recipientId: string;
    initialMessage: string;
    expiresAt?: Date;
  }): Promise<MessageRequest>;

  getMessageRequestById(
    id: string,
    viewerUserId?: string,
  ): Promise<(MessageRequest & { senderProfile?: ConversationParticipantProfile }) | null>;

  listMessageRequests(params: {
    userId: string;
    direction?: 'incoming' | 'outgoing';
    status?: MessageRequestStatus;
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: Array<MessageRequest & { senderProfile?: ConversationParticipantProfile }>;
    nextCursor: string | null;
    hasMore: boolean;
  }>;

  acceptMessageRequest(
    id: string,
    recipientId: string,
  ): Promise<{
    request: MessageRequest;
    conversation: DirectConversationResponse;
  }>;

  declineMessageRequest(id: string, recipientId: string, reason?: string): Promise<MessageRequest>;

  cancelMessageRequest(id: string, senderId: string): Promise<MessageRequest>;
}

export class MessagingRepository implements IMessagingRepository {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  /**
   * Finds an existing direct conversation between two users or creates one atomically.
   * Does NOT require assignment or application context.
   */
  public async createOrGetDirectConversation(
    initiatorUserId: string,
    recipientUserId: string,
    context?: { assignmentId?: string; applicationId?: string },
  ): Promise<DirectConversationResponse> {
    if (initiatorUserId === recipientUserId) {
      throw new SelfMessagingNotAllowedError();
    }

    if (await this.isBlocked(initiatorUserId, recipientUserId)) {
      throw new UserBlockedError();
    }

    // Check for existing active direct conversation between both users
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        deletedAt: null,
        AND: [
          { participants: { some: { userId: initiatorUserId, leftAt: null } } },
          { participants: { some: { userId: recipientUserId, leftAt: null } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: PARTICIPANT_USER_SELECT,
            },
          },
        },
      },
    });

    if (existing) {
      return this.formatDirectConversation(existing as any);
    }

    // Sort user IDs to form a deterministic lock key avoiding deadlocks
    const lockKey = [initiatorUserId, recipientUserId].sort().join(':');

    // Acquire transaction-level advisory lock and create conversation safely
    const created = await this.prisma.$transaction(async (tx) => {
      // 1. Acquire advisory xact lock for this user pair
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'direct_conv:' + lockKey}))`;

      // 2. Re-check for existing direct conversation inside the lock
      const lockedExisting = await tx.conversation.findFirst({
        where: {
          type: 'DIRECT',
          deletedAt: null,
          AND: [
            { participants: { some: { userId: initiatorUserId, leftAt: null } } },
            { participants: { some: { userId: recipientUserId, leftAt: null } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: PARTICIPANT_USER_SELECT,
              },
            },
          },
        },
      });

      if (lockedExisting) {
        return lockedExisting;
      }

      // 3. Create conversation and participants atomically
      const conversationId = generateUuidV7();
      return await tx.conversation.create({
        data: {
          id: conversationId,
          type: 'DIRECT',
          title: null,
          assignmentId: context?.assignmentId ?? null,
          applicationId: context?.applicationId ?? null,
          currentSequence: 0n,
          participants: {
            create: [
              {
                id: generateUuidV7(),
                userId: initiatorUserId,
                role: 'MEMBER',
                lastReadSequence: 0n,
              },
              {
                id: generateUuidV7(),
                userId: recipientUserId,
                role: 'MEMBER',
                lastReadSequence: 0n,
              },
            ],
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: PARTICIPANT_USER_SELECT,
              },
            },
          },
        },
      });
    });

    return this.formatDirectConversation(created as any);
  }

  /**
   * Atomically sends a message allocating a strictly monotonic per-conversation sequence,
   * enforcing idempotency, validating attachments, and creating the outbox event in the same transaction.
   */
  public async sendMessage(params: {
    conversationId: string;
    senderId: string;
    clientMessageId: string;
    content: string;
    mediaAssetIds?: string[];
  }): Promise<MessageResponse> {
    const { conversationId, senderId, clientMessageId, content } = params;
    const mediaAssetIds = params.mediaAssetIds || [];

    if (mediaAssetIds.length > 10) {
      throw new AttachmentLimitExceededError();
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Verify sender is an active participant in the conversation
          const participant = await tx.conversationParticipant.findFirst({
            where: { conversationId, userId: senderId, leftAt: null },
          });
          if (!participant) {
            throw new ConversationNotFoundError();
          }

          // 2. Verify neither party has blocked the other
          const otherParticipants = await tx.conversationParticipant.findMany({
            where: { conversationId, userId: { not: senderId }, leftAt: null },
            select: { userId: true },
          });
          for (const other of otherParticipants) {
            const blocked = await tx.userBlock.findFirst({
              where: {
                OR: [
                  { blockerId: senderId, blockedId: other.userId },
                  { blockerId: other.userId, blockedId: senderId },
                ],
              },
            });
            if (blocked) {
              throw new UserBlockedError();
            }
          }

          // 3. Check message idempotency against composite unique constraint
          const existingMessage = await tx.message.findUnique({
            where: {
              senderId_conversationId_clientMessageId: {
                senderId,
                conversationId,
                clientMessageId,
              },
            },
            include: {
              attachments: true,
            },
          });

          if (existingMessage) {
            const existingAssetIds = existingMessage.attachments.map((a) => a.mediaAssetId).sort();
            const requestedAssetIds = mediaAssetIds.slice().sort();
            const isMatch =
              existingMessage.content === content &&
              existingAssetIds.length === requestedAssetIds.length &&
              existingAssetIds.every((id, idx) => id === requestedAssetIds[idx]);

            if (isMatch) {
              // Idempotent duplicate: return existing message without incrementing sequence or inserting outbox event
              return this.formatMessage(existingMessage);
            }
            throw new DuplicateClientMessageIdError();
          }

          // 4. Validate attachment references against database
          if (mediaAssetIds.length > 0) {
            const assets = await tx.mediaAsset.findMany({
              where: {
                id: { in: mediaAssetIds },
              },
              select: {
                id: true,
                userId: true,
                status: true,
              },
            });

            if (assets.length !== mediaAssetIds.length) {
              throw new AttachmentNotFoundError();
            }

            for (const asset of assets) {
              if (asset.status !== 'ACTIVE') {
                throw new AttachmentNotActiveError();
              }
              if (asset.userId !== senderId) {
                throw new AttachmentNotFoundError(
                  'Attachment media asset does not belong to sender.',
                );
              }
            }
          }

          // 5. Monotonic Sequence Allocation: Acquire exclusive row lock on the conversation
          const lockedRows = await tx.$queryRaw<Array<{ id: string; current_sequence: bigint }>>`
            SELECT id, current_sequence
            FROM conversations
            WHERE id = ${conversationId}::uuid
            FOR UPDATE
          `;

          const firstLocked = lockedRows && lockedRows.length > 0 ? lockedRows[0] : undefined;
          if (!firstLocked) {
            throw new ConversationNotFoundError();
          }

          const currentSeq = BigInt(firstLocked.current_sequence);
          const nextSeq = currentSeq + 1n;

          // 6. Atomically update conversation currentSequence
          await tx.conversation.update({
            where: { id: conversationId },
            data: { currentSequence: nextSeq },
          });

          // 7. Insert message with guaranteed sequence
          const messageId = generateUuidV7();
          const messageCreateInput: Prisma.MessageCreateInput = {
            id: messageId,
            conversation: { connect: { id: conversationId } },
            sender: { connect: { id: senderId } },
            sequence: nextSeq,
            clientMessageId,
            content,
            status: 'SENT',
          };

          if (mediaAssetIds.length > 0) {
            messageCreateInput.attachments = {
              create: mediaAssetIds.map((mediaAssetId) => ({
                id: generateUuidV7(),
                mediaAsset: { connect: { id: mediaAssetId } },
              })),
            };
          }

          const message = await tx.message.create({
            data: messageCreateInput,
            include: {
              attachments: true,
            },
          });

          // 8. Insert corresponding outbox event in the SAME transaction
          const outboxEventId = generateUuidV7();
          await tx.outboxEvent.create({
            data: {
              id: outboxEventId,
              eventType: 'message.created.v1',
              aggregateType: 'Message',
              aggregateId: messageId,
              payload: {
                messageId,
                conversationId,
                senderId,
                sequence: nextSeq.toString(),
                clientMessageId,
                content,
                attachmentCount: mediaAssetIds.length,
                createdAt: message.createdAt.toISOString(),
              },
              status: 'PENDING',
            },
          });

          return this.formatMessage(message);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );
    } catch (err: unknown) {
      // Handle race condition on composite unique constraint
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const racedMessage = await this.prisma.message.findUnique({
          where: {
            senderId_conversationId_clientMessageId: {
              senderId,
              conversationId,
              clientMessageId,
            },
          },
          include: {
            attachments: true,
          },
        });

        if (racedMessage) {
          const existingAssetIds = racedMessage.attachments.map((a) => a.mediaAssetId).sort();
          const requestedAssetIds = mediaAssetIds.slice().sort();
          const isMatch =
            racedMessage.content === content &&
            existingAssetIds.length === requestedAssetIds.length &&
            existingAssetIds.every((id, idx) => id === requestedAssetIds[idx]);

          if (isMatch) {
            return this.formatMessage(racedMessage);
          }
          throw new DuplicateClientMessageIdError();
        }
      }

      throw err;
    }
  }

  /**
   * Updates message content within the authoritative 15-minute edit window.
   * Enforces original author check and non-deleted state, transitioning status to EDITED
   * and writing 'message.updated.v1' to outbox within the same transaction.
   */
  public async editMessage(params: {
    conversationId: string;
    messageId: string;
    userId: string;
    content: string;
  }): Promise<MessageResponse> {
    const { conversationId, messageId, userId, content } = params;

    return await this.prisma.$transaction(
      async (tx) => {
        const message = await tx.message.findUnique({
          where: { id: messageId },
          include: { attachments: true },
        });

        if (!message || message.conversationId !== conversationId || message.deletedAt !== null) {
          throw new MessageNotFoundError();
        }

        if (message.senderId !== userId) {
          throw new MessageNotFoundError('You can only edit your own messages.');
        }

        const EDIT_WINDOW_MS = 15 * 60 * 1000;
        if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
          throw new MessageNotEditableError();
        }

        const updated = await tx.message.update({
          where: { id: messageId },
          data: {
            content,
            status: 'EDITED',
          },
          include: { attachments: true },
        });

        const outboxEventId = generateUuidV7();
        await tx.outboxEvent.create({
          data: {
            id: outboxEventId,
            eventType: 'message.updated.v1',
            aggregateType: 'Message',
            aggregateId: messageId,
            payload: {
              messageId,
              conversationId,
              senderId: userId,
              sequence: updated.sequence.toString(),
              content,
              updatedAt: updated.updatedAt.toISOString(),
            },
            status: 'PENDING',
          },
        });

        return this.formatMessage(updated);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }

  /**
   * Soft-deletes a message by setting deletedAt and sanitizing content.
   * Can be performed by the original sender or an administrator.
   * Emits 'message.deleted.v1' to outbox in the same transaction.
   */
  public async deleteMessage(params: {
    conversationId: string;
    messageId: string;
    userId: string;
    isAdmin: boolean;
  }): Promise<void> {
    const { conversationId, messageId, userId, isAdmin } = params;

    await this.prisma.$transaction(
      async (tx) => {
        const message = await tx.message.findUnique({
          where: { id: messageId },
        });

        if (!message || message.conversationId !== conversationId || message.deletedAt !== null) {
          throw new MessageNotFoundError();
        }

        if (message.senderId !== userId && !isAdmin) {
          throw new MessageNotFoundError(
            'Only the message author or an admin can delete this message.',
          );
        }

        if (!isAdmin) {
          const EDIT_WINDOW_MS = 15 * 60 * 1000;
          if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
            throw new MessageNotEditableError(
              'Messages can only be deleted within 15 minutes of sending.',
            );
          }
        }

        const deletedAt = new Date();
        await tx.message.update({
          where: { id: messageId },
          data: {
            deletedAt,
            status: 'DELETED',
            content: '[This message was deleted]',
          },
        });

        const outboxEventId = generateUuidV7();
        await tx.outboxEvent.create({
          data: {
            id: outboxEventId,
            eventType: 'message.deleted.v1',
            aggregateType: 'Message',
            aggregateId: messageId,
            payload: {
              messageId,
              conversationId,
              deletedBy: userId,
              sequence: message.sequence.toString(),
              deletedAt: deletedAt.toISOString(),
            },
            status: 'PENDING',
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }

  /**
   * Retrieves paginated messages using keyset cursor pagination.
   */
  public async listMessages(params: {
    conversationId: string;
    userId: string;
    cursor?: string;
    limit?: number;
    direction?: 'prev' | 'next';
  }): Promise<ListMessagesResponse> {
    const { conversationId, userId } = params;
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const direction = params.direction || 'prev';

    // Verify membership
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId, leftAt: null },
    });
    if (!participant) {
      throw new ConversationNotFoundError();
    }

    const where: Prisma.MessageWhereInput = {
      conversationId,
      deletedAt: null,
    };

    if (params.cursor) {
      const decoded = decodeMessageCursor(params.cursor);
      if (!decoded) {
        throw new InvalidMessageCursorError();
      }
      const cursorSeq = BigInt(decoded.sequence);
      if (direction === 'prev') {
        where.sequence = { lt: cursorSeq };
      } else {
        where.sequence = { gt: cursorSeq };
      }
    }

    const orderBy: Prisma.MessageOrderByWithRelationInput = {
      sequence: direction === 'prev' ? 'desc' : 'asc',
    };

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        attachments: true,
      },
      orderBy,
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem !== undefined ? encodeMessageCursor(lastItem.sequence) : null;

    return {
      items: items.map((m) => this.formatMessage(m)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Fetches a conversation by ID for an active participant, including unread count.
   */
  public async getConversationById(
    conversationId: string,
    userId: string,
  ): Promise<DirectConversationResponse> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId, leftAt: null },
    });
    if (!participant) {
      throw new ConversationNotFoundError();
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: PARTICIPANT_USER_SELECT,
            },
          },
        },
      },
    });

    if (!conversation || conversation.deletedAt !== null) {
      throw new ConversationNotFoundError();
    }

    const unreadCount = Math.max(
      0,
      Number(conversation.currentSequence - participant.lastReadSequence),
    );

    return this.formatDirectConversation(conversation as any, unreadCount);
  }

  /**
   * Lists all active conversations for a user.
   */
  public async listUserConversations(
    userId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<ListConversationsResponse> {
    const limit = Math.min(Math.max(params?.limit || 20, 1), 50);

    const participantRecords = await this.prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
        conversation: {
          deletedAt: null,
        },
      },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: PARTICIPANT_USER_SELECT,
                },
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          updatedAt: 'desc',
        },
      },
      take: limit + 1,
    });

    const hasMore = participantRecords.length > limit;
    const records = hasMore ? participantRecords.slice(0, limit) : participantRecords;

    const items = records.map((record) => {
      const conv = record.conversation;
      const unreadCount = Math.max(0, Number(conv.currentSequence - record.lastReadSequence));
      return this.formatDirectConversation(conv as any, unreadCount);
    });

    const lastRecord = records[records.length - 1];
    const nextCursor = hasMore && lastRecord !== undefined ? lastRecord.conversation.id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Updates a participant's lastReadSequence pointer.
   */
  public async markConversationRead(
    conversationId: string,
    userId: string,
    sequence: string | bigint,
  ): Promise<MarkReadResponse> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId, leftAt: null },
    });
    if (!participant) {
      throw new ConversationNotFoundError();
    }

    const seq = typeof sequence === 'bigint' ? sequence : BigInt(sequence);

    const updated = await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadSequence: seq,
      },
    });

    return {
      conversationId: updated.conversationId,
      lastReadSequence: updated.lastReadSequence.toString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Blocks a user. Emits a durable 'user.block.created.v1' outbox event within the same atomic transaction.
   */
  public async blockUser(
    blockerId: string,
    blockedId: string,
    reason?: string,
  ): Promise<UserBlockResponse> {
    if (blockerId === blockedId) {
      throw new SelfBlockNotAllowedError();
    }

    return await this.prisma.$transaction(
      async (tx) => {
        const block = await tx.userBlock.upsert({
          where: {
            blockerId_blockedId: {
              blockerId,
              blockedId,
            },
          },
          create: {
            id: generateUuidV7(),
            blockerId,
            blockedId,
            reason: reason ?? null,
          },
          update: {
            reason: reason ?? null,
          },
        });

        // Durably insert outbox event in the same transaction
        const outboxEventId = generateUuidV7();
        await tx.outboxEvent.create({
          data: {
            id: outboxEventId,
            eventType: 'user.block.created.v1',
            aggregateType: 'UserBlock',
            aggregateId: block.id,
            payload: {
              blockId: block.id,
              blockerId,
              blockedId,
              reason: block.reason,
              createdAt: block.createdAt.toISOString(),
            },
            status: 'PENDING',
          },
        });

        return {
          id: block.id,
          blockerId: block.blockerId,
          blockedId: block.blockedId,
          reason: block.reason,
          createdAt: block.createdAt.toISOString(),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }

  /**
   * Unblocks a user. Emits a durable 'user.block.removed.v1' outbox event within the same atomic transaction.
   */
  public async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const deleted = await tx.userBlock.deleteMany({
          where: {
            blockerId,
            blockedId,
          },
        });

        if (deleted.count > 0) {
          const outboxEventId = generateUuidV7();
          await tx.outboxEvent.create({
            data: {
              id: outboxEventId,
              eventType: 'user.block.removed.v1',
              aggregateType: 'UserBlock',
              aggregateId: outboxEventId,
              payload: {
                blockerId,
                blockedId,
                removedAt: new Date().toISOString(),
              },
              status: 'PENDING',
            },
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }

  /**
   * Checks if either user has blocked the other.
   */
  public async isBlocked(userA: string, userB: string): Promise<boolean> {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });
    return !!block;
  }

  /**
   * Lists blocks initiated by the authenticated user with cursor pagination.
   */
  public async listBlocks(
    blockerId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<ListBlocksResponse> {
    const limit = Math.min(Math.max(params?.limit || 20, 1), 100);

    const where: Prisma.UserBlockWhereInput = {
      blockerId,
    };

    if (params?.cursor) {
      where.id = { lt: params.cursor };
    }

    const blocks = await this.prisma.userBlock.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = blocks.length > limit;
    const items = hasMore ? blocks.slice(0, limit) : blocks;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem !== undefined ? lastItem.id : null;

    return {
      items: items.map((b) => ({
        id: b.id,
        blockerId: b.blockerId,
        blockedId: b.blockedId,
        reason: b.reason,
        createdAt: b.createdAt.toISOString(),
      })),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Creates an abuse report against a user, message, or assignment with anti-abuse guards.
   */
  public async createReport(reporterId: string, input: CreateReportInput): Promise<ReportResponse> {
    const { targetType, targetId, category, details } = input;

    // 1. Self-reporting check
    if (targetType === 'USER' && targetId === reporterId) {
      throw new SelfReportNotAllowedError('You cannot report your own user account.');
    }

    // 2. Validate target existence and author checks
    if (targetType === 'USER') {
      const user = await this.prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!user) {
        throw new ReportTargetNotFoundError('Target user was not found.');
      }
    } else if (targetType === 'MESSAGE') {
      const message = await this.prisma.message.findUnique({
        where: { id: targetId },
        select: { id: true, senderId: true, conversationId: true, deletedAt: true },
      });
      if (!message || message.deletedAt !== null) {
        throw new ReportTargetNotFoundError('Target message was not found or has been deleted.');
      }
      if (message.senderId === reporterId) {
        throw new SelfReportNotAllowedError('You cannot report your own message.');
      }
      // Reporter must be a participant in the conversation
      const participant = await this.prisma.conversationParticipant.findFirst({
        where: {
          conversationId: message.conversationId,
          userId: reporterId,
          leftAt: null,
        },
      });
      if (!participant) {
        throw new NotConversationParticipantError(
          'You are not a participant in the conversation containing the reported message.',
        );
      }
    } else if (targetType === 'ASSIGNMENT') {
      const assignment = await this.prisma.assignment.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!assignment) {
        throw new ReportTargetNotFoundError('Target assignment was not found.');
      }
    }

    // 3. Atomically check for duplicate pending report and create within transaction
    const created = await this.prisma.$transaction(
      async (tx) => {
        // Concurrency-safe advisory transaction lock keyed on reporter + target
        const lockKey = `report:${reporterId}:${targetType}:${targetId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const existingPending = await tx.report.findFirst({
          where: {
            reporterId,
            targetType,
            targetId,
            status: 'PENDING',
          },
        });

        if (existingPending) {
          throw new DuplicateReportError();
        }

        const reportId = generateUuidV7();
        return await tx.report.create({
          data: {
            id: reportId,
            reporterId,
            targetType,
            targetId,
            category,
            details,
            status: 'PENDING',
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );

    return {
      id: created.id,
      reporterId: created.reporterId,
      targetType: created.targetType as any,
      targetId: created.targetId,
      category: created.category as any,
      details: created.details,
      status: created.status as any,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  private formatMessage(m: Message & { attachments?: MessageAttachment[] }): MessageResponse {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sequence: m.sequence.toString(),
      clientMessageId: m.clientMessageId,
      content: m.content,
      status: m.status,
      attachments: (m.attachments || []).map((a) => ({
        id: a.id,
        messageId: a.messageId,
        mediaAssetId: a.mediaAssetId,
        createdAt: a.createdAt.toISOString(),
      })),
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  private formatParticipantProfile(
    user?: ParticipantWithUser['user'],
  ): ConversationParticipantProfile | undefined {
    if (!user) {
      return undefined;
    }

    const brand = user.brandProfile && !user.brandProfile.deletedAt ? user.brandProfile : null;
    const creator =
      user.creatorProfile && !user.creatorProfile.deletedAt ? user.creatorProfile : null;
    const professional =
      user.professionalProfile && !user.professionalProfile.deletedAt
        ? user.professionalProfile
        : null;
    const podcaster =
      user.podcasterProfile && !user.podcasterProfile.deletedAt ? user.podcasterProfile : null;

    let displayName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    if (!displayName && brand?.companyName) {
      displayName = brand.companyName;
    } else if (!displayName && podcaster?.podcastName) {
      displayName = podcaster.podcastName;
    } else if (!displayName) {
      displayName = user.id ? `User ${user.id.slice(0, 8)}` : 'User';
    }

    let role: string | undefined;
    if (user.userRoles && user.userRoles.length > 0 && user.userRoles[0]?.role?.name) {
      role = user.userRoles[0].role.name;
    } else if (brand) {
      role = 'BRAND';
    } else if (creator) {
      role = 'CREATOR';
    } else if (professional) {
      role = 'PROFESSIONAL';
    } else if (podcaster) {
      role = 'PODCASTER';
    }

    const city = creator?.locationCity || professional?.locationCity;
    const country = creator?.locationCountry || professional?.locationCountry;
    const location = [city, country].filter(Boolean).join(', ') || null;

    const isVerified = Boolean(creator?.isVerified || brand?.isVerified);

    return {
      displayName,
      avatarUrl: user.avatarUrl ?? null,
      ...(role ? { role } : {}),
      ...(location ? { location } : {}),
      ...(isVerified ? { isVerified } : {}),
    };
  }

  private formatDirectConversation(
    c: Conversation & { participants: ParticipantWithUser[] },
    unreadCount?: number,
  ): DirectConversationResponse {
    return {
      id: c.id,
      type: c.type,
      title: c.title,
      assignmentId: c.assignmentId,
      applicationId: c.applicationId,
      currentSequence: c.currentSequence.toString(),
      participants: c.participants.map((p) => {
        const profile = this.formatParticipantProfile(p.user);
        return {
          id: p.id,
          conversationId: p.conversationId,
          userId: p.userId,
          role: p.role,
          lastReadSequence: p.lastReadSequence.toString(),
          mutedUntil: p.mutedUntil ? p.mutedUntil.toISOString() : null,
          leftAt: p.leftAt ? p.leftAt.toISOString() : null,
          joinedAt: p.joinedAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          ...(profile ? { profile } : {}),
        };
      }),
      ...(unreadCount !== undefined ? { unreadCount } : {}),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
  /**
   * Submits a new peer-to-peer message request.
   * Enforces self-messaging guard, 500-char text limit, bidirectional block check,
   * active recipient check, 30-day decline cooldown, 24-hour cancellation anti-churn cooldown,
   * and partial unique pending check.
   */
  public async createMessageRequest(params: {
    senderId: string;
    recipientId: string;
    initialMessage: string;
    expiresAt?: Date;
  }): Promise<MessageRequest> {
    const { senderId, recipientId } = params;
    const initialMessage = (params.initialMessage || '').trim();

    if (senderId === recipientId) {
      throw new SelfMessageRequestNotAllowedError();
    }

    if (!initialMessage || initialMessage.length > 500) {
      throw new InvalidMessageRequestInputError(
        'Initial message must be between 1 and 500 characters.',
      );
    }

    if (/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/.test(params.initialMessage || '')) {
      throw new InvalidMessageRequestInputError(
        'Initial message contains disallowed control characters.',
      );
    }

    if (await this.isBlocked(senderId, recipientId)) {
      throw new UserBlockedError();
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, status: true },
    });

    if (!recipient || recipient.status === 'DEACTIVATED') {
      throw new UserNotFoundError('Recipient user not found or deactivated.');
    }

    // Rate limit: max 10 requests per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyCount = await this.prisma.messageRequest.count({
      where: {
        senderId,
        createdAt: { gte: oneHourAgo },
      },
    });
    if (hourlyCount >= 10) {
      throw new MessageRequestLimitExceededError(
        'Hourly message request limit exceeded (max 10/hour).',
      );
    }

    // Cooldown check: 30-day decline cooldown
    const declineCooldownCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentDecline = await this.prisma.messageRequest.findFirst({
      where: {
        senderId,
        recipientId,
        status: 'DECLINED',
        respondedAt: { gte: declineCooldownCutoff },
      },
    });
    if (recentDecline) {
      throw new MessageRequestCooldownActiveError(
        'Recipient has declined a request within the last 30 days.',
      );
    }

    // Anti-churn cooldown: 24-hour cancellation cooldown
    const cancelCooldownCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCancel = await this.prisma.messageRequest.findFirst({
      where: {
        senderId,
        recipientId,
        status: 'CANCELLED',
        updatedAt: { gte: cancelCooldownCutoff },
      },
    });
    if (recentCancel) {
      throw new MessageRequestCooldownActiveError(
        'Please wait 24 hours after cancelling before sending another request to this recipient.',
      );
    }

    // Rolling 30-day cap: max 3 requests to same recipient in 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recipientRequestCount = await this.prisma.messageRequest.count({
      where: {
        senderId,
        recipientId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    if (recipientRequestCount >= 3) {
      throw new MessageRequestLimitExceededError(
        'Recipient contact frequency limit reached (maximum 3 requests per 30 days).',
      );
    }

    // Check existing PENDING request with lazy expiry
    const existingPending = await this.prisma.messageRequest.findFirst({
      where: {
        senderId,
        recipientId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      if (existingPending.expiresAt < new Date()) {
        await this.prisma.messageRequest.update({
          where: { id: existingPending.id },
          data: { status: 'EXPIRED' },
        });
      } else {
        throw new DuplicateMessageRequestError();
      }
    }

    const id = generateUuidV7();
    const expiresAt = params.expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.messageRequest.create({
            data: {
              id,
              senderId,
              recipientId,
              initialMessage,
              status: 'PENDING',
              expiresAt,
            },
          });

          // Insert outbox event for message_request.created.v1 in the SAME transaction
          await tx.outboxEvent.create({
            data: {
              id: generateUuidV7(),
              eventType: 'message_request.created.v1',
              aggregateType: 'MessageRequest',
              aggregateId: id,
              payload: {
                requestId: id,
                senderId,
                recipientId,
                initialMessage,
                expiresAt: expiresAt.toISOString(),
                createdAt: created.createdAt.toISOString(),
              },
            },
          });

          return created;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 5000,
        },
      );
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateMessageRequestError();
      }
      throw err;
    }
  }

  /**
   * Retrieves a message request by ID, applying lazy expiry and anti-enumeration.
   */
  public async getMessageRequestById(
    id: string,
    viewerUserId?: string,
  ): Promise<(MessageRequest & { senderProfile?: ConversationParticipantProfile }) | null> {
    const request = await this.prisma.messageRequest.findUnique({
      where: { id },
      include: {
        sender: {
          select: PARTICIPANT_USER_SELECT,
        },
      },
    });

    if (!request) {
      return null;
    }

    // Anti-enumeration: if viewer is supplied, must be sender or recipient
    if (viewerUserId && request.senderId !== viewerUserId && request.recipientId !== viewerUserId) {
      throw new MessageRequestNotFoundError();
    }

    // Lazy expiry check
    if (request.status === 'PENDING' && request.expiresAt < new Date()) {
      await this.prisma.messageRequest.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      request.status = 'EXPIRED';
    }

    const { sender, ...rest } = request;
    const senderProfile = this.formatParticipantProfile(sender as any);

    return {
      ...rest,
      ...(senderProfile ? { senderProfile } : {}),
    };
  }

  /**
   * Lists message requests with keyset cursor pagination.
   */
  public async listMessageRequests(params: {
    userId: string;
    direction?: 'incoming' | 'outgoing';
    status?: MessageRequestStatus;
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: Array<MessageRequest & { senderProfile?: ConversationParticipantProfile }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const { userId, direction = 'incoming', status = 'PENDING', limit = 20, cursor } = params;
    const clampedLimit = Math.max(1, Math.min(limit, 50));

    const where: Prisma.MessageRequestWhereInput = {
      status,
      ...(direction === 'incoming' ? { recipientId: userId } : { senderId: userId }),
    };

    if (cursor) {
      try {
        const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.c === 'string' && typeof parsed.id === 'string') {
          const d = new Date(parsed.c);
          if (!isNaN(d.getTime())) {
            where.OR = [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: parsed.id } }];
          } else {
            throw new InvalidMessageCursorError(
              'The message request pagination cursor timestamp is invalid.',
            );
          }
        } else {
          throw new InvalidMessageCursorError(
            'The message request pagination cursor is invalid or malformed.',
          );
        }
      } catch (err) {
        if (err instanceof InvalidMessageCursorError) throw err;
        throw new InvalidMessageCursorError(
          'The message request pagination cursor is invalid or malformed.',
        );
      }
    }

    const rows = await this.prisma.messageRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: clampedLimit + 1,
      include: {
        sender: {
          select: PARTICIPANT_USER_SELECT,
        },
      },
    });

    const hasMore = rows.length > clampedLimit;
    const items = hasMore ? rows.slice(0, clampedLimit) : rows;

    const formattedItems = items.map((r) => {
      const { sender, ...rest } = r;
      const senderProfile = this.formatParticipantProfile(sender as any);
      return {
        ...rest,
        ...(senderProfile ? { senderProfile } : {}),
      };
    });

    const nextCursor =
      hasMore && items.length > 0
        ? Buffer.from(
            JSON.stringify({
              c: items[items.length - 1]!.createdAt.toISOString(),
              id: items[items.length - 1]!.id,
            }),
            'utf-8',
          ).toString('base64url')
        : null;

    return {
      items: formattedItems,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Accepts a message request atomically.
   * Acquires a PostgreSQL transaction advisory lock, verifies state,
   * creates or retrieves direct conversation, creates sequence 1 message,
   * updates request to ACCEPTED, and enqueues outbox events.
   */
  public async acceptMessageRequest(
    id: string,
    recipientId: string,
  ): Promise<{
    request: MessageRequest;
    conversation: DirectConversationResponse;
  }> {
    let isExpired = false;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const lockKey = `msg_req:${id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const request = await tx.messageRequest.findUnique({
          where: { id },
        });

        if (!request || request.recipientId !== recipientId) {
          throw new MessageRequestNotFoundError();
        }

        // Idempotent resolution
        if (request.status === 'ACCEPTED' && request.conversationId) {
          const existingConv = await tx.conversation.findUnique({
            where: { id: request.conversationId },
            include: {
              participants: {
                include: {
                  user: {
                    select: PARTICIPANT_USER_SELECT,
                  },
                },
              },
            },
          });
          if (existingConv) {
            return {
              request,
              conversation: this.formatDirectConversation(existingConv as any),
            };
          }
        }

        if (request.status !== 'PENDING') {
          throw new MessageRequestInvalidStateError(
            `Cannot accept message request in state '${request.status}'.`,
          );
        }

        const now = new Date();
        if (request.expiresAt <= now) {
          const updateRes = await tx.messageRequest.updateMany({
            where: {
              id,
              status: 'PENDING',
              expiresAt: { lte: now },
            },
            data: {
              status: 'EXPIRED',
              respondedAt: now,
            },
          });

          if (updateRes.count > 0) {
            await tx.outboxEvent.create({
              data: {
                id: generateUuidV7(),
                eventType: 'message_request.expired.v1',
                aggregateType: 'MessageRequest',
                aggregateId: id,
                payload: {
                  requestId: id,
                  senderId: request.senderId,
                  recipientId: request.recipientId,
                  expiredAt: now.toISOString(),
                },
                status: 'PENDING',
              },
            });
          }

          isExpired = true;
          return null as any;
        }

        const blocked = await this.isBlocked(request.senderId, recipientId);
        if (blocked) {
          await tx.messageRequest.update({
            where: { id },
            data: { status: 'CANCELLED' },
          });
          throw new UserBlockedError();
        }

        // Deterministic lock key for this user pair
        const convLockKey = [request.senderId, recipientId].sort().join(':');
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'direct_conv:' + convLockKey}))`;

        // Check if an existing direct conversation already exists between peers
        let conversationId = request.conversationId;
        let conversationRecord: any;

        if (!conversationId) {
          const existingDirect = await tx.conversation.findFirst({
            where: {
              type: 'DIRECT',
              deletedAt: null,
              AND: [
                { participants: { some: { userId: request.senderId, leftAt: null } } },
                { participants: { some: { userId: recipientId, leftAt: null } } },
              ],
            },
            include: {
              participants: {
                include: {
                  user: { select: PARTICIPANT_USER_SELECT },
                },
              },
            },
          });

          if (existingDirect) {
            conversationId = existingDirect.id;
            conversationRecord = existingDirect;
          }
        }

        if (!conversationId) {
          conversationId = generateUuidV7();
          conversationRecord = await tx.conversation.create({
            data: {
              id: conversationId,
              type: 'DIRECT',
              currentSequence: 1n,
              participants: {
                create: [
                  {
                    id: generateUuidV7(),
                    userId: request.senderId,
                    role: 'MEMBER',
                    lastReadSequence: 0n,
                  },
                  {
                    id: generateUuidV7(),
                    userId: recipientId,
                    role: 'MEMBER',
                    lastReadSequence: 0n,
                  },
                ],
              },
            },
            include: {
              participants: {
                include: {
                  user: { select: PARTICIPANT_USER_SELECT },
                },
              },
            },
          });

          // Create sequence 1 message with initialMessage
          const messageId = generateUuidV7();
          await tx.message.create({
            data: {
              id: messageId,
              conversationId,
              senderId: request.senderId,
              sequence: 1n,
              clientMessageId: `req-${request.id}`,
              content: request.initialMessage,
              status: 'SENT',
            },
          });

          // Outbox event for sequence 1 message
          await tx.outboxEvent.create({
            data: {
              id: generateUuidV7(),
              eventType: 'message.created.v1',
              aggregateType: 'Message',
              aggregateId: messageId,
              payload: {
                messageId,
                conversationId,
                senderId: request.senderId,
                sequence: '1',
                clientMessageId: `req-${request.id}`,
                content: request.initialMessage,
                createdAt: new Date().toISOString(),
              },
            },
          });
        }

        const updatedRequest = await tx.messageRequest.update({
          where: { id },
          data: {
            status: 'ACCEPTED',
            conversationId,
            respondedAt: new Date(),
          },
        });

        // Enqueue outbox event for request acceptance
        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'message_request.accepted.v1',
            aggregateType: 'MessageRequest',
            aggregateId: id,
            payload: {
              requestId: id,
              senderId: request.senderId,
              recipientId,
              conversationId,
              acceptedAt: new Date().toISOString(),
            },
          },
        });

        return {
          request: updatedRequest,
          conversation: this.formatDirectConversation(conversationRecord),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    if (isExpired || !result) {
      throw new MessageRequestInvalidStateError('Message request has expired.');
    }

    return result;
  }

  /**
   * Declines a message request atomically.
   */
  public async declineMessageRequest(
    id: string,
    recipientId: string,
    reason?: string,
  ): Promise<MessageRequest> {
    return await this.prisma.$transaction(
      async (tx) => {
        const lockKey = `msg_req:${id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const request = await tx.messageRequest.findUnique({
          where: { id },
        });

        if (!request || request.recipientId !== recipientId) {
          throw new MessageRequestNotFoundError();
        }

        if (request.status === 'DECLINED') {
          return request;
        }

        if (request.status !== 'PENDING') {
          throw new MessageRequestInvalidStateError(
            `Cannot decline message request in state '${request.status}'.`,
          );
        }

        const updated = await tx.messageRequest.update({
          where: { id },
          data: {
            status: 'DECLINED',
            declinedReason: reason || null,
            respondedAt: new Date(),
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'message_request.declined.v1',
            aggregateType: 'MessageRequest',
            aggregateId: id,
            payload: {
              requestId: id,
              senderId: request.senderId,
              recipientId,
              declinedAt: new Date().toISOString(),
              reason: reason || null,
            },
          },
        });

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }

  /**
   * Cancels a pending message request by the sender.
   */
  public async cancelMessageRequest(id: string, senderId: string): Promise<MessageRequest> {
    return await this.prisma.$transaction(
      async (tx) => {
        const lockKey = `msg_req:${id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const request = await tx.messageRequest.findUnique({
          where: { id },
        });

        if (!request || request.senderId !== senderId) {
          throw new MessageRequestNotFoundError();
        }

        if (request.status === 'CANCELLED') {
          return request;
        }

        if (request.status !== 'PENDING') {
          throw new MessageRequestInvalidStateError(
            `Cannot cancel message request in state '${request.status}'.`,
          );
        }

        const updated = await tx.messageRequest.update({
          where: { id },
          data: {
            status: 'CANCELLED',
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'message_request.cancelled.v1',
            aggregateType: 'MessageRequest',
            aggregateId: id,
            payload: {
              requestId: id,
              senderId,
              recipientId: request.recipientId,
              cancelledAt: new Date().toISOString(),
            },
          },
        });

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }
}

export const messagingRepository = new MessagingRepository();
