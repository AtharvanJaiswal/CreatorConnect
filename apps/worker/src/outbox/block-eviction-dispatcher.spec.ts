import { describe, it, expect, vi } from 'vitest';
import {
  BlockEvictionDispatcher,
  type IBlockEvictionService,
} from './block-eviction-dispatcher.js';
import type { ClaimedOutboxEvent } from '@creatorconnect/database';
import { createOutboxClaimToken } from '@creatorconnect/database';

describe('BlockEvictionDispatcher (Increment 10C)', () => {
  const blockerId = '01912952-4a00-7000-8000-000000000001';
  const blockedId = '01912952-4a00-7000-8000-000000000002';
  const blockId = '01912952-4a00-7000-8000-000000000003';

  const createEvent = (
    eventType: string,
    payload: Record<string, unknown>,
  ): ClaimedOutboxEvent => ({
    id: '01912952-4a00-7000-8000-000000000099',
    eventType,
    aggregateType: 'UserBlock',
    aggregateId: blockId,
    payload,
    attempts: 1,
    createdAt: new Date(),
    claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000099', 1),
  });

  it('handles valid user.block.created.v1 and invokes eviction service', async () => {
    const evictSpy = vi.fn().mockResolvedValue({
      success: true,
      evictedRooms: ['conversation:123'],
      sharedConversationsCount: 1,
    });
    const fakeService: IBlockEvictionService = {
      evictBlockedPair: evictSpy,
    };

    const dispatcher = new BlockEvictionDispatcher({ evictionService: fakeService });
    const event = createEvent('user.block.created.v1', {
      blockId,
      blockerId,
      blockedId,
      reason: 'Harassment',
      createdAt: new Date().toISOString(),
    });

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(true);
    expect(evictSpy).toHaveBeenCalledWith(blockerId, blockedId);
  });

  it('handles valid user.block.created.v1 with null reason', async () => {
    const evictSpy = vi.fn().mockResolvedValue({ success: true, evictedRooms: [] });
    const fakeService: IBlockEvictionService = {
      evictBlockedPair: evictSpy,
    };

    const dispatcher = new BlockEvictionDispatcher({ evictionService: fakeService });
    const event = createEvent('user.block.created.v1', {
      blockId,
      blockerId,
      blockedId,
      reason: null,
      createdAt: new Date().toISOString(),
    });

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(true);
    expect(evictSpy).toHaveBeenCalledWith(blockerId, blockedId);
  });

  it('rejects malformed user.block.created.v1 payloads terminally', async () => {
    const evictSpy = vi.fn();
    const dispatcher = new BlockEvictionDispatcher({
      evictionService: { evictBlockedPair: evictSpy },
    });

    const event = createEvent('user.block.created.v1', {
      blockId: 'not-a-uuid',
      blockerId,
      blockedId,
    });

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(false);
    expect(result.error).toContain('Invalid user.block.created.v1 payload schema');
    expect(evictSpy).not.toHaveBeenCalled();
  });

  it('handles valid user.block.removed.v1 as a safe no-op on memberships', async () => {
    const evictSpy = vi.fn();
    const dispatcher = new BlockEvictionDispatcher({
      evictionService: { evictBlockedPair: evictSpy },
    });

    const event = createEvent('user.block.removed.v1', {
      blockerId,
      blockedId,
      removedAt: new Date().toISOString(),
    });

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(true);
    expect(evictSpy).not.toHaveBeenCalled(); // Memberships are not restored
  });

  it('rejects malformed user.block.removed.v1 payloads terminally', async () => {
    const dispatcher = new BlockEvictionDispatcher();
    const event = createEvent('user.block.removed.v1', {
      blockerId: 'not-a-uuid',
      blockedId,
    });

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(false);
    expect(result.error).toContain('Invalid user.block.removed.v1 payload schema');
  });

  it('classifies eviction service errors as transient for outbox retry', async () => {
    const evictSpy = vi.fn().mockRejectedValue(new Error('Redis connection lost'));
    const dispatcher = new BlockEvictionDispatcher({
      evictionService: { evictBlockedPair: evictSpy },
    });

    const event = createEvent('user.block.created.v1', {
      blockId,
      blockerId,
      blockedId,
      reason: null,
      createdAt: new Date().toISOString(),
    });

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(true);
    expect(result.error).toContain('Redis connection lost');
  });

  it('passes through unrelated events as successful for composite chaining', async () => {
    const dispatcher = new BlockEvictionDispatcher();
    const event = createEvent('message.created.v1', {});

    const result = await dispatcher.dispatch(event);
    expect(result.success).toBe(true);
  });
});
