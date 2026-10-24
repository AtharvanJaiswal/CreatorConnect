'use client';

import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { MessageRequestResponse } from '@creatorconnect/contracts';

export interface DeclineRequestDialogProps {
  request: MessageRequestResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDecline: (requestId: string, reason?: string) => Promise<void>;
}

export function DeclineRequestDialog({
  request,
  isOpen,
  onClose,
  onConfirmDecline,
}: DeclineRequestDialogProps) {
  if (!isOpen || !request) return null;

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const senderName = request.senderProfile?.displayName || `User ${request.senderId.slice(0, 8)}`;

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const trimmedReason = reason.trim() ? reason.trim().slice(0, 255) : undefined;
      await onConfirmDecline(request.id, trimmedReason);
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to decline message request. The request may have already expired or been cancelled.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="decline-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col gap-5 border border-[#E7E0D5]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EFE9DF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFDAD6] text-[#BA1A1A] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="decline-dialog-title" className="font-serif text-xl font-bold text-[#14110F]">
                Decline Request
              </h2>
              <p className="text-xs text-[#6F675E]">
                Decline introductory proposal from {senderName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6F675E] hover:bg-[#FAF6EF] transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Policy notice */}
        <div className="bg-[#FAF6EF] border border-[#E7E0D5] rounded-2xl p-4 flex items-start gap-3 text-xs text-[#6F675E]">
          <AlertTriangle className="w-4 h-4 text-[#B08800] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#14110F] mb-0.5">30-Day Re-Request Cooldown</p>
            <p>
              Declining will prevent this sender from submitting another message request to you for
              30 days. No conversation will be created.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleDecline} className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="decline-reason" className="text-xs font-bold text-[#14110F]">
                Optional Feedback / Reason
              </label>
              <span className="text-[10px] text-[#8C827A]">{reason.length} / 255</span>
            </div>
            <textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 255))}
              rows={3}
              placeholder="e.g., Not interested in this scope, or fully booked for Q4."
              className="w-full p-3 bg-[#FAF6EF] text-[#14110F] text-xs rounded-xl border border-[#E7E0D5] focus:outline-none focus:ring-2 focus:ring-[#14110F] placeholder:text-[#8C827A] resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-[#FFDAD6]/50 border border-[#BA1A1A]/30 text-[#BA1A1A] rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EFE9DF]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full border border-[#DDD5C7] text-xs font-bold text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Declining...' : 'Decline Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
