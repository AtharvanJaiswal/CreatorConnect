import { describe, it, expect, vi } from 'vitest';
import { SocketIoEventDispatcher, type SocketIoRoomEmitter } from './socket-io-dispatcher.js';
import type { ClaimedOutboxEvent } from '@creatorconnect/database';
import { createOutboxClaimToken } from '@creatorconnect/database';
import type { MessageCreatedV1Payload } from '@creatorconnect/contracts';

describe('SocketIoEventDispatcher (Increment 8)', () => {
  const validPayload: MessageCreatedV1Payload = {
    messageId: '01912952-4a00-7000-8000-000000000001',
    conversationId: '01912952-4a00-7000-8000-000000000002',
    senderId: '01912952-4a00-7000-8000-000000000003',
    sequence: '42',
    clientMessageId: 'cli-msg-12345',
    content: 'Hello, realtime world!',
    attachmentCount: 0,
    createdAt: new Date().toISOString(),
  };

  const createEvent = (
    eventType = 'message.created.v1',
    payload: Record<string, unknown> = validPayload,
  ): ClaimedOutboxEvent => ({
    id: '01912952-4a00-7000-8000-000000000099',
    eventType,
    aggregateType: 'Message',
    aggregateId: validPayload.messageId,
    payload,
    attempts: 1,
    createdAt: new Date(),
    claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000099', 1),
  });

  it('10. dispatches valid message.created.v1 to the authorized conversation room with contract schema', async () => {
    const emittedEvents: Array<{ room: string; event: string; payload: unknown }> = [];

    const fakeEmitter: SocketIoRoomEmitter = {
      to: (room: string) => ({
        emit: (event: string, ...args: unknown[]) => {
          emittedEvents.push({ room, event, payload: args[0] });
          return true;
        },
      }),
    };

    const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
    const event = createEvent();

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(true);
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]!.room).toBe(`conversation:${validPayload.conversationId}`);
    expect(emittedEvents[0]!.event).toBe('message:created');

    const livePayload = emittedEvents[0]!.payload as any;
    expect(livePayload.eventId).toBe(event.id);
    expect(livePayload.messageId).toBe(validPayload.messageId);
    expect(livePayload.conversationId).toBe(validPayload.conversationId);
    expect(livePayload.senderId).toBe(validPayload.senderId);
    expect(livePayload.sequence).toBe('42');
    expect(typeof livePayload.sequence).toBe('string');
    expect(livePayload.content).toBe('Hello, realtime world!');
  });

  it('rejects unsupported event types as terminal non-transient errors', async () => {
    const fakeEmitter: SocketIoRoomEmitter = {
      to: () => ({ emit: vi.fn() }),
    };

    const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
    const event = createEvent('user.registered.v1');

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(false);
    expect(result.error).toContain('Unsupported outbox event type');
  });

  it('rejects malformed message.created.v1 payloads without emitting to room', async () => {
    const emitSpy = vi.fn();
    const fakeEmitter: SocketIoRoomEmitter = {
      to: () => ({ emit: emitSpy }),
    };

    const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
    const invalidPayload = { ...validPayload, sequence: 42 }; // sequence must be a decimal string!
    const event = createEvent('message.created.v1', invalidPayload);

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(false);
    expect(result.error).toContain('Invalid message.created.v1 payload schema');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('12. catches Redis/transport errors and classifies them as transient for outbox backoff retry', async () => {
    const fakeEmitter: SocketIoRoomEmitter = {
      to: () => ({
        emit: () => {
          throw new Error('Redis connection refused: ECONNREFUSED 127.0.0.1:6379');
        },
      }),
    };

    const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
    const event = createEvent();

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(true);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('passes through user.block.created.v1 and user.block.removed.v1 without error', async () => {
    const fakeEmitter: SocketIoRoomEmitter = {
      to: () => ({ emit: vi.fn() }),
    };

    const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });

    const blockCreatedEvent = createEvent('user.block.created.v1', {
      blockId: '01912952-4a00-7000-8000-000000000001',
      blockerId: '01912952-4a00-7000-8000-000000000002',
      blockedId: '01912952-4a00-7000-8000-000000000003',
      reason: null,
      createdAt: new Date().toISOString(),
    });
    const res1 = await dispatcher.dispatch(blockCreatedEvent);
    expect(res1.success).toBe(true);

    const blockRemovedEvent = createEvent('user.block.removed.v1', {
      blockerId: '01912952-4a00-7000-8000-000000000002',
      blockedId: '01912952-4a00-7000-8000-000000000003',
      removedAt: new Date().toISOString(),
    });
    const res2 = await dispatcher.dispatch(blockRemovedEvent);
    expect(res2.success).toBe(true);
  });

  it('suppresses message delivery when sender and recipient have an active block', async () => {
    const emitSpy = vi.fn();
    const fakeEmitter: SocketIoRoomEmitter = {
      to: () => ({ emit: emitSpy }),
    };

    const mockPrisma = {
      conversationParticipant: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'recipient-user-id' }]),
      },
      userBlock: {
        findFirst: vi.fn().mockResolvedValue({ id: 'block-id' }), // Active block found!
      },
    } as any;

    const dispatcher = new SocketIoEventDispatcher({
      emitter: fakeEmitter,
      prisma: mockPrisma,
    });
    const event = createEvent();

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(true);
    expect(emitSpy).not.toHaveBeenCalled(); // Room emission suppressed!
  });
});
