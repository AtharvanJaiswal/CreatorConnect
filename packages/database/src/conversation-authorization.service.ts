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
  UserSuspendedError,
  MessageRequestRequiredError,
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

    const [initiator, recipient] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: initiatorUserId },
        select: { id: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { id: recipientUserId },
        select: { id: true, status: true },
      }),
    ]);

    if (!initiator || initiator.status === 'DEACTIVATED') {
      throw new UserNotFoundError('Initiator user not found or deactivated.');
    }
    if (initiator.status === 'SUSPENDED') {
      throw new UserSuspendedError('Initiator account is suspended.');
    }

    if (!recipient || recipient.status === 'DEACTIVATED') {
      throw new UserNotFoundError('Recipient user not found or deactivated.');
    }
    if (recipient.status === 'SUSPENDED') {
      throw new UserSuspendedError('Recipient account is suspended.');
    }

    const blocked = await this.isBlocked(initiatorUserId, recipientUserId);
    if (blocked) {
      throw new UserBlockedError();
    }

    // 1. Established Conversation (Grandfathering):
    // Active direct conversations and their histories remain accessible without requiring a MessageRequest.
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        deletedAt: null,
        AND: [
          { participants: { some: { userId: initiatorUserId, leftAt: null } } },
          { participants: { some: { userId: recipientUserId, leftAt: null } } },
        ],
      },
      select: { id: true },
    });

    if (existingConversation) {
      return;
    }

    // 2. Accepted MessageRequest (Explicit consent):
    // Only an accepted request between these exact participants establishes consent.
    const acceptedRequest = await this.prisma.messageRequest.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: initiatorUserId, recipientId: recipientUserId },
          { senderId: recipientUserId, recipientId: initiatorUserId },
        ],
      },
      select: { id: true },
    });

    if (acceptedRequest) {
      return;
    }

    // 3. Commercial Exception A: Active / Non-cancelled Project
    // Permitted project states: IN_PROGRESS, SUBMITTED, REVISION_REQUESTED, APPROVED, COMPLETED, DISPUTED
    // Excludes: CANCELLED
    const qualifyingProject = await this.prisma.project.findFirst({
      where: {
        status: {
          in: [
            'IN_PROGRESS',
            'SUBMITTED',
            'REVISION_REQUESTED',
            'APPROVED',
            'COMPLETED',
            'DISPUTED',
          ],
        },
        OR: [
          { clientId: initiatorUserId, talentId: recipientUserId },
          { clientId: recipientUserId, talentId: initiatorUserId },
        ],
      },
      select: { id: true },
    });

    if (qualifyingProject) {
      return;
    }

    // 4. Commercial Exception B: Active Application
    // Permitted application states: SHORTLISTED, ACCEPTED
    // Excludes: SUBMITTED, UNDER_REVIEW, REJECTED, WITHDRAWN
    // Verifies applicant and brand owner against PostgreSQL authoritative records.
    const qualifyingApplication = await this.prisma.application.findFirst({
      where: {
        status: { in: ['SHORTLISTED', 'ACCEPTED'] },
        OR: [
          {
            applicantId: initiatorUserId,
            assignment: { brand: { userId: recipientUserId } },
          },
          {
            applicantId: recipientUserId,
            assignment: { brand: { userId: initiatorUserId } },
          },
        ],
      },
      select: { id: true },
    });

    if (qualifyingApplication) {
      return;
    }

    // 5. Commercial Exception C: Active Project Invitation
    // Permitted invitation states: PENDING, ACCEPTED (and not expired)
    // Excludes: DECLINED, WITHDRAWN, EXPIRED
    const now = new Date();
    const qualifyingInvitation = await this.prisma.projectInvitation.findFirst({
      where: {
        status: { in: ['PENDING', 'ACCEPTED'] },
        OR: [
          { inviterId: initiatorUserId, inviteeId: recipientUserId },
          { inviterId: recipientUserId, inviteeId: initiatorUserId },
        ],
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        ],
      },
      select: { id: true },
    });

    if (qualifyingInvitation) {
      return;
    }

    // Cold outreach without accepted request or qualifying commercial relationship is rejected
    throw new MessageRequestRequiredError();
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
