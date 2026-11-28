import { adminRbacRepository, type IAdminRbacRepository } from './admin-rbac.repository.js';
import { redisCache, type RedisCacheService } from '../../../services/redis-cache.js';
import { userRepository, type IUserRepository } from '../../../repositories/user.repository.js';
import type {
  AdminRoleResponse,
  AdminPermissionResponse,
  AdminUserRoleResponse,
  CreateAdminRoleRequest,
  UpdateAdminRoleRequest,
} from '@creatorconnect/contracts';
import { ForbiddenError, RoleEscalationAttemptError } from '../../../errors/app-error.js';

export class AdminRbacService {
  constructor(
    private readonly repo: IAdminRbacRepository = adminRbacRepository,
    private readonly cache: RedisCacheService = redisCache,
    private readonly userRepo: IUserRepository = userRepository,
  ) {}

  public async listRoles(): Promise<AdminRoleResponse[]> {
    return await this.repo.listRoles();
  }

  public async getRole(idOrName: string): Promise<AdminRoleResponse | null> {
    return await this.repo.getRoleByIdOrName(idOrName);
  }

  public async createRole(
    data: CreateAdminRoleRequest,
    actorId: string,
  ): Promise<AdminRoleResponse> {
    return await this.repo.createRole(data, actorId);
  }

  public async updateRole(
    id: string,
    data: UpdateAdminRoleRequest,
    actorId: string,
  ): Promise<AdminRoleResponse> {
    return await this.repo.updateRole(id, data, actorId);
  }

  public async deleteRole(id: string, actorId: string): Promise<void> {
    await this.repo.deleteRole(id, actorId);
  }

  public async listPermissions(): Promise<AdminPermissionResponse[]> {
    return await this.repo.listPermissions();
  }

  public async listAdminUsers(): Promise<AdminUserRoleResponse[]> {
    return await this.repo.listAdminUsers();
  }

  public async assignRole(
    targetUserId: string,
    roleName: string,
    actorAdmin: { id: string; adminRoles?: string[] | undefined },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserRoleResponse> {
    // Prevent self-assignment of administrative roles
    if (targetUserId === actorAdmin.id) {
      throw new RoleEscalationAttemptError(
        'Administrators cannot self-assign administrative roles.',
      );
    }

    // Non-super-admins cannot grant SUPER_ADMIN or manage roles beyond their own clearance
    if (
      roleName.toUpperCase() === 'SUPER_ADMIN' &&
      !actorAdmin.adminRoles?.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenError(
        'Only existing Super Administrators can grant the SUPER_ADMIN role.',
      );
    }

    const result = await this.repo.assignRole(
      targetUserId,
      roleName,
      actorAdmin.id,
      ipAddress,
      userAgent,
    );

    // Evict Redis identity cache for the target user to guarantee immediate authorization update
    const target = await this.userRepo.findById(targetUserId);
    if (target) {
      await this.cache.invalidateUser(targetUserId, target.supabaseAuthId);
    }

    return result;
  }

  public async revokeRole(
    targetUserId: string,
    roleName: string,
    actorAdmin: { id: string; adminRoles?: string[] | undefined },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserRoleResponse> {
    // Non-super-admins cannot revoke SUPER_ADMIN
    if (
      roleName.toUpperCase() === 'SUPER_ADMIN' &&
      !actorAdmin.adminRoles?.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenError(
        'Only existing Super Administrators can revoke the SUPER_ADMIN role.',
      );
    }

    const result = await this.repo.revokeRole(
      targetUserId,
      roleName,
      actorAdmin.id,
      ipAddress,
      userAgent,
    );

    // Evict Redis identity cache
    const target = await this.userRepo.findById(targetUserId);
    if (target) {
      await this.cache.invalidateUser(targetUserId, target.supabaseAuthId);
    }

    return result;
  }
}

export const adminRbacService = new AdminRbacService();
