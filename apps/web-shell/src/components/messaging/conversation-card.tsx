'use client';

import React from 'react';
import type { DirectConversationResponse } from '@creatorconnect/contracts';
import { formatConversationTime, getPeerParticipantId } from '../../lib/messaging-workflow-service';
import { Folder, CheckCheck } from 'lucide-react';

export interface ConversationCardProps {
  conversation: DirectConversationResponse;
  isSelected: boolean;
  onSelect: () => void;
  currentUserId?: string | undefined;
}

export function ConversationCard({
  conversation,
  isSelected,
  onSelect,
  currentUserId,
}: ConversationCardProps) {
  const peerUserId = getPeerParticipantId(conversation, currentUserId);
  const displayName =
    conversation.title || (peerUserId ? `User ${peerUserId.slice(0, 8)}` : 'Direct Chat');
  const initial =
    displayName
      .replace(/^User\s+/, '')
      .charAt(0)
      .toUpperCase() || 'C';
  const timeFormatted = formatConversationTime(conversation.updatedAt);
  const unread = conversation.unreadCount ?? 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`group relative p-4 rounded-2xl cursor-pointer transition-all flex items-start gap-3.5 border ${
        isSelected
          ? 'bg-[#FAF6EF] border-[#14110F] shadow-[2px_2px_0px_#14110F]'
          : 'bg-white border-[#E7E0D5] hover:border-[#D5CCC0] hover:bg-[#FAF6EF]/60 shadow-xs'
      }`}
    >
      {/* Avatar Container with Tier/Verified Badge */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-[#EFE9DF] text-[#14110F] font-bold text-base flex items-center justify-center border border-[#E0D8CB] shadow-xs">
          {initial}
        </div>
        <span
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#FFD64A] text-[#14110F] flex items-center justify-center font-bold text-[9px] shadow-xs border border-white"
          title="Verified Participant"
        >
          ✓
        </span>
      </div>

      {/* Conversation Details & Metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 truncate">
            <h3 className="font-sans font-bold text-sm text-[#14110F] truncate">{displayName}</h3>
            <span className="text-[11px] font-medium text-[#6F675E]">• {conversation.type}</span>
          </div>
          {timeFormatted && (
            <span className="text-xs font-semibold text-[#6F675E] shrink-0">{timeFormatted}</span>
          )}
        </div>

        {/* Linked Assignment Chip */}
        {(conversation.assignmentId || conversation.applicationId) && (
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECE7DE] text-[#4A443D] text-[11px] font-medium border border-[#DDD5C7]">
              <Folder className="w-3 h-3 text-[#6F675E]" />
              {conversation.assignmentId
                ? `Assignment #${conversation.assignmentId.slice(0, 8)}`
                : `Application #${conversation.applicationId?.slice(0, 8)}`}
            </span>
          </div>
        )}

        {/* Message preview / sequence placeholder */}
        <p className="text-xs text-[#6F675E] truncate">
          Sequence #{conversation.currentSequence} · Tap to inspect conversation details
        </p>

        {/* Status indicator row */}
        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] text-[#6F675E]">
            <CheckCheck className="w-3.5 h-3.5 text-[#2E7D32]" />
            Delivered
          </span>

          {unread > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#FFD64A] text-[#14110F] text-[11px] font-extrabold shadow-xs">
              {unread} unread
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
