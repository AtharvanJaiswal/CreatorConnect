'use client';

import React from 'react';
import { useAuth } from '../../../providers/auth-provider';
import { Lock } from 'lucide-react';

export interface PermissionGateProps {
  permission?: string;
  role?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedPlaceholder?: boolean;
}

export function PermissionGate({
  permission,
  role,
  children,
  fallback = null,
  showLockedPlaceholder = false,
}: PermissionGateProps) {
  const { user } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  const userRoles = (user as any).roles || [];
  const adminRoles = (user as any).adminRoles || [];
  const adminPermissions: string[] = (user as any).adminPermissions || [];

  const isSuperAdmin =
    adminRoles.includes('SUPER_ADMIN') ||
    adminPermissions.includes('*') ||
    (userRoles.includes('ADMIN') && (!adminPermissions || adminPermissions.length === 0));

  let hasAccess = false;

  if (isSuperAdmin) {
    hasAccess = true;
  } else if (role && (adminRoles.includes(role) || userRoles.includes(role))) {
    hasAccess = true;
  } else if (permission && adminPermissions.includes(permission)) {
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (showLockedPlaceholder) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl bg-[#F2ECE1]/50 border border-[#E7E0D5] text-[#6F675E] text-xs">
        <Lock className="w-4 h-4 text-[#A39A8F] shrink-0" />
        <span>
          Restricted action: Requires {permission || role || 'higher'} administrative privilege.
        </span>
      </div>
    );
  }

  return <>{fallback}</>;
}
