'use client';

import React from 'react';
import type { MessageRequestResponse } from '@creatorconnect/contracts';
import {
  formatMessageRequestExpiry,
  formatMessageRequestStatus,
  formatConversationTime,
} from '../../lib/messaging-workflow-service';
import { Clock, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';

export interface MessageRequestCardProps {
  request: MessageRequestResponse;
  isSelected: boolean;
  onSelect: () => void;
  currentUserId?: string | undefined;
}

export function MessageRequestCard({
  request,
  isSelected,
  onSelect,
  currentUserId,
}: MessageRequestCardProps) {
  const isSender = currentUserId === request.senderId;

  const peerDisplayName = isSender
    ? `Peer (${request.recipientId.slice(0, 8)})`
    : request.senderProfile?.displayName || `User ${request.senderId.slice(0, 8)}`;

  const peerRole = request.senderProfile?.role;
  const isVerified = request.senderProfile?.isVerified;

  const statusConfig = formatMessageRequestStatus(request.status);
  const expiry = formatMessageRequestExpiry(request.expiresAt);
  const formattedTime = formatConversationTime(request.createdAt);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`w-full p-4 rounded-2xl border transition-all text-left flex flex-col gap-2.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#14110F] ${
        isSelected
          ? 'bg-white border-[#14110F] shadow-xs'
          : 'bg-[#FAF6EF] border-[#E7E0D5] hover:bg-white hover:border-[#DDD5C7]'
      }`}
    >
      {/* Top row: Avatar, Name & Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#14110F] text-[#FAF6EF] font-bold text-xs flex items-center justify-center shrink-0 uppercase">
            {peerDisplayName.slice(0, 2)}
          </div>
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-[#14110F] truncate">{peerDisplayName}</span>
              {isVerified && (
                <span title="Verified Creator" className="inline-flex items-center">
                  <ShieldCheck
                    className="w-3.5 h-3.5 text-[#0066CC] shrink-0"
                    aria-label="Verified Creator"
                  />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#6F675E]">
              {isSender ? (
                <span className="inline-flex items-center gap-0.5 text-[#8C827A]">
                  <ArrowUpRight className="w-3 h-3 text-[#B08800]" /> Outgoing Proposal
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[#2E7D32]">
                  <ArrowDownLeft className="w-3 h-3 text-[#2E7D32]" /> Inbound Request
                </span>
              )}
              {peerRole && <span className="truncate">• {peerRole}</span>}
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-[#8C827A] font-medium shrink-0">{formattedTime}</span>
      </div>

      {/* Initial Message Preview */}
      <p className="text-xs text-[#6F675E] line-clamp-2 leading-relaxed italic bg-white/60 p-2 rounded-xl border border-[#EFE9DF]">
        &ldquo;{request.initialMessage}&rdquo;
      </p>

      {/* Bottom Row: Status Badge & Expiry Countdown */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#EFE9DF]/80">
        <span
          className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.badgeClass}`}
        >
          {statusConfig.label}
        </span>

        {request.status === 'PENDING' && (
          <span
            className={`text-[10px] flex items-center gap-1 font-medium ${
              expiry.isExpired ? 'text-[#BA1A1A] font-bold' : 'text-[#8C827A]'
            }`}
          >
            <Clock className="w-3 h-3" />
            {expiry.label}
          </span>
        )}
      </div>
    </div>
  );
}
