import { describe, it, expect } from 'vitest';
import { getPrismaClient, UserStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { RestoreSanitizerService } from './restore-sanitizer.js';
import { PrivacyAuditService } from './privacy-audit.service.js';
import { MockStoragePurgeService } from './external-storage-purge.service.js';

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
});
