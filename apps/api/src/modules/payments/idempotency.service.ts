import crypto from 'node:crypto';
import { getPrismaClient, Prisma } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { IdempotencyConflictError } from '../../errors/app-error.js';

export interface IdempotencyCheckResult<T = unknown> {
  isCached: boolean;
  status?: number | undefined;
  body?: T | undefined;
}

export class IdempotencyService {
  constructor(private prisma = getPrismaClient()) {}

  computeRequestHash(payload: unknown): string {
    const canonicalString = this.canonicalizeJson(payload);
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  async check<T = unknown>(
    scope: string,
    key: string,
    payload: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<IdempotencyCheckResult<T>> {
    const client = tx || this.prisma;
    const record = await client.idempotencyRecord.findUnique({
      where: {
        scope_key: { scope, key },
      },
    });

    if (!record) {
      return { isCached: false };
    }

    // Check expiry
    if (record.expiresAt < new Date()) {
      await client.idempotencyRecord.delete({
        where: { id: record.id },
      });
      return { isCached: false };
    }

    const currentHash = this.computeRequestHash(payload);
    if (record.requestHash !== currentHash) {
      throw new IdempotencyConflictError(
        `Idempotency key '${key}' was previously used with a different request payload. Reusing keys with modified payloads is prohibited.`,
      );
    }

    return {
      isCached: true,
      status: record.responseStatus,
      body: record.responseBody as T,
    };
  }

  async record(
    scope: string,
    key: string,
    payload: unknown,
    responseStatus: number,
    responseBody: unknown,
    resourceId?: string,
    ttlHours = 24,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    const requestHash = this.computeRequestHash(payload);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await client.idempotencyRecord.upsert({
      where: {
        scope_key: { scope, key },
      },
      create: {
        id: generateUuidV7(),
        key,
        scope,
        requestHash,
        responseStatus,
        responseBody: responseBody as any,
        resourceId: resourceId ?? null,
        expiresAt,
      },
      update: {
        requestHash,
        responseStatus,
        responseBody: responseBody as any,
        resourceId: resourceId ?? null,
        expiresAt,
      },
    });
  }

  private canonicalizeJson(obj: unknown): string {
    if (obj === null || obj === undefined) {
      return '';
    }
    if (typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return `[${obj.map((item) => this.canonicalizeJson(item)).join(',')}]`;
    }

    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const key of keys) {
      const val = (obj as Record<string, unknown>)[key];
      if (val !== undefined) {
        sortedObj[key] = val;
      }
    }
    return JSON.stringify(sortedObj);
  }
}

export const idempotencyService = new IdempotencyService();
