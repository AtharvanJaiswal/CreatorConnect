import { describe, it, expect, vi } from 'vitest';
import { RedisBlockEvictionService } from './redis-block-eviction.service.js';

describe('RedisBlockEvictionService (Stale Event Safety & Authoritative Invariant)', () => {
  const userA = '01912952-4a00-7000-8000-000000000001';
  const userB = '01912952-4a00-7000-8000-000000000002';
  const conversationId = '01912952-4a00-7000-8000-000000000010';

  it('evicts rooms and broadcasts notification when active block exists in PostgreSQL', async () => {
    const socketsLeaveSpy = vi.fn();
    const emitSpy = vi.fn();

    const fakeEmitter: any = {
      in: vi.fn().mockReturnValue({ socketsLeave: socketsLeaveSpy }),
      to: vi.fn().mockReturnValue({ emit: emitSpy }),
    };

    const fakePrisma: any = {
      userBlock: {
        findFirst: vi.fn().mockResolvedValue({ id: 'block-123' }),
      },
      conversation: {
        findMany: vi.fn().mockResolvedValue([{ id: conversationId, type: 'DIRECT' }]),
      },
    };

    const service = new RedisBlockEvictionService({
      emitter: fakeEmitter,
      prisma: fakePrisma,
    });

    const result = await service.evictBlockedPair(userA, userB);

    expect(result.success).toBe(true);
    expect(result.evictedRooms).toEqual([`conversation:${conversationId}`]);
    expect(result.sharedConversationsCount).toBe(1);

    // Verified emitter calls
    expect(fakeEmitter.in).toHaveBeenCalledWith(`user:${userA}`);
    expect(fakeEmitter.in).toHaveBeenCalledWith(`user:${userB}`);
    expect(socketsLeaveSpy).toHaveBeenCalledWith(`conversation:${conversationId}`);
    expect(emitSpy).toHaveBeenCalledWith('conversation:blocked', { conversationId });
  });

  it('safely skips eviction when block has already been removed in PostgreSQL (FIND-10D-01 Remediation)', async () => {
    const socketsLeaveSpy = vi.fn();
    const emitSpy = vi.fn();

    const fakeEmitter: any = {
      in: vi.fn().mockReturnValue({ socketsLeave: socketsLeaveSpy }),
      to: vi.fn().mockReturnValue({ emit: emitSpy }),
    };

    // Database returns null -> block was unblocked prior to event processing
    const fakePrisma: any = {
      userBlock: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      conversation: {
        findMany: vi.fn(),
      },
    };

    const service = new RedisBlockEvictionService({
      emitter: fakeEmitter,
      prisma: fakePrisma,
    });

    const result = await service.evictBlockedPair(userA, userB);

    // Must safely complete as no-op without false eviction or misleading notification
    expect(result.success).toBe(true);
    expect(result.evictedRooms).toEqual([]);
    expect(result.sharedConversationsCount).toBe(0);

    expect(fakePrisma.conversation.findMany).not.toHaveBeenCalled();
    expect(fakeEmitter.in).not.toHaveBeenCalled();
    expect(fakeEmitter.to).not.toHaveBeenCalled();
    expect(socketsLeaveSpy).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
