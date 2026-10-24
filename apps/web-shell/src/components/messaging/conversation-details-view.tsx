import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  BellOff,
  CheckCircle2,
  ExternalLink,
  Eye,
  FolderOpen,
  Info,
  Loader2,
  Paperclip,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  DirectConversationResponse,
  MessageResponse,
  MessageAttachmentResponse,
} from '@creatorconnect/contracts';
import {
  formatConversationTime,
  formatMessageTimestamp,
  getPeerParticipant,
} from '../../lib/messaging-workflow-service';
import { BlockParticipantDialog } from './block-participant-dialog';

export interface ConversationDetailsViewProps {
  conversation: DirectConversationResponse;
  messages?: MessageResponse[] | undefined;
  currentUserId?: string | undefined;
  token?: string | null | undefined;
  isBlocked?: boolean | undefined;
  onToggleBlock?: ((reason?: string) => Promise<void>) | undefined;
  onInspectAttachment?: ((attachmentId: string) => void) | undefined;
  onOpenReport?: (() => void) | undefined;
  hasMoreFiles?: boolean | undefined;
  isLoadingMoreFiles?: boolean | undefined;
  onLoadMoreFiles?: (() => Promise<void>) | undefined;
}

export function ConversationDetailsView({
  conversation,
  messages = [],
  currentUserId,
  token: _token,
  isBlocked = false,
  onToggleBlock,
  onInspectAttachment,
  onOpenReport,
  hasMoreFiles = false,
  isLoadingMoreFiles = false,
  onLoadMoreFiles,
}: ConversationDetailsViewProps) {
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  const peerParticipant = getPeerParticipant(conversation, currentUserId);
  const peerUserId = peerParticipant?.userId ?? null;
  const peerProfile = peerParticipant?.profile;
  const displayName =
    conversation.title ||
    peerProfile?.displayName ||
    (peerUserId ? `User ${peerUserId.slice(0, 8)}` : 'Direct Participant');
  const initial =
    displayName
      .replace(/^User\s+/, '')
      .charAt(0)
      .toUpperCase() || 'C';

  // Extract shared media attachments from non-deleted messages using Map-based O(n) deduplication
  const sharedItems = React.useMemo(() => {
    const attachmentMap = new Map<
      string,
      {
        attachment: MessageAttachmentResponse;
        message: MessageResponse;
      }
    >();

    for (const msg of messages) {
      if (msg.status !== 'DELETED' && !msg.deletedAt && msg.attachments) {
        for (const att of msg.attachments) {
          if (!attachmentMap.has(att.id)) {
            attachmentMap.set(att.id, { attachment: att, message: msg });
          }
        }
      }
    }

    const list = Array.from(attachmentMap.values());
    list.sort((a, b) => {
      const seqA = BigInt(a.message.sequence || '0');
      const seqB = BigInt(b.message.sequence || '0');
      if (seqA !== seqB) return seqA > seqB ? -1 : 1;
      return new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime();
    });

    return list;
  }, [messages]);

  return (
    <div className="w-full flex flex-col gap-6 text-[#14110F]">
      {/* Stitch I06: Navigation & Breadcrumb Header */}
      <section
        aria-label="Navigation and Breadcrumbs"
        className="w-full bg-white rounded-3xl p-5 shadow-xs border border-[#EFE9DF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex flex-col gap-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6F675E]">
            <Link href="/messages" className="hover:underline">
              Conversations
            </Link>
            <span>/</span>
            <Link
              href={`/messages/${conversation.id}`}
              className="hover:underline font-medium text-[#14110F]"
            >
              {displayName}
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#14110F]">Details &amp; Files</span>
          </nav>
          <h1 className="font-serif text-2xl font-bold text-[#14110F] tracking-tight">
            Conversation Details &amp; <span className="italic text-[#725C00]">Shared Assets</span>
          </h1>
        </div>

        <Link
          href={`/messages/${conversation.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FAF2EE] hover:bg-[#F3ECE6] text-xs font-bold text-[#14110F] transition-colors border border-[#E7E0D5]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Chat</span>
        </Link>
      </section>

      {/* Stitch I06: Main Two-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Participant Dossier, Linked Project, Shared Media */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1. PARTICIPANT DOSSIER CARD */}
          <div className="bg-white p-6 rounded-3xl border border-[#EFE9DF] shadow-xs flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#EFE9DF]">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#EFE9DF] text-[#14110F] flex items-center justify-center font-bold text-2xl border border-[#E0D8CB] shadow-xs overflow-hidden">
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
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-2 ring-white ${
                      isBlocked ? 'bg-[#BA1A1A]' : 'bg-[#2E7D32]'
                    }`}
                    title={isBlocked ? 'Blocked' : 'Active'}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-xl font-bold text-[#14110F]">{displayName}</h2>
                    {peerProfile?.isVerified && (
                      <span className="bg-[#E9DDFF] text-[#210F47] px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#65558F]" />
                        Verified
                      </span>
                    )}
                    {isBlocked && (
                      <span className="bg-[#FFDAD6] text-[#BA1A1A] px-2 py-0.5 rounded-full text-[10px] font-bold">
                        Blocked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6F675E] mt-0.5">
                    {peerProfile?.role ? `${peerProfile.role} • ` : ''}
                    {peerProfile?.location ? `${peerProfile.location} • ` : ''}
                    Direct Collaboration
                  </p>
                  <p className="font-mono text-[11px] text-[#8C827A] mt-0.5">
                    User Ref: {peerUserId ? `${peerUserId.slice(0, 16)}...` : 'N/A'}
                  </p>
                </div>
              </div>

              {peerUserId && (
                <Link
                  href={`/profiles/${peerUserId}`}
                  className="px-4 py-2 rounded-full bg-[#FAF2EE] hover:bg-[#EFE9DF] text-[#14110F] text-xs font-bold border border-[#E7E0D5] transition-colors flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                >
                  <span>View Public Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* Privacy Shield & Sequence Status */}
            <div className="p-3.5 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6F675E]">
              <div className="flex items-center gap-2 text-[#14110F] font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
                <span>End-to-End Monotonic Keyset Ordering</span>
              </div>
              <div className="font-mono text-[11px]">Sequence #{conversation.currentSequence}</div>
            </div>
          </div>

          {/* 2. LINKED PROJECT BANNER (G10 Bridge) */}
          {conversation.assignmentId ? (
            <div className="bg-white p-6 rounded-3xl border border-[#EFE9DF] shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#FFD64A] text-[#14110F] flex items-center justify-center font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base text-[#14110F]">Linked Project Assignment</h3>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#E9DDFF] text-[#210F47]">
                  Escrow Protected
                </span>
              </div>

              <div className="p-4 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-[#14110F]">
                    {conversation.title || 'Creative Production Assignment'}
                  </h4>
                  <p className="text-xs text-[#6F675E] font-mono mt-0.5">
                    Assignment ID: {conversation.assignmentId}
                  </p>
                </div>
                <Link
                  href={`/assignments/${conversation.assignmentId}`}
                  className="px-4 py-2 rounded-full bg-[#FFD64A] hover:bg-[#F2CA3D] text-[#14110F] font-bold text-xs transition-colors shrink-0"
                >
                  View Brief &amp; Milestones
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-[#EFE9DF] shadow-xs flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#FAF2EE] flex items-center justify-center text-[#6F675E]">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-[#14110F]">
                No Project Linked to This Conversation
              </h3>
              <p className="text-xs text-[#6F675E] max-w-md leading-relaxed">
                This thread operates in direct communication mode. Link an assignment from the
                briefs portal to activate escrow milestone checkpoints.
              </p>
            </div>
          )}

          {/* 3. SHARED FILES & MEDIA SECTION (Stitch I06 Specification) */}
          <section
            aria-label="Shared Files and Media"
            className="bg-white p-6 rounded-3xl border border-[#EFE9DF] shadow-xs flex flex-col gap-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE9DF]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FAF2EE] text-[#14110F] flex items-center justify-center font-bold text-xs">
                  <FolderOpen className="w-4 h-4 text-[#725C00]" />
                </div>
                <h2 className="font-bold text-lg text-[#14110F]">Shared Files &amp; Media</h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FAF2EE] text-[#14110F] border border-[#E7E0D5]">
                {sharedItems.length} {sharedItems.length === 1 ? 'Asset' : 'Assets'}
              </span>
            </div>

            {/* Files Grid or Empty State */}
            {sharedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-[#FAF2EE]/50 rounded-2xl border border-dashed border-[#DDD5C7] gap-2">
                <FolderOpen className="w-10 h-10 text-[#8C827A]" />
                <h4 className="font-bold text-sm text-[#14110F]">No Media or Files Shared Yet</h4>
                <p className="text-xs text-[#6F675E] max-w-sm leading-relaxed">
                  When you or your collaborator attach lookbooks, footage, or storyboard PDFs to
                  messages, they will appear here indexed by thread sequence.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sharedItems.map(({ attachment, message }, idx) => {
                  const isOutbound = message.senderId === currentUserId;
                  const senderLabel = isOutbound ? 'You' : displayName;
                  return (
                    <div
                      key={attachment.id}
                      className="bg-[#FAF2EE] rounded-2xl p-4 border border-[#EFE9DF] flex flex-col justify-between gap-3 shadow-2xs hover:border-[#DDD5C7] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 text-[#725C00] shadow-2xs border border-[#EFE9DF]">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4
                            className="font-bold text-xs text-[#14110F] truncate"
                            title={`Attachment #${idx + 1}`}
                          >
                            Attachment #{idx + 1}
                          </h4>
                          <p className="text-[10px] text-[#6F675E] truncate mt-0.5">
                            Sent by {senderLabel} • {formatMessageTimestamp(message.createdAt)}
                          </p>
                          <p className="font-mono text-[9px] text-[#8C827A] truncate mt-0.5">
                            ID: {attachment.id.slice(0, 16)}...
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#E8DFD5] text-xs">
                        <span className="text-[10px] text-[#6F675E]">
                          Message #{message.sequence}
                        </span>
                        {onInspectAttachment && (
                          <button
                            type="button"
                            onClick={() => onInspectAttachment(attachment.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-[#F3ECE6] text-[#14110F] text-xs font-bold border border-[#E7E0D5] shadow-2xs transition-colors"
                            title="Inspect in High-Res Attachment Viewer (Stitch I05)"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#725C00]" />
                            <span>Inspect (I05)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bounded Cursor Pagination: Load Older Shared Files */}
            {hasMoreFiles && onLoadMoreFiles && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={onLoadMoreFiles}
                  disabled={isLoadingMoreFiles}
                  className="px-4 py-2 rounded-full bg-[#FAF2EE] hover:bg-[#EFE9DF] text-[#14110F] text-xs font-bold border border-[#E7E0D5] transition-colors flex items-center gap-2 disabled:opacity-50 shadow-2xs"
                >
                  {isLoadingMoreFiles ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#725C00]" />
                      <span>Loading older assets...</span>
                    </>
                  ) : (
                    <span>Load Older Shared Files</span>
                  )}
                </button>
              </div>
            )}

            {/* Compliance Footer */}
            <div className="p-3 bg-[#FAF2EE] rounded-xl text-[11px] text-[#6F675E] flex items-center justify-between gap-2 border border-[#EFE9DF]">
              <span className="font-semibold text-[#14110F]">CreatorConnect Media Vault</span>
              <span>
                25 MB max per file • Presigned download URLs (15m expiry) • Audited access
              </span>
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Settings, Safety, Governance, Audit Meta */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* 1. CONVERSATION SETTINGS (Mute Notifications - Contract Gap Disclosure) */}
          <div className="bg-white p-6 rounded-3xl border border-[#EFE9DF] shadow-xs flex flex-col gap-4">
            <h2 className="font-bold text-base text-[#14110F] pb-2 border-b border-[#EFE9DF]">
              Conversation Settings
            </h2>

            <div className="p-4 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-[#14110F]">
                  <BellOff className="w-4 h-4 text-[#6F675E]" />
                  <span>Mute Notifications</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFE9DF] text-[#6F675E]">
                  Pending Release
                </span>
              </div>
              <p className="text-[11px] text-[#6F675E] leading-relaxed">
                The conversation mute endpoint (<code>POST /api/v1/conversations/:id/mute</code>) is
                scheduled for an upcoming backend release. Notification delivery respects your
                global profile settings.
              </p>
            </div>
          </div>

          {/* 2. TRUST, SAFETY & GOVERNANCE SECTION */}
          <div className="bg-white p-6 rounded-3xl border border-[#EFE9DF] shadow-xs flex flex-col gap-4">
            <h2 className="font-bold text-base text-[#14110F] pb-2 border-b border-[#EFE9DF]">
              Trust, Safety &amp; Governance
            </h2>

            {/* Anti-Circumvention Policy */}
            <div className="p-3.5 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] text-xs text-[#6F675E] leading-relaxed flex flex-col gap-1">
              <span className="font-bold text-[#14110F] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#725C00]" />
                Anti-Circumvention Protection
              </span>
              <p className="text-[11px]">
                Keep all communications, deliverables, and payments on CreatorConnect to preserve
                escrow protection and platform dispute mediation.
              </p>
            </div>

            {/* Verified Block Action Card */}
            <div className="p-4 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#14110F] flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-[#BA1A1A]" />
                  <span>Block Participant</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isBlocked ? 'bg-[#FFDAD6] text-[#BA1A1A]' : 'bg-[#EFE9DF] text-[#14110F]'
                  }`}
                >
                  {isBlocked ? 'Blocked' : 'Active'}
                </span>
              </div>
              <p className="text-[11px] text-[#6F675E] leading-relaxed">
                {isBlocked
                  ? `You have blocked ${displayName}. They cannot send messages in this thread.`
                  : `Restrict ${displayName} from sending you messages or initiating collaboration requests.`}
              </p>
              <button
                type="button"
                onClick={() => setBlockDialogOpen(true)}
                className={`w-full py-2 px-3 rounded-full text-xs font-bold transition-colors ${
                  isBlocked
                    ? 'bg-[#FFD64A] hover:bg-[#F2CA3D] text-[#14110F]'
                    : 'bg-[#FFDAD6] hover:bg-[#FFB4AB] text-[#BA1A1A]'
                }`}
              >
                {isBlocked ? `Unblock ${displayName}` : `Block ${displayName}`}
              </button>
            </div>

            {/* Report Participant & Content - Trust & Safety Action */}
            <div className="p-4 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#14110F] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#BA1A1A]" />
                  <span>Report Participant or Content</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                  Available
                </span>
              </div>
              <p className="text-[11px] text-[#6F675E] leading-relaxed">
                Flag policy violations, off-platform solicitations, harassment, or malicious files
                directly to the CreatorConnect Trust &amp; Safety team.
              </p>
              {onOpenReport && (
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="w-full py-2 px-3 rounded-full text-xs font-bold bg-white hover:bg-[#F3ECE6] text-[#BA1A1A] border border-[#FFDAD6] transition-colors shadow-2xs"
                >
                  Submit Abuse Report
                </button>
              )}
            </div>
          </div>

          {/* 3. AUDIT & LEDGER META CARD */}
          <div className="bg-white p-6 rounded-3xl border border-[#EFE9DF] shadow-xs flex flex-col gap-3 text-xs">
            <h3 className="font-bold text-sm text-[#14110F] pb-2 border-b border-[#EFE9DF]">
              Audit &amp; Security Ledger
            </h3>
            <div className="space-y-2 text-[#6F675E]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  Conversation ID
                </span>
                <span className="font-mono text-[11px] text-[#14110F]">{conversation.id}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  Thread Type
                </span>
                <span className="font-semibold text-[#14110F]">{conversation.type}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  Thread Started
                </span>
                <span className="font-semibold text-[#14110F]">
                  {formatConversationTime(conversation.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block">Status</span>
                <span className="font-semibold text-[#2E7D32]">Active · Keyset Sequenced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Block Confirmation Dialog (Stitch I06 Modal 2) */}
      <BlockParticipantDialog
        isOpen={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        peerName={displayName}
        isBlocked={isBlocked}
        onConfirm={async (reason) => {
          if (onToggleBlock) {
            await onToggleBlock(reason);
          }
        }}
      />
    </div>
  );
}
