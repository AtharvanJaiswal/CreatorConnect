'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  EyeOff,
  Trash2,
  Flag,
  CheckCircle2,
} from 'lucide-react';
import type {
  ReviewModerationActionType,
  ReviewResponse,
  ReviewModerationAuditResponse,
} from '@creatorconnect/contracts';
import { moderateReview, validateReviewModeration } from '../../lib/reviews-workflow-service';

interface ReviewModerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { review: ReviewResponse; audit: ReviewModerationAuditResponse }) => void;
  reviewId: string;
  currentStatus: string;
  feedbackText: string;
  reviewerName?: string | undefined;
  accessToken?: string | null | undefined;
}

const MODERATION_ACTIONS: {
  action: ReviewModerationActionType;
  label: string;
  description: string;
  icon: React.ElementType;
  variant: 'danger' | 'warning' | 'success' | 'default';
}[] = [
  {
    action: 'RESTORE',
    label: 'Restore to Published',
    description:
      'Clears flags, restores public visibility, and includes review in rating aggregates.',
    icon: CheckCircle2,
    variant: 'success',
  },
  {
    action: 'HIDE',
    label: 'Hide Temporarily',
    description:
      'Hides review from public view pending deeper investigation while preserving data.',
    icon: EyeOff,
    variant: 'warning',
  },
  {
    action: 'REMOVE',
    label: 'Remove Permanently',
    description: 'Permanently excludes review from public reputation aggregates and profiles.',
    icon: Trash2,
    variant: 'danger',
  },
  {
    action: 'FLAG',
    label: 'Flag for Monitoring',
    description: 'Marks review as flagged for ongoing risk monitoring without hiding it yet.',
    icon: Flag,
    variant: 'default',
  },
];

export function ReviewModerationDialog({
  isOpen,
  onClose,
  onSuccess,
  reviewId,
  currentStatus,
  feedbackText,
  reviewerName,
  accessToken,
}: ReviewModerationDialogProps) {
  const [action, setAction] = useState<ReviewModerationActionType>('HIDE');
  const [reason, setReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAction(currentStatus === 'HIDDEN' ? 'RESTORE' : 'HIDE');
      setReason('');
      setInternalNotes('');
      setError(null);
      setValidationError(null);
    }
  }, [isOpen, currentStatus]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    const trimmedNotes = internalNotes.trim();
    const val = validateReviewModeration({
      action,
      reason,
      ...(trimmedNotes ? { internalNotes: trimmedNotes } : {}),
    });

    if (!val.valid) {
      setValidationError(val.errors[0] || 'Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const outcome = await moderateReview(
        reviewId,
        {
          action,
          reason,
          ...(trimmedNotes ? { internalNotes: trimmedNotes } : {}),
        },
        accessToken,
      );
      onSuccess(outcome);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record moderation decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-dialog-title"
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
              <ShieldCheck className="w-3 h-3 text-[#FFD64A]" />
              <span>Admin Trust & Safety</span>
            </div>
            <h2
              id="moderation-dialog-title"
              className="font-serif text-2xl font-bold text-[#14110F]"
            >
              Review Moderation Decision
            </h2>
            <p className="text-xs text-[#8F877D]">
              Current Status: <span className="font-semibold text-[#14110F]">{currentStatus}</span>
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

        {/* Review Preview */}
        <div className="p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6F675E]">
            Review Snippet {reviewerName ? `(by ${reviewerName})` : ''}
          </span>
          <p className="text-xs text-[#14110F] italic line-clamp-3 leading-relaxed">
            "{feedbackText}"
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
              Select Action <span className="text-[#C93B2B]">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODERATION_ACTIONS.map((item) => {
                const Icon = item.icon;
                const isSelected = action === item.action;

                return (
                  <button
                    key={item.action}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setAction(item.action)}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#14110F] border-[#14110F] text-white'
                        : 'bg-white border-[#E7E0D5] hover:border-[#8F877D] text-[#6F675E]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isSelected ? 'text-[#FFD64A]' : 'text-[#8F877D]'
                      }`}
                    />
                    <div>
                      <span className="text-xs font-semibold block">{item.label}</span>
                      <span
                        className={`text-[10px] leading-tight block ${
                          isSelected ? 'text-white/80' : 'text-[#8F877D]'
                        }`}
                      >
                        {item.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                Official Decision Reason <span className="text-[#C93B2B]">*</span>
              </label>
              <span className="text-[11px] text-[#8F877D]">{reason.length} / 500</span>
            </div>
            <textarea
              rows={2}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the policy rationale for this moderation action..."
              disabled={isSubmitting}
              className="w-full p-3 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs text-[#14110F] placeholder-[#8F877D] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
              Internal Audit Notes (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Confidential notes visible only to administrators..."
              disabled={isSubmitting}
              className="w-full p-3 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs text-[#14110F] placeholder-[#8F877D] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
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
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#14110F] hover:bg-[#2C2724] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFD64A]" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#FFD64A]" />
                  <span>Apply Decision</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
