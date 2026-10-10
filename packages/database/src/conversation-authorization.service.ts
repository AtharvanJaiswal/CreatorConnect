import {
  PrismaClient,
  type Conversation,
  type ConversationParticipant,
  type MessageAttachment,
  type MediaAsset,
} from '@prisma/client';
import { getPrismaClient } from './index.js';
import {
  ConversationNotFoundError,
  UserBlockedError,
  AttachmentNotFoundError,
  AttachmentNotActiveError,
  SelfMessagingNotAllowedError,
  SelfBlockNotAllowedError,
  UserNotFoundError,
} from './errors.js';

export interface IConversationAuthorizationService {
  /**
   * Asserts that a user can initiate a direct conversation with another user.
   * Enforces self-messaging guard, recipient existence, and bidirectional block check.
   */
  assertCanStartDirectConversation(initiatorUserId: string, recipientUserId: string): Promise<void>;

  /**
   * Asserts that a user is an active participant in the conversation.
   * Throws ConversationNotFoundError (404) if conversation does not exist,
   * is soft-deleted, or requester is not an active participant (privacy anti-enumeration).
   */
  assertCanAccessConversation(
    conversationId: string,
    userId: string,
  ): Promise<{
    conversation: Conversation;
    participant: ConversationParticipant;
  }>;

  /**
   * Asserts that a user can read messages in a conversation.
   * Active participants can read message history (even if blocked later, for evidentiary context).
   */
  assertCanReadMessages(
    conversationId: string,
    userId: string,
  ): Promise<{
    conversation: Conversation;
    participant: ConversationParticipant;
  }>;

  /**
   * Asserts that a user can send a message in a conversation.
   * Checks active participation AND bidirectional blocks between sender and all other active participants.
   */
  assertCanSendMessage(
    conversationId: string,
    senderId: string,
  ): Promise<{
    conversation: Conversation;
    participant: ConversationParticipant;
  }>;

  /**
   * Asserts that a user can mark a conversation as read.
   */
  assertCanMarkConversationRead(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant>;

  /**
   * Asserts that a user can access an attachment.
   * Verifies attachment exists, message and conversation are active, user is an active participant,
   * and media asset status is ACTIVE (not quarantined or pending).
   */
  assertCanAccessAttachment(
    attachmentId: string,
    userId: string,
    expectedConversationId?: string,
  ): Promise<{
    attachment: MessageAttachment;
    mediaAsset: MediaAsset;
    conversationId: string;
  }>;

  /**
   * Asserts that a user can block another user.
   * Enforces self-blocking guard and target existence.
   */
  assertCanBlockUser(blockerId: string, blockedId: string): Promise<void>;

  /**
   * Checks whether either user has blocked the other.
   */
  isBlocked(userA: string, userB: string): Promise<boolean>;

  /**
   * Safe membership check without throwing.
   */
  checkMembership(
    conversationId: string,
    userId: string,
  ): Promise<{
    isParticipant: boolean;
    participant?: ConversationParticipant | undefined;
  }>;
}

export class ConversationAuthorizationService implements IConversationAuthorizationService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public async assertCanStartDirectConversation(
    initiatorUserId: string,
    recipientUserId: string,
  ): Promise<void> {
    if (initiatorUserId === recipientUserId) {
      throw new SelfMessagingNotAllowedError();
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, status: true },
    });

    if (!recipient || recipient.status === 'DEACTIVATED') {
      throw new UserNotFoundError('Recipient user not found or deactivated.');
    }

    const blocked = await this.isBlocked(initiatorUserId, recipientUserId);
    if (blocked) {
      throw new UserBlockedError();
    }
  }

  public async assertCanAccessConversation(
    conversationId: string,
    userId: string,
  ): Promise<{
    conversation: Conversation;
    participant: ConversationParticipant;
  }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          where: { userId, leftAt: null },
        },
      },
    });

    if (
      !conversation ||
      conversation.deletedAt !== null ||
      conversation.participants.length === 0
    ) {
      throw new ConversationNotFoundError();
    }

    return {
      conversation,
      participant: conversation.participants[0]!,
    };
  }

  public async assertCanReadMessages(
    conversationId: string,
    userId: string,
  ): Promise<{
    conversation: Conversation;
    participant: ConversationParticipant;
  }> {
    return await this.assertCanAccessConversation(conversationId, userId);
  }

  public async assertCanSendMessage(
    conversationId: string,
    senderId: string,
  ): Promise<{
    conversation: Conversation;
    participant: ConversationParticipant;
  }> {
    const { conversation, participant } = await this.assertCanAccessConversation(
      conversationId,
      senderId,
    );

    const otherParticipants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: senderId },
        leftAt: null,
      },
      select: { userId: true },
    });

    for (const other of otherParticipants) {
      const blocked = await this.isBlocked(senderId, other.userId);
      if (blocked) {
        throw new UserBlockedError();
      }
    }

    return { conversation, participant };
  }

  public async assertCanMarkConversationRead(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant> {
    const { participant } = await this.assertCanAccessConversation(conversationId, userId);
    return participant;
  }

  public async assertCanAccessAttachment(
    attachmentId: string,
    userId: string,
    expectedConversationId?: string,
  ): Promise<{
    attachment: MessageAttachment;
    mediaAsset: MediaAsset;
    conversationId: string;
  }> {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: {
            conversation: {
              include: {
                participants: {
                  where: { userId, leftAt: null },
                },
              },
            },
          },
        },
        mediaAsset: true,
      },
    });

    if (
      !attachment ||
      !attachment.message ||
      attachment.message.deletedAt !== null ||
      !attachment.message.conversation ||
      attachment.message.conversation.deletedAt !== null ||
      attachment.message.conversation.participants.length === 0 ||
      (expectedConversationId !== undefined &&
        attachment.message.conversationId !== expectedConversationId)
    ) {
      throw new AttachmentNotFoundError();
    }

    if (attachment.mediaAsset.status !== 'ACTIVE') {
      throw new AttachmentNotActiveError();
    }

    const otherParticipants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: attachment.message.conversationId,
        userId: { not: userId },
        leftAt: null,
      },
      select: { userId: true },
    });

    for (const other of otherParticipants) {
      const blocked = await this.isBlocked(userId, other.userId);
      if (blocked) {
        throw new UserBlockedError();
      }
    }

    return {
      attachment,
      mediaAsset: attachment.mediaAsset,
      conversationId: attachment.message.conversationId,
    };
  }

  public async assertCanBlockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new SelfBlockNotAllowedError();
    }

    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });

    if (!target) {
      throw new UserNotFoundError('Target user not found.');
    }
  }

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

  public async checkMembership(
    conversationId: string,
    userId: string,
  ): Promise<{
    isParticipant: boolean;
    participant?: ConversationParticipant | undefined;
  }> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null,
        conversation: {
          deletedAt: null,
        },
      },
    });

    if (!participant) {
      return { isParticipant: false };
    }

    return {
      isParticipant: true,
      participant,
    };
  }
}

export const conversationAuthorizationService = new ConversationAuthorizationService();
