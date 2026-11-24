import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  getPrismaClient,
  type PrismaClient,
  MessagingRepository,
  ConversationNotFoundError,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Deterministic Delivery Receipt Concurrency & Atomic PostgreSQL Updates', () => {
  let prisma: PrismaClient;
  let repo: MessagingRepository;

  let alice: { id: string; email: string };
  let bob: { id: string; email: string };
  let mallory: { id: string; email: string };
  const createdConversationIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = getPrismaClient();
    repo = new MessagingRepository(prisma);

    const ts = Date.now();
    alice = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_atomic_alice_${ts}`,
        email: `atomic_alice_${ts}@test.com`,
        firstName: 'Alice',
        lastName: 'Sender',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(alice.id);

    bob = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_atomic_bob_${ts}`,
        email: `atomic_bob_${ts}@test.com`,
        firstName: 'Bob',
        lastName: 'Recipient',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(bob.id);

    mallory = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_atomic_mallory_${ts}`,
        email: `atomic_mallory_${ts}@test.com`,
        firstName: 'Mallory',
        lastName: 'Intruder',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(mallory.id);
  });

  afterAll(async () => {
    for (const cId of createdConversationIds) {
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: cId } });
      await prisma.conversation.deleteMany({ where: { id: cId } });
    }
    for (const uId of createdUserIds) {
      await prisma.user.deleteMany({ where: { id: uId } });
    }
  });

  it('atomically enforces monotonic delivery sequence under concurrent out-of-order updates (5, 10, 3, 8, 7)', async () => {
    const convoId = generateUuidV7();
    createdConversationIds.push(convoId);

    // 1. Start with currentSequence: 10, participant lastDeliveredSequence: 0
    await prisma.conversation.create({
      data: {
        id: convoId,
        type: 'DIRECT',
        currentSequence: 10n,
      },
    });

    await prisma.conversationParticipant.create({
      data: {
        id: generateUuidV7(),
        conversationId: convoId,
        userId: bob.id,
        lastReadSequence: 0n,
        lastDeliveredSequence: 0n,
      },
    });

    const initialSeq = await repo.getDeliveredSequence(convoId, bob.id);
    expect(initialSeq).toBe('0');

    // 2. Concurrently submit acknowledgements for sequences [5, 10, 3, 8, 7]
    const seqs = ['5', '10', '3', '8', '7'];
    const results = await Promise.all(
      seqs.map((seq) => repo.markConversationDelivered(convoId, bob.id, seq)),
    );

    // Each return value must report lastDeliveredSequence >= requested sequence
    for (let i = 0; i < seqs.length; i++) {
      const returnedSeq = BigInt(results[i]!.lastDeliveredSequence);
      const requestedSeq = BigInt(seqs[i]!);
      expect(returnedSeq).toBeGreaterThanOrEqual(requestedSeq);
    }

    // 3. Verify final sequence in database is exactly 10
    const finalSeq = await repo.getDeliveredSequence(convoId, bob.id);
    expect(finalSeq).toBe('10');

    // Direct database row inspection
    const dbParticipant = await prisma.conversationParticipant.findFirstOrThrow({
      where: { conversationId: convoId, userId: bob.id },
    });
    expect(dbParticipant.lastDeliveredSequence).toBe(10n);

    // 4. Repeat under multiple randomized concurrent permutations
    for (let round = 1; round <= 5; round++) {
      const shuffled = [...seqs].sort(() => Math.random() - 0.5);
      await Promise.all(
        shuffled.map((seq) => repo.markConversationDelivered(convoId, bob.id, seq)),
      );

      const checkSeq = await repo.getDeliveredSequence(convoId, bob.id);
      expect(checkSeq).toBe('10');
    }
  });

  it('caps future sequences at conversation currentSequence', async () => {
    const convoId = generateUuidV7();
    createdConversationIds.push(convoId);

    await prisma.conversation.create({
      data: {
        id: convoId,
        type: 'DIRECT',
        currentSequence: 10n,
      },
    });

    await prisma.conversationParticipant.create({
      data: {
        id: generateUuidV7(),
        conversationId: convoId,
        userId: bob.id,
        lastReadSequence: 0n,
        lastDeliveredSequence: 0n,
      },
    });

    // Client requests sequence 99999 on a conversation that only has sequence 10
    const res = await repo.markConversationDelivered(convoId, bob.id, '99999');
    expect(res.lastDeliveredSequence).toBe('10');

    const dbParticipant = await prisma.conversationParticipant.findFirstOrThrow({
      where: { conversationId: convoId, userId: bob.id },
    });
    expect(dbParticipant.lastDeliveredSequence).toBe(10n);
  });

  it('rejects delivery and read acknowledgments from non-participants with ConversationNotFoundError', async () => {
    const convoId = generateUuidV7();
    createdConversationIds.push(convoId);

    await prisma.conversation.create({
      data: {
        id: convoId,
        type: 'DIRECT',
        currentSequence: 10n,
      },
    });

    await prisma.conversationParticipant.create({
      data: {
        id: generateUuidV7(),
        conversationId: convoId,
        userId: bob.id,
        lastReadSequence: 0n,
        lastDeliveredSequence: 0n,
      },
    });

    // Mallory is not a participant in convoId
    await expect(repo.markConversationDelivered(convoId, mallory.id, '5')).rejects.toThrow(
      ConversationNotFoundError,
    );

    await expect(repo.markConversationRead(convoId, mallory.id, '5')).rejects.toThrow(
      ConversationNotFoundError,
    );

    await expect(repo.getDeliveredSequence(convoId, mallory.id)).rejects.toThrow(
      ConversationNotFoundError,
    );
  });

  it('guarantees read acknowledgments advance delivered sequence and never regress delivered sequence under concurrency', async () => {
    const convoId = generateUuidV7();
    createdConversationIds.push(convoId);

    await prisma.conversation.create({
      data: {
        id: convoId,
        type: 'DIRECT',
        currentSequence: 25n,
      },
    });

    await prisma.conversationParticipant.create({
      data: {
        id: generateUuidV7(),
        conversationId: convoId,
        userId: bob.id,
        lastReadSequence: 0n,
        lastDeliveredSequence: 0n,
      },
    });

    // Concurrently fire delivery acknowledgments [4, 12, 6] and read acknowledgments [3, 8, 5]
    const deliveryOps = ['4', '12', '6'].map((s) =>
      repo.markConversationDelivered(convoId, bob.id, s),
    );
    const readOps = ['3', '8', '5'].map((s) => repo.markConversationRead(convoId, bob.id, s));

    await Promise.all([...deliveryOps, ...readOps]);

    const participantAfterBatch = await prisma.conversationParticipant.findFirstOrThrow({
      where: { conversationId: convoId, userId: bob.id },
    });

    // lastDeliveredSequence must be at least 12
    expect(participantAfterBatch.lastDeliveredSequence).toBeGreaterThanOrEqual(12n);
    // lastReadSequence must be at least 8
    expect(participantAfterBatch.lastReadSequence).toBeGreaterThanOrEqual(8n);
    // delivered must be >= read
    expect(participantAfterBatch.lastDeliveredSequence).toBeGreaterThanOrEqual(
      participantAfterBatch.lastReadSequence,
    );

    // Now send read acknowledgment for 20 (exceeding delivered 12)
    const readAdv = await repo.markConversationRead(convoId, bob.id, '20');
    expect(readAdv.lastReadSequence).toBe('20');

    const participantAfterRead = await prisma.conversationParticipant.findFirstOrThrow({
      where: { conversationId: convoId, userId: bob.id },
    });
    expect(participantAfterRead.lastReadSequence).toBe(20n);
    // lastDeliveredSequence must have automatically advanced to at least 20
    expect(participantAfterRead.lastDeliveredSequence).toBeGreaterThanOrEqual(20n);
  });
});
