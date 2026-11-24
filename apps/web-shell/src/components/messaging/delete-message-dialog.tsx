'use client';

import React, { useState } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import type { MessageResponse } from '@creatorconnect/contracts';
import { getMessageEditTimeRemainingMinutes } from '../../lib/messaging-workflow-service';

export interface DeleteMessageDialogProps {
  message: MessageResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (messageId: string) => Promise<void>;
}

export function DeleteMessageDialog({
  message,
  isOpen,
  onClose,
  onConfirmDelete,
}: DeleteMessageDialogProps) {
  if (!isOpen || !message) return null;

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minutesRemaining = getMessageEditTimeRemainingMinutes(message.createdAt);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirmDelete(message.id);
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to delete message. The 15-minute retraction window may have expired.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col gap-4 border border-[#E7E0D5]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#EFE9DF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFDAD6] text-[#BA1A1A] flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-dialog-title" className="font-serif text-xl font-bold text-[#14110F]">
                Delete Message?
              </h2>
              <span className="text-xs font-bold text-[#864D5D]">
                {minutesRemaining} minutes remaining to retract
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF6EF] hover:bg-[#EFE9DF] text-[#14110F] flex items-center justify-center transition-colors"
            title="Close dialog"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#FFDAD6] text-[#93000A] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-[#6F675E] leading-relaxed">
            Under CreatorConnect Rule 4.2, you can permanently retract recent messages. The content
            will be replaced with{' '}
            <span className="font-semibold text-[#14110F] italic">[This message was deleted]</span>{' '}
            across all participants.
          </p>

          <div className="p-3 rounded-xl bg-[#FAF2EE] border border-[#EFE9DF] text-xs text-[#14110F] italic truncate">
            "{message.content}"
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-full text-xs font-bold text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
          >
            Keep Message
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-[#BA1A1A] hover:bg-[#93000A] text-white px-5 py-2 rounded-full font-bold text-xs shadow-2xs transition-all disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete for Everyone'}
          </button>
        </div>
      </div>
    </div>
  );
}
