import type { UserResponse } from '@creatorconnect/contracts';
import type { UserIdentity } from '@creatorconnect/auth';

/**
 * Maps internal UserIdentity to public API UserResponse.
 * Omits administrative RBAC claims for non-ADMIN users and attaches authoritative
 * backend-resolved adminRoles/adminPermissions only for ADMIN identities.
 */
export function toUserResponse(user: UserIdentity, avatarUrl: string | null = null): UserResponse {
  const response: UserResponse = {
    id: user.id,
    supabaseAuthId: user.supabaseAuthId,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl,
    status: user.status,
    roles: user.roles,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (user.roles.includes('ADMIN')) {
    response.adminRoles = user.adminRoles ?? [];
    response.adminPermissions = user.adminPermissions ?? [];
  }

  return response;
}
