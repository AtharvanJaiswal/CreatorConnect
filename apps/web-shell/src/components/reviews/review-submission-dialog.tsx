'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, Loader2, CheckCircle2, AlertTriangle, Clock, Sparkles } from 'lucide-react';
import type { ReviewResponse } from '@creatorconnect/contracts';
import {
  submitProjectReview,
  updateReview,
  validateReviewSubmission,
  validateReviewUpdate,
  isWithin48Hours,
} from '../../lib/reviews-workflow-service';

interface ReviewSubmissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (review: ReviewResponse) => void;
  projectId: string;
  projectTitle: string;
  recipientName: string;
  existingReview?: ReviewResponse | null | undefined;
  accessToken?: string | null | undefined;
}

export function ReviewSubmissionDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectTitle,
  recipientName,
  existingReview,
  accessToken,
}: ReviewSubmissionDialogProps) {
  const isEditing = Boolean(existingReview);

  const [rating, setRating] = useState<number>(existingReview?.rating ?? 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const [communicationRating, setCommunicationRating] = useState<number | null>(
    existingReview?.communicationRating ?? null,
  );
  const [qualityRating, setQualityRating] = useState<number | null>(
    existingReview?.qualityRating ?? null,
  );
  const [adherenceRating, setAdherenceRating] = useState<number | null>(
    existingReview?.adherenceRating ?? null,
  );

  const [feedback, setFeedback] = useState<string>(existingReview?.feedback ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (existingReview) {
        setRating(existingReview.rating);
        setCommunicationRating(existingReview.communicationRating ?? null);
        setQualityRating(existingReview.qualityRating ?? null);
        setAdherenceRating(existingReview.adherenceRating ?? null);
        setFeedback(existingReview.feedback);
      } else {
        setRating(5);
        setCommunicationRating(null);
        setQualityRating(null);
        setAdherenceRating(null);
        setFeedback('');
      }
      setError(null);
      setValidationError(null);
    }
  }, [isOpen, existingReview]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    const updatePayload = {
      rating,
      feedback,
      ...(communicationRating ? { communicationRating } : {}),
      ...(qualityRating ? { qualityRating } : {}),
      ...(adherenceRating ? { adherenceRating } : {}),
    };

    if (isEditing && existingReview) {
      if (!isWithin48Hours(existingReview.createdAt)) {
        setValidationError('The 48-hour edit window has expired.');
        return;
      }

      const val = validateReviewUpdate(updatePayload);

      if (!val.valid) {
        setValidationError(val.errors[0] || 'Please complete all required fields.');
        return;
      }

      setIsSubmitting(true);
      try {
        const updated = await updateReview(existingReview.id, updatePayload, accessToken);
        onSuccess(updated);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to update review.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const createPayload = {
        rating,
        feedback,
        ...(communicationRating ? { communicationRating } : {}),
        ...(qualityRating ? { qualityRating } : {}),
        ...(adherenceRating ? { adherenceRating } : {}),
      };

      const val = validateReviewSubmission(createPayload);

      if (!val.valid) {
        setValidationError(val.errors[0] || 'Please complete all required fields.');
        return;
      }

      setIsSubmitting(true);
      try {
        const created = await submitProjectReview(projectId, createPayload, accessToken);
        onSuccess(created);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Failed to submit review.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const renderStarSelector = (
    currentValue: number | null,
    onChange: (val: number) => void,
    interactiveHover = false,
  ) => {
    return (
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = interactiveHover
            ? star <= (hoverRating ?? rating)
            : star <= (currentValue ?? 0);

          return (
            <button
              key={star}
              type="button"
              disabled={isSubmitting}
              onClick={() => onChange(star)}
              onMouseEnter={() => interactiveHover && setHoverRating(star)}
              onMouseLeave={() => interactiveHover && setHoverRating(null)}
              className="p-1 rounded-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              aria-label={`Select ${star} stars`}
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  isFilled
                    ? 'fill-[#FFD64A] text-[#FFD64A]'
                    : 'text-[#E7E0D5] hover:text-[#FFD64A]/50'
                }`}
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl border border-[#E7E0D5] shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[11px] font-semibold uppercase tracking-wider text-[#6F675E]">
              <Sparkles className="w-3 h-3 text-[#FFD64A]" />
              <span>{isEditing ? 'Edit Project Review' : 'Verified Project Review'}</span>
            </div>
            <h2 id="review-dialog-title" className="font-serif text-2xl font-bold text-[#14110F]">
              {isEditing ? 'Update Review for' : 'Review Collaboration with'} {recipientName}
            </h2>
            <p className="text-xs text-[#8F877D]">
              Project: <span className="font-semibold text-[#14110F]">{projectTitle}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-full hover:bg-[#FAF6EF] text-[#8F877D] hover:text-[#14110F] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 48-Hour Notice */}
        <div className="p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-start gap-2.5 text-xs text-[#6F675E]">
          <Clock className="w-4 h-4 text-[#8F877D] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#14110F]">48-Hour Edit Policy</p>
            <p className="text-[11px] leading-relaxed text-[#8F877D]">
              Reviews are immutable 48 hours after submission to preserve authentic reputation
              integrity.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Primary Star Rating */}
          <div className="space-y-2 bg-[#FAF6EF]/60 p-4 rounded-2xl border border-[#E7E0D5]/70">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
              Overall Rating <span className="text-[#C93B2B]">*</span>
            </label>
            <div className="flex items-center justify-between">
              {renderStarSelector(rating, setRating, true)}
              <span className="text-sm font-bold text-[#14110F] bg-white px-3 py-1 rounded-full border border-[#E7E0D5]">
                {hoverRating ?? rating} / 5 Stars
              </span>
            </div>
          </div>

          {/* Optional Category Ratings */}
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
              Category Breakdown (Optional)
            </label>
            <div className="grid grid-cols-1 gap-2.5 bg-white p-3.5 rounded-2xl border border-[#E7E0D5] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#6F675E]">Communication</span>
                {renderStarSelector(communicationRating, setCommunicationRating)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6F675E]">Quality of Deliverables</span>
                {renderStarSelector(qualityRating, setQualityRating)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6F675E]">Adherence to Deadlines</span>
                {renderStarSelector(adherenceRating, setAdherenceRating)}
              </div>
            </div>
          </div>

          {/* Written Feedback */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                Written Feedback <span className="text-[#C93B2B]">*</span>
              </label>
              <span className="text-[11px] text-[#8F877D]">{feedback.length} / 2000</span>
            </div>
            <textarea
              rows={4}
              required
              minLength={10}
              maxLength={2000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share details of your collaboration, punctuality, and overall delivery quality..."
              disabled={isSubmitting}
              className="w-full p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs text-[#14110F] placeholder-[#8F877D] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
            />
          </div>

          {/* Errors */}
          {validationError && (
            <div className="p-3 rounded-2xl bg-[#FEECEB] border border-[#FCA5A5] flex items-center gap-2 text-xs text-[#C93B2B]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-[#FEECEB] border border-[#FCA5A5] flex items-center gap-2 text-xs text-[#C93B2B]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-xs font-semibold text-[#6F675E] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#14110F] hover:bg-[#2C2724] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFD64A]" />
                  <span>{isEditing ? 'Updating...' : 'Publishing...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#FFD64A]" />
                  <span>{isEditing ? 'Save Changes' : 'Submit Review'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
