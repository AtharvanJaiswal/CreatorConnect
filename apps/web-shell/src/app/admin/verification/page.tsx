'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Video, Search, RefreshCw } from 'lucide-react';
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
import type {
  AdminCreatorListItem,
  AdminCreatorListResponse,
  AdminClientListItem,
  AdminClientListResponse,
} from '@creatorconnect/contracts';

export default function AdminVerificationPage() {
  const [activeTab, setActiveTab] = useState<'creators' | 'clients'>('creators');
  const [creators, setCreators] = useState<AdminCreatorListItem[]>([]);
  const [clients, setClients] = useState<AdminClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');

  // Verify Modal
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [verifyAction, setVerifyAction] = useState<boolean>(true);
  const [verifyReason, setVerifyReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter === 'VERIFIED') params.isVerified = true;
      if (statusFilter === 'UNVERIFIED') params.isVerified = false;

      if (activeTab === 'creators') {
        const data = await apiClient.get<AdminCreatorListResponse>('/api/v1/admin/creators', {
          params,
        });
        setCreators(data?.items || []);
      } else {
        const data = await apiClient.get<AdminClientListResponse>('/api/v1/admin/clients', {
          params,
        });
        setClients(data?.items || []);
      }
    } catch (err) {
      setCreators([]);
      setClients([]);
      setFetchError(
        parseAdminApiError(err, 'Failed to load verification queue records from backend API.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenVerifyModal = (item: any, isVerify: boolean) => {
    setSelectedEntity(item);
    setVerifyAction(isVerify);
    setVerifyReason('');
    setErrorMessage(null);
  };

  const handleExecuteVerification = async () => {
    if (!selectedEntity) return;
    if (!verifyReason.trim()) {
      setErrorMessage('A mandatory justification must be provided for audit compliance.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (activeTab === 'creators') {
        await apiClient.post(`/api/v1/admin/creators/${selectedEntity.id}/verify`, {
          isVerified: verifyAction,
          reason: verifyReason.trim(),
        });
      } else {
        await apiClient.post(`/api/v1/admin/clients/${selectedEntity.id}/verify`, {
          isVerified: verifyAction,
          reason: verifyReason.trim(),
        });
      }

      setSelectedEntity(null);
      fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const creatorColumns: Column<AdminCreatorListItem>[] = [
    {
      key: 'name',
      header: 'Creator Profile',
      render: (row) => {
        const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email;
        return (
          <div className="flex flex-col">
            <span className="font-bold text-[#14110F]">{name}</span>
            <span className="text-xs text-[#6F675E]">
              {row.email} · {row.visibility} · {row.portfolioCount} portfolio items
            </span>
          </div>
        );
      },
    },
    {
      key: 'rating',
      header: 'Reputation',
      render: (row) => (
        <span className="text-xs font-bold text-[#C98A16]">
          ★ {Number(row.averageRating ?? 0).toFixed(2)} ({row.completedProjects} briefs)
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Badge Status',
      render: (row) => (
        <AdminBadge variant={row.isVerified ? 'success' : 'warning'} size="sm" dot>
          {row.isVerified ? 'VERIFIED' : 'PENDING'}
        </AdminBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Verification Decision',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <PermissionGate permission="users.update">
            {row.isVerified ? (
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => handleOpenVerifyModal(row, false)}
                className="text-xs text-[#D8483C] border-[#F6C4C0]"
              >
                Revoke Badge
              </AdminButton>
            ) : (
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => handleOpenVerifyModal(row, true)}
                className="text-xs"
              >
                Approve Badge
              </AdminButton>
            )}
          </PermissionGate>
        </div>
      ),
    },
  ];

  const clientColumns: Column<AdminClientListItem>[] = [
    {
      key: 'name',
      header: 'Brand Organization',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F]">{row.companyName}</span>
          <span className="text-xs text-[#6F675E]">
            {row.industry || 'General'} · {row.email}
          </span>
        </div>
      ),
    },
    {
      key: 'projects',
      header: 'Completed Briefs',
      render: (row) => (
        <span className="text-xs font-bold text-[#14110F]">{row.totalProjects} briefs funded</span>
      ),
    },
    {
      key: 'status',
      header: 'Badge Status',
      render: (row) => (
        <AdminBadge variant={row.isVerified ? 'success' : 'warning'} size="sm" dot>
          {row.isVerified ? 'VERIFIED' : 'PENDING'}
        </AdminBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Verification Decision',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <PermissionGate permission="users.update">
            {row.isVerified ? (
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => handleOpenVerifyModal(row, false)}
                className="text-xs text-[#D8483C] border-[#F6C4C0]"
              >
                Revoke Badge
              </AdminButton>
            ) : (
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => handleOpenVerifyModal(row, true)}
                className="text-xs"
              >
                Approve Badge
              </AdminButton>
            )}
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
            Trust & Verification Queue
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Manual adjudication of creator showreels, industry credentials, and brand enterprise
            status.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchData}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Tabs */}
      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchData} />}
      <div className="flex border-b border-[#E7E0D5] gap-6">
        <button
          onClick={() => setActiveTab('creators')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'creators'
              ? 'border-[#FFD64A] text-[#14110F]'
              : 'border-transparent text-[#6F675E] hover:text-[#14110F]'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Creators & Production Talent</span>
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'clients'
              ? 'border-[#FFD64A] text-[#14110F]'
              : 'border-transparent text-[#6F675E] hover:text-[#14110F]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Brand Clients & Agencies</span>
        </button>
      </div>

      {/* Filter Bar */}
      <AdminCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8">
            <AdminInput
              placeholder={
                activeTab === 'creators'
                  ? 'Search creator by name or specialty...'
                  : 'Search brand or company name...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-4">
            <AdminSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              options={[
                { value: 'ALL', label: 'All Badges' },
                { value: 'UNVERIFIED', label: 'Pending Verification' },
                { value: 'VERIFIED', label: 'Verified Accounts' },
              ]}
            />
          </div>
        </div>
      </AdminCard>

      {/* Data Table */}
      {activeTab === 'creators' ? (
        <AdminTable columns={creatorColumns} data={creators} isLoading={isLoading} />
      ) : (
        <AdminTable columns={clientColumns} data={clients} isLoading={isLoading} />
      )}

      {/* Decision Modal */}
      <AdminModal
        isOpen={Boolean(selectedEntity)}
        onClose={() => setSelectedEntity(null)}
        title={verifyAction ? 'Approve Verified Badge' : 'Revoke Verified Badge'}
        subtitle={`Target: ${
          selectedEntity
            ? [selectedEntity.firstName, selectedEntity.lastName].filter(Boolean).join(' ') ||
              selectedEntity.companyName ||
              selectedEntity.email ||
              selectedEntity.id
            : 'Profile'
        }`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setSelectedEntity(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant={verifyAction ? 'primary' : 'danger'}
              size="sm"
              loading={isSubmitting}
              onClick={handleExecuteVerification}
            >
              Confirm Decision
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {errorMessage}
            </div>
          )}

          <p className="text-xs sm:text-sm text-[#6F675E] leading-relaxed">
            {verifyAction
              ? 'Approving verification awards the blue authenticity badge on the mobile app, granting boosted discovery and milestone guarantees.'
              : 'Revoking verification removes the badge and demotes profile priority in search results.'}
          </p>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Verification Rationale & Evidence Note <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={verifyReason}
              onChange={(e) => setVerifyReason(e.target.value)}
              placeholder="e.g. Showreel verified against Vimeo link, tax ID confirmed, or trademark match..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
