import { type PrismaClient, getPrismaClient, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  AdminRoleResponse,
  AdminPermissionResponse,
  AdminUserRoleResponse,
} from '@creatorconnect/contracts';
import {
  AdminRoleNotFoundError,
  LastSuperAdminLockoutError,
  SystemRoleImmutableError,
} from '../../../errors/app-error.js';

export interface IAdminRbacRepository {
  listRoles(): Promise<AdminRoleResponse[]>;
  getRoleByIdOrName(idOrName: string): Promise<AdminRoleResponse | null>;
  createRole(
    data: { name: string; description?: string; permissions: string[] },
    actorId: string,
  ): Promise<AdminRoleResponse>;
  updateRole(
    id: string,
    data: { description?: string; permissions?: string[] },
    actorId: string,
  ): Promise<AdminRoleResponse>;
  deleteRole(id: string, actorId: string): Promise<void>;
  listPermissions(): Promise<AdminPermissionResponse[]>;
  listAdminUsers(): Promise<AdminUserRoleResponse[]>;
  assignRole(
    userId: string,
    roleName: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserRoleResponse>;
  revokeRole(
    userId: string,
    roleName: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserRoleResponse>;
}

export class AdminRbacRepository implements IAdminRbacRepository {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public async listRoles(): Promise<AdminRoleResponse[]> {
    const roles = await this.prisma.adminRole.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { adminUsers: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((p) => p.permission.name),
      userCount: r._count.adminUsers,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  public async getRoleByIdOrName(idOrName: string): Promise<AdminRoleResponse | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrName);

    const role = await this.prisma.adminRole.findFirst({
      where: isUuid ? { OR: [{ id: idOrName }, { name: idOrName }] } : { name: idOrName },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { adminUsers: true },
        },
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((p) => p.permission.name),
      userCount: role._count.adminUsers,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  public async createRole(
    data: { name: string; description?: string; permissions: string[] },
    actorId: string,
  ): Promise<AdminRoleResponse> {
    return await this.prisma.$transaction(async (tx) => {
      const roleId = generateUuidV7();

      // Verify permissions exist
      const permissionRecords = await tx.adminPermission.findMany({
        where: { name: { in: data.permissions } },
      });

      const role = await tx.adminRole.create({
        data: {
          id: roleId,
          name: data.name.toUpperCase().trim(),
          description: data.description ?? null,
          isSystem: false,
        },
      });

      // Link permissions
      if (permissionRecords.length > 0) {
        await tx.adminRolePermission.createMany({
          data: permissionRecords.map((p) => ({
            id: generateUuidV7(),
            roleId: role.id,
            permissionId: p.id,
          })),
        });
      }

      // Record immutable audit log
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: actorId,
          action: 'ADMIN_ROLE_CREATED',
          entity: 'AdminRole',
          entityId: role.id,
          metadata: {
            name: role.name,
            permissions: data.permissions,
          },
        },
      });

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: permissionRecords.map((p) => p.name),
        userCount: 0,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      };
    });
  }

  public async updateRole(
    id: string,
    data: { description?: string; permissions?: string[] },
    actorId: string,
  ): Promise<AdminRoleResponse> {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.adminRole.findUnique({
        where: { id },
        include: {
          permissions: { include: { permission: true } },
        },
      });

      if (!existing) {
        throw new AdminRoleNotFoundError(`Administrative role not found: ${id}`);
      }

      // Update description
      const updated = await tx.adminRole.update({
        where: { id },
        data: {
          description: data.description !== undefined ? data.description : existing.description,
        },
      });

      // Update permissions if provided
      let finalPermissions = existing.permissions.map((p) => p.permission.name);
      if (data.permissions !== undefined) {
        // Resolve permission records
        const permissionRecords = await tx.adminPermission.findMany({
          where: { name: { in: data.permissions } },
        });

        // Delete existing role-permissions
        await tx.adminRolePermission.deleteMany({
          where: { roleId: id },
        });

        // Create new role-permissions
        if (permissionRecords.length > 0) {
          await tx.adminRolePermission.createMany({
            data: permissionRecords.map((p) => ({
              id: generateUuidV7(),
              roleId: id,
              permissionId: p.id,
            })),
          });
        }
        finalPermissions = permissionRecords.map((p) => p.name);
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: actorId,
          action: 'ADMIN_ROLE_UPDATED',
          entity: 'AdminRole',
          entityId: id,
          metadata: {
            roleName: existing.name,
            previousPermissions: existing.permissions.map((p) => p.permission.name),
            newPermissions: finalPermissions,
          },
        },
      });

      const userCount = await tx.adminUserRole.count({ where: { roleId: id } });

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isSystem: updated.isSystem,
        permissions: finalPermissions,
        userCount,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  public async deleteRole(id: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.adminRole.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new AdminRoleNotFoundError(`Administrative role not found: ${id}`);
      }

      if (existing.isSystem) {
        throw new SystemRoleImmutableError(
          `System role "${existing.name}" cannot be deleted from the platform.`,
        );
      }

      await tx.adminRole.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: actorId,
          action: 'ADMIN_ROLE_DELETED',
          entity: 'AdminRole',
          entityId: id,
          metadata: {
            roleName: existing.name,
          },
        },
      });
    });
  }

  public async listPermissions(): Promise<AdminPermissionResponse[]> {
    const permissions = await this.prisma.adminPermission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });

    return permissions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      module: p.module,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  public async listAdminUsers(): Promise<AdminUserRoleResponse[]> {
    const adminUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          { userRoles: { some: { role: { name: RoleType.ADMIN } } } },
          { adminUserRoles: { some: {} } },
        ],
      },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return adminUsers.map((u) => {
      const roles = u.adminUserRoles.map((aur) => aur.role.name);
      const perms = new Set<string>();
      for (const aur of u.adminUserRoles) {
        for (const p of aur.role.permissions) {
          perms.add(p.permission.name);
        }
      }

      const latestAur = u.adminUserRoles[0];

      return {
        id: latestAur ? latestAur.id : u.id,
        userId: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roles,
        permissions: Array.from(perms),
        assignedAt: latestAur ? latestAur.createdAt.toISOString() : u.createdAt.toISOString(),
        assignedById: latestAur ? latestAur.assignedById : null,
      };
    });
  }

  public async assignRole(
    userId: string,
    roleName: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserRoleResponse> {
    return await this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!targetUser) {
        throw new Error(`Target user not found: ${userId}`);
      }

      const role = await tx.adminRole.findUnique({
        where: { name: roleName.toUpperCase().trim() },
        include: {
          permissions: { include: { permission: true } },
        },
      });
      if (!role) {
        throw new AdminRoleNotFoundError(`Administrative role not found: ${roleName}`);
      }

      if (role.name === 'SUPER_ADMIN') {
        await tx.$queryRaw`
          SELECT id
          FROM admin_roles
          WHERE id = ${role.id}::uuid
          FOR UPDATE
        `;
      }

      // Ensure target user has global RoleType.ADMIN on user_roles
      const globalAdminRole = await tx.role.findUniqueOrThrow({
        where: { name: RoleType.ADMIN },
      });
      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: targetUser.id,
            roleId: globalAdminRole.id,
          },
        },
        update: {},
        create: {
          id: generateUuidV7(),
          userId: targetUser.id,
          roleId: globalAdminRole.id,
        },
      });

      // Upsert admin_user_role
      const aur = await tx.adminUserRole.upsert({
        where: {
          userId_roleId: {
            userId: targetUser.id,
            roleId: role.id,
          },
        },
        update: {
          assignedById: actorId,
        },
        create: {
          id: generateUuidV7(),
          userId: targetUser.id,
          roleId: role.id,
          assignedById: actorId,
        },
      });

      // Fetch all roles for user post-mutation
      const allUserAdminRoles = await tx.adminUserRole.findMany({
        where: { userId: targetUser.id },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      });

      const roles = allUserAdminRoles.map((r) => r.role.name);
      const permissions = new Set<string>();
      for (const r of allUserAdminRoles) {
        for (const p of r.role.permissions) {
          permissions.add(p.permission.name);
        }
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: actorId,
          action: 'ADMIN_ROLE_ASSIGNED',
          entity: 'User',
          entityId: targetUser.id,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          metadata: {
            targetUserId: targetUser.id,
            roleName: role.name,
            assignedRoles: roles,
          },
        },
      });

      return {
        id: aur.id,
        userId: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        roles,
        permissions: Array.from(permissions),
        assignedAt: aur.createdAt.toISOString(),
        assignedById: aur.assignedById,
      };
    });
  }

  public async revokeRole(
    userId: string,
    roleName: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserRoleResponse> {
    return await this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!targetUser) {
        throw new Error(`Target user not found: ${userId}`);
      }

      const role = await tx.adminRole.findUnique({
        where: { name: roleName.toUpperCase().trim() },
      });
      if (!role) {
        throw new AdminRoleNotFoundError(`Administrative role not found: ${roleName}`);
      }

      // =========================================================================
      // Invariant: Prevent Accidental Lockout of the Last Active Super Administrator
      // =========================================================================
      if (role.name === 'SUPER_ADMIN') {
        // Lock the parent SUPER_ADMIN role row BEFORE scanning admin_user_roles so
        // concurrent revocations/assignments serialize under PostgreSQL READ COMMITTED.
        await tx.$queryRaw`
          SELECT id
          FROM admin_roles
          WHERE id = ${role.id}::uuid
          FOR UPDATE
        `;

        const activeSuperAdmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT u.id 
          FROM users u
          JOIN admin_user_roles aur ON u.id = aur.user_id
          WHERE aur.role_id = ${role.id}::uuid AND u.status = 'ACTIVE'
          ORDER BY u.id ASC
          FOR UPDATE OF u
        `;

        const isTargetActiveSuperAdmin = activeSuperAdmins.some((a) => a.id === userId);
        if (isTargetActiveSuperAdmin && activeSuperAdmins.length <= 1) {
          throw new LastSuperAdminLockoutError(
            'Cannot revoke SUPER_ADMIN role: At least one active Super Administrator must remain on the platform.',
          );
        }
      }

      // Delete admin_user_role record
      await tx.adminUserRole.deleteMany({
        where: {
          userId: targetUser.id,
          roleId: role.id,
        },
      });

      // Check remaining admin roles
      const remainingRoles = await tx.adminUserRole.findMany({
        where: { userId: targetUser.id },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      });

      // If user has zero admin roles left, remove global RoleType.ADMIN
      if (remainingRoles.length === 0) {
        const globalAdminRole = await tx.role.findUnique({
          where: { name: RoleType.ADMIN },
        });
        if (globalAdminRole) {
          await tx.userRole.deleteMany({
            where: {
              userId: targetUser.id,
              roleId: globalAdminRole.id,
            },
          });
        }
      }

      const roles = remainingRoles.map((r) => r.role.name);
      const permissions = new Set<string>();
      for (const r of remainingRoles) {
        for (const p of r.role.permissions) {
          permissions.add(p.permission.name);
        }
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: actorId,
          action: 'ADMIN_ROLE_REVOKED',
          entity: 'User',
          entityId: targetUser.id,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          metadata: {
            targetUserId: targetUser.id,
            revokedRoleName: role.name,
            remainingRoles: roles,
          },
        },
      });

      return {
        id: targetUser.id,
        userId: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        roles,
        permissions: Array.from(permissions),
        assignedAt: new Date().toISOString(),
        assignedById: actorId,
      };
    });
  }
}

export const adminRbacRepository = new AdminRbacRepository();
