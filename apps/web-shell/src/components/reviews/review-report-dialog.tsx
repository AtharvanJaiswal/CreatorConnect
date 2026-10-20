'use client';

import React, { useState, useEffect } from 'react';
import { X, Flag, Loader2, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { ReviewReportReason, ReviewReportResponse } from '@creatorconnect/contracts';
import { reportReview, validateReviewReport } from '../../lib/reviews-workflow-service';

interface ReviewReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (report: ReviewReportResponse) => void;
  reviewId: string;
  reviewerName?: string | undefined;
  accessToken?: string | null | undefined;
}

const REPORT_REASONS: { value: ReviewReportReason; label: string; description: string }[] = [
  {
    value: 'SPAM',
    label: 'Spam or Commercial Promotion',
    description: 'Contains unsolicited advertisements, affiliate links, or repetitive text.',
  },
  {
    value: 'HARASSMENT',
    label: 'Harassment or Bullying',
    description: 'Targeted hostility, insults, personal attacks, or intimidation.',
  },
  {
    value: 'DEFAMATION',
    label: 'Defamation or False Statements',
    description: 'Demonstrably untruthful claims made with intent to harm reputation.',
  },
  {
    value: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate Content',
    description: 'Profanity, explicit language, hate speech, or offensive material.',
  },
  {
    value: 'CONFLICT_OF_INTEREST',
    label: 'Conflict of Interest',
    description: 'Fabricated collaboration, competitor sabotage, or undisclosed bias.',
  },
  {
    value: 'OTHER',
    label: 'Other Policy Violation',
    description: 'Violates platform terms of service not covered above.',
  },
];

export function ReviewReportDialog({
  isOpen,
  onClose,
  onSuccess,
  reviewId,
  reviewerName,
  accessToken,
}: ReviewReportDialogProps) {
  const [reason, setReason] = useState<ReviewReportReason>('SPAM');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('SPAM');
      setDetails('');
      setError(null);
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    const val = validateReviewReport({ reason, details });
    if (!val.valid) {
      setValidationError(val.errors[0] || 'Please provide all report details.');
      return;
    }

    setIsSubmitting(true);
    try {
      const report = await reportReview(reviewId, { reason, details }, accessToken);
      onSuccess(report);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl border border-[#E7E0D5] shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEECEB] border border-[#FCA5A5] text-[11px] font-semibold uppercase tracking-wider text-[#C93B2B]">
              <Flag className="w-3 h-3 text-[#C93B2B]" />
              <span>Report Review</span>
            </div>
            <h2 id="report-dialog-title" className="font-serif text-2xl font-bold text-[#14110F]">
              Report Community Review
            </h2>
            {reviewerName && (
              <p className="text-xs text-[#8F877D]">
                Authored by: <span className="font-semibold text-[#14110F]">{reviewerName}</span>
              </p>
            )}
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

        {/* Audit Notice */}
        <div className="p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-start gap-2.5 text-xs text-[#6F675E]">
          <ShieldAlert className="w-4 h-4 text-[#8F877D] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-[#8F877D]">
            Reports trigger independent moderation review by the trust & safety team. Negative
            opinions alone are not grounds for removal unless policy is breached.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
              Reason for Report <span className="text-[#C93B2B]">*</span>
            </label>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                    reason === r.value
                      ? 'bg-[#FAF6EF] border-[#14110F] text-[#14110F]'
                      : 'bg-white border-[#E7E0D5] text-[#6F675E] hover:border-[#8F877D]'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    disabled={isSubmitting}
                    className="mt-0.5 text-[#14110F] focus:ring-[#FFD64A]"
                  />
                  <div>
                    <span className="text-xs font-semibold block">{r.label}</span>
                    <span className="text-[11px] text-[#8F877D] leading-tight block">
                      {r.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                Specific Details <span className="text-[#C93B2B]">*</span>
              </label>
              <span className="text-[11px] text-[#8F877D]">{details.length} / 1000</span>
            </div>
            <textarea
              rows={3}
              required
              minLength={10}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain exactly how this review violates community policy..."
              disabled={isSubmitting}
              className="w-full p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs text-[#14110F] placeholder-[#8F877D] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
            />
          </div>

          {/* Validation & Server Error */}
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
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#C93B2B] hover:bg-[#B33426] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
