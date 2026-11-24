import { describe, it, expect } from 'vitest';
import { getPrismaClient, UserStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { RestoreSanitizerService } from './restore-sanitizer.js';
import { PrivacyAuditService } from './privacy-audit.service.js';
import { MockStoragePurgeService } from './external-storage-purge.service.js';
import { redisCache } from '../../services/redis-cache.js';

describe('RestoreSanitizerService — Backup Restoration & Re-Sanitization Harness', () => {
  const prisma = getPrismaClient();

  it('detects resurrected personal data in a restored database snapshot and re-sanitizes it', async () => {
    const userId = generateUuidV7();
    const requestId = generateUuidV7();
    const creatorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CREATOR' } });

    // 1. Create historical privacy certificate proving this account completed erasure
    await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: `sub_sanitizer_${Date.now()}`,
        email: `deleted-${userId}@deleted.invalid`,
        status: UserStatus.DEACTIVATED,
        userRoles: { create: { id: generateUuidV7(), roleId: creatorRole.id } },
      },
    });

    // Record request creation log
    await prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId,
        action: 'PRIVACY_REQUEST_CREATED',
        entity: 'PrivacyRequest',
        entityId: requestId,
        metadata: { id: requestId, userId },
      },
    });

    // Issue certificate
    const auditService = new PrivacyAuditService(prisma);
    await prisma.$transaction(async (tx) => {
      await auditService.issueCertificate(tx, {
        requestId,
        userId,
        actionTaken: 'IN_PLACE_PSEUDONYMIZATION',
        recordsProcessed: 1,
        mediaFilesPurged: 0,
      });
    });

    // 2. SIMULATE A BACKUP RESTORE:
    // In an old database backup, this user had their original personal email and status was ACTIVE.
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `resurrected_${Date.now()}@personal.invalid`,
        firstName: 'John',
        lastName: 'Doe',
        status: UserStatus.ACTIVE,
      },
    });

    // Verify data was indeed resurrected
    const resurrectedUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(resurrectedUser?.email).toContain('@personal.invalid');
    expect(resurrectedUser?.status).toBe(UserStatus.ACTIVE);

    // 3. Run Pre-Traffic Re-Sanitization Procedure
    const mockStorage = new MockStoragePurgeService();
    const sanitizer = new RestoreSanitizerService({
      prismaClient: prisma,
      storagePurge: mockStorage,
    });

    const report = await sanitizer.sanitizeRestoredDatabase();

    // 4. Assert re-sanitization behavior
    expect(report.resurrectedAccountsSanitized).toBeGreaterThanOrEqual(1);
    expect(report.sanitizedUserIds).toContain(userId);
    expect(report.operatorSignOffRequired).toBe(true);

    // 5. Verify database user is now safely re-pseudonymized
    const sanitizedUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(sanitizedUser?.email).toBe(`deleted-${userId}@deleted.invalid`);
    expect(sanitizedUser?.firstName).toBe('Deleted');
    expect(sanitizedUser?.lastName).toBe('User');
    expect(sanitizedUser?.status).toBe(UserStatus.DEACTIVATED);
  });

  it('preserves unrelated Redis keys (queues, rate-limits, sessions) and invalidates only user cache namespaces', async () => {
    // In-memory Redis mock implementing the exact scan / del contract
    const store = new Map<string, string>();
    store.set('bull:queue:transcode:101', 'job-data');
    store.set('session:token_live_user', 'session-data');
    store.set('ratelimit:ip:192.168.1.1', '5');
    store.set('user:id:sample_test_user', 'user-data');
    store.set('user:sub:sample_test_sub', 'sub-data');
    store.set('user:roles:sample_test_user', 'roles-data');

    const mockRedisClient = {
      scan: async (_cursor: string, _match: string, pattern: string) => {
        // Simple glob prefix matcher (e.g. "user:id:*")
        const prefix = pattern.replace('*', '');
        const matched = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
        return ['0', matched];
      },
      del: async (...keys: string[]) => {
        for (const k of keys) {
          store.delete(k);
        }
        return keys.length;
      },
    };

    const mockCacheService = {
      getClient: () => mockRedisClient,
      invalidateUser: async () => true,
    };

    const mockStorage = new MockStoragePurgeService();
    const sanitizer = new RestoreSanitizerService({
      prismaClient: prisma,
      storagePurge: mockStorage,
      cacheSvc: mockCacheService as any,
    });

    const report = await sanitizer.sanitizeRestoredDatabase();
    expect(report.redisFlushed).toBe(true);

    // Assert: Unrelated keys are strictly preserved
    expect(store.has('bull:queue:transcode:101')).toBe(true);
    expect(store.has('session:token_live_user')).toBe(true);
    expect(store.has('ratelimit:ip:192.168.1.1')).toBe(true);

    // Assert: Targeted user identity cache keys are cleared
    expect(store.has('user:id:sample_test_user')).toBe(false);
    expect(store.has('user:sub:sample_test_sub')).toBe(false);
    expect(store.has('user:roles:sample_test_user')).toBe(false);
  });

  it('fails closed and blocks execution in production context without explicit confirmation', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalConfirm = process.env.CONFIRM_RESTORE_SANITIZATION;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.CONFIRM_RESTORE_SANITIZATION;

      const mockStorage = new MockStoragePurgeService();
      const sanitizer = new RestoreSanitizerService({
        prismaClient: prisma,
        storagePurge: mockStorage,
      });

      await expect(sanitizer.sanitizeRestoredDatabase()).rejects.toThrow(
        /RESTORE SANITIZATION GUARD/,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalConfirm !== undefined) {
        process.env.CONFIRM_RESTORE_SANITIZATION = originalConfirm;
      }
    }
  });
});
