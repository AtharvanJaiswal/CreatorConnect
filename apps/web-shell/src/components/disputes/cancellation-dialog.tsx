'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Undo2,
  Info,
  ArrowRight,
  FileText,
} from 'lucide-react';
import type { ProjectCancellationResponse } from '@creatorconnect/contracts';
import {
  requestCancellation,
  decideCancellation,
  withdrawCancellation,
  validateCancellationRequest,
} from '../../lib/disputes-workflow-service';

export type CancellationDialogMode = 'REQUEST' | 'DECIDE' | 'WITHDRAW';

interface CancellationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cancellation: ProjectCancellationResponse) => void;
  projectId: string;
  projectTitle: string;
  mode: CancellationDialogMode;
  pendingCancellation?: ProjectCancellationResponse | null;
  accessToken?: string | null;
}

export function CancellationDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectTitle,
  mode,
  pendingCancellation,
  accessToken,
}: CancellationDialogProps) {
  const [reason, setReason] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setDecisionReason('');
      setError(null);
      setValidationError(null);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCancellationRequest({ reason });
    if (!validation.valid) {
      setValidationError(validation.errors[0] || 'Invalid cancellation reason.');
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await requestCancellation(projectId, { reason: reason.trim() }, accessToken);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit cancellation request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecision = async (action: 'APPROVE' | 'REJECT') => {
    if (!pendingCancellation) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await decideCancellation(
        projectId,
        pendingCancellation.id,
        {
          action,
          ...(decisionReason.trim() ? { decisionReason: decisionReason.trim() } : {}),
        },
        accessToken,
      );
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to ${action.toLowerCase()} cancellation request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!pendingCancellation) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await withdrawCancellation(projectId, pendingCancellation.id, accessToken);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to withdraw cancellation request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancellation-dialog-title"
    >
      <div className="relative w-full max-w-[540px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#FFF8E7] border border-[#F2C93D]/30 flex items-center justify-center text-[#B88700] mb-4">
          <FileText className="w-6 h-6" />
        </div>

        {/* Title */}
        <h2 id="cancellation-dialog-title" className="font-serif text-2xl font-bold text-[#14110F]">
          {mode === 'REQUEST' && 'Request Mutual Cancellation'}
          {mode === 'DECIDE' && 'Review Cancellation Request'}
          {mode === 'WITHDRAW' && 'Pending Cancellation Request'}
        </h2>
        <p className="text-sm text-[#6F675E] mt-1 mb-5">
          Project: <span className="font-semibold text-[#14110F]">{projectTitle}</span>
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-[#FDE8E8] border border-[#C93B2B]/20 text-sm text-[#C93B2B] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Operation Failed</p>
              <p className="mt-0.5 text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Validation Alert */}
        {validationError && (
          <div className="mb-5 p-3 rounded-2xl bg-[#FDE8E8] border border-[#C93B2B]/20 text-xs text-[#C93B2B] font-medium">
            {validationError}
          </div>
        )}

        {/* MODE 1: REQUEST */}
        {mode === 'REQUEST' && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#FFF8E7] border border-[#F2C93D]/40 text-xs text-[#8A6A00] flex items-start gap-3">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#B88700]" />
              <p className="leading-relaxed">
                Mutual cancellation requires counterparty approval. Once approved, the project will
                transition to CANCELLED and unearned escrow will be reconciled.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                  Cancellation Reason
                </label>
                <span
                  className={`text-[11px] font-medium ${reason.length < 5 ? 'text-[#C93B2B]' : 'text-[#8F877D]'}`}
                >
                  {reason.length}/5000 characters (min 5)
                </span>
              </div>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you wish to cancel this project..."
                disabled={isSubmitting}
                className="w-full p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder:text-[#A8A196] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#6F675E] hover:text-[#14110F] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || reason.trim().length < 5}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#14110F] hover:bg-[#2C2724] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FFD64A]" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Request</span>
                    <ArrowRight className="w-4 h-4 text-[#FFD64A]" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: DECIDE (Counterparty response) */}
        {mode === 'DECIDE' && pendingCancellation && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs">
              <span className="font-semibold text-[#6F675E] uppercase tracking-wider block mb-1">
                Requester Explanation
              </span>
              <p className="text-sm text-[#14110F] leading-relaxed">{pendingCancellation.reason}</p>
              <span className="text-[11px] text-[#8F877D] mt-2 block">
                Requested on {new Date(pendingCancellation.createdAt).toLocaleString()}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E] mb-1.5">
                Response Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Optional explanation for your approval or rejection..."
                disabled={isSubmitting}
                className="w-full p-3 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={() => handleDecision('REJECT')}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-xs font-semibold text-[#C93B2B] transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject Cancellation</span>
              </button>

              <button
                type="button"
                onClick={() => handleDecision('APPROVE')}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#14110F] hover:bg-[#2C2724] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFD64A]" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#2E9E6B]" />
                    <span>Approve Cancellation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: WITHDRAW (Original requester can withdraw) */}
        {mode === 'WITHDRAW' && pendingCancellation && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs">
              <span className="font-semibold text-[#6F675E] uppercase tracking-wider block mb-1">
                Your Submitted Reason
              </span>
              <p className="text-sm text-[#14110F] leading-relaxed">{pendingCancellation.reason}</p>
              <span className="text-[11px] text-[#8F877D] mt-2 block">
                Submitted on {new Date(pendingCancellation.createdAt).toLocaleString()} &bull;
                Status: Awaiting Counterparty Review
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#6F675E] hover:text-[#14110F]"
              >
                Keep Request
              </button>

              <button
                type="button"
                onClick={handleWithdraw}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-xs font-semibold text-[#C93B2B] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Withdrawing...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="w-4 h-4" />
                    <span>Withdraw Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
