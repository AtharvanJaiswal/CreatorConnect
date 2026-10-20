'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, ShieldAlert, ArrowRight, Info } from 'lucide-react';
import type { DisputeReason, DisputeResponse } from '@creatorconnect/contracts';
import { openDispute, validateOpenDispute } from '../../lib/disputes-workflow-service';

interface DisputeOpenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dispute: DisputeResponse) => void;
  projectId: string;
  projectTitle: string;
  deliverableId?: string | null;
  accessToken?: string | null;
}

const DISPUTE_REASONS: { value: DisputeReason; label: string; description: string }[] = [
  {
    value: 'DELIVERABLE_POOR_QUALITY',
    label: 'Deliverable Quality Issue',
    description: 'Work submitted does not meet documented requirements or standards.',
  },
  {
    value: 'MISSED_DEADLINE',
    label: 'Missed Milestone Deadline',
    description: 'Agreed delivery timelines were missed without mutual agreement.',
  },
  {
    value: 'UNRESPONSIVE_PARTY',
    label: 'Unresponsive Counterparty',
    description: 'The other party has stopped communicating for an extended period.',
  },
  {
    value: 'SCOPE_MISMATCH',
    label: 'Scope Mismatch',
    description: 'Expectations or deliverables diverge significantly from the contract.',
  },
  {
    value: 'UNAUTHORIZED_WORK',
    label: 'Unauthorized Work',
    description: 'Actions or changes undertaken without required prior client approval.',
  },
  {
    value: 'OTHER',
    label: 'Other Dispute Issue',
    description: 'Other contractual breach or non-performance issue.',
  },
];

export function DisputeOpenDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectTitle,
  deliverableId,
  accessToken,
}: DisputeOpenDialogProps) {
  const [reason, setReason] = useState<DisputeReason>('DELIVERABLE_POOR_QUALITY');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setReason('DELIVERABLE_POOR_QUALITY');
      setDescription('');
      setError(null);
      setValidationErrors([]);
    }
  }, [isOpen]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateOpenDispute({ reason, description });
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    setIsSubmitting(true);
    setError(null);

    try {
      const input = {
        projectId,
        ...(deliverableId ? { deliverableId } : {}),
        reason,
        description: description.trim(),
      };

      const result = await openDispute(input, accessToken);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to raise dispute.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-open-dialog-title"
    >
      <div className="relative w-full max-w-[580px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#FDE8E8] border border-[#C93B2B]/20 flex items-center justify-center text-[#C93B2B] mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>

        {/* Title & Subheading */}
        <h2 id="dispute-open-dialog-title" className="font-serif text-2xl font-bold text-[#14110F]">
          Initiate Project Dispute
        </h2>
        <p className="text-sm text-[#6F675E] mt-1 mb-6">
          Raise a formal dispute for{' '}
          <span className="font-semibold text-[#14110F]">{projectTitle}</span>.
        </p>

        {/* Notice Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-[#FFF8E7] border border-[#F2C93D]/40 text-xs text-[#8A6A00] flex items-start gap-3">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#B88700]" />
          <div>
            <p className="font-semibold text-[#664D00]">Escrow Ledger Lock Active</p>
            <p className="mt-0.5 leading-relaxed">
              Submitting a dispute immediately freezes all escrow releases and payout approvals. An
              administrative arbitrator will review evidence from both parties.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-[#FDE8E8] border border-[#C93B2B]/20 text-sm text-[#C93B2B] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to initiate dispute</p>
              <p className="mt-0.5 text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-[#FDE8E8] border border-[#C93B2B]/20 text-sm text-[#C93B2B]">
            <p className="font-semibold mb-1 text-xs uppercase tracking-wider">
              Please resolve the following:
            </p>
            <ul className="list-disc list-inside text-xs space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Reason Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E] mb-2">
              Dispute Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
            >
              {DISPUTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#8F877D] mt-1.5">
              {DISPUTE_REASONS.find((r) => r.value === reason)?.description}
            </p>
          </div>

          {/* Description Textarea */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                Detailed Explanation
              </label>
              <span
                className={`text-[11px] font-medium ${description.length < 10 ? 'text-[#C93B2B]' : 'text-[#8F877D]'}`}
              >
                {description.length}/5000 characters (min 10)
              </span>
            </div>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain specifically what obligations were not met, including dates, deliverable versions, or communications..."
              disabled={isSubmitting}
              className="w-full p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder:text-[#A8A196] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E7E0D5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#6F675E] hover:text-[#14110F] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || description.trim().length < 10}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#C93B2B] hover:bg-[#B33224] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Raise Dispute</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
