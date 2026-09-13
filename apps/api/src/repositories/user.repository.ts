import { PrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type { UserIdentity } from '@creatorconnect/auth';
import { LastAdminLockoutError } from '../errors/app-error.js';

export interface CreateUserData {
  supabaseAuthId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roleName: RoleType;
}

export interface IUserRepository {
  findBySub(supabaseAuthId: string): Promise<UserIdentity | null>;
  findById(id: string): Promise<UserIdentity | null>;
  findByEmail(email: string): Promise<UserIdentity | null>;
  getStatusById(id: string): Promise<UserStatus | null>;
  getStatusBySub(
    supabaseAuthId: string,
  ): Promise<{ id: string; status: UserStatus; supabaseAuthId: string } | null>;
  createUserWithRole(
    data: CreateUserData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserIdentity>;
  updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string; avatarUrl?: string },
  ): Promise<UserIdentity>;
  updateStatus(
    targetUserId: string,
    newStatus: UserStatus,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserIdentity>;
}

export class PrismaUserRepository implements IUserRepository {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public async findBySub(supabaseAuthId: string): Promise<UserIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { supabaseAuthId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      supabaseAuthId: user.supabaseAuthId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status as UserStatus,
      roles: user.userRoles.map((ur) => ur.role.name as RoleType),
    };
  }

  public async findById(id: string): Promise<UserIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      supabaseAuthId: user.supabaseAuthId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status as UserStatus,
      roles: user.userRoles.map((ur) => ur.role.name as RoleType),
    };
  }

  public async findByEmail(email: string): Promise<UserIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      supabaseAuthId: user.supabaseAuthId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status as UserStatus,
      roles: user.userRoles.map((ur) => ur.role.name as RoleType),
    };
  }

  /**
   * PostgreSQL-authoritative check for user account status.
   */
  public async getStatusById(id: string): Promise<UserStatus | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { status: true },
    });
    return (user?.status as UserStatus) || null;
  }

  public async getStatusBySub(
    supabaseAuthId: string,
  ): Promise<{ id: string; status: UserStatus; supabaseAuthId: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { supabaseAuthId },
      select: { id: true, status: true, supabaseAuthId: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      status: user.status as UserStatus,
      supabaseAuthId: user.supabaseAuthId,
    };
  }

  /**
   * Transactional user provisioning: creates user, assigns role, and records audit log atomically.
   */
  public async createUserWithRole(
    data: CreateUserData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserIdentity> {
    const userId = generateUuidV7();
    const userRoleId = generateUuidV7();
    const auditLogId = generateUuidV7();

    return await this.prisma.$transaction(async (tx) => {
      // Find role
      const role = await tx.role.findUnique({
        where: { name: data.roleName },
      });

      if (!role) {
        throw new Error(`Role ${data.roleName} not found in database.`);
      }

      // Create User
      const user = await tx.user.create({
        data: {
          id: userId,
          supabaseAuthId: data.supabaseAuthId,
          email: data.email,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          status: UserStatus.ACTIVE,
        },
      });

      // Create UserRole
      await tx.userRole.create({
        data: {
          id: userRoleId,
          userId: user.id,
          roleId: role.id,
        },
      });

      // Create AuditLog
      await tx.auditLog.create({
        data: {
          id: auditLogId,
          userId: user.id,
          action: 'USER_REGISTERED',
          entity: 'User',
          entityId: user.id,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          metadata: {
            role: data.roleName,
            supabaseAuthId: data.supabaseAuthId,
          },
        },
      });

      return {
        id: user.id,
        supabaseAuthId: user.supabaseAuthId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status as UserStatus,
        roles: [data.roleName],
      };
    });
  }

  public async updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string; avatarUrl?: string },
  ): Promise<UserIdentity> {
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    return {
      id: updated.id,
      supabaseAuthId: updated.supabaseAuthId,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      status: updated.status as UserStatus,
      roles: updated.userRoles.map((ur) => ur.role.name as RoleType),
    };
  }

  /**
   * Concurrency-safe status update enforcing the last active admin invariant.
   * Acquires row-level locks on active admins within an explicit PostgreSQL transaction.
   */
  public async updateStatus(
    targetUserId: string,
    newStatus: UserStatus,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserIdentity> {
    return await this.prisma.$transaction(async (tx) => {
      // If changing status away from ACTIVE, check if target is an ADMIN
      if (newStatus !== UserStatus.ACTIVE) {
        // Execute pessimistic row-level lock on active administrators
        const activeAdmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT u.id 
          FROM users u
          JOIN user_roles ur ON u.id = ur.user_id
          JOIN roles r ON ur.role_id = r.id
          WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'
          FOR UPDATE OF u
        `;

        const isTargetAnActiveAdmin = activeAdmins.some((a) => a.id === targetUserId);

        if (isTargetAnActiveAdmin && activeAdmins.length <= 1) {
          throw new LastAdminLockoutError();
        }
      }

      // Update target user status
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { status: newStatus },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: adminUserId,
          action: 'USER_STATUS_UPDATED',
          entity: 'User',
          entityId: targetUserId,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          metadata: {
            previousStatus: updated.status,
            newStatus,
            targetUserId,
          },
        },
      });

      return {
        id: updated.id,
        supabaseAuthId: updated.supabaseAuthId,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        status: updated.status as UserStatus,
        roles: updated.userRoles.map((ur) => ur.role.name as RoleType),
      };
    });
  }
}

export const userRepository = new PrismaUserRepository();
