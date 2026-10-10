import type { ClaimedOutboxEvent, PrismaClient } from '@creatorconnect/database';
import {
  MessageCreatedV1PayloadSchema,
  type MessageCreatedV1Payload,
} from '@creatorconnect/contracts';
import { Value } from '@creatorconnect/validation';
import type { IEventDispatcher, DispatchResult } from './event-dispatcher.js';
import type { Logger } from 'pino';

/**
 * Minimal abstraction for any Socket.IO room emitter (Server, Namespace, BroadcastOperator, or Fake).
 */
export interface SocketIoRoomEmitter {
  to(room: string): {
    emit(event: string, ...args: unknown[]): boolean | void | Promise<unknown>;
  };
}

export interface SocketIoEventDispatcherOptions {
  emitter: SocketIoRoomEmitter;
  prisma?: PrismaClient | undefined;
  logger?: Logger | undefined;
}

/**
 * Production-grade Socket.IO event dispatcher adapter for Transactional Outbox.
 * Fulfills Increment 8 & Increment 10C requirements:
 * 1. Preserves immutable event IDs, aggregate IDs, decimal-string sequences, and correlation metadata.
 * 2. Emits exclusively to authorized conversation room ('conversation:<id>'), never globally.
 * 3. Enforces authoritative bidirectional block verification prior to room fanout (Increment 10C).
 * 4. Validates event payload against MessageCreatedV1PayloadSchema before fanout.
 * 5. Catches Redis adapter/transport errors and classifies them as transient for outbox retry.
 * 6. Does not mark events published independently of outbox processor.
 */
export class SocketIoEventDispatcher implements IEventDispatcher {
  private readonly emitter: SocketIoRoomEmitter;
  private readonly prisma: PrismaClient | undefined;
  private readonly logger: Logger | undefined;

  constructor(options: SocketIoEventDispatcherOptions) {
    this.emitter = options.emitter;
    this.prisma = options.prisma;
    this.logger = options.logger;
  }

  async dispatch(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const eventType = event.eventType ?? (event as any).event_type;
    const aggregateId = event.aggregateId ?? (event as any).aggregate_id;

    // 1. Verify event type support
    if (eventType !== 'message.created.v1') {
      if (eventType === 'user.block.created.v1' || eventType === 'user.block.removed.v1') {
        return { success: true };
      }
      return {
        success: false,
        error: `Unsupported outbox event type: ${eventType}`,
        isTransient: false,
      };
    }

    // 2. Validate payload conforms to versioned contract schema
    if (!Value.Check(MessageCreatedV1PayloadSchema, event.payload)) {
      const errors = Array.from(Value.Errors(MessageCreatedV1PayloadSchema, event.payload));
      const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
      return {
        success: false,
        error: `Invalid message.created.v1 payload schema: ${errorDetail}`,
        isTransient: false,
      };
    }

    const payload = event.payload as MessageCreatedV1Payload;
    const room = `conversation:${payload.conversationId}`;

    // 3. Authoritative bidirectional block verification (Increment 10C)
    // Ensures racy messages created before block commit are never delivered to blocked peers
    if (this.prisma) {
      const otherParticipants = await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId: payload.conversationId,
          userId: { not: payload.senderId },
          leftAt: null,
        },
        select: { userId: true },
      });

      for (const other of otherParticipants) {
        const isBlocked = await this.prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerId: payload.senderId, blockedId: other.userId },
              { blockerId: other.userId, blockedId: payload.senderId },
            ],
          },
        });

        if (isBlocked) {
          if (this.logger) {
            this.logger.warn(
              {
                eventId: event.id,
                conversationId: payload.conversationId,
                senderId: payload.senderId,
                recipientId: other.userId,
              },
              'Protected realtime message delivery suppressed due to active bidirectional block',
            );
          }
          // Fulfill outbox delivery safely without delivering to blocked peer
          return { success: true };
        }
      }
    }

    // 4. Construct live fanout envelope preserving contract metadata
    const livePayload = {
      eventId: event.id,
      eventType,
      aggregateId,
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      sequence: payload.sequence, // decimal string
      clientMessageId: payload.clientMessageId,
      content: payload.content,
      attachmentCount: payload.attachmentCount,
      createdAt: payload.createdAt,
    };

    // 5. Emit to conversation room through Socket.IO / Redis adapter
    try {
      const emitResult = this.emitter.to(room).emit('message:created', livePayload);
      if (emitResult && typeof (emitResult as Promise<unknown>).then === 'function') {
        await emitResult;
      }

      if (this.logger) {
        this.logger.debug(
          {
            eventId: event.id,
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            sequence: payload.sequence,
            room,
          },
          'Successfully dispatched message.created.v1 to Socket.IO room',
        );
      }

      return { success: true };
    } catch (err: any) {
      if (this.logger) {
        this.logger.warn(
          {
            eventId: event.id,
            conversationId: payload.conversationId,
            error: err?.message,
          },
          'Socket.IO room dispatch failed (transient transport error)',
        );
      }

      return {
        success: false,
        error: err?.message || 'Socket.IO transport dispatch failed',
        isTransient: true,
      };
    }
  }
}
