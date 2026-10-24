import { describe, expect, it, beforeAll } from 'vitest';
import {
  getPrismaClient,
  type PrismaClient,
  messagingRepository,
  MessagingRepository,
  SelfMessageRequestNotAllowedError,
  UserBlockedError,
  UserNotFoundError,
  DuplicateMessageRequestError,
  MessageRequestCooldownActiveError,
  MessageRequestNotFoundError,
  MessageRequestInvalidStateError,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('MessageRequest Repository Integration Tests (Milestone 2A)', () => {
  const prisma: PrismaClient = getPrismaClient();

  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let userC: { id: string; email: string };
  let userDeactivated: { id: string; email: string };

  beforeAll(async () => {
    const ts = Date.now();

    // Create User A (Sender)
    const idA = generateUuidV7();
    userA = await prisma.user.create({
      data: {
        id: idA,
        supabaseAuthId: `sub_req_a_${ts}`,
        email: `req_a_${ts}@test.com`,
        firstName: 'Alice',
        lastName: 'Sender',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'CREATOR' },
                create: { id: generateUuidV7(), name: 'CREATOR' },
              },
            },
          },
        },
      },
    });

    // Create User B (Recipient)
    const idB = generateUuidV7();
    userB = await prisma.user.create({
      data: {
        id: idB,
        supabaseAuthId: `sub_req_b_${ts}`,
        email: `req_b_${ts}@test.com`,
        firstName: 'Bob',
        lastName: 'Recipient',
        status: 'ACTIVE',
        creatorProfile: {
          create: {
            id: generateUuidV7(),
            bio: 'Video editor',
            locationCity: 'Berlin',
            locationCountry: 'DE',
            isVerified: true,
          },
        },
      },
    });

    // Create User C (Third Party / Unrelated)
    const idC = generateUuidV7();
    userC = await prisma.user.create({
      data: {
        id: idC,
        supabaseAuthId: `sub_req_c_${ts}`,
        email: `req_c_${ts}@test.com`,
        firstName: 'Charlie',
        lastName: 'ThirdParty',
        status: 'ACTIVE',
      },
    });

    // Create Deactivated User
    const idD = generateUuidV7();
    userDeactivated = await prisma.user.create({
      data: {
        id: idD,
        supabaseAuthId: `sub_req_d_${ts}`,
        email: `req_deactivated_${ts}@test.com`,
        firstName: 'Dave',
        lastName: 'Inactive',
        status: 'DEACTIVATED',
      },
    });
  });

  describe('createMessageRequest', () => {
    it('throws SelfMessageRequestNotAllowedError when sender === recipient', async () => {
      await expect(
        messagingRepository.createMessageRequest({
          senderId: userA.id,
          recipientId: userA.id,
          initialMessage: 'Hello myself',
        }),
      ).rejects.toThrow(SelfMessageRequestNotAllowedError);
    });

    it('throws error when initial message is empty or whitespace only', async () => {
      await expect(
        messagingRepository.createMessageRequest({
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: '   ',
        }),
      ).rejects.toThrow('Initial message must be between 1 and 500 characters.');
    });

    it('throws error when initial message exceeds 500 characters', async () => {
      const longMessage = 'A'.repeat(501);
      await expect(
        messagingRepository.createMessageRequest({
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: longMessage,
        }),
      ).rejects.toThrow('Initial message must be between 1 and 500 characters.');
    });

    it('throws UserNotFoundError when recipient does not exist or is deactivated', async () => {
      await expect(
        messagingRepository.createMessageRequest({
          senderId: userA.id,
          recipientId: userDeactivated.id,
          initialMessage: 'Hello',
        }),
      ).rejects.toThrow(UserNotFoundError);

      await expect(
        messagingRepository.createMessageRequest({
          senderId: userA.id,
          recipientId: generateUuidV7(),
          initialMessage: 'Hello',
        }),
      ).rejects.toThrow(UserNotFoundError);
    });

    it('throws UserBlockedError when recipient has blocked sender', async () => {
      const blockId = generateUuidV7();
      await prisma.userBlock.create({
        data: {
          id: blockId,
          blockerId: userB.id,
          blockedId: userA.id,
        },
      });

      try {
        await expect(
          messagingRepository.createMessageRequest({
            senderId: userA.id,
            recipientId: userB.id,
            initialMessage: 'Blocked pitch',
          }),
        ).rejects.toThrow(UserBlockedError);
      } finally {
        await prisma.userBlock.delete({ where: { id: blockId } });
      }
    });

    it('successfully creates a PENDING message request with outbox event', async () => {
      const initialMessage = 'Hello Bob, I would like to collaborate on your upcoming project.';
      const request = await messagingRepository.createMessageRequest({
        senderId: userA.id,
        recipientId: userB.id,
        initialMessage,
      });

      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.senderId).toBe(userA.id);
      expect(request.recipientId).toBe(userB.id);
      expect(request.status).toBe('PENDING');
      expect(request.initialMessage).toBe(initialMessage);
      expect(request.conversationId).toBeNull();
      expect(request.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Check corresponding outbox event was created in the same transaction
      const outboxEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: request.id,
          eventType: 'message_request.created.v1',
        },
      });

      expect(outboxEvent).toBeDefined();
      expect((outboxEvent?.payload as any).requestId).toBe(request.id);
      expect((outboxEvent?.payload as any).senderId).toBe(userA.id);
      expect((outboxEvent?.payload as any).recipientId).toBe(userB.id);
    });

    it('prevents duplicate pending requests for the same sender-recipient pair', async () => {
      await expect(
        messagingRepository.createMessageRequest({
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Second attempt while first is pending',
        }),
      ).rejects.toThrow(DuplicateMessageRequestError);
    });

    it('rolls back request creation if outbox event insertion fails within transaction', async () => {
      // Create a proxy prisma that throws on tx.outboxEvent.create
      const wrappedPrisma = new Proxy(prisma, {
        get(target, prop, receiver) {
          if (prop === '$transaction') {
            return async (callback: any, options: any) => {
              return target.$transaction(async (tx) => {
                const wrappedTx = new Proxy(tx, {
                  get(txTarget, txProp, txReceiver) {
                    if (txProp === 'outboxEvent') {
                      return {
                        ...txTarget.outboxEvent,
                        create: async () => {
                          throw new Error('Simulated Outbox Failure');
                        },
                      };
                    }
                    return Reflect.get(txTarget, txProp, txReceiver);
                  },
                });
                return await callback(wrappedTx);
              }, options);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      const customRepo = new MessagingRepository(wrappedPrisma as any);
      const testMessage = 'Message that must roll back upon outbox failure';

      // User A sending to User C
      await expect(
        customRepo.createMessageRequest({
          senderId: userA.id,
          recipientId: userC.id,
          initialMessage: testMessage,
        }),
      ).rejects.toThrow('Simulated Outbox Failure');

      // Verify that message_request was NOT committed to the database
      const orphanedRequest = await prisma.messageRequest.findFirst({
        where: {
          senderId: userA.id,
          recipientId: userC.id,
          initialMessage: testMessage,
        },
      });
      expect(orphanedRequest).toBeNull();
    });
  });

  describe('getMessageRequestById & listMessageRequests', () => {
    it('enforces anti-enumeration: non-participant caller receives MessageRequestNotFoundError', async () => {
      const pendingReq = await prisma.messageRequest.findFirst({
        where: { senderId: userA.id, recipientId: userB.id, status: 'PENDING' },
      });
      expect(pendingReq).toBeDefined();

      // User C is neither sender nor recipient
      await expect(
        messagingRepository.getMessageRequestById(pendingReq!.id, userC.id),
      ).rejects.toThrow(MessageRequestNotFoundError);
    });

    it('allows sender and recipient to view request with sender profile dossier', async () => {
      const pendingReq = await prisma.messageRequest.findFirst({
        where: { senderId: userA.id, recipientId: userB.id, status: 'PENDING' },
      });
      expect(pendingReq).toBeDefined();

      const asRecipient = await messagingRepository.getMessageRequestById(pendingReq!.id, userB.id);
      expect(asRecipient).toBeDefined();
      expect(asRecipient?.id).toBe(pendingReq!.id);
      expect(asRecipient?.senderProfile).toBeDefined();
      expect(asRecipient?.senderProfile?.displayName).toBe('Alice Sender');
      expect(asRecipient?.senderProfile?.role).toBe('CREATOR');

      const asSender = await messagingRepository.getMessageRequestById(pendingReq!.id, userA.id);
      expect(asSender).toBeDefined();
      expect(asSender?.id).toBe(pendingReq!.id);
    });

    it('lists incoming and outgoing requests with pagination metadata', async () => {
      const incoming = await messagingRepository.listMessageRequests({
        userId: userB.id,
        direction: 'incoming',
        status: 'PENDING',
      });

      expect(incoming.items.length).toBeGreaterThanOrEqual(1);
      expect(incoming.items[0]?.recipientId).toBe(userB.id);
      expect(incoming.items[0]?.senderProfile).toBeDefined();

      const outgoing = await messagingRepository.listMessageRequests({
        userId: userA.id,
        direction: 'outgoing',
        status: 'PENDING',
      });

      expect(outgoing.items.length).toBeGreaterThanOrEqual(1);
      expect(outgoing.items[0]?.senderId).toBe(userA.id);
    });
  });

  describe('acceptMessageRequest', () => {
    it('enforces recipient authorization: sender or non-participant cannot accept', async () => {
      const pendingReq = await prisma.messageRequest.findFirst({
        where: { senderId: userA.id, recipientId: userB.id, status: 'PENDING' },
      });
      expect(pendingReq).toBeDefined();

      // Sender cannot accept own request
      await expect(
        messagingRepository.acceptMessageRequest(pendingReq!.id, userA.id),
      ).rejects.toThrow(MessageRequestNotFoundError);

      // Third party cannot accept
      await expect(
        messagingRepository.acceptMessageRequest(pendingReq!.id, userC.id),
      ).rejects.toThrow(MessageRequestNotFoundError);
    });

    it('atomically accepts request: creates conversation, participants, sequence 1 message, and outbox events', async () => {
      const pendingReq = await prisma.messageRequest.findFirst({
        where: { senderId: userA.id, recipientId: userB.id, status: 'PENDING' },
      });
      expect(pendingReq).toBeDefined();

      const result = await messagingRepository.acceptMessageRequest(pendingReq!.id, userB.id);

      expect(result).toBeDefined();
      expect(result.request.status).toBe('ACCEPTED');
      expect(result.request.conversationId).toBeDefined();
      expect(result.conversation).toBeDefined();
      expect(result.conversation.id).toBe(result.request.conversationId);
      expect(result.conversation.type).toBe('DIRECT');
      expect(result.conversation.currentSequence).toBe('1');
      expect(result.conversation.participants).toHaveLength(2);

      // Verify sequence 1 message exists in database
      const firstMessage = await prisma.message.findFirst({
        where: {
          conversationId: result.conversation.id,
          sequence: 1n,
        },
      });
      expect(firstMessage).toBeDefined();
      expect(firstMessage?.senderId).toBe(userA.id);
      expect(firstMessage?.content).toBe(pendingReq!.initialMessage);
      expect(firstMessage?.status).toBe('SENT');

      // Verify outbox events
      const acceptEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: pendingReq!.id,
          eventType: 'message_request.accepted.v1',
        },
      });
      expect(acceptEvent).toBeDefined();

      const messageEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: firstMessage!.id,
          eventType: 'message.created.v1',
        },
      });
      expect(messageEvent).toBeDefined();

      // Idempotency check: repeated accept returns the existing conversation
      const repeated = await messagingRepository.acceptMessageRequest(pendingReq!.id, userB.id);
      expect(repeated.request.id).toBe(pendingReq!.id);
      expect(repeated.conversation.id).toBe(result.conversation.id);
    });

    it('rejects acceptance on or after expiry boundary (expiresAt <= now) without partial mutation', async () => {
      // Create request with expired timestamp directly in database
      const expiredReq = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userC.id,
          recipientId: userA.id,
          initialMessage: 'Time-sensitive message that expired',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 5000), // 5 seconds in the past
        },
      });

      // Attempt to accept expired request
      await expect(
        messagingRepository.acceptMessageRequest(expiredReq.id, userA.id),
      ).rejects.toThrow(MessageRequestInvalidStateError);

      // Verify no conversation was created
      const conv = await prisma.conversation.findFirst({
        where: {
          participants: {
            some: { userId: userC.id },
          },
          AND: {
            participants: {
              some: { userId: userA.id },
            },
          },
        },
      });
      expect(conv).toBeNull();

      // Verify no acceptance outbox events were emitted
      const acceptEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: expiredReq.id,
          eventType: 'message_request.accepted.v1',
        },
      });
      expect(acceptEvent).toBeNull();

      // Verify atomic in-transaction expiry transition and outbox event creation
      const expiredEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: expiredReq.id,
          eventType: 'message_request.expired.v1',
        },
      });
      expect(expiredEvent).toBeDefined();
      expect((expiredEvent?.payload as any).requestId).toBe(expiredReq.id);

      const dbReq = await prisma.messageRequest.findUnique({
        where: { id: expiredReq.id },
      });
      expect(dbReq).toBeDefined();
      expect(dbReq?.status).toBe('EXPIRED');
    });

    it('rejects acceptance on exact millisecond boundary (expiresAt === now)', async () => {
      const boundaryTime = new Date();
      const boundaryReq = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userC.id,
          initialMessage: 'Boundary message',
          status: 'PENDING',
          expiresAt: boundaryTime,
        },
      });

      // Acceptance immediately on or after the exact boundary time rejects
      await expect(
        messagingRepository.acceptMessageRequest(boundaryReq.id, userC.id),
      ).rejects.toThrow(MessageRequestInvalidStateError);
    });
  });

  describe('declineMessageRequest & Cooldown Enforcement', () => {
    let reqToDeclineId: string;

    beforeAll(async () => {
      // Create new request from User C to User B
      const req = await messagingRepository.createMessageRequest({
        senderId: userC.id,
        recipientId: userB.id,
        initialMessage: 'Pitch from Charlie to Bob',
      });
      reqToDeclineId = req.id;
    });

    it('enforces recipient authorization: sender cannot decline', async () => {
      await expect(
        messagingRepository.declineMessageRequest(reqToDeclineId, userC.id),
      ).rejects.toThrow(MessageRequestNotFoundError);
    });

    it('declines request, records reason and respondedAt, and emits outbox event', async () => {
      const declined = await messagingRepository.declineMessageRequest(
        reqToDeclineId,
        userB.id,
        'Not interested in video editing right now.',
      );

      expect(declined.status).toBe('DECLINED');
      expect(declined.declinedReason).toBe('Not interested in video editing right now.');
      expect(declined.respondedAt).toBeDefined();

      const declineEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: reqToDeclineId,
          eventType: 'message_request.declined.v1',
        },
      });
      expect(declineEvent).toBeDefined();
    });

    it('enforces 30-day decline cooldown: sender cannot immediately re-request', async () => {
      await expect(
        messagingRepository.createMessageRequest({
          senderId: userC.id,
          recipientId: userB.id,
          initialMessage: 'Second pitch after being declined',
        }),
      ).rejects.toThrow(MessageRequestCooldownActiveError);
    });
  });

  describe('cancelMessageRequest & Anti-Churn Cooldown', () => {
    let reqToCancelId: string;

    beforeAll(async () => {
      // Create request from User A to User C
      const req = await messagingRepository.createMessageRequest({
        senderId: userA.id,
        recipientId: userC.id,
        initialMessage: 'Pitch from Alice to Charlie',
      });
      reqToCancelId = req.id;
    });

    it('enforces sender authorization: recipient cannot cancel', async () => {
      await expect(
        messagingRepository.cancelMessageRequest(reqToCancelId, userC.id),
      ).rejects.toThrow(MessageRequestNotFoundError);
    });

    it('cancels request and emits outbox event', async () => {
      const cancelled = await messagingRepository.cancelMessageRequest(reqToCancelId, userA.id);

      expect(cancelled.status).toBe('CANCELLED');

      const cancelEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: reqToCancelId,
          eventType: 'message_request.cancelled.v1',
        },
      });
      expect(cancelEvent).toBeDefined();
    });

    it('enforces 24-hour anti-churn cooldown after cancellation', async () => {
      await expect(
        messagingRepository.createMessageRequest({
          senderId: userA.id,
          recipientId: userC.id,
          initialMessage: 'Immediate re-request after cancelling',
        }),
      ).rejects.toThrow(MessageRequestCooldownActiveError);
    });
  });
});
