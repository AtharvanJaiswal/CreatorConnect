'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ExternalLink, ShieldCheck, CheckCircle2, FolderOpen } from 'lucide-react';

import type { DirectConversationResponse } from '@creatorconnect/contracts';
import { getPeerParticipantId } from '../../lib/messaging-workflow-service';

export interface ChatContextRailProps {
  conversation: DirectConversationResponse;
  currentUserId?: string | undefined;
}

export function ChatContextRail({ conversation, currentUserId }: ChatContextRailProps) {
  const peerUserId = getPeerParticipantId(conversation, currentUserId);
  const displayName =
    conversation.title || (peerUserId ? `User ${peerUserId.slice(0, 8)}` : 'Direct Contact');
  const initial =
    displayName
      .replace(/^User\s+/, '')
      .charAt(0)
      .toUpperCase() || 'C';

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-full">
      {/* 1. Participant Dossier Card (Stitch I04 Specification) */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E0D5] shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-13 h-13 rounded-2xl bg-[#EFE9DF] text-[#14110F] flex items-center justify-center font-bold text-lg border border-[#E0D8CB] shadow-xs shrink-0">
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-serif text-lg font-bold text-[#14110F]">{displayName}</h3>
              <CheckCircle2 className="w-4 h-4 text-[#65558F]" />
            </div>
            <p className="text-xs text-[#6F675E]">Verified Creator</p>
            <p className="text-[11px] font-semibold text-[#725C00]">Active Collaboration</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#FAF6EF]/70 p-3 rounded-2xl border border-[#EFE9DF] text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F675E] block">
              Response Time
            </span>
            <span className="font-semibold text-[#14110F]">&lt; 15 mins</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F675E] block">
              Thread Status
            </span>
            <span className="font-semibold text-[#2E7D32]">Active</span>
          </div>
        </div>

        {peerUserId && (
          <Link
            href={`/profiles/${peerUserId}`}
            className="w-full text-center bg-[#FAF6EF] hover:bg-[#EFE9DF] text-[#14110F] font-bold text-xs py-2 rounded-full border border-[#E7E0D5] transition-colors flex items-center justify-center gap-1"
          >
            <span>View Public Profile</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}

        <Link
          href={`/messages/${conversation.id}/details`}
          className="w-full text-center bg-[#FFD64A] hover:bg-[#F2CA3D] text-[#14110F] font-bold text-xs py-2 rounded-full shadow-2xs transition-colors flex items-center justify-center gap-1.5"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Shared Files &amp; Details</span>
        </Link>
      </div>

      {/* 2. Escrow & Contract Snapshot Card (Stitch I04 Specification) */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E0D5] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6F675E]">
            Escrow Protection
          </span>
          <span className="bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#65558F]" />
            Verified G10
          </span>
        </div>

        <div>
          <span className="text-xs text-[#6F675E]">Security Model</span>
          <p className="font-serif text-lg font-bold text-[#14110F]">Milestone Protected</p>
        </div>

        <p className="text-xs text-[#6F675E] leading-relaxed">
          Communications in this channel are covered under CreatorConnect's escrow dispute
          resolution and indemnity policies.
        </p>

        {conversation.assignmentId && (
          <Link
            href={`/assignments/${conversation.assignmentId}`}
            className="text-xs font-bold text-[#725C00] hover:underline flex items-center gap-1 pt-1"
          >
            <span>Open Linked Workspace</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* 3. Messaging Safety & Rules Card (Stitch I04 Specification) */}
      <div className="bg-[#FAF2EE] p-5 rounded-3xl border border-[#EFE9DF] flex flex-col gap-2.5">
        <h4 className="text-xs font-bold text-[#14110F] uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#725C00]" />
          <span>Messaging Rules &amp; Safety</span>
        </h4>
        <ul className="text-xs text-[#6F675E] space-y-2 leading-relaxed">
          <li className="flex items-start gap-1.5">
            <span className="font-bold text-[#14110F]">•</span>
            <span>
              <strong>15-Minute Global Delete:</strong> Messages can be retracted for everyone
              within 15 minutes of posting.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="font-bold text-[#14110F]">•</span>
            <span>
              <strong>Anti-Tampering Ledger:</strong> All communications maintain monotonic sequence
              integrity.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="font-bold text-[#14110F]">•</span>
            <span>
              <strong>Off-Platform Protection:</strong> Direct wire attempts outside CreatorConnect
              forfeit escrow protection.
            </span>
          </li>
        </ul>
      </div>
    </aside>
  );
}
