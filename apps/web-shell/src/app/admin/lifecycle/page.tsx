'use client';

import React from 'react';
import { Lock, ShieldAlert, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';

interface LegalHoldItem {
  id: string;
  userId: string;
  reason: string;
  scope: string;
  placedBy: string;
  createdAt: string;
}

export default function AdminLifecyclePage() {
  // Read-only compliance baseline
  const legalHolds: LegalHoldItem[] = [
    {
      id: 'lh-01',
      userId: '0192a0e2-1234-7000-8000-000000000003',
      reason: 'Active tax audit inquiry & double-entry ledger verification',
      scope: 'ALL_FINANCIAL_RECORDS',
      placedBy: 'finance.lead@creatorconnect.in',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    },
    {
      id: 'lh-02',
      userId: '0192a0e2-1234-7000-8000-000000000044',
      reason: 'Ongoing intellectual property arbitration regarding commercial brief #proj-01',
      scope: 'DELIVERABLE_MEDIA',
      placedBy: 'legal@creatorconnect.in',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
  ];

  const columns: Column<LegalHoldItem>[] = [
    {
      key: 'reason',
      header: 'Hold Scope & Preservation Reason',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F] text-xs">{row.reason}</span>
          <span className="text-xs text-[#6F675E] font-mono-code">Scope: {row.scope}</span>
        </div>
      ),
    },
    {
      key: 'userId',
      header: 'Target User UUID',
      render: (row) => <span className="font-mono-code text-xs text-[#14110F]">{row.userId}</span>,
    },
    {
      key: 'placedBy',
      header: 'Placed By Officer',
      render: (row) => <span className="text-xs text-[#6F675E]">{row.placedBy}</span>,
    },
    {
      key: 'createdAt',
      header: 'Preservation Date',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Enforcement',
      render: () => (
        <AdminBadge variant="warning" size="sm" dot>
          ACTIVE HOLD
        </AdminBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
          Privacy, Account Lifecycle & Legal Holds
        </h1>
        <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
          Read-only inspection of statutory preservation holds, cooling-off periods, and DPDP / GDPR
          compliance states.
        </p>
      </div>

      {/* Governance Gate Warning Banner */}
      <div className="p-5 rounded-2xl bg-[#FFF8D6] border border-[#FCE192] flex items-start gap-3.5 text-xs text-[#7A5B00]">
        <Lock className="w-5 h-5 shrink-0 mt-0.5 text-[#C98A16]" />
        <div>
          <h4 className="font-bold text-sm text-[#14110F] mb-1">
            Destructive Erasure Execution Strictly Gated (Phase 3B.9 Governance Hold)
          </h4>
          <p className="leading-relaxed opacity-90">
            Per the platform architectural governance protocol, all destructive PII pseudonymization
            and R2/S3 asset expungement mechanisms remain strictly disabled at the UI level pending
            formal executive sign-off of the Stage A Governance Approval Package and Migration 0013
            rehearsal. Active legal holds take absolute precedence over any user deletion requests.
          </p>
        </div>
      </div>

      {/* Cooling-off Timers & Account States */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AdminCard padding="md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
              Active Legal Holds
            </span>
            <ShieldAlert className="w-4 h-4 text-[#C98A16]" />
          </div>
          <div className="text-3xl font-black text-[#14110F] font-mono-code mb-1">2</div>
          <p className="text-xs text-[#6F675E]">Accounts with frozen deletion eligibility</p>
        </AdminCard>

        <AdminCard padding="md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
              Cooling-Off Queue
            </span>
            <Clock className="w-4 h-4 text-[#2B73C2]" />
          </div>
          <div className="text-3xl font-black text-[#14110F] font-mono-code mb-1">1</div>
          <p className="text-xs text-[#6F675E]">Deactivations within 30-day grace window</p>
        </AdminCard>

        <AdminCard padding="md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
              Erasure Certificates
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#2E9E6B]" />
          </div>
          <div className="text-3xl font-black text-[#14110F] font-mono-code mb-1">0</div>
          <p className="text-xs text-[#6F675E]">Verified privacy receipts issued</p>
        </AdminCard>
      </div>

      {/* Active Legal Holds Table */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-[#14110F]">Active Statutory Legal Holds</h3>
        <AdminTable columns={columns} data={legalHolds} />
      </div>

      {/* Gated Erasure Execution Controls (Strictly Disabled) */}
      <AdminCard padding="md" className="border-[#F6C4C0] bg-[#FAF6EF]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-[#14110F] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D8483C]" />
              <span>Irreversible PII Pseudonymization & Media Expungement</span>
            </h4>
            <p className="text-xs text-[#6F675E] mt-1">
              Trigger cryptographic anonymization and purge media blobs from Cloudflare R2 storage.
            </p>
          </div>

          <button
            disabled
            title="Disabled pending formal Stage A Executive Governance unblocking"
            className="btn-pill btn-pill-outline text-xs px-5 py-2.5 opacity-50 cursor-not-allowed text-[#A39A8F] border-[#D8D1C6] flex items-center gap-2 font-bold"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Execution Gated</span>
          </button>
        </div>
      </AdminCard>
    </div>
  );
}
