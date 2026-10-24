import type { ClaimedOutboxEvent, PrismaClient } from '@creatorconnect/database';
import {
  MessageCreatedV1PayloadSchema,
  type MessageCreatedV1Payload,
  MessageDeletedV1PayloadSchema,
  type MessageDeletedV1Payload,
  MessageUpdatedV1PayloadSchema,
  type MessageUpdatedV1Payload,
  MessageRequestCreatedV1PayloadSchema,
  type MessageRequestCreatedV1Payload,
  MessageRequestAcceptedV1PayloadSchema,
  type MessageRequestAcceptedV1Payload,
  MessageRequestDeclinedV1PayloadSchema,
  type MessageRequestDeclinedV1Payload,
  MessageRequestCancelledV1PayloadSchema,
  type MessageRequestCancelledV1Payload,
  MessageRequestExpiredV1PayloadSchema,
  type MessageRequestExpiredV1Payload,
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
 * Known domain event types that are handled by other dispatchers in the composite pipeline
 * (e.g. BlockEvictionDispatcher or NotificationEventHandler) and should safely pass through
 * SocketIoEventDispatcher without attempting realtime Socket.IO emission.
 */
export const SOCKET_IO_PASSTHROUGH_EVENT_TYPES = new Set<string>([
  'user.block.created.v1',
  'user.block.removed.v1',
  'project.created.v1',
  'project.deliverable.submitted.v1',
  'project.deliverable.approved.v1',
  'project.deliverable.revision_requested.v1',
  'escrow.released.v1',
  'dispute.opened.v1',
  'dispute.status_updated.v1',
  'dispute.resolved.v1',
  'cancellation.requested.v1',
  'cancellation.decided.v1',
  'review.created.v1',
  'review.reported.v1',
  'review.moderated.v1',
  'invitation.created.v1',
  'invitation.accepted.v1',
  'invitation.declined.v1',
  'invitation.withdrawn.v1',
]);

/**
 * Production-grade Socket.IO event dispatcher adapter for Transactional Outbox.
 * Fulfills Increment 8 & Increment 10C requirements:
 * 1. Preserves immutable event IDs, aggregate IDs, decimal-string sequences, and correlation metadata.
 * 2. Emits exclusively to authorized conversation room ('conversation:<id>'), never globally.
 * 3. Enforces authoritative bidirectional block verification prior to room fanout (Increment 10C).
 * 4. Validates event payload against versioned contract schema before fanout.
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

    if (
      eventType === 'message_request.created.v1' ||
      eventType === 'message_request.accepted.v1' ||
      eventType === 'message_request.declined.v1' ||
      eventType === 'message_request.cancelled.v1' ||
      eventType === 'message_request.expired.v1'
    ) {
      return this.dispatchMessageRequestEvent(event, eventType, aggregateId);
    }

    // 1. Verify event type support
    if (
      eventType !== 'message.created.v1' &&
      eventType !== 'message.deleted.v1' &&
      eventType !== 'message.updated.v1'
    ) {
      if (SOCKET_IO_PASSTHROUGH_EVENT_TYPES.has(eventType)) {
        return { success: true };
      }
      return {
        success: false,
        error: `Unsupported outbox event type: ${eventType}`,
        isTransient: false,
      };
    }

    let room: string;
    let socketEvent: string;
    let livePayload: Record<string, unknown>;
    let actorId: string;
    let conversationId: string;

    if (eventType === 'message.created.v1') {
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
      conversationId = payload.conversationId;
      actorId = payload.senderId;
      room = `conversation:${payload.conversationId}`;
      socketEvent = 'message:created';
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        sequence: payload.sequence,
        clientMessageId: payload.clientMessageId,
        content: payload.content,
        attachmentCount: payload.attachmentCount,
        createdAt: payload.createdAt,
      };
    } else if (eventType === 'message.deleted.v1') {
      if (!Value.Check(MessageDeletedV1PayloadSchema, event.payload)) {
        const errors = Array.from(Value.Errors(MessageDeletedV1PayloadSchema, event.payload));
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid message.deleted.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }
      const payload = event.payload as MessageDeletedV1Payload;
      conversationId = payload.conversationId;
      actorId = payload.deletedBy;
      room = `conversation:${payload.conversationId}`;
      socketEvent = 'message:deleted';
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        deletedBy: payload.deletedBy,
        sequence: payload.sequence,
        deletedAt: payload.deletedAt,
      };
    } else {
      // message.updated.v1
      if (!Value.Check(MessageUpdatedV1PayloadSchema, event.payload)) {
        const errors = Array.from(Value.Errors(MessageUpdatedV1PayloadSchema, event.payload));
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid message.updated.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }
      const payload = event.payload as MessageUpdatedV1Payload;
      conversationId = payload.conversationId;
      actorId = payload.senderId;
      room = `conversation:${payload.conversationId}`;
      socketEvent = 'message:updated';
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        sequence: payload.sequence,
        content: payload.content,
        updatedAt: payload.updatedAt,
      };
    }

    // 2. Authoritative bidirectional block verification
    if (this.prisma) {
      const otherParticipants = await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { not: actorId },
          leftAt: null,
        },
        select: { userId: true },
      });

      for (const other of otherParticipants) {
        const isBlocked = await this.prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerId: actorId, blockedId: other.userId },
              { blockerId: other.userId, blockedId: actorId },
            ],
          },
        });

        if (isBlocked) {
          if (this.logger) {
            this.logger.warn(
              {
                eventId: event.id,
                conversationId,
                actorId,
                recipientId: other.userId,
              },
              'Protected realtime message delivery suppressed due to active bidirectional block',
            );
          }
          return { success: true };
        }
      }
    }

    // 3. Emit to conversation room through Socket.IO / Redis adapter
    try {
      const emitResult = this.emitter.to(room).emit(socketEvent, livePayload);
      if (emitResult && typeof (emitResult as Promise<unknown>).then === 'function') {
        await emitResult;
      }

      if (this.logger) {
        this.logger.debug(
          {
            eventId: event.id,
            conversationId,
            socketEvent,
            room,
          },
          `Successfully dispatched ${eventType} to Socket.IO room`,
        );
      }

      return { success: true };
    } catch (err: any) {
      if (this.logger) {
        this.logger.warn(
          {
            eventId: event.id,
            conversationId,
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

  private async dispatchMessageRequestEvent(
    event: ClaimedOutboxEvent,
    eventType: string,
    aggregateId: string,
  ): Promise<DispatchResult> {
    let socketEvent: string;
    let livePayload: Record<string, unknown>;
    let targetRooms: string[];
    let senderId: string;
    let recipientId: string;
    let requestId: string;

    if (eventType === 'message_request.created.v1') {
      if (!Value.Check(MessageRequestCreatedV1PayloadSchema, event.payload)) {
        const errors = Array.from(
          Value.Errors(MessageRequestCreatedV1PayloadSchema, event.payload),
        );
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid message_request.created.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }
      const payload = event.payload as MessageRequestCreatedV1Payload;
      requestId = payload.requestId;
      senderId = payload.senderId;
      recipientId = payload.recipientId;
      socketEvent = 'message_request:created';
      // Deliver to recipient's private user room
      targetRooms = [`user:${payload.recipientId}`];
      // CRITICAL PRIVACY: Do NOT leak initialMessage into realtime notification!
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        requestId: payload.requestId,
        senderId: payload.senderId,
        recipientId: payload.recipientId,
        expiresAt: payload.expiresAt,
        createdAt: payload.createdAt,
      };
    } else if (eventType === 'message_request.accepted.v1') {
      if (!Value.Check(MessageRequestAcceptedV1PayloadSchema, event.payload)) {
        const errors = Array.from(
          Value.Errors(MessageRequestAcceptedV1PayloadSchema, event.payload),
        );
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid message_request.accepted.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }
      const payload = event.payload as MessageRequestAcceptedV1Payload;
      requestId = payload.requestId;
      senderId = payload.senderId;
      recipientId = payload.recipientId;
      socketEvent = 'message_request:accepted';
      // Deliver to both sender and recipient private user rooms
      targetRooms = [`user:${payload.senderId}`, `user:${payload.recipientId}`];
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        requestId: payload.requestId,
        senderId: payload.senderId,
        recipientId: payload.recipientId,
        conversationId: payload.conversationId,
        acceptedAt: payload.acceptedAt,
      };
    } else if (eventType === 'message_request.declined.v1') {
      if (!Value.Check(MessageRequestDeclinedV1PayloadSchema, event.payload)) {
        const errors = Array.from(
          Value.Errors(MessageRequestDeclinedV1PayloadSchema, event.payload),
        );
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid message_request.declined.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }
      const payload = event.payload as MessageRequestDeclinedV1Payload;
      requestId = payload.requestId;
      senderId = payload.senderId;
      recipientId = payload.recipientId;
      socketEvent = 'message_request:declined';
      targetRooms = [`user:${payload.senderId}`, `user:${payload.recipientId}`];
      // Do not leak decline reason into notification payloads
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        requestId: payload.requestId,
        senderId: payload.senderId,
        recipientId: payload.recipientId,
        declinedAt: payload.declinedAt,
      };
    } else if (eventType === 'message_request.cancelled.v1') {
      if (!Value.Check(MessageRequestCancelledV1PayloadSchema, event.payload)) {
        const errors = Array.from(
          Value.Errors(MessageRequestCancelledV1PayloadSchema, event.payload),
        );
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid message_request.cancelled.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }
      const payload = event.payload as MessageRequestCancelledV1Payload;
      requestId = payload.requestId;
      senderId = payload.senderId;
      recipientId = payload.recipientId;
      socketEvent = 'message_request:cancelled';
      targetRooms = [`user:${payload.recipientId}`, `user:${payload.senderId}`];
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        requestId: payload.requestId,
        senderId: payload.senderId,
        recipientId: payload.recipientId,
        cancelledAt: payload.cancelledAt,
      };
    } else {
      // message_request.expired.v1
      if (!Value.Check(MessageRequestExpiredV1PayloadSchema, event.payload)) {
        const errors = Array.from(
          Value.Errors(MessageRequestExpiredV1PayloadSchema, event.payload),
        );
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid message_request.expired.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }
      const payload = event.payload as MessageRequestExpiredV1Payload;
      requestId = payload.requestId;
      senderId = payload.senderId;
      recipientId = payload.recipientId;
      socketEvent = 'message_request:expired';
      targetRooms = [`user:${payload.senderId}`, `user:${payload.recipientId}`];
      livePayload = {
        eventId: event.id,
        eventType,
        aggregateId,
        requestId: payload.requestId,
        senderId: payload.senderId,
        recipientId: payload.recipientId,
        expiredAt: payload.expiredAt,
      };
    }

    // Authoritative bidirectional block verification
    if (this.prisma) {
      const isBlocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedId: recipientId },
            { blockerId: recipientId, blockedId: senderId },
          ],
        },
      });

      if (isBlocked) {
        if (this.logger) {
          this.logger.warn(
            {
              eventId: event.id,
              requestId,
              senderId,
              recipientId,
            },
            'Protected message request realtime delivery suppressed due to active bidirectional block',
          );
        }
        return { success: true };
      }
    }

    // Emit to authorized private user rooms ('user:<userId>')
    try {
      const distinctRooms = Array.from(new Set(targetRooms));
      for (const room of distinctRooms) {
        const emitResult = this.emitter.to(room).emit(socketEvent, livePayload);
        if (emitResult && typeof (emitResult as Promise<unknown>).then === 'function') {
          await emitResult;
        }
      }

      if (this.logger) {
        this.logger.debug(
          {
            eventId: event.id,
            requestId,
            socketEvent,
            rooms: distinctRooms,
          },
          `Successfully dispatched ${eventType} to Socket.IO user rooms`,
        );
      }

      return { success: true };
    } catch (err: any) {
      if (this.logger) {
        this.logger.warn(
          {
            eventId: event.id,
            requestId,
            error: err?.message,
          },
          'Socket.IO user room dispatch failed (transient transport error)',
        );
      }

      return {
        success: false,
        error: err?.message || 'Socket.IO user room transport dispatch failed',
        isTransient: true,
      };
    }
  }
}
