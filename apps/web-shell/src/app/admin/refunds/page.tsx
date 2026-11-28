'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { AdminErrorBanner } from '../../../components/admin/ui/AdminErrorBanner';
import { apiClient } from '../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../lib/admin-error';
import {
  REFUND_REASON_OPTIONS,
  buildCreateRefundPayload,
  formatInrMinor,
  isRefundPendingDualApproval,
  isSelfRefundApprovalBlocked,
} from '../../../lib/admin-finance-helpers';
import { useAuth } from '../../../providers/auth-provider';
import type {
  AdminRefundListItem,
  AdminRefundListResponse,
  CreateRefundRequest,
} from '@creatorconnect/contracts';

export default function AdminRefundsPage() {
  const { user } = useAuth();

  const [refunds, setRefunds] = useState<AdminRefundListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);

  // Initiate Modal State
  const [isInitiateOpen, setIsInitiateOpen] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [amountMinorInput, setAmountMinorInput] = useState('');
  const [refundReason, setRefundReason] =
    useState<CreateRefundRequest['reason']>('CLIENT_REQUESTED');
  const [initiateNotes, setInitiateNotes] = useState('');

  // Decision Modal State
  const [selectedRefund, setSelectedRefund] = useState<AdminRefundListItem | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRefunds = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<AdminRefundListResponse>('/api/v1/admin/refunds');
      setRefunds(data?.items || []);
    } catch (err) {
      setRefunds([]);
      setFetchError(
        parseAdminApiError(err, 'Failed to load refund records from backend finance service.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const handleInitiateRefund = async () => {
    const built = buildCreateRefundPayload({
      paymentIntentId,
      amountMinorInput,
      reason: refundReason,
      notes: initiateNotes,
    });

    if (built.error || !built.payload) {
      setErrorMsg(built.error || 'Invalid refund request.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/api/v1/admin/refunds', built.payload);
      setIsInitiateOpen(false);
      setPaymentIntentId('');
      setAmountMinorInput('');
      setRefundReason('CLIENT_REQUESTED');
      setInitiateNotes('');
      await fetchRefunds();
    } catch (err: unknown) {
      setErrorMsg(parseAdminApiError(err, 'Refund initiation failed.').detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteDecision = async () => {
    if (!selectedRefund) return;
    const trimmed = decisionReason.trim();
    if (trimmed.length < 5 || trimmed.length > 500) {
      setErrorMsg('Decision justification must be between 5 and 500 characters.');
      return;
    }

    // Strict Anti-Self-Approval check
    if (isSelfRefundApprovalBlocked(selectedRefund, user?.id)) {
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
        reason: trimmed,
      });

      setSelectedRefund(null);
      await fetchRefunds();
    } catch (err: unknown) {
      setErrorMsg(parseAdminApiError(err, 'Decision failed.').detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<AdminRefundListItem>[] = [
    {
      key: 'paymentIntentId',
      header: 'Refund Case & Payment Intent',
      headerClassName: 'min-w-[300px] lg:w-[44%]',
      className: 'min-w-[300px] lg:w-[44%]',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F]">
            {row.reason}
            {row.notes ? ` — ${row.notes}` : ''}
          </span>
          <span className="text-xs text-[#6F675E] font-mono-code">
            Intent: {row.paymentIntentId} · By: {row.refundedByEmail || row.refundedById}
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Requested Sum',
      headerClassName: 'w-[140px]',
      className: 'w-[140px] whitespace-nowrap',
      render: (row) => (
        <span className="font-bold text-[#14110F] font-mono-code text-sm">
          {formatInrMinor(row.amountMinor)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Approval State',
      headerClassName: 'w-[190px]',
      className: 'w-[190px]',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <AdminBadge
            variant={
              row.status === 'SUCCEEDED'
                ? 'success'
                : row.status === 'FAILED' || row.approvalStatus === 'REJECTED'
                  ? 'danger'
                  : 'warning'
            }
            size="sm"
            dot
          >
            {row.approvalStatus ? `${row.status} (${row.approvalStatus})` : row.status}
          </AdminBadge>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Requested At',
      headerClassName: 'w-[125px]',
      className: 'w-[125px] whitespace-nowrap',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Four-Eyes Decision',
      headerClassName: 'text-right w-[195px]',
      className: 'text-right w-[195px]',
      render: (row) => {
        const isPendingApproval = isRefundPendingDualApproval(row);
        const isSelfBlocked = isSelfRefundApprovalBlocked(row, user?.id);

        return (
          <div className="flex items-center justify-end gap-2">
            {isPendingApproval && (
              <PermissionGate permission="payments.refund.approve">
                {isSelfBlocked ? (
                  <span className="text-[11px] font-semibold text-[#7A5B00] px-2.5 py-1 rounded-full bg-[#FFF8D6] border border-[#FCE192]">
                    Awaiting Second Officer
                  </span>
                ) : (
                  <>
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
                  </>
                )}
              </PermissionGate>
            )}
          </div>
        );
      },
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

        <div className="flex flex-wrap items-center gap-2">
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
      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchRefunds} />}
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
            label="Payment Intent ID (UUID)"
            placeholder="0192a0e2-..."
            value={paymentIntentId}
            onChange={(e) => setPaymentIntentId(e.target.value)}
            required
          />

          <div>
            <AdminInput
              label="Refund Amount (Minor Paisa Units)"
              placeholder="e.g. 500000 for ₹5,000.00"
              type="number"
              min={1}
              step={1}
              value={amountMinorInput}
              onChange={(e) => setAmountMinorInput(e.target.value)}
              required
            />
            {amountMinorInput && /^\d+$/.test(amountMinorInput.trim()) && (
              <p className="text-[11px] text-[#6F675E] mt-1 font-mono-code">
                INR Equivalent: {formatInrMinor(amountMinorInput.trim())}
              </p>
            )}
          </div>

          <AdminSelect
            label="Refund Reason Category"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value as CreateRefundRequest['reason'])}
            options={REFUND_REASON_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
          />

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Audit Notes &amp; Justification (min 5 chars){' '}
              <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={initiateNotes}
              onChange={(e) => setInitiateNotes(e.target.value)}
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
        subtitle={`Sum: ${selectedRefund ? formatInrMinor(selectedRefund.amountMinor) : ''}`}
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
              Reason Category: <strong className="text-[#14110F]">{selectedRefund?.reason}</strong>
            </div>
            {selectedRefund?.notes && (
              <div>
                Request Notes: <span className="text-[#14110F]">{selectedRefund.notes}</span>
              </div>
            )}
            <div>
              Requested By Officer:{' '}
              <span className="font-mono-code">
                {selectedRefund?.refundedByEmail || selectedRefund?.refundedById}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Decision Justification Note (min 5 chars) <span className="text-[#D8483C]">*</span>
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
