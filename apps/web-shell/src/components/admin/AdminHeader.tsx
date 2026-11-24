'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, ShieldAlert, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';

export function AdminHeader() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const userRoles = (user as any)?.roles || [];
  const adminRoles: string[] = (user as any)?.adminRoles || [];
  const primaryRole = adminRoles[0] || (userRoles.includes('ADMIN') ? 'ADMIN' : 'STAFF');

  const pathParts = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, index) => {
    const href = '/' + pathParts.slice(0, index + 1).join('/');
    const title = part.charAt(0).toUpperCase() + part.slice(1);
    return { href, title };
  });

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E7E0D5] px-6 py-3 flex items-center justify-between">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-medium font-sans-body">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.href}>
            {idx > 0 && <span className="text-[#A39A8F]">/</span>}
            {idx === breadcrumbs.length - 1 ? (
              <span className="font-bold text-[#14110F]">{crumb.title}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-[#6F675E] hover:text-[#14110F] transition-colors"
              >
                {crumb.title}
              </Link>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Role Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF8D6] border border-[#FCE192] text-[#7A5B00] text-xs font-bold font-sans-body uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{primaryRole}</span>
        </div>

        {/* Notifications Icon */}
        <Link
          href="/admin/notifications"
          className="p-2 rounded-full text-[#6F675E] hover:text-[#14110F] hover:bg-[#F2ECE1] transition-colors relative"
          aria-label="Admin Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FFD64A] ring-2 ring-white" />
        </Link>

        {/* User Identity Chip */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#E7E0D5]">
          <div className="w-8 h-8 rounded-full bg-[#14110F] text-[#FFD64A] font-bold text-xs flex items-center justify-center shrink-0">
            {user?.email?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold text-[#14110F] truncate max-w-[140px] leading-tight font-sans-body">
              {user?.email || 'admin@creatorconnect.in'}
            </span>
            <span className="text-[10px] text-[#6F675E] leading-none font-sans-body">
              {user?.id ? `ID: ${user.id.slice(0, 8)}...` : 'Authorized Staff'}
            </span>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => signOut()}
            className="p-1.5 text-[#6F675E] hover:text-[#D8483C] hover:bg-[#FBE9E7] rounded-full transition-colors ml-1"
            title="Sign out of Admin Console"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
