'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient, ApiError } from '../../../lib/api-client';
import {
  MIN_DISPUTE_REASON_LENGTH,
  MAX_DISPUTE_REASON_LENGTH,
  RESOLVABLE_DISPUTE_STATUSES,
  buildResolveDisputePayload,
} from '../../../lib/admin-phase41-helpers';
import type {
  DisputeResponse,
  DisputeStatus,
  ResolveDisputeInput,
} from '@creatorconnect/contracts';

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Adjudication Modal State
  const [selectedDispute, setSelectedDispute] = useState<DisputeResponse | null>(null);
  const [resolution, setResolution] =
    useState<ResolveDisputeInput['resolution']>('RESOLVED_FOR_CREATOR');
  const [resolutionReason, setResolutionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<DisputeResponse[] | { items?: DisputeResponse[] }>(
        '/api/v1/disputes',
      );
      setDisputes(Array.isArray(data) ? data : data?.items || []);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.problem?.detail || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to retrieve contract disputes from backend.';
      setFetchError(msg);
      setDisputes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleExecuteResolution = async () => {
    if (!selectedDispute || isSubmitting) return;

    const validation = buildResolveDisputePayload(resolution, resolutionReason);
    if (validation.error || !validation.payload) {
      setErrorMsg(validation.error || 'Invalid resolution input.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post<DisputeResponse>(
        `/api/v1/disputes/${selectedDispute.id}/resolve`,
        validation.payload,
      );

      setSelectedDispute(null);
      await fetchDisputes();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.problem?.detail || err.message
          : err instanceof Error
            ? err.message
            : 'Dispute resolution failed.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: DisputeStatus) => {
    if (status === 'OPEN') return 'danger';
    if (status === 'UNDER_REVIEW' || status === 'EVIDENCE_REQUESTED') return 'warning';
    if (status === 'RESOLVED_FOR_CREATOR' || status === 'RESOLVED_FOR_CLIENT') return 'success';
    return 'neutral';
  };

  const columns: Column<DisputeResponse>[] = [
    {
      key: 'reason',
      header: 'Dispute Claim & Context',
      render: (row) => (
        <div className="flex flex-col max-w-md">
          <span className="font-bold text-[#14110F]">{row.reason}</span>
          {row.description && (
            <span className="text-xs text-[#6F675E] truncate">{row.description}</span>
          )}
          <span className="text-xs text-[#A39A8F] font-mono-code">Project: {row.projectId}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Escrow State',
      render: (row) => (
        <AdminBadge variant={getStatusBadgeVariant(row.status)} size="sm" dot>
          {row.status}
        </AdminBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Opened At',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">{new Date(row.createdAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Arbitration',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {RESOLVABLE_DISPUTE_STATUSES.has(row.status) ? (
            <PermissionGate
              permissions={['projects.moderate', 'reports.resolve', 'payments.refund.approve']}
            >
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedDispute(row);
                  setResolution('RESOLVED_FOR_CREATOR');
                  setResolutionReason('');
                  setErrorMsg(null);
                }}
                className="text-xs"
              >
                Adjudicate
              </AdminButton>
            </PermissionGate>
          ) : (
            <span className="text-xs text-[#A39A8F] italic">Finalized</span>
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
            Contract Disputes &amp; Arbitration
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Independent staff review of contract breaches, milestone disputes, and escrow funds
            arbitration.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchDisputes}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Explicit Error State — No Silent Mock Fallback */}
      {fetchError && (
        <div
          role="alert"
          className="p-4 bg-[#FBE9E7] border border-[#D8483C]/30 text-[#D8483C] text-sm rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <AdminButton variant="outline" size="sm" onClick={fetchDisputes} className="text-xs">
            Retry
          </AdminButton>
        </div>
      )}

      {/* Table */}
      <AdminTable
        columns={columns}
        data={disputes}
        isLoading={isLoading}
        emptyMessage="No contract disputes found."
      />

      {/* Adjudication Modal */}
      <AdminModal
        isOpen={Boolean(selectedDispute)}
        onClose={() => !isSubmitting && setSelectedDispute(null)}
        title="Adjudicate Escrow Dispute"
        subtitle={`Case ID: ${selectedDispute?.id}`}
        footer={
          <>
            <AdminButton
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setSelectedDispute(null)}
            >
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={isSubmitting}
              onClick={handleExecuteResolution}
            >
              Confirm Adjudication
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl"
            >
              {errorMsg}
            </div>
          )}

          <div>
            <label
              htmlFor="dispute-resolution-select"
              className="text-xs font-bold text-[#14110F] block mb-1.5"
            >
              Arbitration Decision
            </label>
            <select
              id="dispute-resolution-select"
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ResolveDisputeInput['resolution'])}
            >
              <option value="RESOLVED_FOR_CREATOR">
                Release Escrow Funds to Creator (Contract Fulfilled)
              </option>
              <option value="RESOLVED_FOR_CLIENT">
                Refund Escrow Funds to Brand Client (Non-Delivery / Breach)
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="dispute-resolution-reason"
              className="text-xs font-bold text-[#14110F] block mb-1.5"
            >
              Adjudication Rationale &amp; Evidence Audit <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              id="dispute-resolution-reason"
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              maxLength={MAX_DISPUTE_REASON_LENGTH}
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
              placeholder="e.g. Inspected submitted timeline files against brief clause 4.2; deliverable satisfies requirements..."
              required
            />
            <span className="text-[11px] text-[#6F675E] mt-1 block">
              Minimum {MIN_DISPUTE_REASON_LENGTH} characters ({resolutionReason.trim().length}/
              {MAX_DISPUTE_REASON_LENGTH})
            </span>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
