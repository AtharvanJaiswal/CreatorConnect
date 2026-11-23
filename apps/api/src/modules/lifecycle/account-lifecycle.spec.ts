import { describe, it, expect, beforeEach } from 'vitest';
import { getPrismaClient, UserStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { accountLifecycleService } from './account-lifecycle.service.js';
import {
  InvalidLifecycleTransitionError,
  LastAdminLockoutError,
  ForbiddenError,
} from '../../errors/app-error.js';

describe('AccountLifecycleService — Formal State Machine & Invariants', () => {
  const prisma = getPrismaClient();

  beforeEach(async () => {
    // Clean up test audit logs and users if needed
  });

  it('validates state transition rules according to the formal state machine', () => {
    // Permitted
    expect(accountLifecycleService.isValidTransition(UserStatus.ACTIVE, UserStatus.SUSPENDED)).toBe(
      true,
    );
    expect(
      accountLifecycleService.isValidTransition(UserStatus.ACTIVE, UserStatus.DEACTIVATED),
    ).toBe(true);
    expect(accountLifecycleService.isValidTransition(UserStatus.SUSPENDED, UserStatus.ACTIVE)).toBe(
      true,
    );
    expect(
      accountLifecycleService.isValidTransition(UserStatus.DEACTIVATED, UserStatus.ACTIVE),
    ).toBe(true);

    // Prohibited
    expect(
      accountLifecycleService.isValidTransition(UserStatus.SUSPENDED, UserStatus.DEACTIVATED),
    ).toBe(false);
    expect(
      accountLifecycleService.isValidTransition(UserStatus.DEACTIVATED, UserStatus.SUSPENDED),
    ).toBe(false);

    // Self-transitions are invalid
    expect(accountLifecycleService.isValidTransition(UserStatus.ACTIVE, UserStatus.ACTIVE)).toBe(
      false,
    );
    expect(
      accountLifecycleService.isValidTransition(UserStatus.SUSPENDED, UserStatus.SUSPENDED),
    ).toBe(false);
    expect(
      accountLifecycleService.isValidTransition(UserStatus.DEACTIVATED, UserStatus.DEACTIVATED),
    ).toBe(false);
  });

  it('allows an ADMIN to suspend an ACTIVE user and records forensically complete audit log', async () => {
    const adminId = generateUuidV7();
    const targetUserId = generateUuidV7();

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    const creatorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CREATOR' } });

    await prisma.user.create({
      data: {
        id: adminId,
        supabaseAuthId: `sub_admin_${Date.now()}`,
        email: `admin_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: adminRole.id } },
      },
    });

    await prisma.user.create({
      data: {
        id: targetUserId,
        supabaseAuthId: `sub_target_${Date.now()}`,
        email: `target_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: creatorRole.id } },
      },
    });

    const result = await accountLifecycleService.transitionStatus({
      targetUserId,
      newStatus: UserStatus.SUSPENDED,
      actorUserId: adminId,
      actorRoles: ['ADMIN'],
      reason: 'Trust and Safety violation #TS-1001',
    });

    expect(result.previousStatus).toBe(UserStatus.ACTIVE);
    expect(result.newStatus).toBe(UserStatus.SUSPENDED);
    expect(result.user.status).toBe(UserStatus.SUSPENDED);

    // Check DB status
    const dbUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    expect(dbUser?.status).toBe(UserStatus.SUSPENDED);

    // Check AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: targetUserId,
        action: 'USER_LIFECYCLE_TRANSITIONED',
      },
    });
    expect(audit).not.toBeNull();
    const meta = audit?.metadata as any;
    expect(meta?.previousStatus).toBe(UserStatus.ACTIVE);
    expect(meta?.newStatus).toBe(UserStatus.SUSPENDED);
    expect(meta?.reason).toBe('Trust and Safety violation #TS-1001');

    // Check OutboxEvent
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: targetUserId,
        eventType: 'user.lifecycle.transitioned.v1',
      },
    });
    expect(outbox).not.toBeNull();
  });

  it('prohibits invalid state transition (e.g., SUSPENDED -> DEACTIVATED)', async () => {
    const adminId = generateUuidV7();
    const targetUserId = generateUuidV7();

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    const creatorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CREATOR' } });

    await prisma.user.create({
      data: {
        id: adminId,
        supabaseAuthId: `sub_admin_${Date.now()}`,
        email: `admin_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: adminRole.id } },
      },
    });

    await prisma.user.create({
      data: {
        id: targetUserId,
        supabaseAuthId: `sub_target_${Date.now()}`,
        email: `target_${Date.now()}@test.invalid`,
        status: UserStatus.SUSPENDED,
        userRoles: { create: { id: generateUuidV7(), roleId: creatorRole.id } },
      },
    });

    await expect(
      accountLifecycleService.transitionStatus({
        targetUserId,
        newStatus: UserStatus.DEACTIVATED,
        actorUserId: adminId,
        actorRoles: ['ADMIN'],
        reason: 'Attempting invalid transition',
      }),
    ).rejects.toThrow(InvalidLifecycleTransitionError);
  });

  it('prohibits non-admin users from modifying another user status', async () => {
    const userAId = generateUuidV7();
    const userBId = generateUuidV7();
    const creatorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CREATOR' } });

    await prisma.user.create({
      data: {
        id: userAId,
        supabaseAuthId: `sub_a_${Date.now()}`,
        email: `a_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: creatorRole.id } },
      },
    });

    await prisma.user.create({
      data: {
        id: userBId,
        supabaseAuthId: `sub_b_${Date.now()}`,
        email: `b_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: creatorRole.id } },
      },
    });

    await expect(
      accountLifecycleService.transitionStatus({
        targetUserId: userBId,
        newStatus: UserStatus.DEACTIVATED,
        actorUserId: userAId,
        actorRoles: ['CREATOR'],
        reason: 'Malicious modification attempt',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('allows self-deactivation and self-reactivation for a user', async () => {
    const userId = generateUuidV7();
    const creatorRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CREATOR' } });

    await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: `sub_self_${Date.now()}`,
        email: `self_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: creatorRole.id } },
      },
    });

    // 1. Self-deactivate
    const deactivated = await accountLifecycleService.selfDeactivate(
      userId,
      'Taking a break from platform',
    );
    expect(deactivated.status).toBe(UserStatus.DEACTIVATED);

    // 2. Self-reactivate
    const reactivated = await accountLifecycleService.selfReactivate(userId);
    expect(reactivated.status).toBe(UserStatus.ACTIVE);
  });

  it('prevents last active administrator lockout', async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });

    // Suspend any pre-existing active admins
    await prisma.$executeRaw`
      UPDATE users SET status = 'SUSPENDED'
      WHERE id IN (
        SELECT u.id FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        WHERE ur.role_id = ${adminRole.id}::uuid
      )
    `;

    // Create exactly ONE active admin
    const soloAdminId = generateUuidV7();
    await prisma.user.create({
      data: {
        id: soloAdminId,
        supabaseAuthId: `sub_solo_admin_${Date.now()}`,
        email: `solo_admin_${Date.now()}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: adminRole.id } },
      },
    });

    // Attempting to deactivate or suspend the only admin must throw LastAdminLockoutError
    await expect(
      accountLifecycleService.transitionStatus({
        targetUserId: soloAdminId,
        newStatus: UserStatus.DEACTIVATED,
        actorUserId: soloAdminId,
        actorRoles: ['ADMIN'],
        reason: 'Solo admin deactivation attempt',
      }),
    ).rejects.toThrow(LastAdminLockoutError);
  });
});
