'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  FileText,
  MoreVertical,
  Ban,
  Sparkles,
  Info,
} from 'lucide-react';
import type { DirectConversationResponse } from '@creatorconnect/contracts';
import { getPeerParticipant } from '../../lib/messaging-workflow-service';

export interface ChatHeaderProps {
  conversation: DirectConversationResponse;
  currentUserId?: string | undefined;
  isBlocked?: boolean | undefined;
  onToggleBlock?: (() => void) | undefined;
}

export function ChatHeader({
  conversation,
  currentUserId,
  isBlocked = false,
  onToggleBlock,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const peerParticipant = getPeerParticipant(conversation, currentUserId);
  const peerUserId = peerParticipant?.userId ?? null;
  const peerProfile = peerParticipant?.profile;
  const displayName =
    conversation.title ||
    peerProfile?.displayName ||
    (peerUserId ? `User ${peerUserId.slice(0, 8)}` : 'Direct Conversation');
  const initial =
    displayName
      .replace(/^User\s+/, '')
      .charAt(0)
      .toUpperCase() || 'C';

  return (
    <header className="flex flex-col border-b border-[#E7E0D5] bg-[#FFFFFF] px-6 py-4 rounded-t-3xl shadow-xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Back button + Peer Info */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/messages"
            className="w-9 h-9 rounded-full bg-[#FAF6EF] hover:bg-[#EFE9DF] text-[#14110F] flex items-center justify-center transition-colors border border-[#E7E0D5]"
            title="Back to Inbox"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-[#EFE9DF] text-[#14110F] flex items-center justify-center font-bold text-base border border-[#E0D8CB] shadow-xs overflow-hidden">
              {peerProfile?.avatarUrl ? (
                <img
                  src={peerProfile.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                isBlocked ? 'bg-[#BA1A1A]' : 'bg-[#2E7D32]'
              }`}
              title={isBlocked ? 'Blocked' : 'Online / Active'}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl font-bold text-[#14110F] tracking-tight">
                {displayName}
              </h1>
              {peerProfile?.isVerified && (
                <span
                  className="bg-[#E9DDFF] text-[#210F47] px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                  title="Verified Participant"
                >
                  <CheckCircle2 className="w-3 h-3 text-[#65558F]" />
                  Verified
                </span>
              )}
              <span className="hidden sm:inline-flex bg-[#FFD64A]/80 text-[#735C00] px-2 py-0.5 rounded-full text-[10px] font-bold items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                Active Direct
              </span>
            </div>

            <p className="text-xs text-[#6F675E] flex items-center gap-1.5 mt-0.5">
              <span>{conversation.type} Thread</span>
              <span>•</span>
              <span className="font-mono text-[11px]">#{conversation.id.slice(0, 8)}</span>
              <span>•</span>
              <span className="text-[#2E7D32] font-medium flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" />
                Keyset Sequenced
              </span>
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {conversation.assignmentId && (
            <Link
              href={`/assignments/${conversation.assignmentId}`}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6EF] hover:bg-[#EFE9DF] text-[#14110F] text-xs font-semibold border border-[#E7E0D5] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#6F675E]" />
              <span>Linked Brief</span>
            </Link>
          )}

          <Link
            href={`/messages/${conversation.id}/details`}
            className="w-9 h-9 rounded-full bg-[#FAF6EF] hover:bg-[#EFE9DF] text-[#14110F] flex items-center justify-center transition-colors border border-[#E7E0D5]"
            title="Conversation Details & Shared Files (Stitch I06)"
          >
            <Info className="w-4 h-4" />
          </Link>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-full bg-[#FAF6EF] hover:bg-[#EFE9DF] text-[#14110F] flex items-center justify-center transition-colors border border-[#E7E0D5]"
              title="Conversation options"
              aria-label="Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-[#E7E0D5] py-2 z-50 animate-in fade-in zoom-in-95">
                <Link
                  href={`/messages/${conversation.id}/details`}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <Info className="w-3.5 h-3.5 text-[#6F675E]" />
                  <span>Details &amp; Shared Files</span>
                </Link>

                {conversation.assignmentId && (
                  <Link
                    href={`/assignments/${conversation.assignmentId}`}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <FileText className="w-3.5 h-3.5 text-[#6F675E]" />
                    <span>View Assignment</span>
                  </Link>
                )}

                {onToggleBlock && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleBlock();
                    }}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs text-[#BA1A1A] hover:bg-[#FFDAD6]/30 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5 text-[#BA1A1A]" />
                    <span>{isBlocked ? 'Unblock Contact' : 'Block & Report User'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Linked Project Banner (Stitch I04 Specification) */}
      {(conversation.assignmentId || conversation.applicationId) && (
        <div className="mt-3.5 pt-3 border-t border-[#EFE9DF] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-[#6F675E]">
              Linked Context:
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#EFE9DF] text-[#14110F] font-mono text-[11px] font-semibold">
              {conversation.assignmentId
                ? `Assignment #${conversation.assignmentId.slice(0, 8)}`
                : `Application #${conversation.applicationId?.slice(0, 8)}`}
            </span>
          </div>

          <span className="text-[#6F675E] text-[11px]">
            Sequence{' '}
            <span className="font-mono font-bold text-[#14110F]">
              #{conversation.currentSequence}
            </span>
          </span>
        </div>
      )}
    </header>
  );
}
