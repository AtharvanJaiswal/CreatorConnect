'use client';

import React, { useState } from 'react';
import { X, Send, Sparkles, AlertCircle, Info } from 'lucide-react';
import type { MessageRequestResponse } from '@creatorconnect/contracts';
import { messagingWorkflowService } from '../../lib/messaging-workflow-service';

export interface ComposeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: (request: MessageRequestResponse) => void;
  accessToken?: string | null;
  defaultRecipientId?: string;
  defaultRecipientName?: string;
}

export function ComposeRequestModal({
  isOpen,
  onClose,
  onRequestCreated,
  accessToken,
  defaultRecipientId = '',
  defaultRecipientName = '',
}: ComposeRequestModalProps) {
  if (!isOpen) return null;

  const [recipientId, setRecipientId] = useState(defaultRecipientId);
  const [initialMessage, setInitialMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const isRecipientValid = uuidRegex.test(recipientId.trim());
  const isMessageValid = initialMessage.trim().length >= 1 && initialMessage.length <= 500;
  const canSubmit = isRecipientValid && isMessageValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await messagingWorkflowService.createMessageRequest(
        {
          recipientId: recipientId.trim(),
          initialMessage: initialMessage.trim(),
        },
        accessToken ?? undefined,
      );

      onRequestCreated(result);
      onClose();
    } catch (err: any) {
      if (err.status === 409) {
        setError(
          err.detail ||
            'A pending request already exists for this recipient, or a 30-day cooldown is active.',
        );
      } else if (err.status === 403) {
        setError(err.detail || 'Direct communication with this user is restricted or blocked.');
      } else if (err.status === 404) {
        setError('The specified recipient was not found.');
      } else if (err.status === 429) {
        setError(
          'Rate limit exceeded (maximum 10 message requests per hour). Please try again later.',
        );
      } else {
        setError(err.message || 'Failed to send message request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col gap-5 border border-[#E7E0D5]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EFE9DF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF8E1] text-[#7A5800] border border-[#FFE082] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#B08800]" />
            </div>
            <div>
              <h2 id="compose-dialog-title" className="font-serif text-xl font-bold text-[#14110F]">
                Start Message Request
              </h2>
              <p className="text-xs text-[#6F675E]">
                Send an introductory proposal to connect with a creator or brand
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6F675E] hover:bg-[#FAF6EF] transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & consent advisory note */}
        <div className="bg-[#FAF6EF] border border-[#E7E0D5] rounded-2xl p-4 flex items-start gap-3 text-xs text-[#6F675E]">
          <Info className="w-4 h-4 text-[#B08800] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-[#14110F]">Consent-Gated Communication</p>
            <p>
              Your proposal will be placed in the recipient&apos;s request queue. Direct chat and
              attachment sharing are unlocked only after they review and accept your invitation.
            </p>
          </div>
        </div>

        {/* Compose Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Recipient User ID Input */}
          <div>
            <label
              htmlFor="compose-recipient"
              className="block text-xs font-bold text-[#14110F] mb-1.5"
            >
              Recipient User ID (UUID)
            </label>
            <input
              id="compose-recipient"
              type="text"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="e.g. 0192e4ab-1234-7000-8000-000000000001"
              className="w-full px-3.5 py-2.5 bg-[#FAF6EF] text-[#14110F] text-xs font-mono rounded-xl border border-[#E7E0D5] focus:outline-none focus:ring-2 focus:ring-[#14110F] placeholder:text-[#8C827A]"
            />
            {defaultRecipientName && (
              <p className="text-[11px] text-[#6F675E] mt-1">Recipient: {defaultRecipientName}</p>
            )}
            {recipientId.trim().length > 0 && !isRecipientValid && (
              <p className="text-[11px] text-[#BA1A1A] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Must be a valid UUIDv4 or UUIDv7 string.
              </p>
            )}
          </div>

          {/* Initial Message Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="compose-initial-message" className="text-xs font-bold text-[#14110F]">
                Introductory Pitch / Message
              </label>
              <span
                className={`text-[10px] font-medium ${
                  initialMessage.length > 500 ? 'text-[#BA1A1A] font-bold' : 'text-[#8C827A]'
                }`}
              >
                {initialMessage.length} / 500 characters
              </span>
            </div>
            <textarea
              id="compose-initial-message"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Introduce yourself, mention the project or collaboration opportunity, and outline why you'd like to connect. (Plain text only, max 500 chars)"
              className="w-full p-3 bg-[#FAF6EF] text-[#14110F] text-xs rounded-xl border border-[#E7E0D5] focus:outline-none focus:ring-2 focus:ring-[#14110F] placeholder:text-[#8C827A] resize-none leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-3 bg-[#FFDAD6]/50 border border-[#BA1A1A]/30 text-[#BA1A1A] rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EFE9DF]">
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
              disabled={!canSubmit}
              className="px-5 py-2 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Submitting...' : 'Send Message Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
