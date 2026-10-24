import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRequestExpiryWorker } from './message-request-expiry.worker.js';
import { CleanupScheduler } from './cleanup-scheduler.js';
import type { PrismaClient } from '@creatorconnect/database';

describe('MessageRequestExpiryWorker (Phase 19F Milestone 2C)', () => {
  const baseTime = new Date('2026-10-24T12:00:00.000Z');
  const pastTime = new Date('2026-10-24T11:59:00.000Z');
  const futureTime = new Date('2026-10-24T12:01:00.000Z');

  let mockPrisma: any;
  let createdOutboxEvents: any[];
  let updatedRequests: any[];

  beforeEach(() => {
    createdOutboxEvents = [];
    updatedRequests = [];

    mockPrisma = {
      messageRequest: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      outboxEvent: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          createdOutboxEvents.push(data);
          return data;
        }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };
  });

  it('1. transitions only PENDING requests whose expiresAt <= now', async () => {
    const expiredCandidate = {
      id: '01912952-4a00-7000-8000-000000000001',
      senderId: '01912952-4a00-7000-8000-000000000011',
      recipientId: '01912952-4a00-7000-8000-000000000012',
      expiresAt: pastTime,
    };

    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([expiredCandidate]);
    mockPrisma.messageRequest.updateMany.mockResolvedValueOnce({ count: 1 });

    const worker = new MessageRequestExpiryWorker({
      prisma: mockPrisma,
      now: () => baseTime,
      batchSize: 10,
    });

    const result = await worker.expirePendingRequests();

    expect(result.scanned).toBe(1);
    expect(result.expired).toBe(1);
    expect(result.conflicted).toBe(0);
    expect(result.errors).toBe(0);

    // Verify query criteria
    expect(mockPrisma.messageRequest.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        expiresAt: { lte: baseTime },
      },
      take: 10,
      orderBy: { expiresAt: 'asc' },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        expiresAt: true,
      },
    });

    // Verify conditional update
    expect(mockPrisma.messageRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: expiredCandidate.id,
        status: 'PENDING',
        expiresAt: { lte: baseTime },
      },
      data: {
        status: 'EXPIRED',
        respondedAt: baseTime,
      },
    });

    // Verify atomic outbox event creation
    expect(createdOutboxEvents).toHaveLength(1);
    expect(createdOutboxEvents[0].eventType).toBe('message_request.expired.v1');
    expect(createdOutboxEvents[0].aggregateType).toBe('MessageRequest');
    expect(createdOutboxEvents[0].aggregateId).toBe(expiredCandidate.id);
    expect(createdOutboxEvents[0].status).toBe('PENDING');
    expect(createdOutboxEvents[0].payload).toEqual({
      requestId: expiredCandidate.id,
      senderId: expiredCandidate.senderId,
      recipientId: expiredCandidate.recipientId,
      expiredAt: baseTime.toISOString(),
    });
  });

  it('2. does not transition unexpired requests when none match expiresAt <= now', async () => {
    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([]);

    const worker = new MessageRequestExpiryWorker({
      prisma: mockPrisma,
      now: () => baseTime,
    });

    const result = await worker.expirePendingRequests();

    expect(result.scanned).toBe(0);
    expect(result.expired).toBe(0);
    expect(mockPrisma.messageRequest.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('3. handles race conditions idempotently when concurrent worker transitions request first', async () => {
    const candidate = {
      id: '01912952-4a00-7000-8000-000000000002',
      senderId: '01912952-4a00-7000-8000-000000000021',
      recipientId: '01912952-4a00-7000-8000-000000000022',
      expiresAt: pastTime,
    };

    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([candidate]);
    // Concurrent worker won the update race; updateMany returns count: 0
    mockPrisma.messageRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    const worker = new MessageRequestExpiryWorker({
      prisma: mockPrisma,
      now: () => baseTime,
    });

    const result = await worker.expirePendingRequests();

    expect(result.scanned).toBe(1);
    expect(result.expired).toBe(0);
    expect(result.conflicted).toBe(1);
    // Crucial: no outbox event emitted on conflict!
    expect(createdOutboxEvents).toHaveLength(0);
  });

  it('4. handles race condition where request is accepted before expiry update executes', async () => {
    const candidate = {
      id: '01912952-4a00-7000-8000-000000000003',
      senderId: '01912952-4a00-7000-8000-000000000031',
      recipientId: '01912952-4a00-7000-8000-000000000032',
      expiresAt: pastTime,
    };

    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([candidate]);
    // User clicked Accept right before sweep; status changed to ACCEPTED, so updateMany returns 0
    mockPrisma.messageRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    const worker = new MessageRequestExpiryWorker({
      prisma: mockPrisma,
      now: () => baseTime,
    });

    const result = await worker.expirePendingRequests();

    expect(result.expired).toBe(0);
    expect(result.conflicted).toBe(1);
    expect(createdOutboxEvents).toHaveLength(0);
  });

  it('5. processes multiple bounded batches sequentially until queue drained or maxBatches reached', async () => {
    const batch1 = [
      { id: 'req-1', senderId: 'u1', recipientId: 'u2', expiresAt: pastTime },
      { id: 'req-2', senderId: 'u3', recipientId: 'u4', expiresAt: pastTime },
    ];
    const batch2 = [{ id: 'req-3', senderId: 'u5', recipientId: 'u6', expiresAt: pastTime }];

    mockPrisma.messageRequest.findMany
      .mockResolvedValueOnce(batch1) // Batch size = 2, returns full batch
      .mockResolvedValueOnce(batch2); // Second batch returns 1 (< batchSize), finishes

    mockPrisma.messageRequest.updateMany.mockResolvedValue({ count: 1 });

    const worker = new MessageRequestExpiryWorker({
      prisma: mockPrisma,
      now: () => baseTime,
      batchSize: 2,
    });

    const result = await worker.expirePendingRequests({ maxBatches: 5 });

    expect(result.scanned).toBe(3);
    expect(result.expired).toBe(3);
    expect(createdOutboxEvents).toHaveLength(3);
    expect(mockPrisma.messageRequest.findMany).toHaveBeenCalledTimes(2);
  });

  it('6. handles database errors gracefully without throwing', async () => {
    mockPrisma.messageRequest.findMany.mockRejectedValueOnce(
      new Error('PostgreSQL connection dropped'),
    );

    const worker = new MessageRequestExpiryWorker({
      prisma: mockPrisma,
      now: () => baseTime,
    });

    const result = await worker.expirePendingRequests();

    expect(result.scanned).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('7. integrates cleanly with CleanupScheduler.sweepExpiredMessageRequests', async () => {
    const candidate = {
      id: '01912952-4a00-7000-8000-000000000005',
      senderId: '01912952-4a00-7000-8000-000000000051',
      recipientId: '01912952-4a00-7000-8000-000000000052',
      expiresAt: pastTime,
    };

    mockPrisma.messageRequest.findMany.mockResolvedValueOnce([candidate]);
    mockPrisma.messageRequest.updateMany.mockResolvedValueOnce({ count: 1 });

    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any;

    const expiryWorker = new MessageRequestExpiryWorker({
      prisma: mockPrisma,
      logger: mockLogger,
      now: () => baseTime,
    });

    const scheduler = new CleanupScheduler(mockLogger, mockPrisma, expiryWorker);

    const expiredCount = await scheduler.sweepExpiredMessageRequests();

    expect(expiredCount).toBe(1);
    expect(createdOutboxEvents).toHaveLength(1);
  });
});
