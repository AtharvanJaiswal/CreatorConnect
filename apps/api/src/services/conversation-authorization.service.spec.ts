import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  getPrismaClient,
  type PrismaClient,
  ConversationAuthorizationService,
  ConversationNotFoundError,
  UserBlockedError,
  AttachmentNotFoundError,
  AttachmentNotActiveError,
  SelfMessagingNotAllowedError,
  SelfBlockNotAllowedError,
  UserNotFoundError,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('ConversationAuthorizationService PostgreSQL Integration Tests', () => {
  let prisma: PrismaClient;
  let authService: ConversationAuthorizationService;

  // Test users
  let alice: { id: string; email: string };
  let bob: { id: string; email: string };
  let charlie: { id: string; email: string };
  let deactivatedUser: { id: string; email: string };

  // Test conversation
  let activeConvId: string;
  let softDeletedConvId: string;

  // Test media & attachment
  let activeAssetId: string;
  let quarantinedAssetId: string;
  let activeAttachmentId: string;
  let quarantinedAttachmentId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    authService = new ConversationAuthorizationService(prisma);

    const ts = Date.now();

    // 1. Create test users
    alice = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_auth_alice_${ts}`,
        email: `alice_${ts}@auth.test`,
        firstName: 'Alice',
        lastName: 'Auth',
        status: 'ACTIVE',
      },
    });

    bob = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_auth_bob_${ts}`,
        email: `bob_${ts}@auth.test`,
        firstName: 'Bob',
        lastName: 'Auth',
        status: 'ACTIVE',
      },
    });

    charlie = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_auth_charlie_${ts}`,
        email: `charlie_${ts}@auth.test`,
        firstName: 'Charlie',
        lastName: 'Auth',
        status: 'ACTIVE',
      },
    });

    deactivatedUser = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_auth_deact_${ts}`,
        email: `deact_${ts}@auth.test`,
        firstName: 'Deact',
        lastName: 'User',
        status: 'DEACTIVATED',
      },
    });

    // 2. Create active direct conversation between Alice and Bob
    activeConvId = generateUuidV7();
    await prisma.conversation.create({
      data: {
        id: activeConvId,
        type: 'DIRECT',
        currentSequence: 2n,
        participants: {
          create: [
            {
              id: generateUuidV7(),
              userId: alice.id,
              role: 'MEMBER',
              lastReadSequence: 0n,
            },
            {
              id: generateUuidV7(),
              userId: bob.id,
              role: 'MEMBER',
              lastReadSequence: 0n,
            },
          ],
        },
      },
    });

    // 3. Create soft-deleted conversation
    softDeletedConvId = generateUuidV7();
    await prisma.conversation.create({
      data: {
        id: softDeletedConvId,
        type: 'DIRECT',
        deletedAt: new Date(),
        currentSequence: 0n,
        participants: {
          create: [
            {
              id: generateUuidV7(),
              userId: alice.id,
              role: 'MEMBER',
              lastReadSequence: 0n,
            },
            {
              id: generateUuidV7(),
              userId: bob.id,
              role: 'MEMBER',
              lastReadSequence: 0n,
            },
          ],
        },
      },
    });

    // 4. Create MediaAssets (Active and Quarantined)
    activeAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: activeAssetId,
        userId: alice.id,
        storageKey: `attachments/active_${ts}.png`,
        originalName: 'active.png',
        mimeType: 'image/png',
        byteSize: 1024,
        mediaType: 'IMAGE',
        status: 'ACTIVE',
      },
    });

    quarantinedAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: quarantinedAssetId,
        userId: alice.id,
        storageKey: `attachments/quarantine_${ts}.exe`,
        originalName: 'malware.exe',
        mimeType: 'application/octet-stream',
        byteSize: 2048,
        mediaType: 'DOCUMENT',
        status: 'QUARANTINED',
      },
    });

    // 5. Create messages and attachments in active conversation
    const activeMsgId = generateUuidV7();
    await prisma.message.create({
      data: {
        id: activeMsgId,
        conversationId: activeConvId,
        senderId: alice.id,
        sequence: 1n,
        clientMessageId: generateUuidV7(),
        content: 'Active message with active attachment',
        status: 'SENT',
      },
    });

    activeAttachmentId = generateUuidV7();
    await prisma.messageAttachment.create({
      data: {
        id: activeAttachmentId,
        messageId: activeMsgId,
        mediaAssetId: activeAssetId,
      },
    });

    const quarantinedMsgId = generateUuidV7();
    await prisma.message.create({
      data: {
        id: quarantinedMsgId,
        conversationId: activeConvId,
        senderId: alice.id,
        sequence: 2n,
        clientMessageId: generateUuidV7(),
        content: 'Quarantined message attachment',
        status: 'SENT',
      },
    });

    quarantinedAttachmentId = generateUuidV7();
    await prisma.messageAttachment.create({
      data: {
        id: quarantinedAttachmentId,
        messageId: quarantinedMsgId,
        mediaAssetId: quarantinedAssetId,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.messageReaction.deleteMany({});
    await prisma.messageAttachment.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.userBlock.deleteMany({});
    await prisma.mediaAsset.deleteMany({
      where: { userId: { in: [alice.id, bob.id, charlie.id, deactivatedUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [alice.id, bob.id, charlie.id, deactivatedUser.id] } },
    });
  });

  describe('1. Direct Conversation Authorization (assertCanStartDirectConversation)', () => {
    it('authorizes active peers to start a direct conversation', async () => {
      await expect(
        authService.assertCanStartDirectConversation(alice.id, charlie.id),
      ).resolves.toBeUndefined();
    });

    it('rejects self-messaging with SelfMessagingNotAllowedError (400)', async () => {
      await expect(
        authService.assertCanStartDirectConversation(alice.id, alice.id),
      ).rejects.toThrow(SelfMessagingNotAllowedError);
    });

    it('rejects non-existent recipient with UserNotFoundError (404)', async () => {
      const nonExistentId = generateUuidV7();
      await expect(
        authService.assertCanStartDirectConversation(alice.id, nonExistentId),
      ).rejects.toThrow(UserNotFoundError);
    });

    it('rejects deactivated recipient with UserNotFoundError (404)', async () => {
      await expect(
        authService.assertCanStartDirectConversation(alice.id, deactivatedUser.id),
      ).rejects.toThrow(UserNotFoundError);
    });

    it('rejects conversation initiation when initiator has blocked recipient (403)', async () => {
      // Alice blocks Charlie
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: alice.id,
          blockedId: charlie.id,
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(alice.id, charlie.id),
      ).rejects.toThrow(UserBlockedError);

      // Clean up block
      await prisma.userBlock.deleteMany({
        where: { blockerId: alice.id, blockedId: charlie.id },
      });
    });

    it('rejects conversation initiation when recipient has blocked initiator (403)', async () => {
      // Charlie blocks Alice
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: charlie.id,
          blockedId: alice.id,
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(alice.id, charlie.id),
      ).rejects.toThrow(UserBlockedError);

      // Clean up block
      await prisma.userBlock.deleteMany({
        where: { blockerId: charlie.id, blockedId: alice.id },
      });
    });
  });

  describe('2. Conversation Access & Anti-Enumeration (assertCanAccessConversation)', () => {
    it('grants access to active participant and returns conversation + participant', async () => {
      const res = await authService.assertCanAccessConversation(activeConvId, alice.id);

      expect(res.conversation.id).toBe(activeConvId);
      expect(res.participant.userId).toBe(alice.id);
      expect(res.participant.leftAt).toBeNull();
    });

    it('denies non-participant with ConversationNotFoundError (404) preserving privacy', async () => {
      // Charlie is NOT a participant in activeConvId (Alice & Bob)
      await expect(
        authService.assertCanAccessConversation(activeConvId, charlie.id),
      ).rejects.toThrow(ConversationNotFoundError);
    });

    it('denies non-existent conversation ID with ConversationNotFoundError (404)', async () => {
      const fakeId = generateUuidV7();
      await expect(authService.assertCanAccessConversation(fakeId, alice.id)).rejects.toThrow(
        ConversationNotFoundError,
      );
    });

    it('denies soft-deleted conversation with ConversationNotFoundError (404)', async () => {
      await expect(
        authService.assertCanAccessConversation(softDeletedConvId, alice.id),
      ).rejects.toThrow(ConversationNotFoundError);
    });

    it('denies inactive/departed participant (leftAt !== null) with ConversationNotFoundError (404)', async () => {
      // Temporarily mark Bob as left
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: activeConvId, userId: bob.id } },
        data: { leftAt: new Date() },
      });

      await expect(authService.assertCanAccessConversation(activeConvId, bob.id)).rejects.toThrow(
        ConversationNotFoundError,
      );

      // Restore Bob as active participant
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: activeConvId, userId: bob.id } },
        data: { leftAt: null },
      });
    });
  });

  describe('3. Reading Messages & Conversation History (assertCanReadMessages)', () => {
    it('authorizes active participant to read messages', async () => {
      const res = await authService.assertCanReadMessages(activeConvId, bob.id);
      expect(res.conversation.id).toBe(activeConvId);
      expect(res.participant.userId).toBe(bob.id);
    });

    it('denies non-participant with ConversationNotFoundError (404)', async () => {
      await expect(authService.assertCanReadMessages(activeConvId, charlie.id)).rejects.toThrow(
        ConversationNotFoundError,
      );
    });

    it('permits reading history even when participants have blocked each other (evidentiary context)', async () => {
      // Alice blocks Bob
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: alice.id,
          blockedId: bob.id,
        },
      });

      // Both can still read past messages
      await expect(
        authService.assertCanReadMessages(activeConvId, alice.id),
      ).resolves.toBeDefined();
      await expect(authService.assertCanReadMessages(activeConvId, bob.id)).resolves.toBeDefined();

      // Clean up block
      await prisma.userBlock.deleteMany({
        where: { blockerId: alice.id, blockedId: bob.id },
      });
    });
  });

  describe('4. Message Sending Authorization & Bidirectional Blocking (assertCanSendMessage)', () => {
    it('authorizes message send when participants are unblocked', async () => {
      const res = await authService.assertCanSendMessage(activeConvId, alice.id);
      expect(res.conversation.id).toBe(activeConvId);
      expect(res.participant.userId).toBe(alice.id);
    });

    it('denies message send for non-participant with ConversationNotFoundError (404)', async () => {
      await expect(authService.assertCanSendMessage(activeConvId, charlie.id)).rejects.toThrow(
        ConversationNotFoundError,
      );
    });

    it('denies message send when sender blocked the other participant (Alice blocks Bob)', async () => {
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: alice.id,
          blockedId: bob.id,
        },
      });

      // Sender Alice is blocked from sending to Bob
      await expect(authService.assertCanSendMessage(activeConvId, alice.id)).rejects.toThrow(
        UserBlockedError,
      );

      // Peer Bob is also blocked from sending to Alice
      await expect(authService.assertCanSendMessage(activeConvId, bob.id)).rejects.toThrow(
        UserBlockedError,
      );

      await prisma.userBlock.deleteMany({
        where: { blockerId: alice.id, blockedId: bob.id },
      });
    });

    it('denies message send when recipient blocked sender (Bob blocks Alice)', async () => {
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: bob.id,
          blockedId: alice.id,
        },
      });

      // Alice cannot send to Bob
      await expect(authService.assertCanSendMessage(activeConvId, alice.id)).rejects.toThrow(
        UserBlockedError,
      );

      // Bob cannot send to Alice
      await expect(authService.assertCanSendMessage(activeConvId, bob.id)).rejects.toThrow(
        UserBlockedError,
      );

      await prisma.userBlock.deleteMany({
        where: { blockerId: bob.id, blockedId: alice.id },
      });
    });

    it('restores message sending ability prospectively after unblocking', async () => {
      // Create block
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: alice.id,
          blockedId: bob.id,
        },
      });

      // Denied
      await expect(authService.assertCanSendMessage(activeConvId, alice.id)).rejects.toThrow(
        UserBlockedError,
      );

      // Unblock
      await prisma.userBlock.deleteMany({
        where: { blockerId: alice.id, blockedId: bob.id },
      });

      // Authorized again!
      await expect(authService.assertCanSendMessage(activeConvId, alice.id)).resolves.toBeDefined();
    });
  });

  describe('5. Read Receipts Authorization (assertCanMarkConversationRead)', () => {
    it('authorizes active participant to mark conversation read', async () => {
      const participant = await authService.assertCanMarkConversationRead(activeConvId, bob.id);
      expect(participant.userId).toBe(bob.id);
    });

    it('denies non-participant with ConversationNotFoundError (404)', async () => {
      await expect(
        authService.assertCanMarkConversationRead(activeConvId, charlie.id),
      ).rejects.toThrow(ConversationNotFoundError);
    });
  });

  describe('6. Attachment Authorization & Quarantine Enforcement (assertCanAccessAttachment)', () => {
    it('authorizes active participant to access active attachment', async () => {
      const res = await authService.assertCanAccessAttachment(activeAttachmentId, bob.id);
      expect(res.attachment.id).toBe(activeAttachmentId);
      expect(res.mediaAsset.id).toBe(activeAssetId);
      expect(res.mediaAsset.status).toBe('ACTIVE');
    });

    it('denies non-participant with AttachmentNotFoundError (404) preserving confidentiality', async () => {
      // Charlie is not in activeConvId
      await expect(
        authService.assertCanAccessAttachment(activeAttachmentId, charlie.id),
      ).rejects.toThrow(AttachmentNotFoundError);
    });

    it('denies non-existent attachment with AttachmentNotFoundError (404)', async () => {
      const fakeAttachmentId = generateUuidV7();
      await expect(
        authService.assertCanAccessAttachment(fakeAttachmentId, alice.id),
      ).rejects.toThrow(AttachmentNotFoundError);
    });

    it('rejects quarantined attachment with AttachmentNotActiveError (400)', async () => {
      // Alice is in conversation, but attachment is QUARANTINED
      await expect(
        authService.assertCanAccessAttachment(quarantinedAttachmentId, alice.id),
      ).rejects.toThrow(AttachmentNotActiveError);
    });

    it('denies access if participant has left conversation (AttachmentNotFoundError 404)', async () => {
      // Bob leaves conversation
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: activeConvId, userId: bob.id } },
        data: { leftAt: new Date() },
      });

      await expect(
        authService.assertCanAccessAttachment(activeAttachmentId, bob.id),
      ).rejects.toThrow(AttachmentNotFoundError);

      // Restore Bob
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: activeConvId, userId: bob.id } },
        data: { leftAt: null },
      });
    });
  });

  describe('7. User Blocking Rules (assertCanBlockUser & isBlocked)', () => {
    it('authorizes blocking a valid peer', async () => {
      await expect(authService.assertCanBlockUser(alice.id, charlie.id)).resolves.toBeUndefined();
    });

    it('rejects self-blocking with SelfBlockNotAllowedError (400)', async () => {
      await expect(authService.assertCanBlockUser(alice.id, alice.id)).rejects.toThrow(
        SelfBlockNotAllowedError,
      );
    });

    it('rejects blocking a non-existent user with UserNotFoundError (404)', async () => {
      const fakeId = generateUuidV7();
      await expect(authService.assertCanBlockUser(alice.id, fakeId)).rejects.toThrow(
        UserNotFoundError,
      );
    });

    it('evaluates bidirectional isBlocked status accurately', async () => {
      expect(await authService.isBlocked(alice.id, charlie.id)).toBe(false);
      expect(await authService.isBlocked(charlie.id, alice.id)).toBe(false);

      // Charlie blocks Alice
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: charlie.id,
          blockedId: alice.id,
        },
      });

      // Both directions return true
      expect(await authService.isBlocked(alice.id, charlie.id)).toBe(true);
      expect(await authService.isBlocked(charlie.id, alice.id)).toBe(true);

      // Unblock
      await prisma.userBlock.deleteMany({
        where: { blockerId: charlie.id, blockedId: alice.id },
      });

      expect(await authService.isBlocked(alice.id, charlie.id)).toBe(false);
    });
  });

  describe('8. Lightweight Membership Check (checkMembership)', () => {
    it('returns isParticipant: true for active participant', async () => {
      const res = await authService.checkMembership(activeConvId, alice.id);
      expect(res.isParticipant).toBe(true);
      expect(res.participant).toBeDefined();
    });

    it('returns isParticipant: false for non-participant', async () => {
      const res = await authService.checkMembership(activeConvId, charlie.id);
      expect(res.isParticipant).toBe(false);
      expect(res.participant).toBeUndefined();
    });

    it('returns isParticipant: false for departed participant (leftAt !== null)', async () => {
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: activeConvId, userId: bob.id } },
        data: { leftAt: new Date() },
      });

      const res = await authService.checkMembership(activeConvId, bob.id);
      expect(res.isParticipant).toBe(false);

      // Restore
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: activeConvId, userId: bob.id } },
        data: { leftAt: null },
      });
    });
  });
});
