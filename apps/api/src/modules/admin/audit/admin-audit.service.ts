import crypto from 'node:crypto';
import { type PrismaClient, getPrismaClient, type Prisma } from '@creatorconnect/database';
import {
  type AdminAuditLogQuery,
  type AdminAuditLogResponse,
  type AdminAuditLogItem,
  decodeAuditCursor,
  encodeAuditCursor,
} from '@creatorconnect/contracts';
import { BadRequestError, InvalidAuditCursorError } from '../../../errors/app-error.js';
import { sanitizeAuditMetadata } from './audit-sanitizer.js';

export function computeAuditFilterHash(params: {
  actorId: string | undefined;
  action: string | undefined;
  entity: string | undefined;
  entityId: string | undefined;
  startIso: string | undefined;
  endIso: string | undefined;
  search: string | undefined;
}): string {
  const canonical = JSON.stringify({
    a: params.actorId ?? null,
    ac: params.action ?? null,
    e: params.entity ?? null,
    ei: params.entityId ?? null,
    s: params.startIso ?? null,
    ed: params.endIso ?? null,
    q: params.search ?? null,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export class AdminAuditService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public async listAuditLogs(query: AdminAuditLogQuery): Promise<AdminAuditLogResponse> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const andConditions: Prisma.AuditLogWhereInput[] = [];

    const targetActorId = query.actorId || query.userId || undefined;
    if (targetActorId) {
      andConditions.push({ userId: targetActorId });
    }

    const normalizedAction = query.action?.trim() || undefined;
    if (normalizedAction) {
      andConditions.push({ action: normalizedAction });
    }

    const normalizedEntity = query.entity?.trim() || undefined;
    if (normalizedEntity) {
      andConditions.push({ entity: normalizedEntity });
    }

    const normalizedEntityId = query.entityId?.trim() || undefined;
    if (normalizedEntityId) {
      andConditions.push({ entityId: normalizedEntityId });
    }

    let start: Date | undefined;
    let end: Date | undefined;

    if (query.startDate) {
      start = new Date(query.startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestError('Invalid startDate parameter.');
      }
      andConditions.push({ createdAt: { gte: start } });
    }

    if (query.endDate) {
      end = new Date(query.endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestError('Invalid endDate parameter.');
      }
      andConditions.push({ createdAt: { lte: end } });
    }

    if (start && end && start.getTime() > end.getTime()) {
      throw new BadRequestError('startDate cannot be later than endDate.');
    }

    const normalizedSearch = query.search?.trim() || undefined;
    if (normalizedSearch) {
      andConditions.push({
        OR: [
          { action: { contains: normalizedSearch, mode: 'insensitive' } },
          { entity: { contains: normalizedSearch, mode: 'insensitive' } },
          { entityId: { contains: normalizedSearch, mode: 'insensitive' } },
        ],
      });
    }

    const filterHash = computeAuditFilterHash({
      actorId: targetActorId,
      action: normalizedAction,
      entity: normalizedEntity,
      entityId: normalizedEntityId,
      startIso: start?.toISOString(),
      endIso: end?.toISOString(),
      search: normalizedSearch,
    });

    // Keyset cursor pagination condition on (createdAt DESC, id DESC).
    // Including `createdAt <= decodedCursor.createdAt` allows PostgreSQL's B-Tree index on `created_at`
    // (`audit_logs_created_at_idx`) to perform a direct backward index seek instead of scanning newer rows.
    if (query.cursor !== undefined) {
      const decodedCursor = decodeAuditCursor(query.cursor);
      if (!decodedCursor) {
        throw new InvalidAuditCursorError();
      }
      if (decodedCursor.filterHash && decodedCursor.filterHash !== filterHash) {
        throw new InvalidAuditCursorError(
          'Audit cursor does not match the active filter parameters. Reset pagination to page 1.',
        );
      }

      andConditions.push({ createdAt: { lte: decodedCursor.createdAt } });
      andConditions.push({
        OR: [
          { createdAt: { lt: decodedCursor.createdAt } },
          {
            createdAt: decodedCursor.createdAt,
            id: { lt: decodedCursor.id },
          },
        ],
      });
    }

    const where: Prisma.AuditLogWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    // Retrieve limit + 1 records using backward index scan on created_at + tie-break id
    const records = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;

    const items: AdminAuditLogItem[] = pageRecords.map((r) => {
      const actorName = r.user
        ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || r.user.email
        : null;

      return {
        id: r.id,
        userId: r.userId,
        userEmail: r.user?.email || null,
        actorEmail: r.user?.email || null,
        actorName,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        metadata: sanitizeAuditMetadata(r.metadata),
        createdAt: r.createdAt.toISOString(),
      };
    });

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      if (lastItem) {
        nextCursor = encodeAuditCursor(lastItem.createdAt, lastItem.id, filterHash);
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }
}

export const adminAuditService = new AdminAuditService();
