import type { SelfSelectableRole, SyncUserResponse } from '@creatorconnect/contracts';
import { RoleType } from '@creatorconnect/database';
import { IUserRepository, userRepository } from '../../repositories/user.repository.js';
import { IdentityEmailConflictError, RoleEscalationAttemptError } from '../../errors/app-error.js';

const ALLOWED_SELF_ROLES: SelfSelectableRole[] = ['CREATOR', 'PROFESSIONAL', 'BRAND', 'PODCASTER'];

export class AuthService {
  private userRepo: IUserRepository;

  constructor(repo?: IUserRepository) {
    this.userRepo = repo || userRepository;
  }

  /**
   * Synchronizes external Supabase identity to internal CreatorConnect User model.
   * Enforces:
   * 1. Sub is canonical external identity
   * 2. Email collision safety (no automatic merge)
   * 3. Role escalation rejection (ADMIN cannot be self-selected)
   * 4. Atomic PostgreSQL transaction
   */
  public async syncUser(
    sub: string,
    email: string,
    preferredRole?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SyncUserResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user already exists by supabaseAuthId
    const existingBySub = await this.userRepo.findBySub(sub);
    if (existingBySub) {
      return {
        user: {
          id: existingBySub.id,
          supabaseAuthId: existingBySub.supabaseAuthId,
          email: existingBySub.email,
          firstName: existingBySub.firstName ?? null,
          lastName: existingBySub.lastName ?? null,
          avatarUrl: null,
          status: existingBySub.status,
          roles: existingBySub.roles,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isNewUser: false,
      };
    }

    // 2. Email collision check: If email belongs to another user with a different sub, NEVER merge
    const existingByEmail = await this.userRepo.findByEmail(normalizedEmail);
    if (existingByEmail) {
      throw new IdentityEmailConflictError(
        `Email '${normalizedEmail}' is already registered to another CreatorConnect identity. Account merge is prohibited.`,
      );
    }

    // 3. Role assignment validation: reject ADMIN and unauthorized roles
    let assignedRole: RoleType = RoleType.CREATOR;

    if (preferredRole !== undefined) {
      if (
        preferredRole === 'ADMIN' ||
        !ALLOWED_SELF_ROLES.includes(preferredRole as SelfSelectableRole)
      ) {
        throw new RoleEscalationAttemptError(
          `Cannot self-assign role '${preferredRole}'. Allowed onboarding roles: ${ALLOWED_SELF_ROLES.join(', ')}`,
        );
      }
      assignedRole = preferredRole as RoleType;
    }

    // 4. Create user with role and audit log atomically in PostgreSQL
    const createdUser = await this.userRepo.createUserWithRole(
      {
        supabaseAuthId: sub,
        email: normalizedEmail,
        roleName: assignedRole,
      },
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: createdUser.id,
        supabaseAuthId: createdUser.supabaseAuthId,
        email: createdUser.email,
        firstName: createdUser.firstName ?? null,
        lastName: createdUser.lastName ?? null,
        avatarUrl: null,
        status: createdUser.status,
        roles: createdUser.roles,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isNewUser: true,
    };
  }
}

export const authService = new AuthService();
