'use client';

import React from 'react';
import { useAuth } from '../../../providers/auth-provider';
import {
  hasAdminPermission,
  hasAnyAdminPermission,
  isSuperAdminUser,
  type AdminUserLike,
} from '../../../lib/admin-permissions';
import { Lock } from 'lucide-react';

export interface PermissionGateProps {
  permission?: string;
  permissions?: string[];
  role?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedPlaceholder?: boolean;
  lockedRole?: 'alert' | 'status';
}

export function PermissionGate({
  permission,
  permissions,
  role,
  children,
  fallback = null,
  showLockedPlaceholder = false,
  lockedRole,
}: PermissionGateProps) {
  const { user } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  const adminUser = user as AdminUserLike;
  const userRoles = Array.isArray(adminUser.roles) ? adminUser.roles : [];
  const adminRoles = Array.isArray(adminUser.adminRoles) ? adminUser.adminRoles : [];

  const isSuperAdmin = isSuperAdminUser(adminUser);

  let hasAccess = false;

  if (isSuperAdmin) {
    hasAccess = true;
  } else if (
    role &&
    userRoles.includes('ADMIN') &&
    (adminRoles.includes(role) || userRoles.includes(role))
  ) {
    hasAccess = true;
  } else if (permission && hasAdminPermission(adminUser, permission)) {
    hasAccess = true;
  } else if (
    permissions &&
    permissions.length > 0 &&
    hasAnyAdminPermission(adminUser, permissions)
  ) {
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (showLockedPlaceholder) {
    const requiredLabel =
      permission ||
      (permissions && permissions.length > 0 ? permissions.join(' or ') : role) ||
      'higher';
    return (
      <div
        role={lockedRole}
        className="flex items-center gap-2 p-4 rounded-xl bg-[#F2ECE1]/50 border border-[#E7E0D5] text-[#6F675E] text-xs"
      >
        <Lock className="w-4 h-4 text-[#A39A8F] shrink-0" />
        <span>Restricted action: Requires {requiredLabel} administrative privilege.</span>
      </div>
    );
  }

  return <>{fallback}</>;
}
