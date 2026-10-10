import { describe, it, expect, vi } from 'vitest';
import { BlockEvictionService } from './block-eviction.service.js';

describe('BlockEvictionService (Bounded Local Socket Reconciliation & Failure Modes)', () => {
  const userA = '01912952-4a00-7000-8000-000000000001';
  const userB = '01912952-4a00-7000-8000-000000000002';
  const userC = '01912952-4a00-7000-8000-000000000003';
  const convId1 = '01912952-4a00-7000-8000-000000000010';
  const convId2 = '01912952-4a00-7000-8000-000000000020';

  it('evicts stale conversation room memberships when user has left the conversation', async () => {
    const socketLeaveSpy = vi.fn();
    const socketEmitSpy = vi.fn();

    const fakeSocket: any = {
      id: 'socket-1',
      data: { user: { id: userA } },
      rooms: new Set(['socket-1', `user:${userA}`, `conversation:${convId1}`]),
      leave: socketLeaveSpy,
      emit: socketEmitSpy,
      disconnected: false,
    };

    const fakeIo: any = {
      sockets: {
        sockets: new Map([['socket-1', fakeSocket]]),
      },
    };

    const fakePrisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: userA, status: 'ACTIVE' }]),
      },
      conversationParticipant: {
        findMany: vi.fn().mockResolvedValue([]), // No active participants -> userA left
      },
      userBlock: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new BlockEvictionService({
      io: fakeIo,
      prisma: fakePrisma,
    });

    const result = await service.reconcileLocalSockets();

    expect(result.checkedSockets).toBe(1);
    expect(result.evictedCount).toBe(1);
    expect(socketLeaveSpy).toHaveBeenCalledWith(`conversation:${convId1}`);
    expect(socketEmitSpy).not.toHaveBeenCalled(); // No misleading blocked notification when merely departed
  });

  it('evicts local socket and emits conversation:blocked when an active block exists between participants', async () => {
    const socketLeaveSpy = vi.fn();
    const socketEmitSpy = vi.fn();

    const fakeSocket: any = {
      id: 'socket-1',
      data: { user: { id: userA } },
      rooms: new Set(['socket-1', `user:${userA}`, `conversation:${convId1}`]),
      leave: socketLeaveSpy,
      emit: socketEmitSpy,
      disconnected: false,
    };

    const fakeIo: any = {
      sockets: {
        sockets: new Map([['socket-1', fakeSocket]]),
      },
    };

    const fakePrisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: userA, status: 'ACTIVE' }]),
      },
      conversationParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { conversationId: convId1, userId: userA },
          { conversationId: convId1, userId: userB },
        ]),
      },
      userBlock: {
        findMany: vi.fn().mockResolvedValue([
          { blockerId: userB, blockedId: userA }, // User B blocked User A
        ]),
      },
    };

    const service = new BlockEvictionService({
      io: fakeIo,
      prisma: fakePrisma,
    });

    const result = await service.reconcileLocalSockets();

    expect(result.checkedSockets).toBe(1);
    expect(result.evictedCount).toBe(1);
    expect(socketLeaveSpy).toHaveBeenCalledWith(`conversation:${convId1}`);
    expect(socketEmitSpy).toHaveBeenCalledWith('conversation:blocked', {
      conversationId: convId1,
    });
  });

  it('disconnects local sockets when user account status became SUSPENDED or DEACTIVATED', async () => {
    const disconnectSpy = vi.fn();
    const emitSpy = vi.fn();

    const fakeSocket: any = {
      id: 'socket-suspended',
      data: { user: { id: userA } },
      rooms: new Set(['socket-suspended', `user:${userA}`]),
      disconnect: disconnectSpy,
      emit: emitSpy,
      disconnected: false,
    };

    const fakeIo: any = {
      sockets: {
        sockets: new Map([['socket-suspended', fakeSocket]]),
      },
    };

    const fakePrisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: userA, status: 'SUSPENDED' }]),
      },
      conversationParticipant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      userBlock: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new BlockEvictionService({
      io: fakeIo,
      prisma: fakePrisma,
    });

    const result = await service.reconcileLocalSockets();

    expect(result.checkedSockets).toBe(1);
    expect(result.evictedCount).toBe(1);
    expect(emitSpy).toHaveBeenCalledWith('error', {
      code: 'ACCOUNT_INACTIVE',
      message: 'Account status changed.',
    });
    expect(disconnectSpy).toHaveBeenCalledWith(true);
  });

  it('preserves legitimate active unblocked participants in group conversations', async () => {
    const socketLeaveSpy = vi.fn();

    const fakeSocket: any = {
      id: 'socket-3',
      data: { user: { id: userC } },
      rooms: new Set(['socket-3', `user:${userC}`, `conversation:${convId2}`]),
      leave: socketLeaveSpy,
      emit: vi.fn(),
      disconnected: false,
    };

    const fakeIo: any = {
      sockets: {
        sockets: new Map([['socket-3', fakeSocket]]),
      },
    };

    const fakePrisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: userC, status: 'ACTIVE' }]),
      },
      conversationParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { conversationId: convId2, userId: userC },
          { conversationId: convId2, userId: userA },
        ]),
      },
      userBlock: {
        findMany: vi.fn().mockResolvedValue([]), // No blocks between C and A
      },
    };

    const service = new BlockEvictionService({
      io: fakeIo,
      prisma: fakePrisma,
    });

    const result = await service.reconcileLocalSockets();

    expect(result.checkedSockets).toBe(1);
    expect(result.evictedCount).toBe(0);
    expect(socketLeaveSpy).not.toHaveBeenCalled();
  });

  it('enforces single-flight concurrency guard and respects graceful shutdown', async () => {
    const fakeIo: any = {
      sockets: {
        sockets: new Map(),
      },
    };

    const service = new BlockEvictionService({
      io: fakeIo,
    });

    // Test shutdown
    service.shutdown();
    const shutdownResult = await service.reconcileLocalSockets();
    expect(shutdownResult).toEqual({ checkedSockets: 0, evictedCount: 0 });
  });
});
