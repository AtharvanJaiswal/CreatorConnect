'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { apiClient } from '../../../lib/api-client';

interface DisputeItem {
  id: string;
  projectId: string;
  openedById: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Adjudication Modal State
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [resolutionType, setResolutionType] = useState<
    'RELEASE_TO_CREATOR' | 'REFUND_TO_CLIENT' | 'SPLIT'
  >('RELEASE_TO_CREATOR');
  const [resolutionReason, setResolutionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data: any = await apiClient.get('/api/v1/disputes');
      setDisputes(Array.isArray(data) ? data : data?.items || []);
    } catch {
      // Fallback
      setDisputes([
        {
          id: 'disp-01',
          projectId: 'proj-01',
          openedById: 'user-client-1',
          reason: 'Deliverable missing agreed Dolby 5.1 surround sound audio mix files',
          status: 'OPEN',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        },
        {
          id: 'disp-02',
          projectId: 'proj-02',
          openedById: 'user-creator-2',
          reason: 'Client refuses to sign off completed cut despite passing contract specs',
          status: 'UNDER_REVIEW',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleExecuteResolution = async () => {
    if (!selectedDispute) return;
    if (!resolutionReason.trim()) {
      setErrorMsg('Mandatory adjudication rationale is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post(`/api/v1/disputes/${selectedDispute.id}/resolve`, {
        resolutionType,
        reason: resolutionReason.trim(),
      });

      setSelectedDispute(null);
      fetchDisputes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Dispute resolution failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<DisputeItem>[] = [
    {
      key: 'reason',
      header: 'Dispute Claim & Context',
      render: (row) => (
        <div className="flex flex-col max-w-md">
          <span className="font-bold text-[#14110F]">{row.reason}</span>
          <span className="text-xs text-[#6F675E] font-mono-code">Project: {row.projectId}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Escrow State',
      render: (row) => (
        <AdminBadge
          variant={
            row.status === 'OPEN' ? 'danger' : row.status === 'UNDER_REVIEW' ? 'warning' : 'success'
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
          {row.status !== 'RESOLVED' && (
            <AdminButton
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedDispute(row);
                setResolutionType('RELEASE_TO_CREATOR');
                setResolutionReason('');
                setErrorMsg(null);
              }}
              className="text-xs"
            >
              Adjudicate
            </AdminButton>
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
            Contract Disputes & Arbitration
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

      {/* Table */}
      <AdminTable columns={columns} data={disputes} isLoading={isLoading} />

      {/* Adjudication Modal */}
      <AdminModal
        isOpen={Boolean(selectedDispute)}
        onClose={() => setSelectedDispute(null)}
        title="Adjudicate Escrow Dispute"
        subtitle={`Case ID: ${selectedDispute?.id}`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setSelectedDispute(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleExecuteResolution}
            >
              Confirm Adjudication
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

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Arbitration Decision
            </label>
            <select
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value as any)}
            >
              <option value="RELEASE_TO_CREATOR">
                Release Escrow Funds to Creator (Contract Fulfilled)
              </option>
              <option value="REFUND_TO_CLIENT">
                Refund Escrow Funds to Brand Client (Non-Delivery)
              </option>
              <option value="SPLIT">Split Escrow Funds (50/50 Settlement)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Adjudication Rationale & Evidence Audit <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
              placeholder="e.g. Inspected submitted timeline files against brief clause 4.2; deliverable satisfies requirements..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
