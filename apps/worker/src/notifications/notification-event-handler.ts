import type {
  ClaimedOutboxEvent,
  INotificationRepository,
  PrismaClient,
} from '@creatorconnect/database';
import { getPrismaClient, notificationRepository } from '@creatorconnect/database';
import {
  MessageCreatedV1PayloadSchema,
  type MessageCreatedV1Payload,
} from '@creatorconnect/contracts';
import { Value } from '@creatorconnect/validation';
import type { IEventDispatcher, DispatchResult } from '../outbox/event-dispatcher.js';
import type { Logger } from 'pino';

export interface NotificationEventHandlerOptions {
  prisma?: PrismaClient;
  notificationRepo?: INotificationRepository;
  logger?: Logger;
}

/**
 * Handles outbox domain events to create durable in-app notifications.
 *
 * Implements Increment 10B requirements:
 * 1. Validates event payload against authoritative schema.
 * 2. Authoritatively resolves recipient(s) from persisted conversation participants.
 * 3. Never trusts untrusted client input for recipient resolution.
 * 4. Excludes message sender from notification creation.
 * 5. Enforces account-status policy (suspended recipients are ineligible).
 * 6. Enforces user block policy (suppresses notifications between blocked peers).
 * 7. Evaluates user in-app notification preferences at event-processing time.
 * 8. Creates in-app notifications idempotently with event_id deduplication.
 * 9. Privacy-safe: stores only minimal event-derived references without raw message body or sensitive PII.
 * 10. Transient errors trigger outbox retries; invalid payloads fail terminally.
 */
export class NotificationEventHandler implements IEventDispatcher {
  private readonly prismaClient: PrismaClient | undefined;
  private readonly notificationRepo: INotificationRepository;
  private readonly logger: Logger | undefined;

  constructor(options?: NotificationEventHandlerOptions) {
    this.prismaClient = options?.prisma;
    this.notificationRepo = options?.notificationRepo || notificationRepository;
    this.logger = options?.logger;
  }

  private get prisma(): PrismaClient {
    return this.prismaClient || getPrismaClient();
  }

  async dispatch(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const eventType = event.eventType ?? (event as any).event_type;

    // Only handle supported event types; ignore other future event types safely
    if (eventType !== 'message.created.v1') {
      return { success: true };
    }

    // 1. Validate payload schema
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

    try {
      // 2. Authoritatively query active participants in the conversation
      const participants = await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId: payload.conversationId,
          leftAt: null,
        },
        select: {
          userId: true,
        },
      });

      // 3. Exclude the sender
      const recipientIds = participants
        .map((p) => p.userId)
        .filter((userId) => userId !== payload.senderId);

      if (recipientIds.length === 0) {
        this.logger?.debug(
          { eventId: event.id, conversationId: payload.conversationId },
          'No eligible recipients for message notification (sender only or empty conversation)',
        );
        return { success: true };
      }

      // 4. Process each eligible recipient
      for (const recipientId of recipientIds) {
        // 4a. Check recipient account status
        const recipient = await this.prisma.user.findUnique({
          where: { id: recipientId },
          select: { status: true },
        });

        if (!recipient || recipient.status === 'SUSPENDED') {
          this.logger?.info(
            { eventId: event.id, recipientId, status: recipient?.status },
            'Recipient ineligible for notification due to suspended or missing account status',
          );
          continue;
        }

        // 4b. Check block policy (mutual suppression)
        const isBlocked = await this.prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerId: recipientId, blockedId: payload.senderId },
              { blockerId: payload.senderId, blockedId: recipientId },
            ],
          },
        });

        if (isBlocked) {
          this.logger?.info(
            { eventId: event.id, recipientId, senderId: payload.senderId },
            'Notification suppressed due to active user block between peers',
          );
          continue;
        }

        // 4c. Check recipient in-app notification preference
        const isEnabled = await this.notificationRepo.isChannelEnabled(
          recipientId,
          'MESSAGE_RECEIVED',
          'IN_APP',
        );

        if (!isEnabled) {
          this.logger?.info(
            { eventId: event.id, recipientId },
            'Notification suppressed due to recipient preference disabling in-app message notifications',
          );
          continue;
        }

        // 4d. Create in-app notification idempotently with event_id
        await this.notificationRepo.createNotification({
          userId: recipientId,
          eventId: event.id,
          type: 'MESSAGE_RECEIVED',
          title: 'New Message',
          body: 'You received a new message.',
          data: {
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            senderId: payload.senderId,
          },
        });

        this.logger?.info(
          {
            eventId: event.id,
            recipientId,
            messageId: payload.messageId,
          },
          'Created in-app notification for message receipt',
        );
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger?.warn(
        {
          eventId: event.id,
          error: errorMessage,
        },
        'Transient failure processing notification event, will retry',
      );

      return {
        success: false,
        error: errorMessage,
        isTransient: true,
      };
    }
  }
}
