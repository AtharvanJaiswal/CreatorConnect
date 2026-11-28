'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ShieldAlert, Search, Plus, RefreshCw, Ban, Unlock, FileText } from 'lucide-react';
import { AdminCard, AdminCardHeader } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { AdminErrorBanner } from '../../../components/admin/ui/AdminErrorBanner';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient } from '../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../lib/admin-error';
import { useAuth } from '../../../providers/auth-provider';
import { hasAdminPermission, type AdminUserLike } from '../../../lib/admin-permissions';
import type {
  AdminAuditLogItem,
  AdminAuditLogResponse,
  LegalHoldReason,
  LegalHoldResponse,
} from '@creatorconnect/contracts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEGAL_HOLD_REASONS: ReadonlyArray<{ value: LegalHoldReason; label: string }> = [
  { value: 'ACTIVE_DISPUTE', label: 'Active Dispute' },
  { value: 'FINANCIAL_AUDIT', label: 'Financial Audit' },
  { value: 'LAW_ENFORCEMENT_REQUEST', label: 'Law Enforcement Request' },
  { value: 'TRUST_SAFETY_INVESTIGATION', label: 'Trust & Safety Investigation' },
  { value: 'TAX_INSPECTION', label: 'Tax Inspection' },
];

export default function AdminLifecyclePage() {
  const { user } = useAuth();
  const canInspectAudit = hasAdminPermission(
    user as AdminUserLike | null | undefined,
    'audit.read',
  );

  // Target User Legal Hold State
  const [targetUserId, setTargetUserId] = useState('');
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [holds, setHolds] = useState<LegalHoldResponse[]>([]);
  const [isLoadingHolds, setIsLoadingHolds] = useState(false);
  const [holdsError, setHoldsError] = useState<AdminErrorState | null>(null);

  // Recent Audit Activity State (read-only verified audit API)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<AdminErrorState | null>(null);

  // Apply Hold Modal
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [holdReason, setHoldReason] = useState<LegalHoldReason>('ACTIVE_DISPUTE');
  const [caseReference, setCaseReference] = useState('');
  const [holdNotes, setHoldNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Release Hold Modal
  const [releasingHold, setReleasingHold] = useState<LegalHoldResponse | null>(null);
  const [releaseNotes, setReleaseNotes] = useState('');

  const fetchLegalHoldsForUser = useCallback(async (uid: string) => {
    const cleanUid = uid.trim();
    if (!UUID_REGEX.test(cleanUid)) {
      setHolds([]);
      setLoadedUserId(null);
      setHoldsError({
        status: null,
        title: 'Invalid User UUID',
        detail: 'Please enter a valid UUID to query per-user legal holds.',
        isUnauthorized: false,
        isForbidden: false,
      });
      return;
    }

    setIsLoadingHolds(true);
    setHoldsError(null);
    try {
      const data = await apiClient.get<LegalHoldResponse[]>(
        `/api/v1/admin/users/${cleanUid}/legal-holds`,
      );
      setHolds(Array.isArray(data) ? data : []);
      setLoadedUserId(cleanUid);
    } catch (err) {
      setHolds([]);
      setLoadedUserId(null);
      setHoldsError(parseAdminApiError(err, 'Failed to load user legal holds from backend API.'));
    } finally {
      setIsLoadingHolds(false);
    }
  }, []);

  const fetchLifecycleAuditTrail = useCallback(async () => {
    if (!canInspectAudit) {
      setAuditLogs([]);
      return;
    }
    setIsLoadingAudit(true);
    setAuditError(null);
    try {
      const data = await apiClient.get<AdminAuditLogResponse>('/api/v1/admin/audit', {
        params: { entity: 'User', limit: 20 },
      });
      const relevant = (data?.items || []).filter(
        (item) =>
          item.action.includes('LEGAL_HOLD') ||
          item.action.includes('PRIVACY') ||
          item.action.includes('DELETION') ||
          item.action.includes('USER_STATUS'),
      );
      setAuditLogs(relevant);
    } catch (err) {
      setAuditLogs([]);
      setAuditError(parseAdminApiError(err, 'Failed to query lifecycle audit records.'));
    } finally {
      setIsLoadingAudit(false);
    }
  }, [canInspectAudit]);

  useEffect(() => {
    fetchLifecycleAuditTrail();
  }, [fetchLifecycleAuditTrail]);

  const handleApplyHold = async () => {
    if (!loadedUserId) return;
    if (!caseReference.trim() || !holdNotes.trim()) {
      setModalError('Case reference and hold notes are required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiClient.post<LegalHoldResponse>(`/api/v1/admin/users/${loadedUserId}/legal-holds`, {
        reason: holdReason,
        caseReference: caseReference.trim(),
        notes: holdNotes.trim(),
      });
      setIsApplyOpen(false);
      setCaseReference('');
      setHoldNotes('');
      await Promise.all([fetchLegalHoldsForUser(loadedUserId), fetchLifecycleAuditTrail()]);
    } catch (err) {
      setModalError(parseAdminApiError(err, 'Failed to apply legal hold.').detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReleaseHold = async () => {
    if (!loadedUserId || !releasingHold) return;
    if (!releaseNotes.trim()) {
      setModalError('Release justification notes are required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiClient.request<LegalHoldResponse>(
        `/api/v1/admin/users/${loadedUserId}/legal-holds/${releasingHold.id}`,
        'DELETE',
        { releaseNotes: releaseNotes.trim() },
      );
      setReleasingHold(null);
      setReleaseNotes('');
      await Promise.all([fetchLegalHoldsForUser(loadedUserId), fetchLifecycleAuditTrail()]);
    } catch (err) {
      setModalError(parseAdminApiError(err, 'Failed to release legal hold.').detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const holdColumns: Column<LegalHoldResponse>[] = [
    {
      key: 'caseReference',
      header: 'Case Reference & Reason',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F] font-mono-code text-xs">
            {row.caseReference}
          </span>
          <span className="text-xs text-[#6F675E]">
            {row.reason} · {row.notes}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Hold State',
      render: (row) => (
        <AdminBadge variant={row.status === 'ACTIVE' ? 'danger' : 'neutral'} size="sm" dot>
          {row.status}
        </AdminBadge>
      ),
    },
    {
      key: 'appliedAt',
      header: 'Applied',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">{new Date(row.appliedAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Hold Governance',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'ACTIVE' ? (
            <PermissionGate permission="users.privacy">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setReleasingHold(row);
                  setReleaseNotes('');
                  setModalError(null);
                }}
                icon={<Unlock className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Release Hold
              </AdminButton>
            </PermissionGate>
          ) : (
            <span className="text-xs text-[#6F675E]">
              {row.releaseNotes ? `Released: ${row.releaseNotes}` : 'Released'}
            </span>
          )}
        </div>
      ),
    },
  ];

  const auditColumns: Column<AdminAuditLogItem>[] = [
    {
      key: 'action',
      header: 'Lifecycle Action',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-[#14110F] text-xs font-mono-code">{row.action}</span>
          <span className="text-xs text-[#6F675E] font-mono-code">
            Target User: {row.entityId || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <span className="text-xs text-[#6F675E] font-mono-code">
          {row.actorEmail || row.userId || 'SYSTEM'}
        </span>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
              Privacy, Legal Holds &amp; Account Lifecycle
            </h1>
            <AdminBadge variant="warning" size="sm">
              Stage A Hard-Stop Active
            </AdminBadge>
          </div>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Per-user litigation hold inspection integrated with verified lifecycle endpoints;
            unapproved Phase 3B.9 erasure workflows remain gated.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchLifecycleAuditTrail}
          loading={isLoadingAudit}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Audit View
        </AdminButton>
      </div>

      {/* Phase 3B.9 Governance Hard-Stop Banner */}
      <div className="p-4 rounded-2xl bg-[#FFF8D6] border border-[#FCE192] flex items-start gap-3 text-xs text-[#7A5B00]">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-[#C98A16]" />
        <div className="space-y-1">
          <strong className="block text-[#14110F]">
            Phase 3B.9 Legal &amp; Compliance Hard-Stop (0/12 LDR Decisions Approved)
          </strong>
          <p className="leading-relaxed">
            Irreversible PII pseudonymization, media purging, and automated retention sweeps are{' '}
            <strong>BLOCKED</strong> pending sign-off of <code>LDR-001</code> through{' '}
            <code>LDR-012</code> and approval of the Four-Eyes Deletion Protocol. Only
            non-destructive per-user litigation holds are enabled.
          </p>
        </div>
      </div>

      {/* Verified Endpoint 1: Per-User Legal Hold Lookup & Controls */}
      <AdminCard padding="md">
        <AdminCardHeader
          title="Per-User Legal Hold Governance"
          subtitle="Verified backend integration: GET / POST / DELETE /api/v1/admin/users/:id/legal-holds"
          action={
            loadedUserId && (
              <PermissionGate permission="users.privacy">
                <AdminButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setHoldReason('ACTIVE_DISPUTE');
                    setCaseReference('');
                    setHoldNotes('');
                    setModalError(null);
                    setIsApplyOpen(true);
                  }}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Apply Legal Hold
                </AdminButton>
              </PermissionGate>
            )
          }
        />

        <PermissionGate permission="users.privacy" showLockedPlaceholder>
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchLegalHoldsForUser(targetUserId);
              }}
              className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
            >
              <div className="flex-1">
                <AdminInput
                  placeholder="Enter User UUID to inspect or place legal holds..."
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  icon={<Search className="w-4 h-4" />}
                />
              </div>
              <AdminButton type="submit" variant="dark" size="md" loading={isLoadingHolds}>
                Inspect Legal Holds
              </AdminButton>
            </form>

            {holdsError && (
              <AdminErrorBanner
                error={holdsError}
                onRetry={
                  targetUserId.trim() ? () => fetchLegalHoldsForUser(targetUserId) : undefined
                }
              />
            )}

            {loadedUserId && !holdsError && (
              <AdminTable
                columns={holdColumns}
                data={holds}
                isLoading={isLoadingHolds}
                emptyMessage={`No legal holds recorded for user ${loadedUserId}.`}
              />
            )}
          </div>
        </PermissionGate>
      </AdminCard>

      {/* Honest BLOCKED Capabilities Panel */}
      <AdminCard padding="md">
        <AdminCardHeader
          title="Blocked Governance &amp; Retention Capabilities"
          subtitle="Explicit status for workflows lacking backend list APIs or Stage A legal sign-off"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E7E0D5] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#14110F] flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-[#D8483C]" />
                Global Privacy Queue
              </span>
              <AdminBadge variant="danger" size="sm">
                BLOCKED
              </AdminBadge>
            </div>
            <p className="text-[#6F675E] leading-relaxed">
              No platform-wide endpoint exists to list pending DSAR/erasure requests across all
              users without a user ID.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E7E0D5] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#14110F] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#C98A16]" />
                Retention Policy Matrix
              </span>
              <AdminBadge variant="warning" size="sm">
                BLOCKED
              </AdminBadge>
            </div>
            <p className="text-[#6F675E] leading-relaxed">
              Await executive sign-off on LDR-001 through LDR-012 and schema approval for dedicated
              retention rules.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E7E0D5] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#14110F] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#D8483C]" />
                Destructive Erasure Execution
              </span>
              <AdminBadge variant="danger" size="sm">
                BLOCKED
              </AdminBadge>
            </div>
            <p className="text-[#6F675E] leading-relaxed">
              One-click UI erasure execution is disabled pending approved Four-Eyes Deletion
              Protocol and granular privacy RBAC hardening.
            </p>
          </div>
        </div>
      </AdminCard>

      {/* Verified Endpoint 2: Recent Legal-Hold & Lifecycle Audit Log Events */}
      <AdminCard padding="md">
        <AdminCardHeader
          title="Recent Lifecycle &amp; Hold Audit Events"
          subtitle="Verified read-only feed from GET /api/v1/admin/audit?entity=User"
        />
        <PermissionGate permission="audit.read" showLockedPlaceholder>
          {auditError && <AdminErrorBanner error={auditError} onRetry={fetchLifecycleAuditTrail} />}
          <AdminTable
            columns={auditColumns}
            data={auditLogs}
            isLoading={isLoadingAudit}
            emptyMessage="No recent legal-hold or user lifecycle audit events found."
          />
        </PermissionGate>
      </AdminCard>

      {/* Apply Legal Hold Modal */}
      <AdminModal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        title="Apply Legal Hold to User"
        subtitle={`Target User UUID: ${loadedUserId || ''}`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setIsApplyOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleApplyHold}
            >
              Confirm Legal Hold
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {modalError && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {modalError}
            </div>
          )}

          <AdminSelect
            label="Hold Reason Category"
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value as LegalHoldReason)}
            options={LEGAL_HOLD_REASONS.map((r) => ({ value: r.value, label: r.label }))}
          />

          <AdminInput
            label="Case / Ticket Reference"
            placeholder="e.g. CASE-2026-041 or DISPUTE-992"
            value={caseReference}
            onChange={(e) => setCaseReference(e.target.value)}
            required
          />

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Legal Justification Notes <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={holdNotes}
              onChange={(e) => setHoldNotes(e.target.value)}
              placeholder="Document the dispute, audit, or legal preservation basis..."
              required
            />
          </div>
        </div>
      </AdminModal>

      {/* Release Legal Hold Modal */}
      <AdminModal
        isOpen={Boolean(releasingHold)}
        onClose={() => setReleasingHold(null)}
        title="Release Active Legal Hold"
        subtitle={`Case Reference: ${releasingHold?.caseReference || ''}`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setReleasingHold(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              loading={isSubmitting}
              onClick={handleReleaseHold}
            >
              Confirm Hold Release
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {modalError && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {modalError}
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Release Justification Notes <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Confirm dispute settlement, audit closure, or release authorization..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
