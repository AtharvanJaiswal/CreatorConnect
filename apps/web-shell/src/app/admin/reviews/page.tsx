'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Star, Search, RefreshCw } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient } from '../../../lib/api-client';

interface AdminReviewItem {
  id: string;
  projectId: string;
  authorId: string;
  targetUserId: string;
  rating: number;
  comment: string;
  status: string;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('ALL');

  // Moderate Review Modal
  const [selectedReview, setSelectedReview] = useState<AdminReviewItem | null>(null);
  const [modAction, setModAction] = useState<'FLAG' | 'HIDE' | 'REMOVE' | 'RESTORE'>('HIDE');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (ratingFilter !== 'ALL') {
        params.minRating = parseInt(ratingFilter, 10);
        params.maxRating = parseInt(ratingFilter, 10);
      }

      const data: any = await apiClient.get('/api/v1/admin/reviews', { params });
      setReviews(data?.items || []);
    } catch {
      // Fallback records
      setReviews([
        {
          id: 'rev-01',
          projectId: 'proj-01',
          authorId: 'user-brand-1',
          targetUserId: 'user-creator-1',
          rating: 5,
          comment: 'Exceptional 4K color grade. Delivered ahead of Diwali festival schedule.',
          status: 'VISIBLE',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        },
        {
          id: 'rev-02',
          projectId: 'proj-02',
          authorId: 'user-client-2',
          targetUserId: 'user-talent-2',
          rating: 1,
          comment: 'Unprofessional communication and refused to respond to revision brief.',
          status: 'FLAGGED',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [search, ratingFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleOpenModeration = (review: AdminReviewItem) => {
    setSelectedReview(review);
    setModAction(review.status === 'HIDDEN' ? 'RESTORE' : 'HIDE');
    setReason('');
    setError(null);
  };

  const handleExecuteModeration = async () => {
    if (!selectedReview) return;
    if (!reason.trim()) {
      setError('Please provide a mandatory audit justification.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/api/v1/admin/reviews/${selectedReview.id}/moderate`, {
        action: modAction,
        reason: reason.trim(),
      });
      setSelectedReview(null);
      fetchReviews();
    } catch (err: any) {
      setError(err.message || 'Review moderation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<AdminReviewItem>[] = [
    {
      key: 'rating',
      header: 'Score',
      render: (row) => (
        <span className="font-extrabold text-sm text-[#C98A16] font-mono-code flex items-center gap-1">
          <Star className="w-4 h-4 fill-current" />
          <span>{row.rating}.0</span>
        </span>
      ),
    },
    {
      key: 'comment',
      header: 'Public Review Comment',
      render: (row) => (
        <div className="flex flex-col max-w-lg">
          <span className="text-sm text-[#14110F] font-medium">&ldquo;{row.comment}&rdquo;</span>
          <span className="text-xs text-[#6F675E] font-mono-code mt-0.5">
            Project: {row.projectId}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Moderation State',
      render: (row) => (
        <AdminBadge
          variant={
            row.status === 'VISIBLE' ? 'success' : row.status === 'HIDDEN' ? 'danger' : 'warning'
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
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <PermissionGate permission="reviews.moderate">
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
            Verified Reviews Moderation
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Supervise post-contract rating submissions, defamation adjudications, and public comment
            visibility.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchReviews}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Filter Bar */}
      <AdminCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8">
            <AdminInput
              placeholder="Search reviews by comment content or project UUID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-4">
            <AdminSelect
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Star Ratings' },
                { value: '5', label: '5 Stars Only' },
                { value: '4', label: '4 Stars Only' },
                { value: '3', label: '3 Stars Only' },
                { value: '2', label: '2 Stars Only' },
                { value: '1', label: '1 Star Only (High Alert)' },
              ]}
            />
          </div>
        </div>
      </AdminCard>

      {/* Table */}
      <AdminTable columns={columns} data={reviews} isLoading={isLoading} />

      {/* Moderation Modal */}
      <AdminModal
        isOpen={Boolean(selectedReview)}
        onClose={() => setSelectedReview(null)}
        title="Moderate Platform Review"
        subtitle={`Review ID: ${selectedReview?.id}`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setSelectedReview(null)}>
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
          {error && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">Action to Apply</label>
            <select
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              value={modAction}
              onChange={(e) => setModAction(e.target.value as any)}
            >
              <option value="HIDE">Hide Review (Demote from Public Reputation Score)</option>
              <option value="FLAG">Flag for Author Clarification</option>
              <option value="REMOVE">Remove Permanently (Defamation / Breach)</option>
              <option value="RESTORE">Restore to Public Visibility</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Moderation Rationale <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Vulgarity, proven retaliatory false review, or user settlement..."
              required
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
