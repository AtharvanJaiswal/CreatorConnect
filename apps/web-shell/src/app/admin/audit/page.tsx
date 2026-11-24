'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';

interface AuditTrailItem {
  id: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  reason: string;
  ipAddress: string;
  createdAt: string;
}

export default function AdminAuditTrailPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Unified immutable audit baseline
  const auditLogs: AuditTrailItem[] = [
    {
      id: 'aud-01',
      actorEmail: 'superadmin@creatorconnect.in',
      action: 'PLATFORM_SETTING_UPDATED',
      entity: 'PlatformSetting',
      entityId: 'platform.fee.percent',
      reason: 'Approved fee schedule update following quarterly board review',
      ipAddress: '103.21.244.18',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'aud-02',
      actorEmail: 'finance.lead@creatorconnect.in',
      action: 'REFUND_APPROVED',
      entity: 'Refund',
      entityId: 'ref-02',
      reason: 'Contract cancelled following dispute settlement; verified escrow balance',
      ipAddress: '49.37.192.8',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: 'aud-03',
      actorEmail: 'safety.lead@creatorconnect.in',
      action: 'USER_SUSPENDED',
      entity: 'User',
      entityId: '0192a0e2-1234-7000-8000-000000000003',
      reason: 'Repeated solicitations of off-platform payments violating safety guidelines',
      ipAddress: '157.48.201.99',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 'aud-04',
      actorEmail: 'superadmin@creatorconnect.in',
      action: 'ADMIN_ROLE_ASSIGNED',
      entity: 'AdminUserRole',
      entityId: '0192a0e2-1234-7000-8000-000000000097',
      reason: 'Onboarded Trust & Safety lead with reports review permissions',
      ipAddress: '103.21.244.18',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
  ];

  const filteredLogs = auditLogs.filter((log) => {
    if (search.trim()) {
      const matchSearch =
        log.actorEmail.toLowerCase().includes(search.toLowerCase()) ||
        log.reason.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
    }
    if (categoryFilter !== 'ALL') {
      if (
        categoryFilter === 'FINANCE' &&
        !log.action.includes('REFUND') &&
        !log.action.includes('PAYMENT')
      )
        return false;
      if (categoryFilter === 'SETTINGS' && !log.action.includes('SETTING')) return false;
      if (
        categoryFilter === 'USERS' &&
        !log.action.includes('USER') &&
        !log.action.includes('ADMIN')
      )
        return false;
    }
    return true;
  });

  const columns: Column<AuditTrailItem>[] = [
    {
      key: 'action',
      header: 'Administrative Action & Scope',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F] text-xs font-mono-code">{row.action}</span>
          <span className="text-xs text-[#6F675E]">
            Target: <strong className="text-[#14110F]">{row.entity}</strong> (
            {row.entityId.slice(0, 16)}...)
          </span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Officer & Origin',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs text-[#14110F]">{row.actorEmail}</span>
          <span className="text-[10px] text-[#A39A8F] font-mono-code">IP: {row.ipAddress}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Mandatory Audit Justification',
      render: (row) => (
        <span className="text-xs text-[#14110F] font-medium max-w-md block">
          &ldquo;{row.reason}&rdquo;
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">{new Date(row.createdAt).toLocaleString()}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
          Immutable Platform Audit Trail
        </h1>
        <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
          Cryptographically recorded ledger of administrative role grants, setting alterations,
          refund decisions, and suspensions.
        </p>
      </div>

      {/* Filter Bar */}
      <AdminCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8">
            <AdminInput
              placeholder="Search audit trail by actor email, justification keyword, or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-4">
            <AdminSelect
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Event Categories' },
                { value: 'FINANCE', label: 'Financial & Refunds' },
                { value: 'SETTINGS', label: 'Platform Configuration' },
                { value: 'USERS', label: 'Identity & RBAC Access' },
              ]}
            />
          </div>
        </div>
      </AdminCard>

      {/* Table */}
      <AdminTable columns={columns} data={filteredLogs} />
    </div>
  );
}
