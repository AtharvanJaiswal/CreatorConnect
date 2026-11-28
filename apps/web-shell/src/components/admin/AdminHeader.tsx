'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Menu, ShieldAlert, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';

export interface AdminHeaderProps {
  isMobileMenuOpen?: boolean;
  onOpenMobileMenu?: () => void;
  mobileMenuButtonRef?: React.RefObject<HTMLButtonElement>;
}

export function AdminHeader({
  isMobileMenuOpen = false,
  onOpenMobileMenu,
  mobileMenuButtonRef,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const userRoles = (user as any)?.roles || [];
  const adminRoles: string[] = (user as any)?.adminRoles || [];
  const primaryRole = adminRoles[0] || (userRoles.includes('ADMIN') ? 'UNASSIGNED_ADMIN' : 'STAFF');

  const pathParts = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, index) => {
    const href = '/' + pathParts.slice(0, index + 1).join('/');
    const title = part.charAt(0).toUpperCase() + part.slice(1);
    return { href, title };
  });

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E7E0D5] px-3 sm:px-6 py-3 flex items-center justify-between gap-2 min-w-0">
      {/* Mobile Menu Trigger & Breadcrumb Navigation */}
      <div className="flex items-center gap-2 min-w-0">
        {onOpenMobileMenu && (
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="admin-mobile-drawer"
            className="lg:hidden inline-flex items-center justify-center min-w-10 min-h-10 p-2 rounded-xl border border-[#E7E0D5] bg-white text-[#14110F] hover:bg-[#F2ECE1] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD64A]"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium font-sans-body min-w-0 truncate"
        >
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              {idx > 0 && (
                <span className="text-[#A39A8F] hidden sm:inline" aria-hidden="true">
                  /
                </span>
              )}
              {idx === breadcrumbs.length - 1 ? (
                <span className="font-bold text-[#14110F] truncate">{crumb.title}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-[#6F675E] hover:text-[#14110F] transition-colors hidden sm:inline shrink-0"
                >
                  {crumb.title}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Role Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF8D6] border border-[#FCE192] text-[#7A5B00] text-xs font-bold font-sans-body uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{primaryRole}</span>
        </div>

        {/* Notifications Icon */}
        <Link
          href="/admin/notifications"
          className="inline-flex items-center justify-center min-w-9 min-h-9 p-2 rounded-full text-[#6F675E] hover:text-[#14110F] hover:bg-[#F2ECE1] transition-colors relative"
          aria-label="Admin Notifications"
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FFD64A] ring-2 ring-white" />
        </Link>

        {/* User Identity Chip */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E7E0D5]">
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
            type="button"
            onClick={() => signOut()}
            aria-label="Sign out of Admin Console"
            className="inline-flex items-center justify-center min-w-9 min-h-9 p-1.5 text-[#6F675E] hover:text-[#D8483C] hover:bg-[#FBE9E7] rounded-full transition-colors sm:ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD64A]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
