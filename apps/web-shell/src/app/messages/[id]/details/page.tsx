'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../providers/auth-provider';
import {
  messagingWorkflowService,
  getPeerParticipantId,
} from '../../../../lib/messaging-workflow-service';
import type {
  DirectConversationResponse,
  MessageResponse,
  CreateReportInput,
  ReportResponse,
} from '@creatorconnect/contracts';
import { ConversationDetailsView } from '../../../../components/messaging/conversation-details-view';
import { AttachmentViewerModal } from '../../../../components/messaging/attachment-viewer-modal';
import { ReportAbuseDialog } from '../../../../components/messaging/report-abuse-dialog';
import { Header } from '../../../../components/header';
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

export default function ConversationDetailsPage() {
  const params = useParams();
  const conversationId = typeof params?.id === 'string' ? params.id : '';

  const { user, accessToken, isLoading: isAuthLoading } = useAuth();

  const [conversation, setConversation] = useState<DirectConversationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [inspectingAttachmentId, setInspectingAttachmentId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState<boolean>(false);

  // Cancellation and repeated-cursor protection guards
  const abortControllerRef = useRef<AbortController | null>(null);
  const paginationAbortControllerRef = useRef<AbortController | null>(null);
  const seenCursorsRef = useRef<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!conversationId) return;

    // Cancel any previous in-flight requests (both main load and pagination)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (paginationAbortControllerRef.current) {
      paginationAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    seenCursorsRef.current.clear();

    setIsLoading(true);
    setError(null);
    try {
      const conv = await messagingWorkflowService.getConversation(
        conversationId,
        accessToken ?? undefined,
      );
      if (controller.signal.aborted) return;
      setConversation(conv);

      // Check block status if peer is present
      const peerId = getPeerParticipantId(conv, user?.id);
      if (peerId) {
        try {
          const status = await messagingWorkflowService.checkBlockStatus(
            peerId,
            accessToken ?? undefined,
          );
          if (!controller.signal.aborted) {
            setIsBlocked(status.isBlocked);
          }
        } catch {
          // Non-blocking fallback
        }
      }

      // Fetch initial message page to extract shared files
      try {
        const msgList = await messagingWorkflowService.listMessages(
          conversationId,
          { limit: 50, signal: controller.signal },
          accessToken ?? undefined,
        );
        if (!controller.signal.aborted) {
          setMessages(msgList.items);
          setNextCursor(msgList.nextCursor);
          setHasMore(Boolean(msgList.hasMore && msgList.nextCursor));
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Non-fatal message listing fallback
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load conversation details. Access may be restricted.',
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [conversationId, accessToken, user?.id]);

  useEffect(() => {
    if (!isAuthLoading) {
      loadData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (paginationAbortControllerRef.current) {
        paginationAbortControllerRef.current.abort();
      }
    };
  }, [isAuthLoading, loadData]);

  // Bounded cursor pagination to load older messages & shared assets
  const handleLoadMoreFiles = async () => {
    if (!conversationId || !nextCursor || !hasMore || isLoadingMore) return;

    const cursorToFetch = nextCursor;

    // Repeated-cursor protection: prevent infinite pagination loops on duplicate cursors
    if (seenCursorsRef.current.has(cursorToFetch)) {
      setHasMore(false);
      return;
    }
    seenCursorsRef.current.add(cursorToFetch);

    // Cancel any previous pagination in flight
    if (paginationAbortControllerRef.current) {
      paginationAbortControllerRef.current.abort();
    }
    const paginationController = new AbortController();
    paginationAbortControllerRef.current = paginationController;
    const requestTargetConversationId = conversationId;

    setIsLoadingMore(true);
    try {
      const msgList = await messagingWorkflowService.listMessages(
        conversationId,
        { cursor: cursorToFetch, limit: 50, signal: paginationController.signal },
        accessToken ?? undefined,
      );

      // Verify conversation has not changed while request was in-flight
      if (paginationController.signal.aborted || conversationId !== requestTargetConversationId) {
        return;
      }

      setMessages((prev) => {
        // Map-based deduplication by message ID
        const msgMap = new Map<string, MessageResponse>();
        for (const m of prev) {
          msgMap.set(m.id, m);
        }
        for (const m of msgList.items) {
          if (!msgMap.has(m.id)) {
            msgMap.set(m.id, m);
          }
        }
        return Array.from(msgMap.values());
      });

      setNextCursor(msgList.nextCursor);
      setHasMore(Boolean(msgList.hasMore && msgList.nextCursor));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Keyset pagination error is non-fatal for current view
    } finally {
      if (!paginationController.signal.aborted && conversationId === requestTargetConversationId) {
        setIsLoadingMore(false);
      }
    }
  };

  const handleToggleBlock = async (reason?: string) => {
    if (!conversation) return;
    const peerId = getPeerParticipantId(conversation, user?.id);
    if (!peerId) return;

    if (isBlocked) {
      await messagingWorkflowService.unblockUser(peerId, accessToken ?? undefined);
      setIsBlocked(false);
    } else {
      await messagingWorkflowService.blockUser(peerId, reason, accessToken ?? undefined);
      setIsBlocked(true);
    }
  };

  const handleSubmitReport = async (input: CreateReportInput): Promise<ReportResponse> => {
    return await messagingWorkflowService.submitReport(input, accessToken ?? undefined);
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 text-[#6F675E]">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFD64A]" />
            <p className="text-sm font-medium">Loading conversation details &amp; assets...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-[#EFE9DF] shadow-xs flex flex-col items-center gap-4">
            <ShieldAlert className="w-12 h-12 text-[#BA1A1A]" />
            <h2 className="font-bold text-lg text-[#14110F]">Conversation Access Denied</h2>
            <p className="text-xs text-[#6F675E] leading-relaxed">
              {error || 'You do not have active participant permissions for this conversation.'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={loadData}
                className="px-4 py-2 rounded-full bg-[#FAF2EE] hover:bg-[#EFE9DF] text-[#14110F] text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <Link
                href="/messages"
                className="px-4 py-2 rounded-full bg-[#FFD64A] text-[#14110F] text-xs font-bold"
              >
                Return to Inbox
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const peerId = getPeerParticipantId(conversation, user?.id);
  const peerName =
    conversation.title || (peerId ? `User ${peerId.slice(0, 8)}` : 'Direct Participant');

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <ConversationDetailsView
          conversation={conversation}
          messages={messages}
          currentUserId={user?.id}
          token={accessToken}
          isBlocked={isBlocked}
          onToggleBlock={handleToggleBlock}
          onInspectAttachment={(attId) => setInspectingAttachmentId(attId)}
          onOpenReport={() => setReportDialogOpen(true)}
          hasMoreFiles={hasMore}
          isLoadingMoreFiles={isLoadingMore}
          onLoadMoreFiles={handleLoadMoreFiles}
        />
      </main>

      {/* Attachment Viewer Modal (Stitch I05 reuse) */}
      {inspectingAttachmentId && (
        <AttachmentViewerModal
          isOpen={Boolean(inspectingAttachmentId)}
          onClose={() => setInspectingAttachmentId(null)}
          conversationId={conversationId}
          attachmentId={inspectingAttachmentId}
          token={accessToken}
          peerName={peerName}
        />
      )}

      {/* Abuse Reporting Dialog (Stitch I06 Action) */}
      {peerId && (
        <ReportAbuseDialog
          isOpen={reportDialogOpen}
          onClose={() => setReportDialogOpen(false)}
          targetType="USER"
          targetId={peerId}
          targetName={peerName}
          onSubmitReport={handleSubmitReport}
        />
      )}
    </div>
  );
}
