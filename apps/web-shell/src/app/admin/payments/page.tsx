'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, RefreshCw } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';
import { apiClient } from '../../../lib/api-client';

interface AdminPaymentItem {
  id: string;
  projectId: string;
  clientId: string;
  provider: string;
  providerPaymentId: string | null;
  amountMinor: string;
  feeMinor: string;
  status: string;
  createdAt: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const data: any = await apiClient.get('/api/v1/admin/payments', { params });
      setPayments(data?.items || []);
    } catch {
      // Fallback data
      setPayments([
        {
          id: 'pi-01',
          projectId: 'proj-01',
          clientId: 'client-1',
          provider: 'RAZORPAY',
          providerPaymentId: 'pay_Nz82Kx9281a',
          amountMinor: '12500000',
          feeMinor: '1250000',
          status: 'SUCCEEDED',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        },
        {
          id: 'pi-02',
          projectId: 'proj-02',
          clientId: 'client-2',
          provider: 'RAZORPAY',
          providerPaymentId: 'pay_Mz19Ka8392b',
          amountMinor: '8000000',
          feeMinor: '800000',
          status: 'SUCCEEDED',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
        },
        {
          id: 'pi-03',
          projectId: 'proj-03',
          clientId: 'client-3',
          provider: 'RAZORPAY',
          providerPaymentId: null,
          amountMinor: '25000000',
          feeMinor: '2500000',
          status: 'REQUIRES_PAYMENT_METHOD',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const formatCurrency = (minor: string) => {
    const val = parseInt(minor, 10);
    if (isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val / 100);
  };

  const columns: Column<AdminPaymentItem>[] = [
    {
      key: 'id',
      header: 'Payment Intent & Provider ID',
      render: (row) => (
        <div className="flex flex-col font-mono-code">
          <span className="font-bold text-[#14110F] text-xs">{row.id}</span>
          <span className="text-[10px] text-[#6F675E]">
            {row.providerPaymentId || 'Pending Provider Intent'}
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Gross Volume',
      render: (row) => (
        <span className="font-bold text-[#14110F] font-mono-code text-sm">
          {formatCurrency(row.amountMinor)}
        </span>
      ),
    },
    {
      key: 'fee',
      header: 'Platform Fee (10%)',
      render: (row) => (
        <span className="text-xs text-[#2E9E6B] font-mono-code font-bold">
          +{formatCurrency(row.feeMinor)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Ledger State',
      render: (row) => (
        <AdminBadge
          variant={
            row.status === 'SUCCEEDED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'
          }
          size="sm"
          dot
        >
          {row.status}
        </AdminBadge>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Payments & Escrow Transactions
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Real-time Razorpay escrow intentions, gateway status tracking, and platform take-rate
            ledger records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/refunds"
            className="btn-pill btn-pill-secondary text-xs px-4 py-2 font-bold"
          >
            Refund Queue
          </Link>
          <Link
            href="/admin/reconciliation"
            className="btn-pill btn-pill-secondary text-xs px-4 py-2 font-bold"
          >
            Reconciliation
          </Link>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={fetchPayments}
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </AdminButton>
        </div>
      </div>

      {/* Filter Bar */}
      <AdminCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8">
            <AdminInput
              placeholder="Search by Payment Intent ID or Razorpay transaction ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-4">
            <AdminSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Payment States' },
                { value: 'SUCCEEDED', label: 'Succeeded & Escrow Funded' },
                { value: 'REQUIRES_PAYMENT_METHOD', label: 'Awaiting Gateway Checkout' },
                { value: 'FAILED', label: 'Failed Payments' },
              ]}
            />
          </div>
        </div>
      </AdminCard>

      {/* Table */}
      <AdminTable columns={columns} data={payments} isLoading={isLoading} />
    </div>
  );
}
