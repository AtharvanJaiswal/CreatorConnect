import {
  PrismaClient,
  Prisma,
  type Conversation,
  type ConversationParticipant,
  type Message,
  type MessageAttachment,
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
} from './errors.js';

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
  isBlocked(userA: string, userB: string): Promise<boolean>;
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
        participants: true,
      },
    });

    if (existing) {
      return this.formatDirectConversation(existing);
    }

    // Create conversation and participants in a transaction
    const conversationId = generateUuidV7();
    const created = await this.prisma.$transaction(async (tx) => {
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
          participants: true,
        },
      });
    });

    return this.formatDirectConversation(created);
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
        participants: true,
      },
    });

    if (!conversation || conversation.deletedAt !== null) {
      throw new ConversationNotFoundError();
    }

    const unreadCount = Math.max(
      0,
      Number(conversation.currentSequence - participant.lastReadSequence),
    );

    return this.formatDirectConversation(conversation, unreadCount);
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
            participants: true,
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
      return this.formatDirectConversation(conv, unreadCount);
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

  private formatDirectConversation(
    c: Conversation & { participants: ConversationParticipant[] },
    unreadCount?: number,
  ): DirectConversationResponse {
    return {
      id: c.id,
      type: c.type,
      title: c.title,
      assignmentId: c.assignmentId,
      applicationId: c.applicationId,
      currentSequence: c.currentSequence.toString(),
      participants: c.participants.map((p) => ({
        id: p.id,
        conversationId: p.conversationId,
        userId: p.userId,
        role: p.role,
        lastReadSequence: p.lastReadSequence.toString(),
        mutedUntil: p.mutedUntil ? p.mutedUntil.toISOString() : null,
        leftAt: p.leftAt ? p.leftAt.toISOString() : null,
        joinedAt: p.joinedAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      ...(unreadCount !== undefined ? { unreadCount } : {}),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}

export const messagingRepository = new MessagingRepository();
