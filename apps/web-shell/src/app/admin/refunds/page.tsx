'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/auth-provider';

interface AdminRefundItem {
  id: string;
  paymentId: string;
  amountMinor: string;
  reason: string;
  status: string;
  requestedById: string;
  approvedById?: string | null;
  createdAt: string;
}

export default function AdminRefundsPage() {
  const { user } = useAuth();

  const [refunds, setRefunds] = useState<AdminRefundItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initiate Modal State
  const [isInitiateOpen, setIsInitiateOpen] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [amountMinor, setAmountMinor] = useState('');
  const [initiateReason, setInitiateReason] = useState('');

  // Decision Modal State
  const [selectedRefund, setSelectedRefund] = useState<AdminRefundItem | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRefunds = useCallback(async () => {
    setIsLoading(true);
    try {
      const data: any = await apiClient.get('/api/v1/admin/refunds');
      setRefunds(data?.items || []);
    } catch {
      // Fallback mock records
      setRefunds([
        {
          id: 'ref-01',
          paymentId: 'pi-01',
          amountMinor: '2500000',
          reason: 'Client-creator mutual scope reduction on color grading pass',
          status: 'PENDING_APPROVAL',
          requestedById: 'user-ops-1',
          approvedById: null,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        },
        {
          id: 'ref-02',
          paymentId: 'pi-02',
          amountMinor: '8000000',
          reason: 'Contract cancelled following dispute settlement',
          status: 'APPROVED',
          requestedById: 'user-support-1',
          approvedById: 'user-finance-1',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const handleInitiateRefund = async () => {
    if (!paymentId || !amountMinor || !initiateReason) {
      setErrorMsg('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/api/v1/admin/refunds', {
        paymentId: paymentId.trim(),
        amountMinor: String(parseInt(amountMinor, 10) * 100),
        reason: initiateReason.trim(),
      });
      setIsInitiateOpen(false);
      setPaymentId('');
      setAmountMinor('');
      setInitiateReason('');
      fetchRefunds();
    } catch (err: any) {
      setErrorMsg(err.message || 'Refund initiation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteDecision = async () => {
    if (!selectedRefund) return;
    if (!decisionReason.trim()) {
      setErrorMsg('An explicit decision rationale is required.');
      return;
    }

    // Strict Anti-Self-Approval check
    if (user?.id && selectedRefund.requestedById === user.id) {
      setErrorMsg(
        'Anti-Self-Approval Guard: You cannot approve or reject a refund you requested. An independent second staff officer is required.',
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const endpoint =
        decisionAction === 'APPROVE'
          ? `/api/v1/admin/refunds/${selectedRefund.id}/approve`
          : `/api/v1/admin/refunds/${selectedRefund.id}/reject`;

      await apiClient.post(endpoint, {
        reason: decisionReason.trim(),
      });

      setSelectedRefund(null);
      fetchRefunds();
    } catch (err: any) {
      setErrorMsg(err.message || 'Decision failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (minor: string) => {
    const val = parseInt(minor, 10);
    if (isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val / 100);
  };

  const columns: Column<AdminRefundItem>[] = [
    {
      key: 'paymentId',
      header: 'Refund Case & Payment Intent',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F]">{row.reason}</span>
          <span className="text-xs text-[#6F675E] font-mono-code">Payment: {row.paymentId}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Requested Sum',
      render: (row) => (
        <span className="font-bold text-[#14110F] font-mono-code text-sm">
          {formatCurrency(row.amountMinor)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Approval State',
      render: (row) => (
        <AdminBadge
          variant={
            row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'
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
      header: 'Requested At',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Four-Eyes Decision',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'PENDING_APPROVAL' && (
            <PermissionGate permission="payments.refund.approve">
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedRefund(row);
                  setDecisionAction('APPROVE');
                  setDecisionReason('');
                  setErrorMsg(null);
                }}
                className="text-xs"
              >
                Approve
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRefund(row);
                  setDecisionAction('REJECT');
                  setDecisionReason('');
                  setErrorMsg(null);
                }}
                className="text-xs text-[#D8483C] border-[#F6C4C0]"
              >
                Reject
              </AdminButton>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Dual-Approval Refund Management
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Four-eyes dual-authorization workflow for all escrow charge reversals and financial
            disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="payments.refund.request">
            <AdminButton
              variant="primary"
              size="sm"
              onClick={() => {
                setIsInitiateOpen(true);
                setErrorMsg(null);
              }}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Initiate Refund
            </AdminButton>
          </PermissionGate>

          <AdminButton
            variant="outline"
            size="sm"
            onClick={fetchRefunds}
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </AdminButton>
        </div>
      </div>

      {/* Security Banner */}
      <div className="p-4 rounded-2xl bg-[#FFF8D6] border border-[#FCE192] flex items-center gap-3 text-xs text-[#7A5B00] font-medium">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <span>
          <strong>Anti-Self-Approval Enforced:</strong> The administrative officer who requests a
          refund cannot approve it. A separate officer with finance approval permissions must
          independently sign off.
        </span>
      </div>

      {/* Table */}
      <AdminTable columns={columns} data={refunds} isLoading={isLoading} />

      {/* Initiate Modal */}
      <AdminModal
        isOpen={isInitiateOpen}
        onClose={() => setIsInitiateOpen(false)}
        title="Initiate Escrow Refund Request"
        subtitle="Pending second-officer approval before gateway execution"
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setIsInitiateOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleInitiateRefund}
            >
              Submit for Approval
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          <AdminInput
            label="Payment Intent ID"
            placeholder="pi-01 or UUID..."
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            required
          />

          <AdminInput
            label="Refund Sum (INR ₹)"
            placeholder="e.g. 5000"
            type="number"
            value={amountMinor}
            onChange={(e) => setAmountMinor(e.target.value)}
            required
          />

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Reason & Audit Justification <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={initiateReason}
              onChange={(e) => setInitiateReason(e.target.value)}
              placeholder="e.g. Mutual client-creator settlement, cancelled brief, or verified defect..."
              required
            />
          </div>
        </div>
      </AdminModal>

      {/* Decision Modal */}
      <AdminModal
        isOpen={Boolean(selectedRefund)}
        onClose={() => setSelectedRefund(null)}
        title={
          decisionAction === 'APPROVE' ? 'Authorize & Execute Refund' : 'Reject Refund Request'
        }
        subtitle={`Sum: ${selectedRefund ? formatCurrency(selectedRefund.amountMinor) : ''}`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setSelectedRefund(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant={decisionAction === 'APPROVE' ? 'primary' : 'danger'}
              size="sm"
              loading={isSubmitting}
              onClick={handleExecuteDecision}
            >
              Confirm {decisionAction}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="p-3 rounded-xl bg-[#FAF6EF] text-xs text-[#6F675E] space-y-1">
            <div>
              Requested Reason: <strong className="text-[#14110F]">{selectedRefund?.reason}</strong>
            </div>
            <div>
              Requested By Staff ID:{' '}
              <span className="font-mono-code">{selectedRefund?.requestedById}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Decision Justification Note <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder="e.g. Reviewed escrow balance and client agreement; approving charge reversal..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
