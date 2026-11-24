'use client';

import React, { useState } from 'react';
import type { MessageRequestResponse, DirectConversationResponse } from '@creatorconnect/contracts';
import {
  formatMessageRequestExpiry,
  formatMessageRequestStatus,
  formatMessageDateSeparator,
} from '../../lib/messaging-workflow-service';
import {
  Check,
  X,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  MessageSquare,
  Ban,
} from 'lucide-react';
import { DeclineRequestDialog } from './decline-request-dialog';

export interface MessageRequestDetailPaneProps {
  request: MessageRequestResponse | null;
  currentUserId?: string | undefined;
  onAccept: (requestId: string) => Promise<{ conversation: DirectConversationResponse }>;
  onDecline: (requestId: string, reason?: string) => Promise<void>;
  onCancel: (requestId: string) => Promise<void>;
  onOpenConversation: (conversationId: string) => void;
}

export function MessageRequestDetailPane({
  request,
  currentUserId,
  onAccept,
  onDecline,
  onCancel,
  onOpenConversation,
}: MessageRequestDetailPaneProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!request) {
    return (
      <div className="h-[580px] bg-white rounded-3xl border border-[#E7E0D5] p-8 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-[#FAF6EF] flex items-center justify-center text-[#8C827A] mb-3">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h3 className="font-serif text-lg font-bold text-[#14110F]">No Request Selected</h3>
        <p className="text-xs text-[#6F675E] max-w-sm mt-1">
          Select a message request from the list to review the proposal, inspect the peer profile,
          or accept the invitation.
        </p>
      </div>
    );
  }

  const isSender = currentUserId === request.senderId;
  const isRecipient = currentUserId === request.recipientId;

  const peerDisplayName = isSender
    ? `Peer (${request.recipientId.slice(0, 8)})`
    : request.senderProfile?.displayName || `User ${request.senderId.slice(0, 8)}`;

  const peerRole = request.senderProfile?.role;
  const peerLocation = request.senderProfile?.location;
  const isVerified = request.senderProfile?.isVerified;

  const statusConfig = formatMessageRequestStatus(request.status);
  const expiry = formatMessageRequestExpiry(request.expiresAt);
  const createdDate = formatMessageDateSeparator(request.createdAt);

  const handleAccept = async () => {
    setIsAccepting(true);
    setActionError(null);
    try {
      const res = await onAccept(request.id);
      if (res?.conversation?.id) {
        onOpenConversation(res.conversation.id);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to accept message request.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancel = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this message request? A 24-hour cooldown will apply before sending another request.',
      )
    ) {
      return;
    }
    setIsCancelling(true);
    setActionError(null);
    try {
      await onCancel(request.id);
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel message request.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 sm:p-8 flex flex-col gap-6 shadow-xs min-h-[580px]">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EFE9DF]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#14110F] text-[#FAF6EF] font-bold text-sm flex items-center justify-center shrink-0 uppercase shadow-2xs">
            {peerDisplayName.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-bold text-[#14110F]">{peerDisplayName}</h2>
              {isVerified && (
                <span title="Verified Creator" className="inline-flex items-center">
                  <ShieldCheck
                    className="w-4 h-4 text-[#0066CC] shrink-0"
                    aria-label="Verified Creator"
                  />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6F675E] mt-0.5">
              {isSender ? (
                <span className="inline-flex items-center gap-1 font-bold text-[#B08800]">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Outgoing Proposal
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-[#2E7D32]">
                  <ArrowDownLeft className="w-3.5 h-3.5" /> Inbound Request
                </span>
              )}
              {peerRole && <span>• {peerRole}</span>}
              {peerLocation && <span>• {peerLocation}</span>}
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span
            className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border ${statusConfig.badgeClass}`}
          >
            {statusConfig.label}
          </span>
          <span className="text-[11px] text-[#8C827A]">Sent {createdDate}</span>
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-4 bg-[#FFDAD6]/50 border border-[#BA1A1A]/30 text-[#BA1A1A] rounded-2xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Informational Guidance Box */}
      <div className="bg-[#FAF6EF] border border-[#E7E0D5] rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#14110F] uppercase tracking-wider text-[10px]">
            Introductory Proposal
          </span>
          {request.status === 'PENDING' && (
            <span
              className={`text-xs flex items-center gap-1 font-medium ${
                expiry.isExpired ? 'text-[#BA1A1A] font-bold' : 'text-[#6F675E]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {expiry.label}
            </span>
          )}
        </div>

        {/* Initial message display */}
        <div className="bg-white p-4 rounded-xl border border-[#E7E0D5] text-[#14110F] text-sm leading-relaxed whitespace-pre-wrap font-sans">
          &ldquo;{request.initialMessage}&rdquo;
        </div>

        {request.declinedReason && (
          <div className="mt-2 p-3 bg-[#FFEBEE] rounded-xl border border-[#FFCDD2] text-xs text-[#B71C1C]">
            <span className="font-bold">Decline Reason:</span> {request.declinedReason}
          </div>
        )}
      </div>

      {/* Lifecycle Explanation / Status Callout */}
      <div className="text-xs text-[#6F675E] leading-relaxed">
        {request.status === 'PENDING' && isRecipient && (
          <p>
            Accepting this request will create a direct, encrypted conversation with{' '}
            {peerDisplayName} and post their proposal as the opening message. Declining enforces a
            30-day cooldown.
          </p>
        )}
        {request.status === 'PENDING' && isSender && (
          <p>
            Your introductory message has been delivered to {peerDisplayName}. You will be notified
            in realtime as soon as they respond. You can cancel this request before they respond
            (24-hour cooldown applies).
          </p>
        )}
        {request.status === 'ACCEPTED' && (
          <p className="text-[#2E7D32] font-medium">
            This invitation was accepted. Direct conversation and attachment permissions are active.
          </p>
        )}
        {request.status === 'DECLINED' && (
          <p className="text-[#8C827A]">
            This request was declined. Communication between these accounts remains restricted by
            server consent policy.
          </p>
        )}
        {request.status === 'EXPIRED' && (
          <p className="text-[#8C827A]">
            This request expired after 7 days without recipient response. A new introductory request
            may be submitted.
          </p>
        )}
        {request.status === 'CANCELLED' && (
          <p className="text-[#8C827A]">
            This request was retracted by the sender before recipient review.
          </p>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="mt-auto pt-6 border-t border-[#EFE9DF] flex items-center justify-between flex-wrap gap-3">
        {/* State: PENDING & Current User is Recipient -> Accept / Decline */}
        {request.status === 'PENDING' && isRecipient && !expiry.isExpired && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsDeclineModalOpen(true)}
              disabled={isAccepting}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full border border-[#DDD5C7] text-xs font-bold text-[#BA1A1A] hover:bg-[#FFDAD6]/30 transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" /> Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isAccepting ? 'Accepting...' : 'Accept & Start Chat'}
            </button>
          </div>
        )}

        {/* State: PENDING & Current User is Sender -> Cancel */}
        {request.status === 'PENDING' && isSender && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="px-5 py-2.5 rounded-full border border-[#DDD5C7] text-xs font-bold text-[#6F675E] hover:bg-[#FAF6EF] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" />
            {isCancelling ? 'Cancelling...' : 'Cancel Request'}
          </button>
        )}

        {/* State: ACCEPTED -> Open Conversation */}
        {request.status === 'ACCEPTED' && request.conversationId && (
          <button
            onClick={() => onOpenConversation(request.conversationId!)}
            className="px-6 py-2.5 rounded-full bg-[#14110F] text-[#FAF6EF] text-xs font-bold shadow-2xs hover:bg-[#2C2724] transition-all flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4 text-[#FFD64A]" /> Open Active Conversation
          </button>
        )}
      </div>

      {/* Decline Dialog Modal */}
      <DeclineRequestDialog
        request={request}
        isOpen={isDeclineModalOpen}
        onClose={() => setIsDeclineModalOpen(false)}
        onConfirmDecline={onDecline}
      />
    </div>
  );
}
