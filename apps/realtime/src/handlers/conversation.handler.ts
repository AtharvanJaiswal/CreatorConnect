import type { Socket, Server as SocketIOServer } from 'socket.io';
import type { PrismaClient } from '@creatorconnect/database';
import {
  conversationAuthorizationService,
  type ConversationAuthorizationService,
  messagingRepository,
  type IMessagingRepository,
  getPrismaClient,
} from '@creatorconnect/database';
import type { Logger } from 'pino';

export interface ConversationHandlerOptions {
  authService?: ConversationAuthorizationService | undefined;
  messagingRepo?: IMessagingRepository | undefined;
  prisma?: PrismaClient | undefined;
  logger?: Logger | undefined;
}

export interface JoinRoomPayload {
  conversationId: string;
}

export interface LeaveRoomPayload {
  conversationId: string;
}

export interface SyncRoomPayload {
  conversationId: string;
  sinceSequence: string;
}

export interface RoomAckResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Registers conversation room management events on an authenticated socket.
 * Enforces strict authorization via ConversationAuthorizationService and bidirectional block policy.
 */
export function registerConversationHandlers(
  socket: Socket,
  _io: SocketIOServer,
  options: ConversationHandlerOptions = {},
) {
  const authService = options.authService || conversationAuthorizationService;
  const repo = options.messagingRepo || messagingRepository;
  const prisma = options.prisma || getPrismaClient();
  const logger = options.logger;

  const user = socket.data.user;
  if (!user || !user.id) {
    // Sockets without authenticated user data cannot register room handlers
    return;
  }

  const userId = user.id;

  /**
   * Handle joining a conversation room.
   */
  socket.on(
    'conversation:join',
    async (payload: unknown, ack?: (res: RoomAckResponse<{ conversationId: string }>) => void) => {
      try {
        if (!payload || typeof payload !== 'object' || !('conversationId' in payload)) {
          const res = {
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Missing conversationId in payload.' },
          };
          if (typeof ack === 'function') ack(res);
          return;
        }

        const conversationId = (payload as JoinRoomPayload).conversationId;
        if (
          !conversationId ||
          typeof conversationId !== 'string' ||
          !UUID_REGEX.test(conversationId)
        ) {
          const res = {
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Invalid conversationId UUID format.' },
          };
          if (typeof ack === 'function') ack(res);
          return;
        }

        // 1. Authorize active participant status (Anti-enumeration: non-participants get NOT_FOUND)
        try {
          await authService.assertCanAccessConversation(conversationId, userId);
        } catch {
          const res = {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Conversation not found or access denied.',
            },
          };
          if (typeof ack === 'function') ack(res);
          return;
        }

        // 2. Authorize bidirectional block policy with all other participants
        const otherParticipants = await prisma.conversationParticipant.findMany({
          where: {
            conversationId,
            userId: { not: userId },
            leftAt: null,
          },
          select: { userId: true },
        });

        for (const other of otherParticipants) {
          const blocked = await authService.isBlocked(userId, other.userId);
          if (blocked) {
            const res = {
              success: false,
              error: {
                code: 'USER_BLOCKED',
                message: 'Cannot join room: conversation is blocked.',
              },
            };
            if (typeof ack === 'function') ack(res);
            return;
          }
        }

        // 3. Authorized — Join the Socket.IO room
        const roomName = `conversation:${conversationId}`;
        await socket.join(roomName);

        if (logger) {
          logger.info(
            { socketId: socket.id, userId, conversationId },
            'Socket joined conversation room',
          );
        }

        const res = {
          success: true,
          data: { conversationId },
        };
        if (typeof ack === 'function') ack(res);
      } catch (err: any) {
        if (logger) {
          logger.error(
            { socketId: socket.id, err: err?.message },
            'Error joining conversation room',
          );
        }
        const res = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to join conversation room.' },
        };
        if (typeof ack === 'function') ack(res);
      }
    },
  );

  /**
   * Handle leaving a conversation room. Safe and idempotent.
   */
  socket.on(
    'conversation:leave',
    async (payload: unknown, ack?: (res: RoomAckResponse<{ conversationId: string }>) => void) => {
      try {
        if (!payload || typeof payload !== 'object' || !('conversationId' in payload)) {
          const res = {
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Missing conversationId in payload.' },
          };
          if (typeof ack === 'function') ack(res);
          return;
        }

        const conversationId = (payload as LeaveRoomPayload).conversationId;
        const roomName = `conversation:${conversationId}`;
        await socket.leave(roomName);

        if (logger) {
          logger.info(
            { socketId: socket.id, userId, conversationId },
            'Socket left conversation room',
          );
        }

        const res = {
          success: true,
          data: { conversationId },
        };
        if (typeof ack === 'function') ack(res);
      } catch (err: any) {
        const res = {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to leave conversation room.' },
        };
        if (typeof ack === 'function') ack(res);
      }
    },
  );

  /**
   * Handle conversation message sync for reconnecting clients.
   */
  socket.on(
    'conversation:sync',
    async (
      payload: unknown,
      ack?: (res: RoomAckResponse<{ messages: any[]; latestSequence: string }>) => void,
    ) => {
      try {
        if (!payload || typeof payload !== 'object') {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: { code: 'BAD_REQUEST', message: 'Invalid sync payload.' },
            });
          }
          return;
        }

        const { conversationId, sinceSequence } = payload as SyncRoomPayload;
        if (!conversationId || typeof conversationId !== 'string') {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: { code: 'BAD_REQUEST', message: 'Missing conversationId.' },
            });
          }
          return;
        }

        // Verify participation
        try {
          await authService.assertCanAccessConversation(conversationId, userId);
        } catch {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: { code: 'NOT_FOUND', message: 'Conversation not found or access denied.' },
            });
          }
          return;
        }

        // Authorize bidirectional block policy with all other active participants
        const otherParticipants = await prisma.conversationParticipant.findMany({
          where: {
            conversationId,
            userId: { not: userId },
            leftAt: null,
          },
          select: { userId: true },
        });

        for (const other of otherParticipants) {
          const blocked = await authService.isBlocked(userId, other.userId);
          if (blocked) {
            if (typeof ack === 'function') {
              ack({
                success: false,
                error: {
                  code: 'USER_BLOCKED',
                  message: 'Cannot sync: conversation is blocked.',
                },
              });
            }
            return;
          }
        }

        const sinceBigInt = sinceSequence ? BigInt(sinceSequence) : BigInt(0);

        const messages = await prisma.message.findMany({
          where: {
            conversationId,
            sequence: { gt: sinceBigInt },
            deletedAt: null,
          },
          orderBy: { sequence: 'asc' },
          take: 100,
          include: {
            attachments: {
              include: {
                mediaAsset: true,
              },
            },
          },
        });

        const serializedMessages = messages.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          sequence: m.sequence.toString(),
          clientMessageId: m.clientMessageId,
          content: m.content,
          attachmentCount: m.attachments.length,
          createdAt: m.createdAt.toISOString(),
          attachments: m.attachments.map((a) => ({
            id: a.id,
            mediaAssetId: a.mediaAssetId,
            fileName: a.mediaAsset?.originalName || '',
            fileSize: a.mediaAsset?.byteSize || 0,
            mimeType: a.mediaAsset?.mimeType || '',
          })),
        }));

        const latestSeq =
          messages.length > 0
            ? messages[messages.length - 1]!.sequence.toString()
            : sinceSequence || '0';

        if (typeof ack === 'function') {
          ack({
            success: true,
            data: {
              messages: serializedMessages,
              latestSequence: latestSeq,
            },
          });
        }
      } catch (err: any) {
        if (typeof ack === 'function') {
          ack({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Sync failed.' },
          });
        }
      }
    },
  );

  /**
   * Handle sending a message in a conversation via Socket.IO.
   */
  socket.on('message:send', async (payload: unknown, ack?: (res: RoomAckResponse<any>) => void) => {
    try {
      if (!payload || typeof payload !== 'object') {
        if (typeof ack === 'function') {
          ack({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid payload.' } });
        }
        return;
      }

      const { conversationId, clientMessageId, content, mediaAssetIds } = payload as any;
      if (
        !conversationId ||
        typeof conversationId !== 'string' ||
        !UUID_REGEX.test(conversationId) ||
        !clientMessageId ||
        typeof clientMessageId !== 'string'
      ) {
        if (typeof ack === 'function') {
          ack({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Invalid conversationId or clientMessageId.' },
          });
        }
        return;
      }

      if (
        !content ||
        typeof content !== 'string' ||
        content.trim().length === 0 ||
        content.length > 5000
      ) {
        if (typeof ack === 'function') {
          ack({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Message content must be 1-5000 characters.' },
          });
        }
        return;
      }

      // 1. Authorize sender
      try {
        await authService.assertCanSendMessage(conversationId, userId);
      } catch (authErr: any) {
        const code = authErr?.statusCode === 403 ? 'USER_BLOCKED' : 'FORBIDDEN';
        if (typeof ack === 'function') {
          ack({
            success: false,
            error: { code, message: authErr?.message || 'Permission denied.' },
          });
        }
        return;
      }

      // 2. Persist message with client-side idempotency
      const sent = await repo.sendMessage({
        conversationId,
        senderId: userId,
        clientMessageId,
        content,
        ...(Array.isArray(mediaAssetIds) ? { mediaAssetIds } : {}),
      });

      if (logger) {
        logger.info(
          {
            socketId: socket.id,
            userId,
            conversationId,
            messageId: sent.id,
            sequence: sent.sequence,
          },
          'Message sent via socket',
        );
      }

      if (typeof ack === 'function') {
        ack({ success: true, data: sent });
      }
    } catch (err: any) {
      if (logger) {
        logger.error(
          { socketId: socket.id, err: err?.message },
          'Failed to send message via socket',
        );
      }
      if (typeof ack === 'function') {
        ack({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to send message.' },
        });
      }
    }
  });

  /**
   * Handle delivery receipt acknowledgement via Socket.IO.
   */
  socket.on(
    'message:delivered',
    async (payload: unknown, ack?: (res: RoomAckResponse<any>) => void) => {
      try {
        if (!payload || typeof payload !== 'object') {
          if (typeof ack === 'function') {
            ack({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid payload.' } });
          }
          return;
        }

        const { conversationId, sequence } = payload as any;
        if (
          !conversationId ||
          typeof conversationId !== 'string' ||
          !UUID_REGEX.test(conversationId) ||
          !sequence ||
          !/^[0-9]+$/.test(String(sequence))
        ) {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: { code: 'BAD_REQUEST', message: 'Invalid conversationId or sequence.' },
            });
          }
          return;
        }

        try {
          await authService.assertCanAccessConversation(conversationId, userId);
        } catch {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
            });
          }
          return;
        }

        const res = await repo.markConversationDelivered(conversationId, userId, String(sequence));

        // Broadcast delivery receipt to the room
        const roomName = `conversation:${conversationId}`;
        socket.to(roomName).emit('message:delivered', {
          conversationId,
          userId,
          sequence: res.lastDeliveredSequence,
          deliveredAt: res.updatedAt,
        });

        if (typeof ack === 'function') {
          ack({ success: true, data: res });
        }
      } catch (err: any) {
        if (typeof ack === 'function') {
          ack({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to record delivery.' },
          });
        }
      }
    },
  );

  /**
   * Handle read receipt acknowledgement via Socket.IO.
   */
  socket.on('message:read', async (payload: unknown, ack?: (res: RoomAckResponse<any>) => void) => {
    try {
      if (!payload || typeof payload !== 'object') {
        if (typeof ack === 'function') {
          ack({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid payload.' } });
        }
        return;
      }

      const { conversationId, sequence } = payload as any;
      if (
        !conversationId ||
        typeof conversationId !== 'string' ||
        !UUID_REGEX.test(conversationId) ||
        !sequence ||
        !/^[0-9]+$/.test(String(sequence))
      ) {
        if (typeof ack === 'function') {
          ack({
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Invalid conversationId or sequence.' },
          });
        }
        return;
      }

      try {
        await authService.assertCanAccessConversation(conversationId, userId);
      } catch {
        if (typeof ack === 'function') {
          ack({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
        }
        return;
      }

      const res = await repo.markConversationRead(conversationId, userId, String(sequence));

      // Broadcast read receipt to the room
      const roomName = `conversation:${conversationId}`;
      socket.to(roomName).emit('message:read', {
        conversationId,
        userId,
        sequence: res.lastReadSequence,
        readAt: res.updatedAt,
      });

      if (typeof ack === 'function') {
        ack({ success: true, data: res });
      }
    } catch (err: any) {
      if (typeof ack === 'function') {
        ack({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to record read.' },
        });
      }
    }
  });

  /**
   * Handle ephemeral typing indicators via Socket.IO.
   */
  socket.on(
    'conversation:typing',
    async (payload: unknown, ack?: (res: RoomAckResponse<any>) => void) => {
      try {
        if (!payload || typeof payload !== 'object') {
          if (typeof ack === 'function') {
            ack({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid payload.' } });
          }
          return;
        }

        const { conversationId, isTyping } = payload as any;
        if (
          !conversationId ||
          typeof conversationId !== 'string' ||
          !UUID_REGEX.test(conversationId)
        ) {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: { code: 'BAD_REQUEST', message: 'Invalid conversationId.' },
            });
          }
          return;
        }

        try {
          await authService.assertCanAccessConversation(conversationId, userId);
        } catch {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: { code: 'NOT_FOUND', message: 'Conversation not found.' },
            });
          }
          return;
        }

        const roomName = `conversation:${conversationId}`;
        socket.to(roomName).emit('conversation:typing', {
          conversationId,
          userId,
          isTyping: Boolean(isTyping),
          timestamp: new Date().toISOString(),
        });

        if (typeof ack === 'function') {
          ack({ success: true, data: { conversationId, isTyping: Boolean(isTyping) } });
        }
      } catch (err: any) {
        if (typeof ack === 'function') {
          ack({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to emit typing.' },
          });
        }
      }
    },
  );
}
