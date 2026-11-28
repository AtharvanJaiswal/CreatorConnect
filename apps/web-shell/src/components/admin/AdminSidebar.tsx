'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Star,
  CreditCard,
  RotateCcw,
  Scale,
  Bell,
  Sliders,
  Cpu,
  UserCheck,
  History,
  Lock,
  Headphones,
  FileText,
  X,
} from 'lucide-react';
import { CcLogoSquare } from '../ui/cc-brand';
import { useAuth } from '../../providers/auth-provider';
import { hasAnyAdminPermission, type AdminUserLike } from '../../lib/admin-permissions';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'warning' | 'danger' | 'info';
  permission?: string;
  permissions?: string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
        permission: 'analytics.read',
      },
    ],
  },
  {
    title: 'Trust & Safety',
    items: [
      {
        name: 'Verification',
        href: '/admin/verification',
        icon: ShieldCheck,
        badge: 'Queue',
        permission: 'users.read',
      },
      {
        name: 'Moderation & Reports',
        href: '/admin/moderation',
        icon: AlertTriangle,
        badgeVariant: 'danger',
        permission: 'reports.review',
      },
      {
        name: 'Reviews',
        href: '/admin/reviews',
        icon: Star,
        permission: 'reviews.moderate',
      },
      {
        name: 'Disputes',
        href: '/admin/disputes',
        icon: Scale,
        badgeVariant: 'warning',
        permissions: [
          'projects.moderate',
          'reports.review',
          'reports.resolve',
          'payments.read',
          'payments.refund.approve',
        ],
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        name: 'Users Directory',
        href: '/admin/users',
        icon: Users,
        permission: 'users.read',
      },
      {
        name: 'Assignments & Projects',
        href: '/admin/assignments',
        icon: FileCheck,
        permission: 'projects.read',
      },
      {
        name: 'Support Inquiries',
        href: '/admin/support',
        icon: Headphones,
        permission: 'support.manage',
      },
      {
        name: 'Broadcast Campaigns',
        href: '/admin/notifications',
        icon: Bell,
        permission: 'settings.read',
      },
    ],
  },
  {
    title: 'Finance & Ledger',
    items: [
      {
        name: 'Payments & Escrows',
        href: '/admin/payments',
        icon: CreditCard,
        permission: 'payments.read',
      },
      {
        name: 'Dual-Approval Refunds',
        href: '/admin/refunds',
        icon: RotateCcw,
        badgeVariant: 'warning',
        permissions: ['payments.read', 'payments.refund.request', 'payments.refund.approve'],
      },
      {
        name: 'Ledger Reconciliation',
        href: '/admin/reconciliation',
        icon: FileText,
        permission: 'payments.reconcile',
      },
      { name: 'Referrals & Subscriptions', href: '/admin/referrals', icon: Star },
    ],
  },
  {
    title: 'Platform & Governance',
    items: [
      {
        name: 'Platform Settings',
        href: '/admin/config',
        icon: Sliders,
        permission: 'settings.read',
      },
      {
        name: 'Worker Queues',
        href: '/admin/jobs',
        icon: Cpu,
        permission: 'settings.read',
      },
      {
        name: 'Staff & RBAC',
        href: '/admin/admins',
        icon: UserCheck,
        permission: 'admins.read',
      },
      {
        name: 'Roles & Permissions',
        href: '/admin/roles',
        icon: Lock,
        permission: 'admins.read',
      },
      {
        name: 'Audit Trail',
        href: '/admin/audit',
        icon: History,
        permission: 'audit.read',
      },
      {
        name: 'Privacy & Lifecycle',
        href: '/admin/lifecycle',
        icon: Lock,
        permission: 'users.privacy',
      },
    ],
  },
];

export interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  restoreFocusRef?: React.RefObject<HTMLButtonElement>;
}

function SidebarNavContent({
  visibleSections,
  pathname,
  onNavigate,
  onMobileClose,
  closeButtonRef,
}: {
  visibleSections: NavSection[];
  pathname: string;
  onNavigate?: (() => void) | undefined;
  onMobileClose?: (() => void) | undefined;
  closeButtonRef?: React.RefObject<HTMLButtonElement> | undefined;
}) {
  return (
    <>
      {/* Brand Header */}
      <div className="p-4 border-b border-[#E7E0D5] bg-[#FAF6EF] flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <Link
          href="/admin/dashboard"
          {...(onNavigate ? { onClick: onNavigate } : {})}
          className="flex items-center gap-3 min-w-0"
        >
          <CcLogoSquare size="sm" className="rounded-lg bg-[#14110F] text-[#FFD64A] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-extrabold text-sm tracking-tight text-[#14110F] font-sans-body truncate">
              CreatorConnect
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F675E]">
              Admin Console
            </span>
          </div>
        </Link>

        {onMobileClose && (
          <button
            ref={closeButtonRef}
            type="button"
            autoFocus
            onClick={onMobileClose}
            aria-label="Close navigation menu"
            className="lg:hidden inline-flex items-center justify-center min-w-10 min-h-10 p-2 rounded-xl border border-[#E7E0D5] bg-white text-[#14110F] hover:bg-[#F2ECE1] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD64A]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Nav Sections */}
      <div className="flex-1 px-3 py-4 space-y-6">
        {visibleSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h2 className="px-3 text-[11px] font-bold text-[#A39A8F] uppercase tracking-wider font-sans-body">
              {section.title}
            </h2>
            <div className="space-y-0.5 pt-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...(onNavigate ? { onClick: onNavigate } : {})}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold font-sans-body transition-colors ${
                      isActive
                        ? 'bg-[#FFD64A] text-[#14110F] shadow-xs font-bold'
                        : 'text-[#6F675E] hover:text-[#14110F] hover:bg-[#F2ECE1]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        aria-hidden="true"
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#14110F]' : 'text-[#6F675E]'}`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          isActive
                            ? 'bg-[#14110F] text-[#FFD64A]'
                            : item.badgeVariant === 'danger'
                              ? 'bg-[#FBE9E7] text-[#D8483C]'
                              : item.badgeVariant === 'warning'
                                ? 'bg-[#FBF1DC] text-[#C98A16]'
                                : 'bg-[#F2ECE1] text-[#6F675E]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Platform Status */}
      <div className="p-3 border-t border-[#E7E0D5] bg-[#FAF6EF]">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E7E0D5] text-xs font-semibold text-[#14110F]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2E9E6B] animate-pulse motion-reduce:animate-none"></span>
            <span className="text-[11px] font-bold">Platform Secure</span>
          </div>
          <span className="text-[10px] text-[#A39A8F] font-mono">v1.0.0</span>
        </div>
      </div>
    </>
  );
}

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
  restoreFocusRef,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasMobileOpenRef = useRef(false);
  const adminUser = user as AdminUserLike | null | undefined;
  const isAuthenticatedAdmin = Boolean(adminUser?.roles?.includes('ADMIN'));

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!isAuthenticatedAdmin) return false;
      const requiredPerms = item.permissions
        ? item.permissions
        : item.permission
          ? [item.permission]
          : [];
      if (requiredPerms.length === 0) return true;
      return hasAnyAdminPermission(adminUser, requiredPerms);
    }),
  })).filter((section) => section.items.length > 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== 'function') return;

    if (mobileOpen && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!mobileOpen && dialog.open) {
      dialog.close();
    }

    if (wasMobileOpenRef.current && !mobileOpen) {
      requestAnimationFrame(() => {
        restoreFocusRef?.current?.focus();
      });
    }
    wasMobileOpenRef.current = mobileOpen;
  }, [mobileOpen, restoreFocusRef]);

  return (
    <>
      {/* Desktop Sticky Sidebar (>= 1024px) */}
      <aside
        aria-label="Primary sidebar navigation"
        className="hidden lg:flex w-64 bg-[#FAF6EF] border-r border-[#E7E0D5] flex-col shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto custom-scrollbar"
      >
        <nav aria-label="Primary admin navigation" className="flex flex-col flex-1">
          <SidebarNavContent visibleSections={visibleSections} pathname={pathname} />
        </nav>
      </aside>

      {/* Mobile Top-Layer Navigation Drawer (< 1024px) */}
      <dialog
        ref={dialogRef}
        id="admin-mobile-drawer"
        aria-label="Admin navigation drawer"
        onClose={() => onMobileClose?.()}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            onMobileClose?.();
          }
        }}
        className="lg:hidden fixed inset-0 m-0 p-0 w-full h-full max-w-none max-h-none bg-transparent border-0 overflow-visible backdrop:bg-[#14110F]/45 backdrop:backdrop-blur-xs open:flex"
      >
        <nav
          aria-label="Mobile admin navigation"
          className="w-[min(18rem,82dvw)] h-[100svh] bg-[#FAF6EF] border-r border-[#E7E0D5] flex flex-col overflow-y-auto custom-scrollbar shadow-2xl"
        >
          <SidebarNavContent
            visibleSections={visibleSections}
            pathname={pathname}
            onNavigate={onMobileClose}
            onMobileClose={onMobileClose || (() => {})}
            closeButtonRef={closeButtonRef}
          />
        </nav>
      </dialog>
    </>
  );
}
