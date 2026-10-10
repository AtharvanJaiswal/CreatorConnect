import type { ClaimedOutboxEvent } from '@creatorconnect/database';
import {
  UserBlockCreatedV1PayloadSchema,
  UserBlockRemovedV1PayloadSchema,
  type UserBlockCreatedV1Payload,
  type UserBlockRemovedV1Payload,
} from '@creatorconnect/contracts';
import { Value } from '@creatorconnect/validation';
import type { IEventDispatcher, DispatchResult } from './event-dispatcher.js';
import type { Logger } from 'pino';

export interface IBlockEvictionService {
  evictBlockedPair(
    userA: string,
    userB: string,
  ): Promise<{
    success: boolean;
    evictedRooms?: string[];
    sharedConversationsCount?: number;
  }>;
}

export interface BlockEvictionDispatcherOptions {
  evictionService?: IBlockEvictionService | undefined;
  logger?: Logger | undefined;
}

/**
 * Production-grade outbox event dispatcher for user block events.
 * Handles 'user.block.created.v1' by evicting the blocked pair's active sockets from shared rooms.
 * Handles 'user.block.removed.v1' idempotently without restoring stale room memberships.
 * Returns success for other event types to allow composite dispatcher chaining.
 */
export class BlockEvictionDispatcher implements IEventDispatcher {
  private readonly evictionService: IBlockEvictionService | undefined;
  private readonly logger: Logger | undefined;

  constructor(options?: BlockEvictionDispatcherOptions) {
    this.evictionService = options?.evictionService;
    this.logger = options?.logger;
  }

  async dispatch(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const eventType = event.eventType ?? (event as any).event_type;

    // Handle user.block.created.v1
    if (eventType === 'user.block.created.v1') {
      if (!Value.Check(UserBlockCreatedV1PayloadSchema, event.payload)) {
        const errors = Array.from(Value.Errors(UserBlockCreatedV1PayloadSchema, event.payload));
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid user.block.created.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }

      const payload = event.payload as UserBlockCreatedV1Payload;

      try {
        if (this.evictionService) {
          await this.evictionService.evictBlockedPair(payload.blockerId, payload.blockedId);
        }

        if (this.logger) {
          this.logger.info(
            {
              eventId: event.id,
              blockerId: payload.blockerId,
              blockedId: payload.blockedId,
            },
            'Successfully processed user.block.created.v1 active socket eviction',
          );
        }

        return { success: true };
      } catch (err: any) {
        if (this.logger) {
          this.logger.warn(
            {
              eventId: event.id,
              blockerId: payload.blockerId,
              blockedId: payload.blockedId,
              error: err?.message,
            },
            'Block eviction failed (transient transport/database error)',
          );
        }

        return {
          success: false,
          error: err?.message || 'Block eviction failed',
          isTransient: true,
        };
      }
    }

    // Handle user.block.removed.v1
    if (eventType === 'user.block.removed.v1') {
      if (!Value.Check(UserBlockRemovedV1PayloadSchema, event.payload)) {
        const errors = Array.from(Value.Errors(UserBlockRemovedV1PayloadSchema, event.payload));
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
        return {
          success: false,
          error: `Invalid user.block.removed.v1 payload schema: ${errorDetail}`,
          isTransient: false,
        };
      }

      const payload = event.payload as UserBlockRemovedV1Payload;

      // Specification: When A unblocks B, do NOT automatically restore old room memberships.
      // Require normal authentication and fresh conversation authorization upon next room join.
      if (this.logger) {
        this.logger.info(
          {
            eventId: event.id,
            blockerId: payload.blockerId,
            blockedId: payload.blockedId,
          },
          'Successfully processed user.block.removed.v1 (no-op on socket room memberships)',
        );
      }

      return { success: true };
    }

    // Pass through other event types safely
    return { success: true };
  }
}
