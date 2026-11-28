'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  Briefcase,
  AlertTriangle,
  Scale,
  TrendingUp,
  ArrowUpRight,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { AdminCard, AdminCardHeader } from '../../../components/admin/ui/AdminCard';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminErrorBanner } from '../../../components/admin/ui/AdminErrorBanner';
import { apiClient } from '../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../lib/admin-error';
import type { DashboardOverviewResponse } from '@creatorconnect/contracts';

type DashboardMetrics = DashboardOverviewResponse['metrics'];

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [period, setPeriod] = useState<string>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<DashboardOverviewResponse>(
        '/api/v1/admin/dashboard/overview',
        { params: { period } },
      );
      if (data?.metrics) {
        setMetrics(data.metrics);
        if (data.period) setPeriod(data.period);
      } else {
        setMetrics(null);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      setMetrics(null);
      setFetchError(
        parseAdminApiError(err, 'Failed to load executive overview telemetry from backend API.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const formatMinorToInr = (minorStr?: string) => {
    if (!minorStr) return '₹0.00';
    const minor = parseInt(minorStr, 10);
    if (isNaN(minor)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(minor / 100);
  };

  return (
    <div className="space-y-8 font-sans-body">
      {/* Top Welcome & Period Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Executive Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Real-time multi-sided platform health, liquidity, and trust metrics.
            {lastRefreshed ? ` Last updated at ${lastRefreshed.toLocaleTimeString()}.` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-[#E7E0D5] bg-white p-1 text-xs font-semibold">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full transition-colors ${
                  period === p
                    ? 'bg-[#FFD64A] text-[#14110F] font-bold shadow-2xs'
                    : 'text-[#6F675E] hover:text-[#14110F]'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <AdminButton
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </AdminButton>
        </div>
      </div>

      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchOverview} />}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <AdminCard padding="md" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
                User Directory
              </span>
              <div className="w-8 h-8 rounded-full bg-[#FAF6EF] flex items-center justify-center text-[#14110F]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-[#14110F] font-mono-code mb-1">
              {metrics ? metrics.totalUsers.toLocaleString() : '—'}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#2E9E6B] font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {metrics
                  ? `+${metrics.registrationGrowthPercent}% this period`
                  : 'Awaiting metrics'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#EFE9DF] flex items-center justify-between text-xs text-[#6F675E]">
            <span>Active: {metrics?.activeUsers || 0}</span>
            <Link
              href="/admin/users"
              className="font-bold text-[#14110F] hover:underline flex items-center gap-0.5"
            >
              <span>View</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </AdminCard>

        {/* GMV Volume */}
        <AdminCard padding="md" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
                Gross Volume (GMV)
              </span>
              <div className="w-8 h-8 rounded-full bg-[#E6F4EC] flex items-center justify-center text-[#2E9E6B]">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-[#14110F] font-mono-code mb-1">
              {formatMinorToInr(metrics?.totalTransactionVolumeMinor)}
            </div>
            <div className="text-xs text-[#6F675E]">
              Platform Fee Revenue:{' '}
              <strong className="text-[#14110F]">
                {formatMinorToInr(metrics?.platformRevenueMinor)}
              </strong>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#EFE9DF] flex items-center justify-between text-xs text-[#6F675E]">
            <span>Success Rate: {metrics?.paymentSuccessRate || 0}%</span>
            <Link
              href="/admin/payments"
              className="font-bold text-[#14110F] hover:underline flex items-center gap-0.5"
            >
              <span>Ledger</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </AdminCard>

        {/* Active Projects */}
        <AdminCard padding="md" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
                Marketplace Projects
              </span>
              <div className="w-8 h-8 rounded-full bg-[#EBF3FD] flex items-center justify-center text-[#2B73C2]">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-[#14110F] font-mono-code mb-1">
              {metrics ? metrics.projectsCreated.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-[#6F675E]">
              In Escrow / Active:{' '}
              <strong className="text-[#14110F]">{metrics?.projectsInProgress || 0}</strong>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#EFE9DF] flex items-center justify-between text-xs text-[#6F675E]">
            <span>Completed: {metrics?.projectsCompleted || 0}</span>
            <Link
              href="/admin/assignments"
              className="font-bold text-[#14110F] hover:underline flex items-center gap-0.5"
            >
              <span>Inspect</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </AdminCard>

        {/* Trust & Safety Queue */}
        <AdminCard padding="md" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
                Trust & Safety
              </span>
              <div className="w-8 h-8 rounded-full bg-[#FBE9E7] flex items-center justify-center text-[#D8483C]">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-[#D8483C] font-mono-code mb-1">
              {(metrics?.pendingModerationReports || 0) + (metrics?.projectsDisputed || 0)}
            </div>
            <div className="text-xs text-[#6F675E]">
              Pending Reports: <strong>{metrics?.pendingModerationReports || 0}</strong> • Disputes:{' '}
              <strong>{metrics?.projectsDisputed || 0}</strong>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#EFE9DF] flex items-center justify-between text-xs text-[#6F675E]">
            <span>Support: {metrics?.openSupportTickets || 0} open</span>
            <Link
              href="/admin/moderation"
              className="font-bold text-[#D8483C] hover:underline flex items-center gap-0.5"
            >
              <span>Triage Queue</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </AdminCard>
      </div>

      {/* Actionable Operation Hubs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Review Queues */}
        <div className="lg:col-span-2 space-y-6">
          <AdminCard padding="none">
            <div className="p-5 border-b border-[#E7E0D5]">
              <h3 className="text-base font-bold text-[#14110F]">
                High-Priority Operational Actions
              </h3>
              <p className="text-xs text-[#6F675E] mt-0.5">
                Critical queues requiring manual administrative approval
              </p>
            </div>
            <div className="divide-y divide-[#EFE9DF]">
              <div className="p-4 flex items-center justify-between hover:bg-[#FAF6EF]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FBF1DC] text-[#C98A16] flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#14110F]">
                      Pending Dual-Approval Refunds
                    </h4>
                    <p className="text-xs text-[#6F675E]">
                      {metrics
                        ? `${metrics.pendingRefundsCount} refund request(s) awaiting review`
                        : 'Inspect dual-approval refund queue'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/refunds"
                  className="btn-pill btn-pill-secondary text-xs px-4 py-1.5 font-bold"
                >
                  Review Approvals
                </Link>
              </div>

              <div className="p-4 flex items-center justify-between hover:bg-[#FAF6EF]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF8D6] text-[#7A5B00] flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#14110F]">
                      Creator Verification Submissions
                    </h4>
                    <p className="text-xs text-[#6F675E]">
                      New showreels and profile badge applications
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/verification"
                  className="btn-pill btn-pill-secondary text-xs px-4 py-1.5 font-bold"
                >
                  Verify Creators
                </Link>
              </div>

              <div className="p-4 flex items-center justify-between hover:bg-[#FAF6EF]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FBE9E7] text-[#D8483C] flex items-center justify-center shrink-0">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#14110F]">Open Contract Disputes</h4>
                    <p className="text-xs text-[#6F675E]">
                      Active escrow freezes pending arbitration adjudication
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/disputes"
                  className="btn-pill btn-pill-secondary text-xs px-4 py-1.5 font-bold"
                >
                  Adjudicate
                </Link>
              </div>
            </div>
          </AdminCard>

          {/* Platform Performance & System Health */}
          <AdminCard padding="md">
            <AdminCardHeader
              title="Infrastructure & Workers Status"
              subtitle="BullMQ Redis queue backlogs and background processing"
              action={
                <Link
                  href="/admin/jobs"
                  className="text-xs font-bold text-[#14110F] hover:underline flex items-center gap-1"
                >
                  <span>Queues Monitor</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  Realtime Gateway
                </span>
                <span className="text-sm font-bold text-[#14110F] flex items-center gap-1.5 mt-1">
                  <span>Socket.IO Active</span>
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  BullMQ Worker
                </span>
                <Link
                  href="/admin/jobs"
                  className="text-sm font-bold text-[#2B73C2] hover:underline flex items-center gap-1.5 mt-1"
                >
                  <span>Inspect Queues</span>
                </Link>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  Ledger Reconciliation
                </span>
                <Link
                  href="/admin/reconciliation"
                  className="text-sm font-bold text-[#2B73C2] hover:underline flex items-center gap-1.5 mt-1"
                >
                  <span>Run Balance Audit</span>
                </Link>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  Privacy &amp; Lifecycle
                </span>
                <Link
                  href="/admin/lifecycle"
                  className="text-sm font-bold text-[#2B73C2] hover:underline flex items-center gap-1.5 mt-1"
                >
                  <span>Legal Holds</span>
                </Link>
              </div>
            </div>
          </AdminCard>
        </div>

        {/* Security & System Notice Sidecard */}
        <div className="space-y-6">
          <AdminCard padding="md" className="bg-[#14110F] text-white border-[#2A2420]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-[#FFD64A] uppercase tracking-wider">
                Security Architecture
              </span>
            </div>
            <h4 className="text-lg font-bold mb-2">Dual-Approval Protocol Active</h4>
            <p className="text-xs text-[#A39A8F] leading-relaxed mb-4">
              Financial disbursements, user suspensions, and setting rollbacks enforce cryptographic
              audit logs and strict segregation of duties.
            </p>
            <div className="p-3 rounded-xl bg-[#2A2420] border border-[#3A322C] text-[11px] text-[#FAF6EF] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#A39A8F]">JWKS Asymmetric Auth:</span>
                <strong className="text-[#FFD64A]">Active</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A39A8F]">Anti-Self-Approval:</span>
                <strong className="text-[#2E9E6B]">Enforced</strong>
              </div>
            </div>
          </AdminCard>

          <AdminCard padding="md">
            <h4 className="text-sm font-bold text-[#14110F] mb-3">Admin Navigation Shortcuts</h4>
            <div className="space-y-2 text-xs font-semibold">
              <Link
                href="/admin/users"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FAF6EF] transition-colors text-[#14110F]"
              >
                <span>Users & Roles Directory</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#6F675E]" />
              </Link>
              <Link
                href="/admin/config"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FAF6EF] transition-colors text-[#14110F]"
              >
                <span>Platform Settings & Feature Flags</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#6F675E]" />
              </Link>
              <Link
                href="/admin/audit"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FAF6EF] transition-colors text-[#14110F]"
              >
                <span>Global Audit Logs</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#6F675E]" />
              </Link>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
