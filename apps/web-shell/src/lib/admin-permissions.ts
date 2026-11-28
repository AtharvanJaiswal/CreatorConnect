export interface AdminUserLike {
  roles?: string[] | null | undefined;
  adminRoles?: string[] | null | undefined;
  adminPermissions?: string[] | null | undefined;
}

/**
 * Returns true strictly when an authenticated ADMIN user holds explicit
 * SUPER_ADMIN role assignment or the universal '*' permission.
 * Bare ADMIN accounts with empty or missing adminPermissions ALWAYS return false.
 */
export function isSuperAdminUser(user: AdminUserLike | null | undefined): boolean {
  if (!user || !Array.isArray(user.roles) || !user.roles.includes('ADMIN')) {
    return false;
  }
  const adminRoles = Array.isArray(user.adminRoles) ? user.adminRoles : [];
  const adminPermissions = Array.isArray(user.adminPermissions) ? user.adminPermissions : [];
  return adminRoles.includes('SUPER_ADMIN') || adminPermissions.includes('*');
}

/**
 * Returns true when an authenticated ADMIN user satisfies at least one
 * explicitly required administrative permission (or SUPER_ADMIN / '*').
 */
export function hasAnyAdminPermission(
  user: AdminUserLike | null | undefined,
  requiredPermissions: readonly string[],
): boolean {
  if (!user || !Array.isArray(user.roles) || !user.roles.includes('ADMIN')) {
    return false;
  }
  if (isSuperAdminUser(user)) {
    return true;
  }
  const adminPermissions = Array.isArray(user.adminPermissions) ? user.adminPermissions : [];
  if (adminPermissions.length === 0) {
    return false;
  }
  return requiredPermissions.some((perm) => adminPermissions.includes(perm));
}

export function hasAdminPermission(
  user: AdminUserLike | null | undefined,
  permission: string,
): boolean {
  return hasAnyAdminPermission(user, [permission]);
}

/**
 * Determines whether a user is authorized to enter the Admin Console shell.
 * Denies ordinary platform users AND bare ADMIN accounts with zero assigned
 * adminRoles/adminPermissions (fail-closed hydration).
 */
export function hasAdminConsoleAccess(user: AdminUserLike | null | undefined): boolean {
  if (!user || !Array.isArray(user.roles) || !user.roles.includes('ADMIN')) {
    return false;
  }
  if (isSuperAdminUser(user)) {
    return true;
  }
  const adminPermissions = Array.isArray(user.adminPermissions) ? user.adminPermissions : [];
  return adminPermissions.length > 0;
}
