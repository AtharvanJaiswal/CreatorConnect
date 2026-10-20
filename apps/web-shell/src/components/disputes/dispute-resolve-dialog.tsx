'use client';

import React, { useState, useEffect } from 'react';
import { X, Scale, AlertTriangle, Loader2, ArrowRight, Info } from 'lucide-react';
import type { DisputeResponse, ResolveDisputeInput } from '@creatorconnect/contracts';
import { resolveDispute, validateResolveDispute } from '../../lib/disputes-workflow-service';

interface DisputeResolveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedDispute: DisputeResponse) => void;
  dispute: DisputeResponse | null;
  projectTitle: string;
  escrowBalance?: number;
  currency?: string;
  accessToken?: string | null;
}

export function DisputeResolveDialog({
  isOpen,
  onClose,
  onSuccess,
  dispute,
  projectTitle,
  escrowBalance = 0,
  currency = 'INR',
  accessToken,
}: DisputeResolveDialogProps) {
  const [resolution, setResolution] = useState<'RESOLVED_FOR_CLIENT' | 'RESOLVED_FOR_CREATOR'>(
    'RESOLVED_FOR_CLIENT',
  );
  const [resolutionReason, setResolutionReason] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setResolution('RESOLVED_FOR_CLIENT');
      setResolutionReason('');
      setResolutionNotes('');
      setRefundAmount('');
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

  if (!isOpen || !dispute) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedRefund = refundAmount.trim() ? Math.round(Number(refundAmount)) : undefined;

    const validation = validateResolveDispute({
      resolution,
      resolutionReason,
      refundAmount: parsedRefund,
      escrowBalance,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    setIsSubmitting(true);
    setError(null);

    try {
      const input: ResolveDisputeInput = {
        resolution,
        resolutionReason: resolutionReason.trim(),
        ...(resolutionNotes.trim() ? { resolutionNotes: resolutionNotes.trim() } : {}),
        ...(parsedRefund !== undefined ? { refundAmount: parsedRefund } : {}),
      };

      const result = await resolveDispute(dispute.id, input, accessToken);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve dispute.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-resolve-dialog-title"
    >
      <div className="relative w-full max-w-[620px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#14110F] flex items-center justify-center text-[#FFD64A] mb-4">
          <Scale className="w-6 h-6" />
        </div>

        {/* Title & Subheading */}
        <h2
          id="dispute-resolve-dialog-title"
          className="font-serif text-2xl font-bold text-[#14110F]"
        >
          Arbitrate Dispute Decision
        </h2>
        <p className="text-sm text-[#6F675E] mt-1 mb-6">
          Authorized administrative resolution for{' '}
          <span className="font-semibold text-[#14110F]">{projectTitle}</span>.
        </p>

        {/* Warning Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-[#FFF8E7] border border-[#F2C93D]/40 text-xs text-[#8A6A00] flex items-start gap-3">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#B88700]" />
          <div>
            <p className="font-semibold text-[#664D00]">Binding Administrative Action</p>
            <p className="mt-0.5 leading-relaxed">
              Resolving this dispute records an immutable ledger adjustment, unfreezes the project
              contract, and notifies both client and creator via transactional outbox.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-[#FDE8E8] border border-[#C93B2B]/20 text-sm text-[#C93B2B] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Arbitration Failed</p>
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
          {/* Resolution Outcome Radio Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E] mb-2.5">
              Arbitration Ruling
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  resolution === 'RESOLVED_FOR_CLIENT'
                    ? 'bg-[#FAF6EF] border-[#14110F] ring-2 ring-[#14110F]/10'
                    : 'bg-white border-[#E7E0D5] hover:bg-[#FAF6EF]/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="resolution"
                    value="RESOLVED_FOR_CLIENT"
                    checked={resolution === 'RESOLVED_FOR_CLIENT'}
                    onChange={() => setResolution('RESOLVED_FOR_CLIENT')}
                    className="accent-[#14110F]"
                  />
                  <span className="text-sm font-semibold text-[#14110F]">In Favor of Client</span>
                </div>
                <p className="text-xs text-[#6F675E] pl-5 leading-relaxed">
                  Authorizes refund to client. Unearned escrow is returned.
                </p>
              </label>

              <label
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  resolution === 'RESOLVED_FOR_CREATOR'
                    ? 'bg-[#FAF6EF] border-[#14110F] ring-2 ring-[#14110F]/10'
                    : 'bg-white border-[#E7E0D5] hover:bg-[#FAF6EF]/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="resolution"
                    value="RESOLVED_FOR_CREATOR"
                    checked={resolution === 'RESOLVED_FOR_CREATOR'}
                    onChange={() => setResolution('RESOLVED_FOR_CREATOR')}
                    className="accent-[#14110F]"
                  />
                  <span className="text-sm font-semibold text-[#14110F]">In Favor of Creator</span>
                </div>
                <p className="text-xs text-[#6F675E] pl-5 leading-relaxed">
                  Creator fulfilled contractual requirements. Escrow remains payable.
                </p>
              </label>
            </div>
          </div>

          {/* Refund Amount (Client resolution only) */}
          {resolution === 'RESOLVED_FOR_CLIENT' && (
            <div className="p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                  Refund Amount ({currency})
                </label>
                <span className="text-xs font-medium text-[#14110F]">
                  Escrow Balance: {currency} {escrowBalance}
                </span>
              </div>
              <input
                type="number"
                min="0"
                max={escrowBalance}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`Leave empty for full escrow balance (${escrowBalance})`}
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E7E0D5] text-sm text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              />
              <p className="text-[11px] text-[#8F877D] mt-1.5">
                Specifying an amount authorizes an idempotent partial refund. Leave blank to return
                the entire remaining escrow balance.
              </p>
            </div>
          )}

          {/* Formal Resolution Reason */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                Official Arbitration Reason (Shared with Parties)
              </label>
              <span
                className={`text-[11px] font-medium ${resolutionReason.length < 5 ? 'text-[#C93B2B]' : 'text-[#8F877D]'}`}
              >
                {resolutionReason.length}/5000 characters (min 5)
              </span>
            </div>
            <textarea
              rows={3}
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
              placeholder="State the formal basis for this ruling citing relevant evidence, timelines, and contract deliverables..."
              disabled={isSubmitting}
              className="w-full p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder:text-[#A8A196] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
            />
          </div>

          {/* Internal Arbitrator Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6F675E] mb-2">
              Internal Audit Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Internal administrative commentary or ledger notes..."
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
              disabled={isSubmitting || resolutionReason.trim().length < 5}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#14110F] hover:bg-[#2C2724] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFD64A]" />
                  <span>Finalizing Decision...</span>
                </>
              ) : (
                <>
                  <span>Enact Binding Ruling</span>
                  <ArrowRight className="w-4 h-4 text-[#FFD64A]" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
