import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { getPrismaClient, type PrismaClient, OutboxRepository } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { OutboxProcessor } from './outbox-processor.js';
import { type IEventDispatcher, type DispatchResult } from './event-dispatcher.js';

class MockEventDispatcher implements IEventDispatcher {
  public dispatched: any[] = [];
  public failNextWithTransient: boolean = false;
  public failNextWithTerminal: boolean = false;
  public crashAfterDispatch: boolean = false;

  async dispatch(event: any): Promise<DispatchResult> {
    if (this.failNextWithTransient) {
      this.failNextWithTransient = false;
      return { success: false, error: 'Redis connection timeout', isTransient: true };
    }
    if (this.failNextWithTerminal) {
      this.failNextWithTerminal = false;
      return { success: false, error: 'Fatal serialization error', isTransient: false };
    }
    this.dispatched.push(event);
    if (this.crashAfterDispatch) {
      this.crashAfterDispatch = false;
      throw new Error('Worker crash simulated after external dispatch');
    }
    return { success: true };
  }
}

describe('Transactional Outbox Dispatcher Integration Tests (Increment 7)', () => {
  let prisma: PrismaClient;
  let outboxRepo: OutboxRepository;
  let dispatcher: MockEventDispatcher;
  let processor: OutboxProcessor;

  beforeAll(async () => {
    prisma = getPrismaClient();
    outboxRepo = new OutboxRepository(prisma);
  });

  beforeEach(async () => {
    dispatcher = new MockEventDispatcher();
    processor = new OutboxProcessor({
      outboxRepo,
      dispatcher,
      config: {
        batchSize: 10,
        pollIntervalMs: 50,
        leaseDurationSeconds: 2, // Short lease for quick test expiration
        maxAttempts: 3,
        baseDelayMs: 50,
        maxDelayMs: 200,
        jitterMs: 10,
        consumerName: 'test-dispatcher',
      },
    });

    // Clean up outbox and processed events
    await prisma.processedEvent.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
  });

  afterAll(async () => {
    await prisma.processedEvent.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
  });

  const createTestEvent = async (
    overrides: {
      eventType?: string;
      payload?: any;
      status?: any;
      nextAttemptAt?: Date;
      attempts?: number;
    } = {},
  ) => {
    const id = generateUuidV7();
    const messageId = generateUuidV7();
    const conversationId = generateUuidV7();
    const senderId = generateUuidV7();

    const validPayload = {
      messageId,
      conversationId,
      senderId,
      sequence: '1',
      clientMessageId: generateUuidV7(),
      content: 'Hello Outbox',
      attachmentCount: 0,
      createdAt: new Date().toISOString(),
    };

    return await prisma.outboxEvent.create({
      data: {
        id,
        eventType: overrides.eventType || 'message.created.v1',
        aggregateType: 'Message',
        aggregateId: messageId,
        payload: overrides.payload !== undefined ? overrides.payload : validPayload,
        status: overrides.status || 'PENDING',
        attempts: overrides.attempts ?? 0,
        nextAttemptAt: overrides.nextAttemptAt || new Date(),
      },
    });
  };

  describe('1. Claiming & Concurrency', () => {
    it('1. claims pending events using FOR UPDATE SKIP LOCKED', async () => {
      await createTestEvent();
      await createTestEvent();

      const claimed = await outboxRepo.claimBatch({ batchSize: 10 });
      expect(claimed).toHaveLength(2);
      expect(claimed[0]!.attempts).toBe(1);
      expect(claimed[0]!.claimToken.attempt).toBe(1);

      // Verify DB status is PROCESSING
      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: claimed[0]!.id } });
      expect(dbEvent?.status).toBe('PROCESSING');
      expect(dbEvent?.attempts).toBe(1);
    });

    it('2. concurrent workers claim disjoint events without double-claiming', async () => {
      // Create 4 events
      for (let i = 0; i < 4; i++) {
        await createTestEvent();
      }

      // Worker 1 and Worker 2 claim concurrently
      const [batch1, batch2] = await Promise.all([
        outboxRepo.claimBatch({ batchSize: 2 }),
        outboxRepo.claimBatch({ batchSize: 2 }),
      ]);

      expect(batch1).toHaveLength(2);
      expect(batch2).toHaveLength(2);

      const ids1 = new Set(batch1.map((e) => e.id));
      const ids2 = new Set(batch2.map((e) => e.id));

      // Overlap must be empty!
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(false);
      }
    });

    it('3. recovers expired leases when a worker crashes', async () => {
      const past = new Date(Date.now() - 5000); // 5s in the past
      const event = await createTestEvent({
        status: 'PROCESSING',
        attempts: 1,
        nextAttemptAt: past, // Expired lease
      });

      const claimed = await outboxRepo.claimBatch({ batchSize: 10, leaseDurationSeconds: 10 });
      expect(claimed).toHaveLength(1);
      expect(claimed[0]!.id).toBe(event.id);
      expect(claimed[0]!.attempts).toBe(2); // Incremented attempt counter
    });

    it('4. prevents stale claim tokens from modifying newer claims', async () => {
      const event = await createTestEvent();

      // Worker 1 claims
      const claimed1 = await outboxRepo.claimBatch({ batchSize: 1, leaseDurationSeconds: 1 });
      const token1 = claimed1[0]!.claimToken;
      expect(token1.attempt).toBe(1);

      // Simulate lease expiration
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      // Worker 2 claims the expired event
      const claimed2 = await outboxRepo.claimBatch({ batchSize: 1 });
      const token2 = claimed2[0]!.claimToken;
      expect(token2.attempt).toBe(2);

      // Stale Worker 1 attempts to mark published using token1
      const staleSuccess = await outboxRepo.markPublished(token1);
      expect(staleSuccess).toBe(false); // Stale worker rejected!

      // Live Worker 2 marks published using token2
      const liveSuccess = await outboxRepo.markPublished(token2);
      expect(liveSuccess).toBe(true);

      const finalRecord = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(finalRecord?.status).toBe('PUBLISHED');
      expect(finalRecord?.attempts).toBe(2);
    });
  });

  describe('2. Dispatch, Processing & Idempotency', () => {
    it('5. successfully dispatches event and transitions state to PUBLISHED', async () => {
      const event = await createTestEvent();

      const count = await processor.processNextBatch();
      expect(count).toBe(1);
      expect(dispatcher.dispatched).toHaveLength(1);
      expect(dispatcher.dispatched[0]!.id).toBe(event.id);

      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('PUBLISHED');
      expect(dbEvent?.publishedAt).toBeDefined();

      // Verify processed_events record was created
      const isProcessed = await outboxRepo.isEventProcessed(event.id, 'test-dispatcher');
      expect(isProcessed).toBe(true);
    });

    it('6. retries on transient adapter failure with exponential backoff', async () => {
      const event = await createTestEvent();
      dispatcher.failNextWithTransient = true;

      const count = await processor.processNextBatch();
      expect(count).toBe(1); // Processed attempt

      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('PENDING'); // Back to PENDING for retry
      expect(dbEvent?.attempts).toBe(1);
      expect(dbEvent?.lastError).toContain('Redis connection timeout');
      expect(dbEvent?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('7. honors max attempts and transitions to DEAD_LETTER', async () => {
      // Event already at 2 attempts, maxAttempts is 3
      const event = await createTestEvent({ attempts: 2 });
      dispatcher.failNextWithTransient = true;

      await processor.processNextBatch();

      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('DEAD_LETTER'); // Exceeded max attempts (attempt 3 of 3 failed)
      expect(dbEvent?.attempts).toBe(3);
    });

    it('8. transitions immediately to DEAD_LETTER on terminal failure', async () => {
      const event = await createTestEvent();
      dispatcher.failNextWithTerminal = true;

      await processor.processNextBatch();

      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('DEAD_LETTER');
      expect(dbEvent?.lastError).toContain('Fatal serialization error');
    });

    it('9. moves unknown event types to DEAD_LETTER without silent drop', async () => {
      const event = await createTestEvent({ eventType: 'unknown.anomaly.v9' });

      await processor.processNextBatch();

      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('DEAD_LETTER');
      expect(dbEvent?.lastError).toContain('UNKNOWN_EVENT_TYPE: unknown.anomaly.v9');
      expect(dispatcher.dispatched).toHaveLength(0);
    });

    it('10. moves invalid payload schemas to DEAD_LETTER with validation diagnostics', async () => {
      const event = await createTestEvent({
        payload: { invalid: 'missing required fields' },
      });

      await processor.processNextBatch();

      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('DEAD_LETTER');
      expect(dbEvent?.lastError).toContain('PAYLOAD_VALIDATION_FAILED');
      expect(dispatcher.dispatched).toHaveLength(0);
    });

    it('11. skips redundant external dispatch for already processed events (idempotency)', async () => {
      const event = await createTestEvent();

      // Pre-record as already processed by this consumer
      await outboxRepo.recordProcessedEvent(event.id, 'test-dispatcher');

      await processor.processNextBatch();

      // External dispatcher was NOT called again
      expect(dispatcher.dispatched).toHaveLength(0);

      // But outbox event was finalized to PUBLISHED
      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('PUBLISHED');
    });

    it('12. recovers gracefully on crash/restart cycle', async () => {
      const event = await createTestEvent();

      // Crash simulated: batch claims event, increments attempt, but worker restarts
      const claimed = await outboxRepo.claimBatch({ batchSize: 1, leaseDurationSeconds: 1 });
      expect(claimed).toHaveLength(1);

      // Simulate lease expiration
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      // New worker processor starts up and recovers the event
      const count = await processor.processNextBatch();
      expect(count).toBe(1);

      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('PUBLISHED');
      expect(dbEvent?.attempts).toBe(2);
    });

    it('13. isolates batch errors so one poison event does not block others', async () => {
      // Event 1 is poison (invalid payload)
      const poison = await createTestEvent({ payload: { bad: true } });
      // Event 2 is valid
      const valid = await createTestEvent();

      const count = await processor.processNextBatch();
      expect(count).toBe(2);

      const dbPoison = await prisma.outboxEvent.findUnique({ where: { id: poison.id } });
      const dbValid = await prisma.outboxEvent.findUnique({ where: { id: valid.id } });

      expect(dbPoison?.status).toBe('DEAD_LETTER');
      expect(dbValid?.status).toBe('PUBLISHED');
      expect(dispatcher.dispatched).toHaveLength(1);
      expect(dispatcher.dispatched[0]!.id).toBe(valid.id);
    });

    it('14. supports graceful shutdown and stops claiming work', async () => {
      await processor.start();
      expect(processor.getStatus().isRunning).toBe(true);

      await processor.stop();
      expect(processor.getStatus().isRunning).toBe(false);

      // Add new event
      await createTestEvent();

      // After stop, no active polling should run
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(dispatcher.dispatched).toHaveLength(0);
    });

    it('15. verifies atomicity of database state transitions', async () => {
      const event = await createTestEvent();

      // Claiming transitions PENDING -> PROCESSING atomically
      const claimed = await outboxRepo.claimBatch({ batchSize: 1 });
      expect(claimed).toHaveLength(1);

      const inFlight = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(inFlight?.status).toBe('PROCESSING');

      // Marking published transitions PROCESSING -> PUBLISHED
      const published = await outboxRepo.markPublished(claimed[0]!.claimToken);
      expect(published).toBe(true);

      const finalized = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(finalized?.status).toBe('PUBLISHED');
    });

    it('16. documents and handles at-least-once external delivery guarantee during crash window', async () => {
      const event = await createTestEvent();
      dispatcher.crashAfterDispatch = true; // Simulates crash AFTER external send, BEFORE DB commit

      // Processing throws due to crash
      await processor.processNextBatch();

      // External dispatch DID happen once
      expect(dispatcher.dispatched).toHaveLength(1);

      // But DB state remains in PROCESSING because worker crashed before recording success
      const dbEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(dbEvent?.status).toBe('PROCESSING');

      // Expire lease
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      // Restarted worker claims and retries
      dispatcher.crashAfterDispatch = false;
      await processor.processNextBatch();

      // External dispatch occurred a second time (at-least-once window verified!)
      expect(dispatcher.dispatched).toHaveLength(2);

      // Now finalized
      const finalEvent = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
      expect(finalEvent?.status).toBe('PUBLISHED');
    });
  });
});
