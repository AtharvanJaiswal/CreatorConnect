'use client';

import React, { useState } from 'react';
import { Edit3, X, Clock, AlertCircle } from 'lucide-react';
import type { MessageResponse } from '@creatorconnect/contracts';
import { getMessageEditTimeRemainingMinutes } from '../../lib/messaging-workflow-service';

export interface EditMessageDialogProps {
  message: MessageResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmEdit: (messageId: string, newContent: string) => Promise<void>;
}

export function EditMessageDialog({
  message,
  isOpen,
  onClose,
  onConfirmEdit,
}: EditMessageDialogProps) {
  if (!isOpen || !message) return null;

  const [content, setContent] = useState(message.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minutesRemaining = getMessageEditTimeRemainingMinutes(message.createdAt);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    if (trimmed.length > 5000) {
      setError('Message exceeds 5,000 character maximum limit.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirmEdit(message.id, trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to edit message. The 15-minute window may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col gap-4 border border-[#E7E0D5]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#EFE9DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFD64A]/30 text-[#725C00] flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="edit-dialog-title" className="font-serif text-xl font-bold text-[#14110F]">
                Edit Message
              </h2>
              <span className="text-xs text-[#6F675E] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#725C00]" />
                <span className="font-semibold text-[#725C00]">
                  {minutesRemaining} minutes remaining
                </span>{' '}
                to edit
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
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5">
              Message Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full bg-[#FAF2EE] rounded-2xl p-3.5 text-sm text-[#14110F] border border-[#EFE9DF] focus:border-[#725C00] outline-none resize-none leading-relaxed"
              placeholder="Update message text..."
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full text-xs font-bold text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting || content.trim() === message.content}
              className="bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] px-5 py-2 rounded-full font-bold text-xs shadow-2xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
