import type { Server as SocketIOServer } from 'socket.io';
import type { PrismaClient } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import type { Logger } from 'pino';

export interface BlockEvictionOptions {
  io: SocketIOServer;
  prisma?: PrismaClient | undefined;
  logger?: Logger | undefined;
}

export interface BlockEvictionResult {
  success: boolean;
  userA: string;
  userB: string;
  evictedRooms: string[];
  sharedConversationsCount: number;
}

/**
 * Service responsible for evicting active Socket.IO connections from protected conversation rooms
 * when a user block is created between two participants.
 *
 * Security Invariants:
 * 1. Derives rooms exclusively from authoritative PostgreSQL conversation membership.
 * 2. Evicts all active sockets of the blocked pair across all connected tabs/devices via user rooms ('user:<id>').
 * 3. Works seamlessly on single-instance in-memory Socket.IO and across multi-instance Redis adapter clusters.
 * 4. In a direct conversation, evicts the blocked pair from 'conversation:<id>'.
 * 5. Emits minimal, non-sensitive 'conversation:blocked' notifications to affected clients without leaking PII.
 */
export class BlockEvictionService {
  private readonly io: SocketIOServer;
  private readonly prismaClient: PrismaClient | undefined;
  private readonly logger: Logger | undefined;
  private isReconciling = false;

  constructor(options: BlockEvictionOptions) {
    this.io = options.io;
    this.prismaClient = options.prisma;
    this.logger = options.logger;
  }

  private get prisma(): PrismaClient {
    return this.prismaClient || getPrismaClient();
  }

  /**
   * Identifies all shared active conversation rooms between userA and userB,
   * evicts all connected sockets for both users from those rooms, and emits a non-sensitive
   * 'conversation:blocked' notification.
   */
  public async evictBlockedPair(userA: string, userB: string): Promise<BlockEvictionResult> {
    const startTime = Date.now();

    // 1. Authoritatively resolve all active, non-deleted shared conversations
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

    // 3. Perform room eviction for each shared conversation
    for (const conv of sharedConversations) {
      const roomName = `conversation:${conv.id}`;
      evictedRooms.push(roomName);

      // Instruct Socket.IO to evict all sockets of both users from this conversation room.
      // With @socket.io/redis-adapter, socketsLeave broadcasts a request across all cluster instances.
      await Promise.all([
        this.io.in(`user:${userA}`).socketsLeave(roomName),
        this.io.in(`user:${userB}`).socketsLeave(roomName),
      ]);

      // Emit minimal, non-sensitive event to notify clients they have been isolated from this room
      this.io.to(`user:${userA}`).emit('conversation:blocked', { conversationId: conv.id });
      this.io.to(`user:${userB}`).emit('conversation:blocked', { conversationId: conv.id });
    }

    const durationMs = Date.now() - startTime;

    if (this.logger) {
      this.logger.info(
        {
          userA,
          userB,
          sharedCount: sharedConversations.length,
          evictedRoomsCount: evictedRooms.length,
          durationMs,
        },
        'Completed active-socket block eviction for user pair',
      );
    }

    return {
      success: true,
      userA,
      userB,
      evictedRooms,
      sharedConversationsCount: sharedConversations.length,
    };
  }

  private isShuttingDown = false;

  public shutdown(): void {
    this.isShuttingDown = true;
  }

  /**
   * Bounded reconciliation of active local sockets.
   * Invoked upon Redis reconnection or recovery to evict any stale sockets that
   * may have missed eviction commands during a network partition.
   *
   * Security & Algorithmic Guarantees:
   * 1. Iterates exclusively local sockets connected to this process (io.sockets.sockets).
   * 2. Resolves authenticated socket identities server-side; ignores client-supplied claims.
   * 3. Verifies active account status (SUSPENDED / DEACTIVATED sockets are disconnected).
   * 4. Bounded batched queries: eliminates N+1 queries via chunked conversation + block lookups (O(S + R + Q)).
   * 5. Evicts departed users (leftAt !== null) and bidirectional blocked pairs.
   * 6. Emits minimal, non-sensitive 'conversation:blocked' events without leaking PII.
   * 7. Single-flight concurrency guard prevents overlapping runs during recovery flappers.
   * 8. Safe under concurrent socket disconnects and respects graceful shutdown.
   */
  public async reconcileLocalSockets(): Promise<{ checkedSockets: number; evictedCount: number }> {
    if (this.isShuttingDown) {
      return { checkedSockets: 0, evictedCount: 0 };
    }

    if (this.isReconciling) {
      if (this.logger) {
        this.logger.warn('Local socket reconciliation already in progress; skipping duplicate run');
      }
      return { checkedSockets: 0, evictedCount: 0 };
    }

    this.isReconciling = true;
    try {
      let evictedCount = 0;

      // 1. Snapshot local sockets connected to this server process
      const localSockets = Array.from(this.io.sockets?.sockets?.values() ?? []);
      const checkedSockets = localSockets.length;

      if (checkedSockets === 0) {
        return { checkedSockets: 0, evictedCount: 0 };
      }

      // 2. Extract authenticated user identities and verify active account status
      const uniqueUserIds = Array.from(
        new Set(
          localSockets
            .map((s) => (s.data as any)?.user?.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );

      const users =
        uniqueUserIds.length > 0
          ? await this.prisma.user.findMany({
              where: { id: { in: uniqueUserIds } },
              select: { id: true, status: true },
            })
          : [];

      const userStatusMap = new Map(users.map((u) => [u.id, u.status]));

      // Disconnect any local sockets whose accounts became suspended or deactivated
      for (const socket of localSockets) {
        const userId = (socket.data as any)?.user?.id;
        if (userId && userStatusMap.has(userId) && userStatusMap.get(userId) !== 'ACTIVE') {
          socket.emit('error', { code: 'ACCOUNT_INACTIVE', message: 'Account status changed.' });
          socket.disconnect(true);
          evictedCount++;
        }
      }

      // 3. Collect active conversation room targets from remaining local sockets
      interface RoomTarget {
        socket: (typeof localSockets)[0];
        userId: string;
        conversationId: string;
        roomName: string;
      }

      const targets: RoomTarget[] = [];
      const uniqueConvIds = new Set<string>();

      for (const socket of localSockets) {
        if (socket.disconnected) continue;
        const userId = (socket.data as any)?.user?.id;
        if (!userId || userStatusMap.get(userId) !== 'ACTIVE') continue;

        for (const room of socket.rooms) {
          if (room.startsWith('conversation:')) {
            const conversationId = room.slice('conversation:'.length);
            targets.push({ socket, userId, conversationId, roomName: room });
            uniqueConvIds.add(conversationId);
          }
        }
      }

      if (targets.length === 0) {
        return { checkedSockets, evictedCount };
      }

      // 4. Bounded chunked evaluation of conversations to prevent unbounded SQL queries
      const convIdList = Array.from(uniqueConvIds);
      const BATCH_SIZE = 100;

      for (let i = 0; i < convIdList.length; i += BATCH_SIZE) {
        if (this.isShuttingDown) break;

        const batchConvIds = convIdList.slice(i, i + BATCH_SIZE);
        const batchConvSet = new Set(batchConvIds);
        const batchTargets = targets.filter((t) => batchConvSet.has(t.conversationId));

        // Bounded Query 1: Retrieve active participants for all conversations in this batch
        const participants = await this.prisma.conversationParticipant.findMany({
          where: {
            conversationId: { in: batchConvIds },
            leftAt: null,
          },
          select: {
            conversationId: true,
            userId: true,
          },
        });

        const activeParticipantsByConv = new Map<string, Set<string>>();
        const allParticipantIds = new Set<string>();

        for (const p of participants) {
          if (!activeParticipantsByConv.has(p.conversationId)) {
            activeParticipantsByConv.set(p.conversationId, new Set());
          }
          activeParticipantsByConv.get(p.conversationId)!.add(p.userId);
          allParticipantIds.add(p.userId);
        }

        // Bounded Query 2: Retrieve bidirectional blocks between participants in this batch
        const participantList = Array.from(allParticipantIds);
        const blocks =
          participantList.length > 0
            ? await this.prisma.userBlock.findMany({
                where: {
                  AND: [
                    { blockerId: { in: participantList } },
                    { blockedId: { in: participantList } },
                  ],
                },
                select: {
                  blockerId: true,
                  blockedId: true,
                },
              })
            : [];

        const blockPairSet = new Set<string>();
        for (const b of blocks) {
          blockPairSet.add(`${b.blockerId}:${b.blockedId}`);
        }

        // In-memory evaluation of local targets against authoritative PostgreSQL snapshot
        for (const target of batchTargets) {
          if (target.socket.disconnected) continue;

          const activeUsers = activeParticipantsByConv.get(target.conversationId);

          // Stale membership: user is not an active participant (removed, left, or deleted conversation)
          if (!activeUsers || !activeUsers.has(target.userId)) {
            target.socket.leave(target.roomName);
            evictedCount++;
            continue;
          }

          // Blocked pair: verify bidirectional block with any other active participant
          let isBlocked = false;
          for (const otherUserId of activeUsers) {
            if (otherUserId !== target.userId) {
              if (
                blockPairSet.has(`${target.userId}:${otherUserId}`) ||
                blockPairSet.has(`${otherUserId}:${target.userId}`)
              ) {
                isBlocked = true;
                break;
              }
            }
          }

          if (isBlocked) {
            target.socket.leave(target.roomName);
            target.socket.emit('conversation:blocked', {
              conversationId: target.conversationId,
            });
            evictedCount++;
          }
        }
      }

      if (this.logger) {
        this.logger.info(
          { checkedSockets, evictedCount },
          'Completed local socket reconciliation after cluster state change or recovery',
        );
      }

      return { checkedSockets, evictedCount };
    } finally {
      this.isReconciling = false;
    }
  }
}
