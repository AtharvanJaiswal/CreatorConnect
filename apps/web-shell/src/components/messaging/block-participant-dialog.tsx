import React, { useState } from 'react';
import { Ban, AlertTriangle, X, Loader2 } from 'lucide-react';

export interface BlockParticipantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  peerName: string;
  isBlocked: boolean;
  onConfirm: (reason?: string) => Promise<void>;
}

export function BlockParticipantDialog({
  isOpen,
  onClose,
  peerName,
  isBlocked,
  onConfirm,
}: BlockParticipantDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isBlocked ? `Unblock ${peerName}` : `Block ${peerName}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#EFE9DF] flex flex-col gap-5 text-[#14110F]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isBlocked ? 'bg-[#FAF2EE] text-[#14110F]' : 'bg-[#FFDAD6] text-[#BA1A1A]'
              }`}
            >
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#14110F]">
                {isBlocked ? `Unblock ${peerName}?` : `Block ${peerName}?`}
              </h3>
              <p className="text-xs text-[#6F675E]">Verified Trust &amp; Safety Action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6F675E] hover:bg-[#FAF2EE] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Body */}
        <div className="p-3.5 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] text-xs text-[#14110F] leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#725C00] shrink-0 mt-0.5" />
          <p>
            {isBlocked
              ? `Unblocking will allow ${peerName} to send messages and collaborate with you again.`
              : `Blocking will restrict ${peerName} from sending messages in this thread. Existing escrow milestones and dispute audit logs remain preserved.`}
          </p>
        </div>

        {/* Reason Input (only when blocking) */}
        {!isBlocked && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="block-reason" className="text-xs font-semibold text-[#14110F]">
              Reason for block (optional, logged for trust review)
            </label>
            <textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Unsolicited off-platform payment request or harassment"
              rows={2}
              maxLength={255}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDD5C7] focus:outline-none focus:border-[#725C00] resize-none bg-[#FAF9F5]"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-[#BA1A1A] bg-[#FFDAD6]/50 p-2.5 rounded-xl border border-[#BA1A1A]/20">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EFE9DF]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-full bg-[#FAF2EE] hover:bg-[#EFE9DF] text-xs font-semibold text-[#14110F] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAction}
            disabled={submitting}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-transform active:scale-98 flex items-center gap-1.5 shadow-xs ${
              isBlocked
                ? 'bg-[#FFD64A] hover:bg-[#F2CA3D] text-[#14110F]'
                : 'bg-[#BA1A1A] hover:bg-[#93000A] text-white'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isBlocked ? 'Confirm Unblock' : 'Block Participant'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
