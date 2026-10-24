'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Star, CheckCircle2, AlertCircle, Loader2, User, Sparkles } from 'lucide-react';
import type { PendingReviewProject } from '@creatorconnect/contracts';
import { fetchPendingReviews } from '../../lib/reviews-workflow-service';
import { ReviewSubmissionDialog } from './review-submission-dialog';

interface PendingReviewsCardProps {
  accessToken?: string | null;
  onReviewSubmitted?: () => void;
}

export function PendingReviewsCard({ accessToken, onReviewSubmitted }: PendingReviewsCardProps) {
  const [pendingProjects, setPendingProjects] = useState<PendingReviewProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectToReview, setActiveProjectToReview] = useState<PendingReviewProject | null>(
    null,
  );
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPendingReviews(accessToken);
      setPendingProjects(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load projects awaiting review.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 text-center shadow-sm flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#14110F]" />
        <span className="text-xs text-[#8F877D]">Loading projects awaiting review...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-[#FCA5A5] p-5 shadow-sm bg-[#FEECEB]/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#C93B2B]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadPending}
          className="px-3 py-1.5 rounded-full bg-[#14110F] text-white text-[11px] font-semibold hover:bg-[#2C2724] transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  if (pendingProjects.length === 0) {
    return null; // Clean: do not show clutter when no reviews are pending
  }

  return (
    <>
      <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#FFD64A]">
              <Sparkles className="w-4 h-4 text-[#14110F]" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#14110F]">
                Projects Awaiting Your Review
              </h3>
              <p className="text-xs text-[#8F877D]">
                You have {pendingProjects.length}{' '}
                {pendingProjects.length === 1 ? 'completed project' : 'completed projects'} ready
                for verified feedback.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#FFD64A]/20 border border-[#FFD64A]/50 text-[11px] font-bold text-[#14110F]">
            {pendingProjects.length} Pending
          </span>
        </div>

        {successBanner && (
          <div className="p-3.5 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] text-xs text-[#2E9E6B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-[#2E9E6B] font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="divide-y divide-[#E7E0D5]/60">
          {pendingProjects.map((p) => (
            <div
              key={p.projectId}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center shrink-0 overflow-hidden">
                  {p.counterparty.avatarUrl ? (
                    <img
                      src={p.counterparty.avatarUrl}
                      alt={p.counterparty.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-[#8F877D]" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <h4 className="font-semibold text-sm text-[#14110F]">{p.projectTitle}</h4>
                  <div className="flex items-center gap-2 text-xs text-[#8F877D] flex-wrap">
                    <span>With {p.counterparty.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-semibold uppercase text-[#6F675E]">
                      {p.counterparty.role}
                    </span>
                    {p.completedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Completed {new Date(p.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveProjectToReview(p)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#FFD64A] hover:bg-[#F2C93D] text-[#14110F] text-xs font-semibold shadow-sm transition-all self-start sm:self-center shrink-0"
              >
                <Star className="w-3.5 h-3.5 fill-[#14110F] text-[#14110F]" />
                <span>Leave Review</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {activeProjectToReview && (
        <ReviewSubmissionDialog
          isOpen={Boolean(activeProjectToReview)}
          onClose={() => setActiveProjectToReview(null)}
          onSuccess={() => {
            setSuccessBanner(
              `Your review for "${activeProjectToReview.projectTitle}" was published.`,
            );
            setActiveProjectToReview(null);
            loadPending();
            onReviewSubmitted?.();
          }}
          projectId={activeProjectToReview.projectId}
          projectTitle={activeProjectToReview.projectTitle}
          recipientName={activeProjectToReview.counterparty.name}
          accessToken={accessToken}
        />
      )}
    </>
  );
}
