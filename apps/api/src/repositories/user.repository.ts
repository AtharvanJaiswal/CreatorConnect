import { PrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type { UserIdentity } from '@creatorconnect/auth';
import type { AdminPermission } from '@creatorconnect/contracts';
import { LastAdminLockoutError, LastSuperAdminLockoutError } from '../errors/app-error.js';
import { redisCache } from '../services/redis-cache.js';

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

  private mapToUserIdentity(user: any): UserIdentity {
    const roles = user.userRoles.map((ur: any) => ur.role.name as RoleType);
    let adminRoles: string[] | undefined;
    let adminPermissions: AdminPermission[] | undefined;

    if (roles.includes('ADMIN')) {
      if (user.adminUserRoles && user.adminUserRoles.length > 0) {
        adminRoles = user.adminUserRoles.map((aur: any) => aur.role.name);
        const perms = new Set<AdminPermission>();
        for (const aur of user.adminUserRoles) {
          for (const rp of aur.role.permissions || []) {
            if (rp.permission?.name) {
              perms.add(rp.permission.name as AdminPermission);
            }
          }
        }
        adminPermissions = Array.from(perms);
      } else {
        // Zero-trust deny-by-default: if an admin user doesn't have granular role entries,
        // they possess zero administrative roles and zero administrative permissions.
        adminRoles = [];
        adminPermissions = [];
      }
    }

    return {
      id: user.id,
      supabaseAuthId: user.supabaseAuthId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status as UserStatus,
      roles,
      adminRoles,
      adminPermissions,
    };
  }

  private readonly userIncludes = {
    userRoles: {
      include: { role: true },
    },
    adminUserRoles: {
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    },
  };

  public async findBySub(supabaseAuthId: string): Promise<UserIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { supabaseAuthId },
      include: this.userIncludes,
    });

    if (!user) return null;
    return this.mapToUserIdentity(user);
  }

  public async findById(id: string): Promise<UserIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.userIncludes,
    });

    if (!user) return null;
    return this.mapToUserIdentity(user);
  }

  public async findByEmail(email: string): Promise<UserIdentity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.userIncludes,
    });

    if (!user) return null;
    return this.mapToUserIdentity(user);
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
      include: this.userIncludes,
    });

    return this.mapToUserIdentity(updated);
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
      // If changing status away from ACTIVE, check if target is an ADMIN or SUPER_ADMIN
      if (newStatus !== UserStatus.ACTIVE) {
        // Acquire parent role locks in consistent order (roles -> admin_roles -> users)
        // so concurrent RBAC mutations and status updates serialize under READ COMMITTED.
        await tx.$queryRaw`
          SELECT id FROM roles WHERE name = 'ADMIN' FOR UPDATE
        `;
        await tx.$queryRaw`
          SELECT id FROM admin_roles WHERE name = 'SUPER_ADMIN' FOR UPDATE
        `;

        // Execute pessimistic row-level lock on active administrators
        const activeAdmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT u.id 
          FROM users u
          JOIN user_roles ur ON u.id = ur.user_id
          JOIN roles r ON ur.role_id = r.id
          WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'
          ORDER BY u.id ASC
          FOR UPDATE OF u
        `;

        const isTargetAnActiveAdmin = activeAdmins.some((a) => a.id === targetUserId);

        if (isTargetAnActiveAdmin && activeAdmins.length <= 1) {
          throw new LastAdminLockoutError();
        }

        // Enforce invariant: Prevent suspension/lockout of the last active Super Administrator
        const activeSuperAdmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT u.id 
          FROM users u
          JOIN admin_user_roles aur ON u.id = aur.user_id
          JOIN admin_roles ar ON aur.role_id = ar.id
          WHERE ar.name = 'SUPER_ADMIN' AND u.status = 'ACTIVE'
          ORDER BY u.id ASC
          FOR UPDATE OF u
        `;

        const isTargetActiveSuperAdmin = activeSuperAdmins.some((a) => a.id === targetUserId);
        if (isTargetActiveSuperAdmin && activeSuperAdmins.length <= 1) {
          throw new LastSuperAdminLockoutError(
            'Cannot deactivate or suspend the last active Super Administrator on the platform.',
          );
        }
      }

      // Capture the previous status BEFORE mutation for forensically correct audit trail.
      const currentRecord = await tx.user.findUniqueOrThrow({
        where: { id: targetUserId },
        select: { status: true },
      });
      const previousStatus = currentRecord.status;

      // Update target user status
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { status: newStatus },
        include: this.userIncludes,
      });

      // Create Audit Log with accurate before/after state
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
            previousStatus,
            newStatus,
            targetUserId,
          },
        },
      });

      // Invalidate Redis user identity cache to guarantee immediate authorization update
      await redisCache.invalidateUser(updated.id, updated.supabaseAuthId);

      return this.mapToUserIdentity(updated);
    });
  }
}

export const userRepository = new PrismaUserRepository();
