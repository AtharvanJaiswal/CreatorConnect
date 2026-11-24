'use client';

import React from 'react';
import Link from 'next/link';
import type { DirectConversationResponse } from '@creatorconnect/contracts';
import { getPeerParticipant } from '../../lib/messaging-workflow-service';
import {
  MessageSquare,
  ShieldCheck,
  Folder,
  ArrowRight,
  Clock,
  CheckCircle2,
  Users,
} from 'lucide-react';

export interface ConversationPreviewPaneProps {
  conversation: DirectConversationResponse | null;
  currentUserId?: string | undefined;
  onMarkRead?: ((conversationId: string, sequence: string) => Promise<void>) | undefined;
  isMarkingRead?: boolean | undefined;
}

export function ConversationPreviewPane({
  conversation,
  currentUserId,
  onMarkRead,
  isMarkingRead = false,
}: ConversationPreviewPaneProps) {
  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 sm:p-16 h-full min-h-[500px] bg-white rounded-3xl border border-[#E7E0D5] shadow-xs">
        <div className="w-16 h-16 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center mb-4 text-[#8C827A]">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="font-serif text-2xl font-bold text-[#14110F] mb-2">
          Select a conversation to start messaging
        </h3>
        <p className="text-sm text-[#6F675E] max-w-md leading-relaxed">
          Choose a conversation from the list on the left to view active project context,
          participant dossier, and message sequence integrity.
        </p>
      </div>
    );
  }

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
  const unread = conversation.unreadCount ?? 0;

  return (
    <section className="flex flex-col justify-between h-full min-h-[580px] bg-white rounded-3xl border border-[#E7E0D5] p-6 sm:p-8 shadow-xs">
      {/* Top Header */}
      <div>
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7E0D5]">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-[#EFE9DF] text-[#14110F] font-bold text-lg flex items-center justify-center border border-[#E0D8CB] shadow-xs overflow-hidden">
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
              {peerProfile?.isVerified && (
                <span
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FFD64A] text-[#14110F] flex items-center justify-center font-bold text-[10px] shadow-xs border border-white"
                  title="Verified Participant"
                >
                  ✓
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-2xl font-bold text-[#14110F] tracking-tight">
                  {displayName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF6EF] text-[#6F675E] border border-[#E7E0D5]">
                  {conversation.type}
                </span>
              </div>
              <p className="text-xs text-[#6F675E] mt-0.5">
                Conversation ID: <span className="font-mono text-[11px]">{conversation.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unread > 0 && onMarkRead && (
              <button
                onClick={() => onMarkRead(conversation.id, conversation.currentSequence)}
                disabled={isMarkingRead}
                className="text-xs font-bold px-3.5 py-2 rounded-full border border-[#DDD5C7] text-[#14110F] hover:bg-[#FAF6EF] transition-colors disabled:opacity-50"
              >
                {isMarkingRead ? 'Updating...' : 'Mark as Read'}
              </button>
            )}
            <Link href={`/messages/${conversation.id}`}>
              <button className="bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs px-4 py-2 rounded-full shadow-2xs transition-all flex items-center gap-2">
                Open Chat <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </header>

        {/* Linked Assignment or Application Badge */}
        {(conversation.assignmentId || conversation.applicationId) && (
          <div className="my-5 p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Folder className="w-4 h-4 text-[#8C827A]" />
              <span className="text-xs font-bold text-[#14110F]">
                {conversation.assignmentId
                  ? `Linked Assignment: #${conversation.assignmentId.slice(0, 8)}`
                  : `Linked Application: #${conversation.applicationId?.slice(0, 8)}`}
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#6F675E]">Verified Context</span>
          </div>
        )}

        {/* Conversation Statistics / Context Dossier */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
          <div className="p-3.5 rounded-2xl bg-[#FAF6EF]/70 border border-[#E7E0D5]">
            <div className="flex items-center gap-1.5 text-xs text-[#6F675E] mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Participants</span>
            </div>
            <span className="text-base font-bold text-[#14110F]">
              {conversation.participants.length} Active
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FAF6EF]/70 border border-[#E7E0D5]">
            <div className="flex items-center gap-1.5 text-xs text-[#6F675E] mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Sequence Counter</span>
            </div>
            <span className="text-base font-bold text-[#14110F]">
              #{conversation.currentSequence}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FAF6EF]/70 border border-[#E7E0D5]">
            <div className="flex items-center gap-1.5 text-xs text-[#6F675E] mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" />
              <span>Unread Messages</span>
            </div>
            <span className="text-base font-bold text-[#14110F]">{unread}</span>
          </div>
        </div>

        {/* Participant list preview */}
        <div className="mt-4">
          <h4 className="text-xs font-bold text-[#6F675E] uppercase tracking-wider mb-2.5">
            Conversation Members
          </h4>
          <div className="flex flex-col gap-2">
            {conversation.participants.map((p) => {
              const name = p.profile?.displayName ?? `User ${p.userId.slice(0, 8)}`;
              const memberInitial =
                name
                  .replace(/^User\s+/, '')
                  .charAt(0)
                  .toUpperCase() || p.userId.slice(0, 2).toUpperCase();
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF6EF]/40 border border-[#EFE9DF]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#E0D8CB] flex items-center justify-center text-xs font-bold text-[#14110F] overflow-hidden">
                      {p.profile?.avatarUrl ? (
                        <img
                          src={p.profile.avatarUrl}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        memberInitial
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#14110F]">
                        {name}
                        {p.userId === currentUserId && ' (You)'}
                      </span>
                      <span className="text-[10px] text-[#6F675E] ml-2">
                        Role: {p.profile?.role ?? p.role}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#6F675E]">
                    Last Read: #{p.lastReadSequence}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Safety & Isolation Footer */}
      <footer className="mt-8 pt-4 border-t border-[#E7E0D5] flex items-center gap-2 text-xs text-[#6F675E]">
        <ShieldCheck className="w-4 h-4 text-[#2E7D32] shrink-0" />
        <span>
          Protected by CreatorConnect anti-enumeration and tenant participant authorization.
        </span>
      </footer>
    </section>
  );
}
