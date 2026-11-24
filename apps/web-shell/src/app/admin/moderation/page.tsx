'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient } from '../../../lib/api-client';

interface AdminReportItem {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function AdminModerationPage() {
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Adjudication Modal State
  const [selectedReport, setSelectedReport] = useState<AdminReportItem | null>(null);
  const [adjudicationAction, setAdjudicationAction] = useState<'resolve' | 'dismiss'>('resolve');
  const [penaltyAction, setPenaltyAction] = useState<string>('CONTENT_REMOVED');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const data: any = await apiClient.get('/api/v1/admin/reports', { params });
      setReports(data?.items || []);
    } catch {
      // Fallback records
      setReports([
        {
          id: 'rep-01',
          reporterId: 'user-reporter-1',
          targetType: 'USER_PROFILE',
          targetId: 'user-flagged-1',
          reason: 'Spam brief soliciting off-platform cryptocurrency payments',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        },
        {
          id: 'rep-02',
          reporterId: 'user-reporter-2',
          targetType: 'DELIVERABLE',
          targetId: 'deliv-2',
          reason: 'Uploaded deliverable contains unlicensed commercial copyrighted music',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        },
        {
          id: 'rep-03',
          reporterId: 'user-reporter-3',
          targetType: 'REVIEW',
          targetId: 'rev-3',
          reason: 'Abusive language and personal threats in review comment',
          status: 'RESOLVED',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleOpenAdjudication = (report: AdminReportItem, action: 'resolve' | 'dismiss') => {
    setSelectedReport(report);
    setAdjudicationAction(action);
    setPenaltyAction('CONTENT_REMOVED');
    setNotes('');
    setError(null);
  };

  const handleExecuteAdjudication = async () => {
    if (!selectedReport) return;
    if (!notes.trim()) {
      setError('A mandatory adjudication explanation is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (adjudicationAction === 'resolve') {
        await apiClient.post(`/api/v1/admin/reports/${selectedReport.id}/resolve`, {
          action: penaltyAction,
          resolutionNotes: notes.trim(),
        });
      } else {
        await apiClient.post(`/api/v1/admin/reports/${selectedReport.id}/dismiss`, {
          dismissalReason: notes.trim(),
        });
      }

      setSelectedReport(null);
      fetchReports();
    } catch (err: any) {
      setError(err.message || 'Adjudication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<AdminReportItem>[] = [
    {
      key: 'reason',
      header: 'Report Rationale & Target',
      render: (row) => (
        <div className="flex flex-col max-w-md">
          <span className="font-bold text-[#14110F]">{row.reason}</span>
          <span className="text-xs text-[#6F675E]">
            Target: <strong className="text-[#14110F]">{row.targetType}</strong> ({row.targetId})
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Triage Status',
      render: (row) => (
        <AdminBadge
          variant={
            row.status === 'PENDING' ? 'danger' : row.status === 'RESOLVED' ? 'success' : 'neutral'
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
      header: 'Reported',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">{new Date(row.createdAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Adjudication Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'PENDING' && (
            <PermissionGate permission="reports.resolve">
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => handleOpenAdjudication(row, 'resolve')}
                className="text-xs"
              >
                Resolve
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => handleOpenAdjudication(row, 'dismiss')}
                className="text-xs"
              >
                Dismiss
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
            Trust & Moderation Reports Queue
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Centralized triage of user grievances, copyright flags, off-platform solicitations, and
            community safety violations.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchReports}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Filters */}
      <AdminCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8">
            <AdminInput
              placeholder="Search reports by keyword, target UUID, or reporter..."
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
                { value: 'ALL', label: 'All Report Statuses' },
                { value: 'PENDING', label: 'Pending Triage Only' },
                { value: 'RESOLVED', label: 'Resolved Reports' },
                { value: 'DISMISSED', label: 'Dismissed Reports' },
              ]}
            />
          </div>
        </div>
      </AdminCard>

      {/* Table */}
      <AdminTable columns={columns} data={reports} isLoading={isLoading} />

      {/* Adjudication Modal */}
      <AdminModal
        isOpen={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title={
          adjudicationAction === 'resolve'
            ? 'Resolve Report & Enforce Penalty'
            : 'Dismiss Abuse Report'
        }
        subtitle={`Report Target: ${selectedReport?.targetType} (${selectedReport?.targetId})`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant={adjudicationAction === 'resolve' ? 'primary' : 'secondary'}
              size="sm"
              loading={isSubmitting}
              onClick={handleExecuteAdjudication}
            >
              Confirm Adjudication
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          {adjudicationAction === 'resolve' && (
            <div>
              <label className="text-xs font-bold text-[#14110F] block mb-1.5">
                Enforcement Penalty
              </label>
              <select
                className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
                value={penaltyAction}
                onChange={(e) => setPenaltyAction(e.target.value)}
              >
                <option value="CONTENT_REMOVED">Remove Reported Content / Brief</option>
                <option value="WARN">Issue Official Warning to User</option>
                <option value="SUSPEND">Suspend Violator Account</option>
                <option value="BAN">Permanent Platform Ban</option>
                <option value="NO_ACTION">Resolve with No Penalty</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              {adjudicationAction === 'resolve' ? 'Resolution Notes' : 'Dismissal Reason'}{' '}
              <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide explicit rationale for this administrative action..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
