'use client';

import React from 'react';
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
} from 'lucide-react';
import { CcLogoSquare } from '../ui/cc-brand';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'warning' | 'danger' | 'info';
  permission?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Trust & Safety',
    items: [
      { name: 'Verification', href: '/admin/verification', icon: ShieldCheck, badge: 'Queue' },
      {
        name: 'Moderation & Reports',
        href: '/admin/moderation',
        icon: AlertTriangle,
        badgeVariant: 'danger',
      },
      { name: 'Reviews', href: '/admin/reviews', icon: Star },
      { name: 'Disputes', href: '/admin/disputes', icon: Scale, badgeVariant: 'warning' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { name: 'Users Directory', href: '/admin/users', icon: Users },
      { name: 'Assignments & Projects', href: '/admin/assignments', icon: FileCheck },
      { name: 'Support Inquiries', href: '/admin/support', icon: Headphones },
      { name: 'Broadcast Campaigns', href: '/admin/notifications', icon: Bell },
    ],
  },
  {
    title: 'Finance & Ledger',
    items: [
      { name: 'Payments & Escrows', href: '/admin/payments', icon: CreditCard },
      {
        name: 'Dual-Approval Refunds',
        href: '/admin/refunds',
        icon: RotateCcw,
        badgeVariant: 'warning',
      },
      { name: 'Ledger Reconciliation', href: '/admin/reconciliation', icon: FileText },
      { name: 'Referrals & Subscriptions', href: '/admin/referrals', icon: Star },
    ],
  },
  {
    title: 'Platform & Governance',
    items: [
      { name: 'Platform Settings', href: '/admin/config', icon: Sliders },
      { name: 'Worker Queues', href: '/admin/jobs', icon: Cpu },
      { name: 'Staff & RBAC', href: '/admin/admins', icon: UserCheck },
      { name: 'Roles & Permissions', href: '/admin/roles', icon: Lock },
      { name: 'Audit Trail', href: '/admin/audit', icon: History },
      { name: 'Privacy & Lifecycle', href: '/admin/lifecycle', icon: Lock },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#FAF6EF] border-r border-[#E7E0D5] flex flex-col shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto custom-scrollbar">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#E7E0D5] bg-[#FAF6EF] flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <CcLogoSquare size="sm" className="rounded-lg bg-[#14110F] text-[#FFD64A]" />
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-[#14110F] font-sans-body">
              CreatorConnect
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F675E]">
              Admin Console
            </span>
          </div>
        </Link>
      </div>

      {/* Nav Sections */}
      <div className="flex-1 px-3 py-4 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <h4 className="px-3 text-[11px] font-bold text-[#A39A8F] uppercase tracking-wider font-sans-body">
              {section.title}
            </h4>
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
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold font-sans-body transition-colors ${
                      isActive
                        ? 'bg-[#FFD64A] text-[#14110F] shadow-xs font-bold'
                        : 'text-[#6F675E] hover:text-[#14110F] hover:bg-[#F2ECE1]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#14110F]' : 'text-[#6F675E]'}`}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
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
            <span className="w-2 h-2 rounded-full bg-[#2E9E6B] animate-pulse"></span>
            <span className="text-[11px] font-bold">Platform Secure</span>
          </div>
          <span className="text-[10px] text-[#A39A8F] font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
