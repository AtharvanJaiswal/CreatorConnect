'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import type { ProjectDeliverableResponse, ReviewDeliverableInput } from '@creatorconnect/contracts';
import {
  validateReview,
  generateIdempotencyKey,
  reviewDeliverable,
} from '../../lib/milestone-workflow-service';

interface MilestoneReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  milestone: ProjectDeliverableResponse;
  accessToken?: string | null;
}

export function MilestoneReviewDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  milestone,
  accessToken,
}: MilestoneReviewDialogProps) {
  const [activeTab, setActiveTab] = useState<'APPROVE' | 'REQUEST_REVISION'>('APPROVE');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('APPROVE');
      setRevisionNotes('');
      setSubmitError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validation = validateReview({
    action: activeTab,
    notes: revisionNotes,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const idempotencyKey = generateIdempotencyKey();
      const payload: ReviewDeliverableInput = {
        action: activeTab,
        idempotencyKey,
        ...(activeTab === 'REQUEST_REVISION' && revisionNotes.trim()
          ? { notes: revisionNotes.trim() }
          : {}),
      };
      await reviewDeliverable(projectId, milestone.id, payload, accessToken);

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Deliverable review failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
    >
      <div className="relative w-full max-w-[540px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#65558F]" />
            <span>Client Milestone Review • v{milestone.version}</span>
          </div>

          <h2
            id="review-dialog-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight"
          >
            Review Deliverable Submission
          </h2>
          <p className="text-sm text-[#6F675E] mt-1">
            Milestone: <span className="font-semibold text-[#14110F]">{milestone.title}</span>
          </p>

          {milestone.submissionNotes && (
            <div className="mt-3 p-3.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs text-[#14110F]">
              <span className="font-bold text-[#6F675E] block mb-1">Creator Submission Notes:</span>
              <p>{milestone.submissionNotes}</p>
            </div>
          )}
        </div>

        {/* Action Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF6EF] rounded-2xl border border-[#E7E0D5] mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('APPROVE');
              setSubmitError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'APPROVE'
                ? 'bg-white text-[#2E9E6B] shadow-sm border border-[#E7E0D5]'
                : 'text-[#6F675E] hover:text-[#14110F]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Approve & Accept</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REQUEST_REVISION');
              setSubmitError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'REQUEST_REVISION'
                ? 'bg-white text-[#C98A16] shadow-sm border border-[#E7E0D5]'
                : 'text-[#6F675E] hover:text-[#14110F]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Request Revision</span>
          </button>
        </div>

        {/* Tab Content */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {activeTab === 'APPROVE' && (
            <div className="p-4 rounded-2xl bg-[#E6F4EA]/60 border border-[#2E9E6B]/30 space-y-3">
              <div className="flex items-start gap-3">
                <FileCheck className="w-5 h-5 text-[#2E9E6B] shrink-0 mt-0.5" />
                <div className="text-xs text-[#14110F]">
                  <p className="font-bold mb-1">Confirmation of Deliverable Acceptance</p>
                  <p className="text-[#6F675E]">
                    Accepting this deliverable marks the milestone as <strong>APPROVED</strong>. If
                    all project deliverables are approved, the project will transition to completed
                    status and escrow funds can be safely released.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'REQUEST_REVISION' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#FFF6D9] border border-[#FFD64A]/60 text-xs text-[#735C00] flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Constructive Feedback Required</span>
                  <p>
                    Please specify actionable changes needed. The deliverable will be moved to{' '}
                    <strong>REVISION_REQUESTED</strong> status, allowing the creator to submit
                    version {milestone.version + 1}.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="revision-feedback"
                  className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-2"
                >
                  Revision Feedback & Required Modifications{' '}
                  <span className="text-[#D8483C]">*</span>
                </label>
                <textarea
                  id="revision-feedback"
                  rows={4}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Detail specific edits, timestamps in video, typography adjustments, audio balances..."
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder-[#A39A8F] focus:outline-none focus:border-[#FFD64A] focus:ring-1 focus:ring-[#FFD64A] transition-all"
                  required
                />
                <span className="text-[11px] text-[#A39A8F] mt-1 block">
                  Minimum 10 characters required. Current: {revisionNotes.length}
                </span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {submitError && (
            <div className="p-3.5 rounded-xl bg-[#FCE8E6] border border-[#D8483C] text-xs text-[#D8483C] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#6F675E] hover:text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
            >
              Cancel
            </button>

            {activeTab === 'APPROVE' ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2E9E6B] text-white hover:bg-[#25855A] text-xs font-bold shadow-sm disabled:opacity-50 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Approval...</span>
                  </>
                ) : (
                  <span>Confirm Deliverable Approval</span>
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!validation.valid || isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] text-xs font-bold shadow-sm disabled:opacity-50 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Feedback...</span>
                  </>
                ) : (
                  <span>Send Revision Request</span>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
