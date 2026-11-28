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
import { AdminErrorBanner } from '../../../components/admin/ui/AdminErrorBanner';
import { apiClient } from '../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../lib/admin-error';
import type { AdminProjectListItem, AdminProjectListResponse } from '@creatorconnect/contracts';

export default function AdminAssignmentsPage() {
  const [projects, setProjects] = useState<AdminProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);

  // Moderation Action State
  const [selectedProject, setSelectedProject] = useState<AdminProjectListItem | null>(null);
  const [modAction, setModAction] = useState<
    'SUSPEND' | 'RESTRICT' | 'FLAG_UNDER_REVIEW' | 'RESTORE'
  >('FLAG_UNDER_REVIEW');
  const [modReason, setModReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params: Record<string, any> = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const data = await apiClient.get<AdminProjectListResponse>('/api/v1/admin/projects', {
        params,
      });
      if (data?.items) {
        setProjects(data.items);
        setTotal(data.total ?? data.items.length);
      } else {
        setProjects([]);
        setTotal(0);
      }
    } catch (err) {
      setProjects([]);
      setTotal(0);
      setFetchError(parseAdminApiError(err, 'Failed to retrieve marketplace projects from API.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleOpenModeration = (p: AdminProjectListItem) => {
    setSelectedProject(p);
    setModAction('FLAG_UNDER_REVIEW');
    setModReason('');
    setErrorMsg(null);
  };

  const handleExecuteModeration = async () => {
    if (!selectedProject) return;
    if (!modReason.trim()) {
      setErrorMsg('A detailed reason is required for project moderation actions.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post(`/api/v1/admin/projects/${selectedProject.id}/moderate`, {
        action: modAction,
        reason: modReason.trim(),
      });
      setSelectedProject(null);
      fetchProjects();
    } catch (err: any) {
      setErrorMsg(err.message || 'Moderation action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (minor: string) => {
    const val = parseInt(minor, 10);
    if (isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val / 100);
  };

  const columns: Column<AdminProjectListItem>[] = [
    {
      key: 'title',
      header: 'Brief Title & Scope',
      render: (row) => (
        <div className="flex flex-col max-w-md">
          <span className="font-bold text-[#14110F] line-clamp-1">{row.title}</span>
          <span className="text-xs text-[#6F675E] font-mono-code">
            {row.clientEmail || row.clientId} · {row.talentEmail || row.talentId}
          </span>
        </div>
      ),
    },
    {
      key: 'budget',
      header: 'Contract Value',
      render: (row) => (
        <span className="font-bold text-[#14110F] font-mono-code">
          {formatCurrency(row.totalAmountMinor)}
        </span>
      ),
    },
    {
      key: 'dispute',
      header: 'Deliverables & Dispute',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6F675E]">{row.deliverablesCount} milestones</span>
          {row.hasDispute && (
            <AdminBadge variant="danger" size="sm" dot>
              DISPUTED
            </AdminBadge>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Project Lifecycle',
      render: (row) => (
        <AdminBadge
          variant={
            row.status === 'COMPLETED'
              ? 'success'
              : row.status === 'IN_PROGRESS'
                ? 'info'
                : row.status === 'SUSPENDED'
                  ? 'danger'
                  : 'neutral'
          }
          size="sm"
        >
          {row.status}
        </AdminBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Operations',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <PermissionGate permission="projects.moderate">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => handleOpenModeration(row)}
              className="text-xs"
            >
              Moderate
            </AdminButton>
          </PermissionGate>
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
            Assignments & Projects Governance
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Supervise brief postings, milestone escrows, contract fulfillment, and content
            compliance.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchProjects}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Filter Bar */}
      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchProjects} />}
      <AdminCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8">
            <AdminInput
              placeholder="Search brief by title, deliverable description, or ID..."
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
                { value: 'ALL', label: 'All Project Statuses' },
                { value: 'PUBLISHED', label: 'Open Briefs' },
                { value: 'IN_PROGRESS', label: 'In Progress (Escrow Locked)' },
                { value: 'COMPLETED', label: 'Completed & Released' },
                { value: 'SUSPENDED', label: 'Suspended / Under Review' },
              ]}
            />
          </div>
        </div>
      </AdminCard>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={projects}
        isLoading={isLoading}
        pagination={{
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          onPageChange: (p) => setPage(p),
        }}
      />

      {/* Moderation Modal */}
      <AdminModal
        isOpen={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
        title="Project Moderation Action"
        subtitle={`Target: ${selectedProject?.title}`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setSelectedProject(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              loading={isSubmitting}
              onClick={handleExecuteModeration}
            >
              Enforce Action
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
              Select Enforcement Action
            </label>
            <select
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              value={modAction}
              onChange={(e) => setModAction(e.target.value as any)}
            >
              <option value="FLAG_UNDER_REVIEW">Flag Under Review (Notify Participants)</option>
              <option value="RESTRICT">Restrict (Freeze New Bids & Deliverables)</option>
              <option value="SUSPEND">Suspend (Immediate Lock & Escrow Freeze)</option>
              <option value="RESTORE">Restore (Lift All Restrictions)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Enforcement Reason & Justification <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder="e.g. Terms violation, prohibited commercial content, copyright dispute..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
