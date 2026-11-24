'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import '../../styles/admin.css';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return <div className="min-h-screen bg-[#FAF6EF] font-sans-body">{children}</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFD64A]" />
          <span className="text-sm font-semibold text-[#6F675E] font-sans-body">
            Verifying administrative access...
          </span>
        </div>
      </div>
    );
  }

  const userRoles = (user as any)?.roles || [];
  const adminRoles = (user as any)?.adminRoles || [];
  const adminPermissions = (user as any)?.adminPermissions || [];
  const isStaff =
    userRoles.includes('ADMIN') || adminRoles.length > 0 || adminPermissions.length > 0;

  if (!user || !isStaff) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] flex flex-col items-center justify-center p-4 font-sans-body">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#E7E0D5] p-8 text-center shadow-[0_12px_36px_rgba(20,17,15,0.06)]">
          <div className="w-16 h-16 rounded-full bg-[#FFF8D6] text-[#7A5B00] flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-[#C98A16]" />
          </div>
          <h2 className="text-xl font-bold text-[#14110F] mb-2 font-sans-body">
            Restricted Admin Console
          </h2>
          <p className="text-sm text-[#6F675E] mb-6 leading-relaxed">
            Administrative privileges required. Please sign in with an authorized staff account or
            contact your platform super-administrator.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/admin/login"
              className="btn-pill btn-pill-primary w-full py-3 text-sm font-bold shadow-xs"
            >
              Sign In to Admin Console
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF] flex flex-row font-sans-body text-[#14110F] selection:bg-[#FFD64A] selection:text-[#14110F]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
