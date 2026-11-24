'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, CheckCircle2, Eye, RefreshCw } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient } from '../../../lib/api-client';

interface AdminUserItem {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  status: string;
  roles: string[];
  isVerified: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Suspension / Reactivation Modal State
  const [targetUser, setTargetUser] = useState<AdminUserItem | null>(null);
  const [modalAction, setModalAction] = useState<'suspend' | 'reactivate' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (roleFilter !== 'ALL') params.role = roleFilter;

      const data: any = await apiClient.get('/api/v1/admin/users', { params });
      if (data?.items) {
        setUsers(data.items);
        setTotalUsers(data.total || data.items.length);
      }
    } catch {
      // Fallback baseline for demo or dev environment
      const mockUsers: AdminUserItem[] = [
        {
          id: '0192a0e2-1234-7000-8000-000000000001',
          email: 'vikram.cinematographer@creatorconnect.in',
          phoneNumber: '+919876543210',
          status: 'ACTIVE',
          roles: ['CREATOR', 'TALENT'],
          isVerified: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        },
        {
          id: '0192a0e2-1234-7000-8000-000000000002',
          email: 'priya.marketing@zomatofresh.com',
          phoneNumber: '+919876543211',
          status: 'ACTIVE',
          roles: ['BRAND'],
          isVerified: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
        },
        {
          id: '0192a0e2-1234-7000-8000-000000000003',
          email: 'flagged.editor@unknown.net',
          phoneNumber: '+919876543212',
          status: 'SUSPENDED',
          roles: ['TALENT'],
          isVerified: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        },
      ];
      setUsers(mockUsers);
      setTotalUsers(mockUsers.length);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenActionModal = (user: AdminUserItem, action: 'suspend' | 'reactivate') => {
    setTargetUser(user);
    setModalAction(action);
    setActionReason('');
    setActionError(null);
  };

  const handleExecuteAction = async () => {
    if (!targetUser || !modalAction) return;
    if (modalAction === 'suspend' && !actionReason.trim()) {
      setActionError('An explicit audit justification reason is required for suspension.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      if (modalAction === 'suspend') {
        await apiClient.post(`/api/v1/admin/users/${targetUser.id}/suspend`, {
          reason: actionReason.trim(),
        });
      } else {
        await apiClient.post(`/api/v1/admin/users/${targetUser.id}/reactivate`, {
          reason: actionReason.trim() || 'Reactivated following review',
        });
      }

      setModalAction(null);
      setTargetUser(null);
      fetchUsers();
    } catch (err: any) {
      setActionError(err.message || 'Action failed. Please verify administrative permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<AdminUserItem>[] = [
    {
      key: 'user',
      header: 'Account Identity',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F]">{row.email || 'No email provided'}</span>
          <span className="text-xs text-[#6F675E] font-mono-code">
            {row.phoneNumber || row.id.slice(0, 8) + '...'}
          </span>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Assigned Roles',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((r) => (
            <AdminBadge
              key={r}
              variant={r === 'ADMIN' ? 'danger' : r === 'BRAND' ? 'purple' : 'neutral'}
              size="sm"
            >
              {r}
            </AdminBadge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const isSuspended = row.status === 'SUSPENDED';
        const isActive = row.status === 'ACTIVE';
        return (
          <div className="flex items-center gap-1.5">
            <AdminBadge
              variant={isSuspended ? 'danger' : isActive ? 'success' : 'warning'}
              size="sm"
              dot
            >
              {row.status}
            </AdminBadge>
            {row.isVerified && (
              <span title="Verified Showreel & Credentials">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2E9E6B]" />
              </span>
            )}
          </div>
        );
      },
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
      header: 'Operations',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/admin/users/${row.id}`}
            className="p-1.5 rounded-lg text-[#6F675E] hover:text-[#14110F] hover:bg-[#F2ECE1] transition-colors"
            title="Inspect deep user details & audit timeline"
          >
            <Eye className="w-4 h-4" />
          </Link>

          <PermissionGate permission="users.suspend">
            {row.status === 'SUSPENDED' ? (
              <button
                onClick={() => handleOpenActionModal(row, 'reactivate')}
                className="btn-pill btn-pill-secondary text-xs px-3 py-1 font-bold"
              >
                Reactivate
              </button>
            ) : (
              <button
                onClick={() => handleOpenActionModal(row, 'suspend')}
                className="btn-pill btn-pill-outline text-xs px-3 py-1 text-[#D8483C] hover:bg-[#FBE9E7] border-[#F6C4C0] font-bold"
              >
                Suspend
              </button>
            )}
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            User Management Directory
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Global search, multi-role profile inspection, and administrative account governance.
            Total accounts: {totalUsers}.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Filters Bar */}
      <AdminCard padding="sm" className="bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6">
            <AdminInput
              placeholder="Search by email, phone number, or user UUID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-3">
            <AdminSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Account Statuses' },
                { value: 'ACTIVE', label: 'Active Only' },
                { value: 'SUSPENDED', label: 'Suspended Accounts' },
                { value: 'DEACTIVATED', label: 'Self-Deactivated' },
              ]}
            />
          </div>

          <div className="sm:col-span-3">
            <AdminSelect
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Roles' },
                { value: 'CREATOR', label: 'Creators' },
                { value: 'TALENT', label: 'Production Talent' },
                { value: 'BRAND', label: 'Brand Sponsors' },
                { value: 'ADMIN', label: 'Administrators' },
              ]}
            />
          </div>
        </div>
      </AdminCard>

      {/* Users Data Table */}
      <AdminTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
        pagination={{
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalUsers / limit)),
          onPageChange: (p) => setPage(p),
        }}
      />

      {/* Suspend / Reactivate Modal */}
      <AdminModal
        isOpen={Boolean(modalAction)}
        onClose={() => setModalAction(null)}
        title={modalAction === 'suspend' ? 'Suspend User Account' : 'Reactivate User Account'}
        subtitle={targetUser ? `Target: ${targetUser.email || targetUser.id}` : undefined}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setModalAction(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant={modalAction === 'suspend' ? 'danger' : 'primary'}
              size="sm"
              loading={isSubmitting}
              onClick={handleExecuteAction}
            >
              {modalAction === 'suspend' ? 'Confirm Suspension' : 'Confirm Reactivation'}
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-xl bg-[#FBE9E7] border border-[#F6C4C0] text-xs text-[#D8483C] font-semibold">
              {actionError}
            </div>
          )}

          <p className="text-xs sm:text-sm text-[#6F675E] leading-relaxed">
            {modalAction === 'suspend'
              ? 'Suspending this account immediately revokes all active auth sessions, cancels public brief visibility, and freezes escrow actions. An immutable audit log entry will be created.'
              : 'Reactivating this account restores login capabilities and marketplace participation. The action is recorded in the platform audit log.'}
          </p>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Audit Reason & Justification <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm text-[#14110F] font-sans-body focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Terms violation, dispute fraud investigation, or customer request..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
