'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Send, RefreshCw } from 'lucide-react';
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
  NotificationCampaignResponse,
  CampaignListResponse,
  EstimateCampaignResponse,
} from '@creatorconnect/contracts';

type AudienceKey = 'ALL_USERS' | 'CREATORS' | 'BRANDS' | 'ACTIVE_USERS';

export default function AdminNotificationsPage() {
  const [campaigns, setCampaigns] = useState<NotificationCampaignResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);

  // Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'PUSH' | 'IN_APP' | 'EMAIL'>('PUSH');
  const [targetAudience, setTargetAudience] = useState<AudienceKey>('ALL_USERS');
  const [estimatedAudience, setEstimatedAudience] = useState<number | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<CampaignListResponse>(
        '/api/v1/admin/notifications/campaigns',
      );
      setCampaigns(data?.items || []);
    } catch (err) {
      setCampaigns([]);
      setFetchError(
        parseAdminApiError(err, 'Failed to fetch notification broadcast campaigns from API.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Dynamic audience estimator
  useEffect(() => {
    if (!isComposerOpen) return;
    const calculateEstimate = async () => {
      setIsEstimating(true);
      setEstimateError(null);
      try {
        const res = await apiClient.post<EstimateCampaignResponse>(
          '/api/v1/admin/notifications/campaigns/estimate',
          { targetType: targetAudience },
        );
        setEstimatedAudience(res?.estimatedCount ?? 0);
      } catch (err) {
        setEstimatedAudience(null);
        setEstimateError(parseAdminApiError(err, 'Unable to estimate audience size.').detail);
      } finally {
        setIsEstimating(false);
      }
    };
    calculateEstimate();
  }, [isComposerOpen, targetAudience]);

  const handleSendCampaign = async () => {
    if (title.trim().length < 3 || body.trim().length < 5) {
      setErrorMsg('Title (min 3 chars) and message body (min 5 chars) are required.');
      return;
    }

    const createTargetType =
      targetAudience === 'CREATORS'
        ? 'CREATORS_ONLY'
        : targetAudience === 'BRANDS'
          ? 'BRANDS_ONLY'
          : targetAudience;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post('/api/v1/admin/notifications/campaigns', {
        title: title.trim(),
        message: body.trim(),
        targetType: createTargetType,
        channels: [channel],
      });

      setIsComposerOpen(false);
      setTitle('');
      setBody('');
      await fetchCampaigns();
    } catch (err: unknown) {
      setErrorMsg(parseAdminApiError(err, 'Failed to dispatch notification campaign.').detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<NotificationCampaignResponse>[] = [
    {
      key: 'title',
      header: 'Campaign Title & Message',
      render: (row) => (
        <div className="flex flex-col max-w-md">
          <span className="font-bold text-[#14110F]">{row.title}</span>
          <span className="text-xs text-[#6F675E] line-clamp-1">{row.message}</span>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Channels & Target',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.channels.map((ch) => (
            <AdminBadge key={ch} variant="neutral" size="sm">
              {ch}
            </AdminBadge>
          ))}
          <AdminBadge variant="purple" size="sm">
            {row.targetType}
          </AdminBadge>
        </div>
      ),
    },
    {
      key: 'metrics',
      header: 'Delivery Metrics',
      render: (row) => (
        <span className="text-xs font-mono-code font-bold text-[#14110F]">
          {row.sentCount.toLocaleString()} / {row.estimatedRecipients.toLocaleString()}
          <span className="text-[#2E9E6B] ml-1">
            ({Math.round((row.sentCount / Math.max(1, row.estimatedRecipients)) * 100)}%)
          </span>
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Dispatched At',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Broadcast Notification Campaigns
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Dispatch urgent announcements, marketplace updates, and policy notifications directly to
            mobile devices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="settings.manage">
            <AdminButton
              variant="primary"
              size="sm"
              onClick={() => {
                setIsComposerOpen(true);
                setErrorMsg(null);
              }}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Compose Broadcast
            </AdminButton>
          </PermissionGate>

          <AdminButton
            variant="outline"
            size="sm"
            onClick={fetchCampaigns}
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </AdminButton>
        </div>
      </div>

      {/* Table */}
      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchCampaigns} />}
      <AdminTable columns={columns} data={campaigns} isLoading={isLoading} />

      {/* Composer Modal with Mobile Preview */}
      <AdminModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        title="Broadcast Notification Composer"
        subtitle="Live delivery to authenticated Android & iOS devices"
        maxWidth="lg"
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setIsComposerOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleSendCampaign}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Dispatch Broadcast
            </AdminButton>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
                {errorMsg}
              </div>
            )}

            <AdminInput
              label="Notification Title"
              placeholder="e.g. Platform Maintenance Notice..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div>
              <label className="text-xs font-bold text-[#14110F] block mb-1.5">
                Message Body <span className="text-[#D8483C]">*</span>
              </label>
              <textarea
                className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Concise message for mobile lock screen..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AdminSelect
                label="Delivery Channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'PUSH' | 'IN_APP' | 'EMAIL')}
                options={[
                  { value: 'PUSH', label: 'Push Notification' },
                  { value: 'IN_APP', label: 'In-App Bell Only' },
                  { value: 'EMAIL', label: 'Email Dispatch' },
                ]}
              />

              <AdminSelect
                label="Target Audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as AudienceKey)}
                options={[
                  { value: 'ALL_USERS', label: 'All Users' },
                  { value: 'CREATORS', label: 'Creators Only' },
                  { value: 'BRANDS', label: 'Brand Sponsors' },
                  { value: 'ACTIVE_USERS', label: 'Active Users Only' },
                ]}
              />
            </div>

            <div className="p-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-between text-xs">
              <span className="text-[#6F675E] font-medium">Estimated Audience:</span>
              <strong className="text-[#14110F] font-mono-code font-bold">
                {isEstimating
                  ? 'Calculating...'
                  : estimateError
                    ? 'Estimate unavailable'
                    : estimatedAudience !== null
                      ? `${estimatedAudience.toLocaleString()} devices`
                      : '—'}
              </strong>
            </div>
          </div>

          {/* Mobile Preview Mock */}
          <div className="flex flex-col items-center justify-center p-4 bg-[#FAF6EF] rounded-2xl border border-[#E7E0D5]">
            <span className="text-[10px] font-bold text-[#6F675E] uppercase tracking-wider mb-3">
              Mobile Lock Screen Preview
            </span>
            <div className="w-full max-w-[260px] bg-white rounded-2xl p-3.5 border border-[#E7E0D5] shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-[#14110F] text-[#FFD64A] text-[9px] font-black flex items-center justify-center">
                  CC
                </div>
                <span className="text-[10px] font-bold text-[#14110F]">CreatorConnect</span>
                <span className="text-[9px] text-[#A39A8F] ml-auto">Now</span>
              </div>
              <h5 className="text-xs font-bold text-[#14110F] leading-tight">
                {title || 'Campaign Title'}
              </h5>
              <p className="text-[11px] text-[#6F675E] mt-1 leading-snug line-clamp-3">
                {body || 'Your message will appear here on user mobile devices.'}
              </p>
            </div>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
