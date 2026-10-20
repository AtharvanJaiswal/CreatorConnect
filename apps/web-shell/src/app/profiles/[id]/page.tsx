'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Star,
  ShieldCheck,
  Award,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Flag,
  Edit3,
  Loader2,
  Briefcase,
  User,
  Sparkles,
} from 'lucide-react';
import type {
  PublicCreatorProfileResponse,
  ReputationSummaryResponse,
  ReviewResponse,
} from '@creatorconnect/contracts';
import { useAuth } from '../../../providers/auth-provider';
import {
  fetchUserReputation,
  fetchUserReviews,
  formatRating,
  calculateStarPercentages,
  canEditReview,
  canReportReview,
} from '../../../lib/reviews-workflow-service';
import { ReviewReportDialog } from '../../../components/reviews/review-report-dialog';
import { ReviewSubmissionDialog } from '../../../components/reviews/review-submission-dialog';
import { PendingReviewsCard } from '../../../components/reviews/pending-reviews-card';

export default function PublicCreatorProfilePage() {
  const params = useParams();
  const profileId = params?.id as string;
  const { user, accessToken } = useAuth();

  const [creatorProfile, setCreatorProfile] = useState<PublicCreatorProfileResponse | null>(null);
  const [reputation, setReputation] = useState<ReputationSummaryResponse | null>(null);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [minRatingFilter, setMinRatingFilter] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'reviews' | 'portfolio' | 'about'>('reviews');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [reportingReview, setReportingReview] = useState<ReviewResponse | null>(null);
  const [editingReview, setEditingReview] = useState<ReviewResponse | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const fetchProfileAndReputation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch public profile
      let profileData: PublicCreatorProfileResponse | null = null;
      let targetUserId = profileId;

      try {
        const res = await fetch(`/api/v1/profiles/public/creator/${encodeURIComponent(profileId)}`);
        if (res.ok) {
          profileData = await res.json();
          if (profileData?.id) {
            targetUserId = profileData.id;
          }
        }
      } catch {
        // Fallback: direct user id query
      }

      setCreatorProfile(profileData);

      // 2. Fetch authoritative canonical reputation summary
      const repData = await fetchUserReputation(targetUserId, accessToken);
      setReputation(repData);

      // 3. Fetch public published reviews
      const reviewsData = await fetchUserReviews(
        targetUserId,
        {
          limit: 20,
          ...(minRatingFilter !== undefined ? { minRating: minRatingFilter } : {}),
        },
        accessToken,
      );
      setReviews(reviewsData.items);
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve public creator reputation profile.');
    } finally {
      setIsLoading(false);
    }
  }, [profileId, accessToken, minRatingFilter]);

  useEffect(() => {
    if (profileId) {
      fetchProfileAndReputation();
    }
  }, [profileId, fetchProfileAndReputation]);

  const starPercentages = reputation
    ? calculateStarPercentages(reputation.ratingDistribution, reputation.totalReviews)
    : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const displayName = creatorProfile?.displayName || 'Creator Profile';
  const location = [creatorProfile?.locationCity, creatorProfile?.locationCountry]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] pb-24">
      {/* Top Banner / Cover */}
      <div className="w-full h-44 md:h-56 bg-gradient-to-r from-[#14110F] via-[#2C2724] to-[#14110F] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#FFD64A_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 md:-mt-20 relative z-10 space-y-8">
        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Avatar */}
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-[#FAF6EF] border-2 border-white shadow-md overflow-hidden flex items-center justify-center shrink-0">
                {creatorProfile?.avatarUrl ? (
                  <img
                    src={creatorProfile.avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-[#8F877D]" />
                )}
              </div>

              {/* Title & Identity */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-2xl md:text-3xl font-bold text-[#14110F]">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8F8F0] border border-[#A7F3D0] text-[11px] font-semibold text-[#2E9E6B]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Creator
                  </span>
                </div>

                {creatorProfile?.bio && (
                  <p className="text-xs sm:text-sm text-[#6F675E] leading-relaxed max-w-2xl">
                    {creatorProfile.bio}
                  </p>
                )}

                {/* Meta details */}
                <div className="flex items-center gap-4 text-xs text-[#8F877D] pt-1 flex-wrap">
                  {location && <span>📍 {location}</span>}
                  {creatorProfile?.tagline && (
                    <span className="italic text-[#6F675E]">"{creatorProfile.tagline}"</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            <div className="flex sm:flex-row md:flex-col gap-2 shrink-0">
              <div className="p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-[#8F877D]" />
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#8F877D] block">
                    Completed Projects
                  </span>
                  <span className="text-sm font-bold text-[#14110F]">
                    {reputation?.completedProjectCount ?? 0} Verified
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center gap-3">
                <Award className="w-5 h-5 text-[#FFD64A]" />
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[#8F877D] block">
                    Public Reviews
                  </span>
                  <span className="text-sm font-bold text-[#14110F]">
                    {reputation?.totalReviews ?? 0} Published
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action feedback message */}
        {actionSuccessMessage && (
          <div className="p-4 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] text-xs text-[#2E9E6B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              onClick={() => setActionSuccessMessage(null)}
              className="text-[#2E9E6B] hover:underline font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-16 text-center bg-white rounded-3xl border border-[#E7E0D5] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#14110F]" />
            <p className="text-xs text-[#8F877D]">Loading verified reputation profile...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-8 text-center bg-white rounded-3xl border border-[#FCA5A5] bg-[#FEECEB]/30 space-y-3">
            <AlertCircle className="w-8 h-8 text-[#C93B2B] mx-auto" />
            <p className="font-semibold text-sm text-[#C93B2B]">Error Loading Profile</p>
            <p className="text-xs text-[#6F675E]">{error}</p>
            <button
              onClick={fetchProfileAndReputation}
              className="px-4 py-2 rounded-full bg-[#14110F] text-white text-xs font-semibold hover:bg-[#2C2724] transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && reputation && (
          <>
            {/* Pending Reviews Banner (if user has completed projects awaiting review) */}
            {user && (
              <PendingReviewsCard
                accessToken={accessToken}
                onReviewSubmitted={fetchProfileAndReputation}
              />
            )}

            {/* Stitch Tabs: Reviews (E09), Portfolio (E08), Overview/About (E07) */}
            <div className="flex items-center gap-2 border-b border-[#E7E0D5] pb-3 overflow-x-auto">
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'reviews'
                    ? 'bg-[#14110F] text-white shadow-sm'
                    : 'bg-white border border-[#E7E0D5] text-[#6F675E] hover:border-[#8F877D]'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-[#FFD64A] text-[#FFD64A]" />
                <span>Verified Reviews ({reputation.totalReviews})</span>
              </button>

              <button
                onClick={() => setActiveTab('portfolio')}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'portfolio'
                    ? 'bg-[#14110F] text-white shadow-sm'
                    : 'bg-white border border-[#E7E0D5] text-[#6F675E] hover:border-[#8F877D]'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Portfolio & Works ({creatorProfile?.portfolio?.length ?? 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('about')}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'about'
                    ? 'bg-[#14110F] text-white shadow-sm'
                    : 'bg-white border border-[#E7E0D5] text-[#6F675E] hover:border-[#8F877D]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Skills & About</span>
              </button>
            </div>

            {activeTab === 'reviews' && (
              <>
                {/* Authoritative Reputation Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Scorecard: Overall Average & Bayesian Shrinkage */}
                  <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 md:p-8 flex flex-col justify-between space-y-4 shadow-sm">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6F675E] block">
                        Authoritative Rating
                      </span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="font-serif text-5xl font-extrabold text-[#14110F]">
                          {formatRating(reputation.averageRating)}
                        </span>
                        {reputation.averageRating !== null && (
                          <span className="text-sm text-[#8F877D]">/ 5.0</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[#FFD64A] mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              reputation.averageRating !== null &&
                              star <= Math.round(reputation.averageRating)
                                ? 'fill-[#FFD64A] text-[#FFD64A]'
                                : 'text-[#E7E0D5]'
                            }`}
                          />
                        ))}
                        <span className="text-xs text-[#8F877D] ml-2 font-medium">
                          ({reputation.totalReviews}{' '}
                          {reputation.totalReviews === 1 ? 'review' : 'reviews'})
                        </span>
                      </div>
                    </div>

                    {/* Bayesian Shrinkage Indicator */}
                    <div className="pt-4 border-t border-[#E7E0D5] space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[#6F675E]">
                        <span className="font-medium flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-[#FFD64A]" />
                          Confidence Score
                        </span>
                        <span className="font-bold text-[#14110F]">
                          {reputation.bayesianScore !== null
                            ? reputation.bayesianScore.toFixed(2)
                            : 'Unrated'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8F877D] leading-tight">
                        Platform prior m=4.0, C=5.0 prevents early score manipulation.
                      </p>
                    </div>
                  </div>

                  {/* Star Distribution Histogram */}
                  <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 md:p-8 shadow-sm space-y-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6F675E] block">
                      Rating Distribution
                    </span>

                    <div className="space-y-2 pt-1">
                      {[5, 4, 3, 2, 1].map((s) => {
                        const count = reputation.ratingDistribution[s as 1 | 2 | 3 | 4 | 5] ?? 0;
                        const pct = starPercentages[s] ?? 0;

                        return (
                          <div key={s} className="flex items-center gap-3 text-xs">
                            <span className="w-7 font-semibold text-[#14110F] flex items-center gap-0.5">
                              {s} <Star className="w-3 h-3 fill-[#FFD64A] text-[#FFD64A]" />
                            </span>

                            <div className="flex-1 h-2 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] overflow-hidden">
                              <div
                                className="h-full bg-[#14110F] rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            <span className="w-8 text-right text-[11px] text-[#8F877D] font-mono">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category Averages */}
                  <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 md:p-8 shadow-sm space-y-4">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6F675E] block">
                      Category Breakdown
                    </span>

                    <div className="space-y-3 pt-1">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#6F675E]">Communication</span>
                          <span className="font-bold text-[#14110F]">
                            {formatRating(reputation.categoryAverages.communication)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#FAF6EF] overflow-hidden">
                          <div
                            className="h-full bg-[#FFD64A] rounded-full"
                            style={{
                              width: `${((reputation.categoryAverages.communication ?? 0) / 5) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#6F675E]">Quality of Deliverables</span>
                          <span className="font-bold text-[#14110F]">
                            {formatRating(reputation.categoryAverages.quality)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#FAF6EF] overflow-hidden">
                          <div
                            className="h-full bg-[#FFD64A] rounded-full"
                            style={{
                              width: `${((reputation.categoryAverages.quality ?? 0) / 5) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#6F675E]">Adherence to Deadlines</span>
                          <span className="font-bold text-[#14110F]">
                            {formatRating(reputation.categoryAverages.adherence)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#FAF6EF] overflow-hidden">
                          <div
                            className="h-full bg-[#FFD64A] rounded-full"
                            style={{
                              width: `${((reputation.categoryAverages.adherence ?? 0) / 5) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Published Reviews Stream */}
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-serif text-2xl font-bold text-[#14110F]">
                        Verified Reviews & Feedback
                      </h2>
                      <p className="text-xs text-[#8F877D]">
                        Authentic post-completion reviews submitted by verified project
                        collaborators.
                      </p>
                    </div>

                    {/* Rating Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {[
                        { label: 'All Reviews', value: undefined },
                        { label: '5 Stars', value: 5 },
                        { label: '4+ Stars', value: 4 },
                        { label: '3+ Stars', value: 3 },
                      ].map((filter) => {
                        const isSelected = minRatingFilter === filter.value;
                        return (
                          <button
                            key={filter.label}
                            onClick={() => setMinRatingFilter(filter.value)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                              isSelected
                                ? 'bg-[#14110F] text-white shadow-sm'
                                : 'bg-white border border-[#E7E0D5] text-[#6F675E] hover:border-[#8F877D]'
                            }`}
                          >
                            {filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reviews List */}
                  {reviews.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-3xl border border-[#E7E0D5] space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center mx-auto text-[#8F877D]">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <h3 className="font-serif text-lg font-bold text-[#14110F]">
                        No Reviews Found
                      </h3>
                      <p className="text-xs text-[#8F877D] max-w-sm mx-auto leading-relaxed">
                        This creator does not have any eligible published reviews under the selected
                        filter criteria.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((rev) => {
                        const reviewer = (rev as any).reviewer;
                        const reviewerName = reviewer
                          ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() ||
                            'Verified Client'
                          : 'Verified Client';

                        const canEdit = user ? canEditReview(rev, user.id).canEdit : false;
                        const canReport = user ? canReportReview(rev, user.id) : false;

                        return (
                          <div
                            key={rev.id}
                            className="bg-white rounded-3xl border border-[#E7E0D5] p-6 space-y-4 shadow-sm hover:border-[#8F877D] transition-all"
                          >
                            {/* Header: Reviewer info + Rating stars */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center font-bold text-xs text-[#14110F] overflow-hidden">
                                  {reviewer?.avatarUrl ? (
                                    <img
                                      src={reviewer.avatarUrl}
                                      alt={reviewerName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    reviewerName[0] || 'C'
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-[#14110F]">
                                      {reviewerName}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-semibold text-[#6F675E]">
                                      <CheckCircle2 className="w-3 h-3 text-[#2E9E6B]" />
                                      Verified Completion
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px] text-[#8F877D] mt-0.5">
                                    <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                                    {rev.editCount > 0 && (
                                      <span className="italic text-[#8F877D]">(edited)</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Star Score */}
                              <div className="flex items-center gap-1.5 self-start sm:self-center">
                                <div className="flex items-center text-[#FFD64A]">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`w-4 h-4 ${
                                        s <= rev.rating
                                          ? 'fill-[#FFD64A] text-[#FFD64A]'
                                          : 'text-[#E7E0D5]'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="font-bold text-sm text-[#14110F] ml-1">
                                  {rev.rating}.0
                                </span>
                              </div>
                            </div>

                            {/* Written Feedback Text */}
                            <p className="text-xs sm:text-sm text-[#14110F] leading-relaxed whitespace-pre-line">
                              {rev.feedback}
                            </p>

                            {/* Category Rating Chips if available */}
                            {(rev.communicationRating ||
                              rev.qualityRating ||
                              rev.adherenceRating) && (
                              <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-[#6F675E]">
                                {rev.communicationRating && (
                                  <span className="px-2.5 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5]">
                                    Communication: {rev.communicationRating}★
                                  </span>
                                )}
                                {rev.qualityRating && (
                                  <span className="px-2.5 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5]">
                                    Quality: {rev.qualityRating}★
                                  </span>
                                )}
                                {rev.adherenceRating && (
                                  <span className="px-2.5 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5]">
                                    Adherence: {rev.adherenceRating}★
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Action buttons (Edit if author within 48h, Report if viewer) */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E0D5]/60">
                              {canEdit && (
                                <button
                                  onClick={() => setEditingReview(rev)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-[11px] font-semibold text-[#14110F] transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit Review</span>
                                </button>
                              )}

                              {canReport && (
                                <button
                                  onClick={() => setReportingReview(rev)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#FEECEB] text-[11px] font-semibold text-[#8F877D] hover:text-[#C93B2B] transition-colors"
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                  <span>Report</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'portfolio' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#14110F]">
                    Featured Portfolio
                  </h2>
                  <p className="text-xs text-[#8F877D]">
                    Curated works and deliverables produced by this creator.
                  </p>
                </div>

                {!creatorProfile?.portfolio || creatorProfile.portfolio.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-[#E7E0D5] space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center mx-auto text-[#8F877D]">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <h3 className="font-serif text-lg font-bold text-[#14110F]">
                      No Portfolio Items
                    </h3>
                    <p className="text-xs text-[#8F877D] max-w-sm mx-auto leading-relaxed">
                      This creator has not published any public portfolio works yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {creatorProfile.portfolio.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-3xl border border-[#E7E0D5] overflow-hidden shadow-sm hover:border-[#8F877D] transition-all space-y-4"
                      >
                        {item.media && item.media.length > 0 && (
                          <div className="w-full h-48 bg-[#FAF6EF] overflow-hidden">
                            <img
                              src={
                                item.media?.[0]?.mediaAsset?.url ||
                                item.media?.[0]?.mediaAsset?.previewUrl ||
                                ''
                              }
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-6 space-y-3">
                          <h3 className="font-serif text-lg font-bold text-[#14110F]">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-[#6F675E] leading-relaxed line-clamp-3">
                              {item.description}
                            </p>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2.5 py-0.5 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-semibold text-[#6F675E]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'about' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white rounded-3xl border border-[#E7E0D5] p-6 md:p-8 space-y-6 shadow-sm">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#14110F] mb-2">
                      About the Creator
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6F675E] leading-relaxed whitespace-pre-line">
                      {creatorProfile?.bio || 'No detailed biography provided.'}
                    </p>
                  </div>

                  {creatorProfile?.categories && creatorProfile.categories.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-[#E7E0D5]">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8F877D]">
                        Production Categories
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        {creatorProfile.categories.map((c) => (
                          <span
                            key={c.id}
                            className="px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-xs font-semibold text-[#14110F]"
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {creatorProfile?.skills && creatorProfile.skills.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-[#E7E0D5]">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8F877D]">
                        Skills & Proficiency
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        {creatorProfile.skills.map((s) => (
                          <span
                            key={s.id}
                            className="px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-xs font-semibold text-[#14110F] flex items-center gap-1.5"
                          >
                            <span>{s.name}</span>
                            <span className="text-[10px] uppercase font-bold text-[#8F877D]">
                              • {s.proficiency}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 md:p-8 space-y-5 shadow-sm h-fit">
                  <h3 className="font-serif text-lg font-bold text-[#14110F]">Service Terms</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[#8F877D] block">Starting Rate</span>
                      <span className="text-lg font-bold text-[#14110F]">
                        {creatorProfile?.startingRate
                          ? `₹${(creatorProfile.startingRate / 100).toLocaleString('en-IN')}`
                          : 'Custom Quote'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#8F877D] block">Work Mode</span>
                      <span className="font-semibold text-[#14110F]">
                        {creatorProfile?.isRemote ? 'Available for Remote Work' : 'On-Site Only'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#8F877D] block">Identity Status</span>
                      <span className="font-semibold text-[#2E9E6B] flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Platform Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Report Dialog */}
      {reportingReview && (
        <ReviewReportDialog
          isOpen={Boolean(reportingReview)}
          onClose={() => setReportingReview(null)}
          onSuccess={() => {
            setActionSuccessMessage('Your report has been submitted to trust & safety for audit.');
            setReportingReview(null);
          }}
          reviewId={reportingReview.id}
          reviewerName={
            (reportingReview as any).reviewer
              ? `${(reportingReview as any).reviewer.firstName || ''} ${(reportingReview as any).reviewer.lastName || ''}`.trim()
              : undefined
          }
          accessToken={accessToken}
        />
      )}

      {/* Review Edit Dialog */}
      {editingReview && (
        <ReviewSubmissionDialog
          isOpen={Boolean(editingReview)}
          onClose={() => setEditingReview(null)}
          onSuccess={() => {
            setActionSuccessMessage('Your review has been successfully updated.');
            setEditingReview(null);
            fetchProfileAndReputation();
          }}
          projectId={editingReview.projectId}
          projectTitle="Completed Project"
          recipientName={displayName}
          existingReview={editingReview}
          accessToken={accessToken}
        />
      )}
    </div>
  );
}
