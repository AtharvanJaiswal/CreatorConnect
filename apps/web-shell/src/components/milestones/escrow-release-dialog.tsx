'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertTriangle, Loader2, Lock, ArrowRight } from 'lucide-react';
import { releaseEscrow } from '../../lib/milestone-workflow-service';

interface EscrowReleaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (releasedAmount: number) => void;
  projectId: string;
  projectTitle: string;
  escrowBalance: number;
  currency?: string;
  accessToken?: string | null;
}

export function EscrowReleaseDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectTitle,
  escrowBalance,
  currency = 'INR',
  accessToken,
}: EscrowReleaseDialogProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsConfirmed(false);
      setError(null);
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

  const handleRelease = async () => {
    if (!isConfirmed || isReleasing) return;

    setIsReleasing(true);
    setError(null);

    try {
      const result = await releaseEscrow(projectId, accessToken);
      onSuccess(result.releasedAmount);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Escrow release failed.');
    } finally {
      setIsReleasing(false);
    }
  };

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(escrowBalance);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escrow-release-dialog-title"
    >
      <div className="relative w-full max-w-[500px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-2xl bg-[#E6F4EA] border border-[#2E9E6B]/30 flex items-center justify-center text-[#2E9E6B] mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4EA] text-[#2E9E6B] text-[10px] font-bold uppercase tracking-wider mb-2">
            <span>Escrow Settlement Gate</span>
          </div>

          <h2
            id="escrow-release-dialog-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight"
          >
            Authorize Escrow Fund Release
          </h2>
          <p className="text-sm text-[#6F675E] mt-1">
            Project: <span className="font-semibold text-[#14110F]">{projectTitle}</span>
          </p>
        </div>

        {/* Amount Box */}
        <div className="my-5 p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-center">
          <span className="text-xs uppercase tracking-wider text-[#6F675E] font-bold block mb-1">
            Escrow Balance to be Released
          </span>
          <div className="text-3xl font-heading font-black text-[#14110F]">{formattedAmount}</div>
          <span className="text-[11px] text-[#A39A8F] mt-1 block">
            Funds will be transferred from Escrow Holding to Creator Payable account
          </span>
        </div>

        {/* Ledger & Security Notice */}
        <div className="p-3.5 rounded-xl bg-[#FFF6D9] border border-[#FFD64A]/60 text-xs text-[#735C00] space-y-1.5 mb-4">
          <div className="flex items-center gap-1.5 font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Immutable Double-Entry Ledger Transaction</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            By releasing funds, you verify that all milestone deliverables have been reviewed,
            approved, and accepted. This financial ledger operation is irreversible.
          </p>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-3 p-3 rounded-xl bg-[#FAF6EF]/60 border border-[#E7E0D5] text-xs text-[#14110F] cursor-pointer select-none mb-4">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
            className="mt-0.5 rounded border-[#E7E0D5] text-[#FFD64A] focus:ring-[#FFD64A]"
          />
          <span className="leading-tight">
            I confirm that I have reviewed the deliverables and authorize the release of{' '}
            <strong>{formattedAmount}</strong> to the creator.
          </span>
        </label>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#FCE8E6] border border-[#D8483C] text-xs text-[#D8483C] flex items-center gap-1.5 mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D5]">
          <button
            type="button"
            onClick={onClose}
            disabled={isReleasing}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#6F675E] hover:text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleRelease}
            disabled={!isConfirmed || isReleasing}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2E9E6B] text-white hover:bg-[#25855A] text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isReleasing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Releasing Funds...</span>
              </>
            ) : (
              <>
                <span>Confirm & Release</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
