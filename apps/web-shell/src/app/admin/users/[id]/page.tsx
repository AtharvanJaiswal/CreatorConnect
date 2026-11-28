'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminCard, AdminCardHeader } from '../../../../components/admin/ui/AdminCard';
import { AdminBadge } from '../../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../../components/admin/ui/AdminButton';
import { AdminModal } from '../../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../../components/admin/ui/PermissionGate';
import { AdminErrorBanner } from '../../../../components/admin/ui/AdminErrorBanner';
import { apiClient } from '../../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../../lib/admin-error';
import type { AdminUserDetailsResponse } from '@creatorconnect/contracts';

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;

  const [details, setDetails] = useState<AdminUserDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);
  const [modalAction, setModalAction] = useState<'suspend' | 'reactivate' | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<AdminUserDetailsResponse>(`/api/v1/admin/users/${userId}`);
      setDetails(data);
    } catch (err) {
      setDetails(null);
      setFetchError(parseAdminApiError(err, 'Failed to fetch user dossier from backend API.'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleAction = async () => {
    if (!modalAction) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Please provide at least 3 characters of audit justification.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (modalAction === 'suspend') {
        await apiClient.post(`/api/v1/admin/users/${userId}/suspend`, { reason: trimmed });
      } else {
        await apiClient.post(`/api/v1/admin/users/${userId}/reactivate`, { reason: trimmed });
      }
      setModalAction(null);
      await fetchUser();
    } catch (err: unknown) {
      const parsed = parseAdminApiError(err, 'Action failed.');
      setError(parsed.detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !details) {
    return (
      <div className="py-20 text-center font-sans-body">
        <div className="w-8 h-8 rounded-full border-2 border-[#FFD64A] border-t-transparent animate-spin motion-reduce:animate-none mx-auto mb-3" />
        <span className="text-sm font-semibold text-[#6F675E]">Loading account dossier...</span>
      </div>
    );
  }

  if (fetchError || !details) {
    return (
      <div className="space-y-6 font-sans-body">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="p-2 rounded-full border border-[#E7E0D5] bg-white hover:bg-[#F2ECE1] transition-colors"
            aria-label="Back to Users Directory"
          >
            <ArrowLeft className="w-4 h-4 text-[#14110F]" />
          </Link>
          <h1 className="text-2xl font-extrabold text-[#14110F] tracking-tight">
            User Account Dossier
          </h1>
        </div>
        <AdminErrorBanner
          error={
            fetchError || {
              status: null,
              title: 'User Record Unavailable',
              detail: 'Unable to retrieve user details from backend API.',
              isUnauthorized: false,
              isForbidden: false,
            }
          }
          onRetry={fetchUser}
        />
      </div>
    );
  }

  const user = details.user;
  const profile = details.profile as Record<string, any> | null;
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || profile?.companyName || user.email;

  return (
    <div className="space-y-6 font-sans-body">
      {/* Navigation & Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="p-2 rounded-full border border-[#E7E0D5] bg-white hover:bg-[#F2ECE1] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#14110F]" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#14110F] tracking-tight">{displayName}</h1>
            <AdminBadge variant={user.status === 'SUSPENDED' ? 'danger' : 'success'} size="sm" dot>
              {user.status}
            </AdminBadge>
          </div>
          <p className="text-xs text-[#6F675E] font-mono-code mt-0.5">UUID: {user.id}</p>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile & Metadata */}
        <div className="lg:col-span-2 space-y-6">
          <AdminCard padding="md">
            <AdminCardHeader
              title="Identity & Multi-Role Profiles"
              subtitle="Registered authentication identifiers and domain affiliations"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  Email Address
                </span>
                <span className="text-sm font-bold text-[#14110F] mt-0.5 block">{user.email}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  Profile &amp; Activity Stats
                </span>
                <span className="text-sm font-bold text-[#14110F] mt-0.5 block">
                  {details.stats.projectsCount} projects · ★ {details.stats.averageRating} (
                  {details.stats.reviewsCount} reviews)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  Active Roles
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.roles.map((r) => (
                    <AdminBadge key={r} size="sm" variant={r === 'ADMIN' ? 'danger' : 'neutral'}>
                      {r}
                    </AdminBadge>
                  ))}
                  {user.adminRoles?.map((ar) => (
                    <AdminBadge key={ar} size="sm" variant="brand">
                      {ar}
                    </AdminBadge>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider block">
                  Account Created
                </span>
                <span className="text-sm font-bold text-[#14110F] mt-0.5 block">
                  {new Date(user.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {profile && (
              <div className="mt-6 pt-5 border-t border-[#EFE9DF]">
                <h4 className="text-sm font-bold text-[#14110F] mb-2">Domain Profile Summary</h4>
                <p className="text-xs text-[#6F675E] leading-relaxed mb-3">
                  {profile.bio ||
                    profile.description ||
                    profile.companyName ||
                    'Active profile record'}
                </p>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#14110F]">
                  <span>
                    Completeness: <strong>{user.profileCompleteness}%</strong>
                  </span>
                  <span>
                    Verified Badge: <strong>{user.isVerified ? 'Yes' : 'No'}</strong>
                  </span>
                  {profile.industry && (
                    <span>
                      Industry: <strong>{profile.industry}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </AdminCard>

          {/* Activity Audit Timeline */}
          <AdminCard padding="md">
            <AdminCardHeader
              title="Chronological Audit Timeline"
              subtitle="Sanitized immutable log of logins, contract signatures, and administrative actions"
            />
            <div className="space-y-4 pt-2">
              {details.activityTimeline && details.activityTimeline.length > 0 ? (
                details.activityTimeline.map((item, idx) => (
                  <div
                    key={`${item.action}-${item.createdAt}-${idx}`}
                    className="flex items-start gap-3 text-xs"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#FFD64A] mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <span className="font-bold text-[#14110F]">{item.action}</span>
                      <span className="text-[#6F675E]"> on {item.entity}</span>
                    </div>
                    <span className="text-[10px] text-[#A39A8F] font-mono-code shrink-0">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#6F675E]">
                  No recorded audit activity for this user account.
                </p>
              )}
            </div>
          </AdminCard>
        </div>

        {/* Right Column: Actions & Governance */}
        <div className="space-y-6">
          <AdminCard padding="md">
            <h3 className="text-base font-bold text-[#14110F] mb-3">Administrative Actions</h3>
            <p className="text-xs text-[#6F675E] mb-4 leading-relaxed">
              Enforce platform safety or lift account restrictions. Mandatory audit reasons are
              logged.
            </p>

            {user.status === 'SUSPENDED' ? (
              <PermissionGate permission="users.reactivate" showLockedPlaceholder>
                <AdminButton
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setModalAction('reactivate');
                    setReason('');
                    setError(null);
                  }}
                >
                  Reactivate Account
                </AdminButton>
              </PermissionGate>
            ) : (
              <PermissionGate permission="users.suspend" showLockedPlaceholder>
                <AdminButton
                  variant="danger"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setModalAction('suspend');
                    setReason('');
                    setError(null);
                  }}
                >
                  Suspend Account
                </AdminButton>
              </PermissionGate>
            )}
          </AdminCard>

          <AdminCard padding="md" className="bg-[#FAF6EF]">
            <h4 className="text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
              Legal & Privacy Notice
            </h4>
            <p className="text-xs text-[#6F675E] leading-relaxed">
              Account data retention and erasure requests are governed by the DPDP Act and GDPR
              compliance rules. Destructive actions are gated by executive governance approval.
            </p>
          </AdminCard>
        </div>
      </div>

      {/* Action Modal */}
      <AdminModal
        isOpen={Boolean(modalAction)}
        onClose={() => setModalAction(null)}
        title={modalAction === 'suspend' ? 'Suspend Account' : 'Reactivate Account'}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setModalAction(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant={modalAction === 'suspend' ? 'danger' : 'primary'}
              size="sm"
              loading={isSubmitting}
              onClick={handleAction}
            >
              Confirm
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
          <p className="text-xs text-[#6F675E]">
            Please provide an explicit administrative justification for this action.
          </p>
          <textarea
            className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for audit log..."
            required
          />
        </div>
      </AdminModal>
    </div>
  );
}
