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

  it('dispatches valid message.deleted.v1 to the authorized conversation room', async () => {
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
    const deletePayload = {
      messageId: validPayload.messageId,
      conversationId: validPayload.conversationId,
      deletedBy: validPayload.senderId,
      sequence: '43',
      deletedAt: new Date().toISOString(),
    };
    const event = createEvent('message.deleted.v1', deletePayload);

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(true);
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]!.room).toBe(`conversation:${validPayload.conversationId}`);
    expect(emittedEvents[0]!.event).toBe('message:deleted');

    const livePayload = emittedEvents[0]!.payload as any;
    expect(livePayload.messageId).toBe(deletePayload.messageId);
    expect(livePayload.deletedBy).toBe(deletePayload.deletedBy);
    expect(livePayload.sequence).toBe('43');
    expect(livePayload.deletedAt).toBe(deletePayload.deletedAt);
  });

  it('dispatches valid message.updated.v1 to the authorized conversation room', async () => {
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
    const updatePayload = {
      messageId: validPayload.messageId,
      conversationId: validPayload.conversationId,
      senderId: validPayload.senderId,
      sequence: '44',
      content: 'Updated content string',
      updatedAt: new Date().toISOString(),
    };
    const event = createEvent('message.updated.v1', updatePayload);

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(true);
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]!.room).toBe(`conversation:${validPayload.conversationId}`);
    expect(emittedEvents[0]!.event).toBe('message:updated');

    const livePayload = emittedEvents[0]!.payload as any;
    expect(livePayload.content).toBe('Updated content string');
    expect(livePayload.sequence).toBe('44');
  });

  it('rejects malformed message.deleted.v1 payload without emitting to room', async () => {
    const emitSpy = vi.fn();
    const fakeEmitter: SocketIoRoomEmitter = {
      to: () => ({ emit: emitSpy }),
    };

    const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
    const invalidPayload = { messageId: 'not-a-uuid' };
    const event = createEvent('message.deleted.v1', invalidPayload);

    const result = await dispatcher.dispatch(event);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(false);
    expect(result.error).toContain('Invalid message.deleted.v1 payload schema');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  describe('MessageRequest Outbox Dispatching (Phase 19F Milestone 2C)', () => {
    const senderId = '01912952-4a00-7000-8000-000000000001';
    const recipientId = '01912952-4a00-7000-8000-000000000002';
    const requestId = '01912952-4a00-7000-8000-000000000003';
    const conversationId = '01912952-4a00-7000-8000-000000000004';
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    const createdAt = new Date().toISOString();

    it('dispatches message_request.created.v1 exclusively to recipient private user room without leaking initialMessage', async () => {
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
      const payload = {
        requestId,
        senderId,
        recipientId,
        initialMessage:
          'Super secret private proposal message that must NOT leak into realtime push!',
        expiresAt,
        createdAt,
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000099',
        eventType: 'message_request.created.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000099', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emittedEvents).toHaveLength(1);
      // Room convention: user:${recipientId}
      expect(emittedEvents[0]!.room).toBe(`user:${recipientId}`);
      expect(emittedEvents[0]!.event).toBe('message_request:created');

      const livePayload = emittedEvents[0]!.payload as any;
      expect(livePayload.requestId).toBe(requestId);
      expect(livePayload.senderId).toBe(senderId);
      expect(livePayload.recipientId).toBe(recipientId);
      expect(livePayload.expiresAt).toBe(expiresAt);

      // CRITICAL PRIVACY INVARIANT: Must NOT leak initialMessage
      expect(livePayload.initialMessage).toBeUndefined();
      expect(JSON.stringify(livePayload)).not.toContain('Super secret private proposal message');
    });

    it('dispatches message_request.accepted.v1 to both sender and recipient user rooms with conversationId', async () => {
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
      const acceptedAt = new Date().toISOString();
      const payload = {
        requestId,
        senderId,
        recipientId,
        conversationId,
        acceptedAt,
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000098',
        eventType: 'message_request.accepted.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000098', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emittedEvents).toHaveLength(2);
      const rooms = emittedEvents.map((e) => e.room);
      expect(rooms).toContain(`user:${senderId}`);
      expect(rooms).toContain(`user:${recipientId}`);
      expect(emittedEvents[0]!.event).toBe('message_request:accepted');

      const livePayload = emittedEvents[0]!.payload as any;
      expect(livePayload.requestId).toBe(requestId);
      expect(livePayload.conversationId).toBe(conversationId);
      expect(livePayload.acceptedAt).toBe(acceptedAt);
    });

    it('dispatches message_request.declined.v1 to both user rooms without leaking decline reason', async () => {
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
      const declinedAt = new Date().toISOString();
      const payload = {
        requestId,
        senderId,
        recipientId,
        declinedAt,
        reason: 'Private decline note that should not leak',
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000097',
        eventType: 'message_request.declined.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000097', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[0]!.event).toBe('message_request:declined');

      const livePayload = emittedEvents[0]!.payload as any;
      expect(livePayload.requestId).toBe(requestId);
      expect(livePayload.declinedAt).toBe(declinedAt);
      expect(livePayload.reason).toBeUndefined();
    });

    it('dispatches message_request.cancelled.v1 to both user rooms', async () => {
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
      const cancelledAt = new Date().toISOString();
      const payload = {
        requestId,
        senderId,
        recipientId,
        cancelledAt,
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000096',
        eventType: 'message_request.cancelled.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000096', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[0]!.event).toBe('message_request:cancelled');
      const livePayload = emittedEvents[0]!.payload as any;
      expect(livePayload.requestId).toBe(requestId);
      expect(livePayload.cancelledAt).toBe(cancelledAt);
    });

    it('dispatches message_request.expired.v1 to both user rooms', async () => {
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
      const expiredAt = new Date().toISOString();
      const payload = {
        requestId,
        senderId,
        recipientId,
        expiredAt,
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000095',
        eventType: 'message_request.expired.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000095', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[0]!.event).toBe('message_request:expired');
      const livePayload = emittedEvents[0]!.payload as any;
      expect(livePayload.requestId).toBe(requestId);
      expect(livePayload.expiredAt).toBe(expiredAt);
    });

    it('rejects malformed message_request.created.v1 payload safely without emitting', async () => {
      const emitSpy = vi.fn();
      const fakeEmitter: SocketIoRoomEmitter = {
        to: () => ({ emit: emitSpy }),
      };

      const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
      const invalidPayload = {
        requestId: 'not-a-uuid',
        senderId,
        recipientId,
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000094',
        eventType: 'message_request.created.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload: invalidPayload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000094', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(false);
      expect(result.isTransient).toBe(false);
      expect(result.error).toContain('Invalid message_request.created.v1 payload schema');
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('suppresses realtime delivery when bidirectional block exists between sender and recipient', async () => {
      const emitSpy = vi.fn();
      const fakeEmitter: SocketIoRoomEmitter = {
        to: () => ({ emit: emitSpy }),
      };

      const mockPrisma = {
        userBlock: {
          findFirst: vi.fn().mockResolvedValue({
            id: '01912952-4a00-7000-8000-000000000099',
            blockerId: recipientId,
            blockedId: senderId,
          }),
        },
      } as any;

      const dispatcher = new SocketIoEventDispatcher({
        emitter: fakeEmitter,
        prisma: mockPrisma,
      });

      const payload = {
        requestId,
        senderId,
        recipientId,
        initialMessage: 'Hello there',
        expiresAt,
        createdAt,
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000093',
        eventType: 'message_request.created.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000093', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      // Suppressed delivery: socket emit was NOT invoked
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('handles transport failure as transient error for outbox retry', async () => {
      const fakeEmitter: SocketIoRoomEmitter = {
        to: () => ({
          emit: () => {
            throw new Error('Redis socket cluster connection timed out');
          },
        }),
      };

      const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
      const payload = {
        requestId,
        senderId,
        recipientId,
        initialMessage: 'Hello there',
        expiresAt,
        createdAt,
      };
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000092',
        eventType: 'message_request.created.v1',
        aggregateType: 'MessageRequest',
        aggregateId: requestId,
        payload,
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000092', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(false);
      expect(result.isTransient).toBe(true);
      expect(result.error).toContain('Redis socket cluster connection timed out');
    });
  });

  describe('Notification & External Event Passthrough (Milestone 2C.3)', () => {
    it('passes through notification-only events without attempting socket emission', async () => {
      const emitSpy = vi.fn();
      const fakeEmitter: SocketIoRoomEmitter = {
        to: () => ({ emit: emitSpy }),
      };

      const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000095',
        eventType: 'project.created.v1',
        aggregateType: 'Project',
        aggregateId: '01912952-4a00-7000-8000-000000000096',
        payload: {
          projectId: '01912952-4a00-7000-8000-000000000096',
          title: 'Brand Campaign',
        },
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000095', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('passes through block eviction events without attempting socket emission', async () => {
      const emitSpy = vi.fn();
      const fakeEmitter: SocketIoRoomEmitter = {
        to: () => ({ emit: emitSpy }),
      };

      const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000097',
        eventType: 'user.block.created.v1',
        aggregateType: 'UserBlock',
        aggregateId: '01912952-4a00-7000-8000-000000000098',
        payload: {
          blockerId: 'user-a',
          blockedId: 'user-b',
        },
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000097', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(true);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('rejects arbitrary unknown event types as terminal non-transient failures', async () => {
      const emitSpy = vi.fn();
      const fakeEmitter: SocketIoRoomEmitter = {
        to: () => ({ emit: emitSpy }),
      };

      const dispatcher = new SocketIoEventDispatcher({ emitter: fakeEmitter });
      const event: ClaimedOutboxEvent = {
        id: '01912952-4a00-7000-8000-000000000099',
        eventType: 'totally.unknown.event.v99',
        aggregateType: 'Unknown',
        aggregateId: '01912952-4a00-7000-8000-000000000100',
        payload: { foo: 'bar' },
        attempts: 1,
        createdAt: new Date(),
        claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000099', 1),
      };

      const result = await dispatcher.dispatch(event);

      expect(result.success).toBe(false);
      expect(result.isTransient).toBe(false);
      expect(result.error).toContain('Unsupported outbox event type: totally.unknown.event.v99');
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
