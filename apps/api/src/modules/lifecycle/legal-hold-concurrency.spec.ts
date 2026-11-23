import { describe, it, expect } from 'vitest';
import { getPrismaClient, UserStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { LegalHoldService } from './legal-hold.service.js';
import { PrivacyRequestService } from './privacy-request.service.js';
import { DataErasureOrchestrator } from './data-erasure-orchestrator.js';
import { MockStoragePurgeService } from './external-storage-purge.service.js';
import { MockSupabaseAdminService } from './supabase-admin.service.js';
import {
  LegalHoldActiveError,
  ConflictError,
  NotFoundError,
  PrivacyRequestInvalidStateError,
} from '../../errors/app-error.js';

describe('LegalHoldService & Erasure Concurrency — Parent-Row Locking Protocol', () => {
  const prisma = getPrismaClient();

  const createTestUser = async (emailPrefix: string) => {
    const userId = generateUuidV7();
    const adminId = generateUuidV7();
    const creatorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CREATOR' } });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });

    await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: `sub_${emailPrefix}_${Date.now()}`,
        email: `${emailPrefix}_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: creatorRole.id } },
      },
    });

    await prisma.user.create({
      data: {
        id: adminId,
        supabaseAuthId: `sub_admin_${emailPrefix}_${Date.now()}`,
        email: `admin_${emailPrefix}_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: adminRole.id } },
      },
    });

    return { userId, adminId };
  };

  it('Scenario 1: Hold created before erasure scheduling -> Erasure request rejected', async () => {
    const { userId, adminId } = await createTestUser('scen1');
    const holdService = new LegalHoldService(prisma);
    const privacyService = new PrivacyRequestService(prisma);

    // Apply hold first
    await holdService.applyHold({
      userId,
      reason: 'ACTIVE_DISPUTE',
      caseReference: 'CASE-SCEN1-001',
      notes: 'Active dispute on deliverable #DEL-402',
      appliedById: adminId,
    });

    // Attempting to request erasure must fail atomically under parent-row lock
    await expect(privacyService.requestErasure(userId)).rejects.toThrow(LegalHoldActiveError);
  });

  it('Scenario 2: Hold created during cooling-off -> Execution aborted with REJECTED_LEGAL_HOLD', async () => {
    const { userId, adminId } = await createTestUser('scen2');
    const holdService = new LegalHoldService(prisma);
    const privacyService = new PrivacyRequestService(prisma);
    const orchestrator = new DataErasureOrchestrator({
      prismaClient: prisma,
      storagePurge: new MockStoragePurgeService(),
      supabase: new MockSupabaseAdminService(),
    });

    // 1. Submit and confirm erasure request
    const { request, rawConfirmationCode } = await privacyService.requestErasure(userId);
    await privacyService.confirmErasure(userId, rawConfirmationCode);

    // 2. Admin applies legal hold while in cooling-off
    await holdService.applyHold({
      userId,
      reason: 'TAX_INSPECTION',
      caseReference: 'CASE-SCEN2-TAX',
      notes: 'Statutory tax audit hold',
      appliedById: adminId,
    });

    // 3. Orchestrator executes erasure -> must detect hold and transition to REJECTED_LEGAL_HOLD
    const result = await orchestrator.executeErasure(request.id);

    expect(result.status).toBe('REJECTED_LEGAL_HOLD');
    expect(result.rejectionReason).toContain('active legal hold');

    // Verify user was NOT pseudonymized
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.email).not.toContain('@deleted.invalid');
  });

  it('Scenario 3 & 4: Parent-Row Locking blocks concurrent hold insertion during erasure', async () => {
    const { userId, adminId } = await createTestUser('scen3');
    const holdService = new LegalHoldService(prisma);

    // Synchronization barriers
    let lockAcquiredByErasure = false;
    let releaseErasureLock: () => void = () => {};
    const erasureHoldPromise = new Promise<void>((resolve) => {
      releaseErasureLock = resolve;
    });

    // Transaction 1: Simulates erasure transaction acquiring parent row lock
    const tx1Promise = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      lockAcquiredByErasure = true;

      // Hold lock until Tx 2 has attempted to acquire lock
      await erasureHoldPromise;

      // Finish Tx 1
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.DEACTIVATED },
      });
    });

    // Wait until Tx 1 definitely has the parent row lock
    while (!lockAcquiredByErasure) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // Transaction 2: Concurrent attempt to apply hold.
    // In PostgreSQL, Tx 2 MUST block on the parent row lock!
    let tx2Started = false;
    let tx2Finished = false;

    const tx2Promise = (async () => {
      tx2Started = true;
      await holdService.applyHold({
        userId,
        reason: 'TRUST_SAFETY_INVESTIGATION',
        caseReference: 'CASE-CONCURRENT-001',
        notes: 'Concurrent hold attempt',
        appliedById: adminId,
      });
      tx2Finished = true;
    })();

    // Yield control to let Tx 2 run into the lock
    await new Promise((r) => setTimeout(r, 50));
    expect(tx2Started).toBe(true);
    expect(tx2Finished).toBe(false); // Tx 2 is strictly BLOCKED waiting for Tx 1!

    // Release Tx 1 lock
    releaseErasureLock();
    await tx1Promise;

    // Now Tx 2 unblocks and finishes
    await tx2Promise;
    expect(tx2Finished).toBe(true);

    const holds = await holdService.getActiveHolds(userId);
    expect(holds).toHaveLength(1);
    expect(holds[0].caseReference).toBe('CASE-CONCURRENT-001');
  });

  it('Scenario 5: Multiple concurrent legal holds applied serialize cleanly', async () => {
    const { userId, adminId } = await createTestUser('scen5');
    const holdService = new LegalHoldService(prisma);

    // Launch two hold creations concurrently
    const [holdA, holdB] = await Promise.all([
      holdService.applyHold({
        userId,
        reason: 'ACTIVE_DISPUTE',
        caseReference: 'CASE-DISPUTE-01',
        notes: 'Dispute 1',
        appliedById: adminId,
      }),
      holdService.applyHold({
        userId,
        reason: 'FINANCIAL_AUDIT',
        caseReference: 'CASE-AUDIT-02',
        notes: 'Audit 2',
        appliedById: adminId,
      }),
    ]);

    expect(holdA.id).not.toBe(holdB.id);

    const activeHolds = await holdService.getActiveHolds(userId);
    expect(activeHolds).toHaveLength(2);
    expect(activeHolds.map((h) => h.caseReference).sort()).toEqual([
      'CASE-AUDIT-02',
      'CASE-DISPUTE-01',
    ]);
  });

  it('Scenario 6: Hold release concurrent with erasure evaluation', async () => {
    const { userId, adminId } = await createTestUser('scen6');
    const holdService = new LegalHoldService(prisma);
    const privacyService = new PrivacyRequestService(prisma);
    const orchestrator = new DataErasureOrchestrator({
      prismaClient: prisma,
      storagePurge: new MockStoragePurgeService(),
      supabase: new MockSupabaseAdminService(),
    });

    // 1. Create hold
    const hold = await holdService.applyHold({
      userId,
      reason: 'ACTIVE_DISPUTE',
      caseReference: 'CASE-TEMP-HOLD',
      notes: 'Temporary hold',
      appliedById: adminId,
    });

    // 2. Request erasure (fails while hold active)
    await expect(privacyService.requestErasure(userId)).rejects.toThrow(LegalHoldActiveError);

    // 3. Release hold
    await holdService.releaseHold({
      holdId: hold.id,
      releasedById: adminId,
      releaseNotes: 'Dispute amicably settled',
    });

    // 4. Now erasure request succeeds under parent lock
    const { request, rawConfirmationCode } = await privacyService.requestErasure(userId);
    await privacyService.confirmErasure(userId, rawConfirmationCode);

    // 5. Erasure execution completes cleanly
    const result = await orchestrator.executeErasure(request.id);
    expect(result.status).toBe('COMPLETED');
  });

  it('Scenario 7: Two erasure workers processing the same request execute idempotently', async () => {
    const { userId } = await createTestUser('scen7');
    const privacyService = new PrivacyRequestService(prisma);
    const mockStorage = new MockStoragePurgeService();
    const mockSupabase = new MockSupabaseAdminService();

    const orchestrator = new DataErasureOrchestrator({
      prismaClient: prisma,
      storagePurge: mockStorage,
      supabase: mockSupabase,
    });

    const { request, rawConfirmationCode } = await privacyService.requestErasure(userId);
    await privacyService.confirmErasure(userId, rawConfirmationCode);

    // Worker 1 and Worker 2 both attempt execution
    const [result1, result2] = await Promise.all([
      orchestrator.executeErasure(request.id),
      orchestrator.executeErasure(request.id),
    ]);

    expect(result1.status).toBe('COMPLETED');
    expect(result2.status).toBe('COMPLETED');

    // Final database state is cleanly pseudonymized
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.email).toBe(`deleted-${userId}@deleted.invalid`);
    expect(user?.status).toBe(UserStatus.DEACTIVATED);
  });

  it('Scenario 8: Non-existent user fails safely with NotFoundError', async () => {
    const holdService = new LegalHoldService(prisma);
    const fakeId = generateUuidV7();

    await expect(
      holdService.applyHold({
        userId: fakeId,
        reason: 'LAW_ENFORCEMENT_REQUEST',
        caseReference: 'CASE-FAKE-001',
        notes: 'Testing nonexistent user',
        appliedById: generateUuidV7(),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Scenario 9: Rejects erasure execution on CANCELLED or UNCONFIRMED requests', async () => {
    const { userId: user1 } = await createTestUser('scen9_unconfirmed');
    const { userId: user2 } = await createTestUser('scen9_cancelled');
    const privacyService = new PrivacyRequestService(prisma);
    const mockStorage = new MockStoragePurgeService();
    const mockSupabase = new MockSupabaseAdminService();

    const orchestrator = new DataErasureOrchestrator({
      prismaClient: prisma,
      storagePurge: mockStorage,
      supabase: mockSupabase,
    });

    // 1. Unconfirmed request
    const { request: unconfirmedReq } = await privacyService.requestErasure(user1);
    await expect(orchestrator.executeErasure(unconfirmedReq.id)).rejects.toThrow(
      PrivacyRequestInvalidStateError,
    );

    // 2. Cancelled request
    const { request: toCancelReq, rawConfirmationCode } =
      await privacyService.requestErasure(user2);
    await privacyService.confirmErasure(user2, rawConfirmationCode);
    await privacyService.cancelErasure(user2, 'Changed my mind');

    await expect(orchestrator.executeErasure(toCancelReq.id)).rejects.toThrow(
      PrivacyRequestInvalidStateError,
    );
  });

  it('Scenario 10: Worker crash after DB commit recovers idempotently and completes remaining stages', async () => {
    const { userId } = await createTestUser('scen10');
    const privacyService = new PrivacyRequestService(prisma);
    const mockStorage = new MockStoragePurgeService();
    const mockSupabase = new MockSupabaseAdminService();

    // Setup an asset for this user in mock storage
    mockStorage.storedObjects.set(`users/${userId}/doc.pdf`, {
      buffer: Buffer.from('data'),
    });
    mockSupabase.users.add(`sub_scen10_${userId}`);

    const { request, rawConfirmationCode } = await privacyService.requestErasure(userId);
    await privacyService.confirmErasure(userId, rawConfirmationCode);

    // Run 1: Simulate crash during storage purge
    let storagePurgeAttempted = false;
    const crashingStorage = {
      purgeUserAssets: async () => {
        storagePurgeAttempted = true;
        throw new Error('SIMULATED_NETWORK_PARTITION_DURING_S3_PURGE');
      },
    };

    const crashingOrchestrator = new DataErasureOrchestrator({
      prismaClient: prisma,
      storagePurge: crashingStorage as any,
      supabase: mockSupabase,
    });

    await expect(crashingOrchestrator.executeErasure(request.id)).rejects.toThrow(
      /SIMULATED_NETWORK_PARTITION_DURING_S3_PURGE/,
    );
    expect(storagePurgeAttempted).toBe(true);

    // Assert that DB pseudonymization committed successfully before the crash
    const postCrashUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(postCrashUser?.email).toBe(`deleted-${userId}@deleted.invalid`);

    // Run 2: Worker restart / retry with recovered storage
    const recoveryOrchestrator = new DataErasureOrchestrator({
      prismaClient: prisma,
      storagePurge: mockStorage,
      supabase: mockSupabase,
    });

    const recoveryResult = await recoveryOrchestrator.executeErasure(request.id);
    expect(recoveryResult.status).toBe('COMPLETED');
    expect(recoveryResult.stagesCompleted).toContain('MEDIA_PURGE_COMPLETED');
    expect(recoveryResult.stagesCompleted).toContain('SUPABASE_IDENTITY_PURGE_COMPLETED');
    expect(recoveryResult.stagesCompleted).toContain('ERASURE_COMPLETED');

    // Storage and Supabase are now purged
    expect(mockStorage.storedObjects.has(`users/${userId}/doc.pdf`)).toBe(false);
  });

  it('Scenario 11: Concurrent release of the same hold serializes cleanly without double-release', async () => {
    const { userId, adminId } = await createTestUser('scen11');
    const holdService = new LegalHoldService(prisma);

    const hold = await holdService.applyHold({
      userId,
      reason: 'ACTIVE_DISPUTE',
      caseReference: 'CASE-CONCURRENT-RELEASE',
      notes: 'Testing concurrent release serialization',
      appliedById: adminId,
    });

    // Two admin workers attempt to release the same hold concurrently
    const [rel1, rel2] = await Promise.allSettled([
      holdService.releaseHold({
        holdId: hold.id,
        releasedById: adminId,
        releaseNotes: 'Release attempt 1',
      }),
      holdService.releaseHold({
        holdId: hold.id,
        releasedById: adminId,
        releaseNotes: 'Release attempt 2',
      }),
    ]);

    // Exactly one must succeed and one must be rejected with ConflictError
    const successes = [rel1, rel2].filter((r) => r.status === 'fulfilled');
    const rejections = [rel1, rel2].filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    expect((rejections[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    // Active holds is now 0
    const active = await holdService.getActiveHolds(userId);
    expect(active).toHaveLength(0);
  });
});
