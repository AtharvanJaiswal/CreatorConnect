import type { Emitter } from '@socket.io/redis-emitter';
import type { PrismaClient, IConversationAuthorizationService } from '@creatorconnect/database';
import { getPrismaClient, conversationAuthorizationService } from '@creatorconnect/database';
import type { Logger } from 'pino';
import type { IBlockEvictionService } from './block-eviction-dispatcher.js';

export interface RedisBlockEvictionOptions {
  emitter: Emitter;
  prisma?: PrismaClient | undefined;
  authService?: IConversationAuthorizationService | undefined;
  logger?: Logger | undefined;
}

/**
 * Production-grade Redis-backed Block Eviction Service for background workers.
 * Uses @socket.io/redis-emitter to publish cross-node room eviction and notification commands
 * across all connected Socket.IO instances running in the cluster.
 *
 * Invariants:
 * 1. Derives rooms authoritatively from PostgreSQL active conversation membership.
 * 2. Emits socketsLeave for both users from shared conversation rooms across all cluster nodes.
 * 3. Broadcasts minimal, non-sensitive 'conversation:blocked' notifications to affected user rooms.
 * 4. Safe against empty conversations, missing peers, or concurrent database updates.
 */
export class RedisBlockEvictionService implements IBlockEvictionService {
  private readonly emitter: Emitter;
  private readonly prismaClient?: PrismaClient | undefined;
  private readonly authServiceInstance?: IConversationAuthorizationService | undefined;
  private readonly logger?: Logger | undefined;

  constructor(options: RedisBlockEvictionOptions) {
    this.emitter = options.emitter;
    this.prismaClient = options.prisma;
    this.authServiceInstance = options.authService;
    this.logger = options.logger;
  }

  private get prisma(): PrismaClient {
    return this.prismaClient || getPrismaClient();
  }

  async evictBlockedPair(
    userA: string,
    userB: string,
  ): Promise<{
    success: boolean;
    evictedRooms: string[];
    sharedConversationsCount: number;
  }> {
    const startTime = Date.now();

    // 1. Authoritative bidirectional block verification
    // Ensures stale or duplicate block events dispatched after an unblock are safe no-ops
    const isBlocked = this.authServiceInstance
      ? await this.authServiceInstance.isBlocked(userA, userB)
      : this.prismaClient
        ? Boolean(
            await this.prisma.userBlock.findFirst({
              where: {
                OR: [
                  { blockerId: userA, blockedId: userB },
                  { blockerId: userB, blockedId: userA },
                ],
              },
              select: { id: true },
            }),
          )
        : await conversationAuthorizationService.isBlocked(userA, userB);

    if (!isBlocked) {
      this.logger?.info(
        { userA, userB },
        'Skipping block eviction: no active bidirectional block found in database (block removed or stale event)',
      );
      return {
        success: true,
        evictedRooms: [],
        sharedConversationsCount: 0,
      };
    }

    // 2. Authoritatively resolve all active, non-deleted shared conversations
    const sharedConversations = await this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        AND: [
          { participants: { some: { userId: userA, leftAt: null } } },
          { participants: { some: { userId: userB, leftAt: null } } },
        ],
      },
      select: {
        id: true,
        type: true,
      },
    });

    const evictedRooms: string[] = [];

    // 2. Broadcast room eviction commands and block notifications via Redis emitter
    for (const conv of sharedConversations) {
      const roomName = `conversation:${conv.id}`;
      evictedRooms.push(roomName);

      // Instruct all Socket.IO instances across cluster to evict userA and userB sockets from room
      this.emitter.in(`user:${userA}`).socketsLeave(roomName);
      this.emitter.in(`user:${userB}`).socketsLeave(roomName);

      // Emit minimal, non-sensitive notification to both users
      this.emitter.to(`user:${userA}`).emit('conversation:blocked', { conversationId: conv.id });
      this.emitter.to(`user:${userB}`).emit('conversation:blocked', { conversationId: conv.id });
    }

    const durationMs = Date.now() - startTime;
    this.logger?.info(
      {
        userA,
        userB,
        sharedConversationsCount: sharedConversations.length,
        evictedRoomsCount: evictedRooms.length,
        durationMs,
      },
      'Broadcasted cluster-wide block eviction for user pair via Redis emitter',
    );

    return {
      success: true,
      evictedRooms,
      sharedConversationsCount: sharedConversations.length,
    };
  }
}
