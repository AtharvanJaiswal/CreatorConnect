'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle2, RefreshCw } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient } from '../../../lib/api-client';

interface AdminRoleItem {
  id: string;
  name: string;
  description: string | null | undefined;
  isSystem: boolean;
  permissions: string[];
  userCount?: number | undefined;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Role Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRolesData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesData, permsData]: any = await Promise.all([
        apiClient.get('/api/v1/admin/roles'),
        apiClient.get('/api/v1/admin/permissions'),
      ]);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setAllPermissions(Array.isArray(permsData) ? permsData : []);
    } catch {
      // Fallback
      setRoles([
        {
          id: 'role-1',
          name: 'SUPER_ADMIN',
          description: 'Universal administrative super-access across all subsystems',
          isSystem: true,
          permissions: ['*'],
          userCount: 1,
        },
        {
          id: 'role-2',
          name: 'FINANCE_ADMIN',
          description: 'Payment reconciliation, refund dual-approvals, and fee management',
          isSystem: true,
          permissions: ['payments.read', 'payments.refund.approve', 'payments.reconcile'],
          userCount: 2,
        },
        {
          id: 'role-3',
          name: 'TRUST_SAFETY_ADMIN',
          description: 'Abuse report triage, user suspensions, and review moderation',
          isSystem: true,
          permissions: ['reports.review', 'reports.resolve', 'reviews.moderate', 'users.suspend'],
          userCount: 3,
        },
      ]);
      setAllPermissions([
        { id: 'p1', name: 'users.read', module: 'Users', description: 'Read user directory' },
        { id: 'p2', name: 'users.suspend', module: 'Users', description: 'Suspend user accounts' },
        { id: 'p3', name: 'payments.read', module: 'Finance', description: 'Inspect ledger' },
        {
          id: 'p4',
          name: 'payments.refund.approve',
          module: 'Finance',
          description: 'Approve refunds',
        },
        {
          id: 'p5',
          name: 'reports.review',
          module: 'Moderation',
          description: 'Review abuse reports',
        },
        {
          id: 'p6',
          name: 'settings.manage',
          module: 'Config',
          description: 'Change platform settings',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRolesData();
  }, [fetchRolesData]);

  const handleTogglePerm = (permName: string) => {
    if (selectedPerms.includes(permName)) {
      setSelectedPerms(selectedPerms.filter((p) => p !== permName));
    } else {
      setSelectedPerms([...selectedPerms, permName]);
    }
  };

  const handleCreateRole = async () => {
    if (!roleName.trim() || selectedPerms.length === 0) {
      setErrorMsg('Role name and at least one permission are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/api/v1/admin/roles', {
        name: roleName.trim().toUpperCase().replace(/\s+/g, '_'),
        description: roleDesc.trim() || undefined,
        permissions: selectedPerms,
      });

      setIsCreateOpen(false);
      setRoleName('');
      setRoleDesc('');
      setSelectedPerms([]);
      fetchRolesData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create administrative role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<AdminRoleItem>[] = [
    {
      key: 'name',
      header: 'Role Name & Scope',
      render: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#14110F] text-xs font-mono-code">{row.name}</span>
            {row.isSystem && (
              <AdminBadge variant="neutral" size="sm">
                SYSTEM
              </AdminBadge>
            )}
          </div>
          <span className="text-xs text-[#6F675E] mt-0.5">{row.description}</span>
        </div>
      ),
    },
    {
      key: 'permissions',
      header: 'Assigned Permissions',
      render: (row) => (
        <div className="flex flex-wrap gap-1 max-w-md">
          {row.permissions.map((p) => (
            <span
              key={p}
              className="text-[10px] font-mono-code px-2 py-0.5 rounded-md bg-[#FAF6EF] border border-[#E7E0D5] text-[#14110F]"
            >
              {p}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'userCount',
      header: 'Assigned Staff',
      render: (row) => (
        <span className="text-xs font-bold text-[#14110F]">{row.userCount || 0} officers</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            RBAC Roles & Permissions Matrix
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            System administrative roles, custom authority groups, and granular operational
            capabilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="admins.manage">
            <AdminButton
              variant="primary"
              size="sm"
              onClick={() => {
                setIsCreateOpen(true);
                setErrorMsg(null);
              }}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Create Custom Role
            </AdminButton>
          </PermissionGate>

          <AdminButton
            variant="outline"
            size="sm"
            onClick={fetchRolesData}
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </AdminButton>
        </div>
      </div>

      {/* Table */}
      <AdminTable columns={columns} data={roles} isLoading={isLoading} />

      {/* Create Modal */}
      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Custom Administrative Role"
        subtitle="Define fine-grained permission assignments"
        maxWidth="lg"
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleCreateRole}
            >
              Save Custom Role
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
            label="Role Identifier"
            placeholder="e.g. REGIONAL_COMPLIANCE_OFFICER"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            required
          />

          <AdminInput
            label="Description"
            placeholder="Brief description of role responsibilities..."
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
          />

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-2">
              Select Permissions ({selectedPerms.length} selected){' '}
              <span className="text-[#D8483C]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
              {allPermissions.map((perm) => {
                const isSelected = selectedPerms.includes(perm.name);
                return (
                  <button
                    key={perm.id || perm.name}
                    type="button"
                    onClick={() => handleTogglePerm(perm.name)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors flex items-start gap-2 ${
                      isSelected
                        ? 'bg-[#FFF8D6] border-[#FFD64A] text-[#7A5B00] font-bold'
                        : 'bg-[#FAF6EF] border-[#E7E0D5] text-[#6F675E] hover:border-[#D8D1C6]'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                        isSelected ? 'bg-[#FFD64A] border-[#FFD64A]' : 'border-[#A39A8F]'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-[#14110F]" />}
                    </div>
                    <div>
                      <span className="font-mono-code font-bold block">{perm.name}</span>
                      <span className="text-[10px] text-[#A39A8F] leading-tight block">
                        {perm.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
