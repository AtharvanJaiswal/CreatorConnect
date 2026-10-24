'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../providers/auth-provider';
import {
  messagingWorkflowService,
  formatMessageDateSeparator,
  getPeerParticipantId,
} from '../../../lib/messaging-workflow-service';
import { useRealtimeChat, type RealtimeMessageCreatedEvent } from '../../../lib/use-realtime-chat';
import type { DirectConversationResponse, MessageResponse } from '@creatorconnect/contracts';
import { ChatHeader } from '../../../components/messaging/chat-header';
import { ChatMessageBubble } from '../../../components/messaging/chat-message-bubble';
import { ChatComposer } from '../../../components/messaging/chat-composer';
import { ChatContextRail } from '../../../components/messaging/chat-context-rail';
import { EditMessageDialog } from '../../../components/messaging/edit-message-dialog';
import { DeleteMessageDialog } from '../../../components/messaging/delete-message-dialog';
import { AttachmentViewerModal } from '../../../components/messaging/attachment-viewer-modal';
import { ArrowLeft, RefreshCw, MessageSquare, ShieldAlert, Loader2, ChevronUp } from 'lucide-react';

export default function ChatDetailPage() {
  const params = useParams();
  const conversationId = typeof params?.id === 'string' ? params.id : '';

  const { user, accessToken, isLoading: isAuthLoading } = useAuth();

  const [conversation, setConversation] = useState<DirectConversationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlockedLocally, setIsBlockedLocally] = useState<boolean>(false);

  // Dialog state
  const [editingMessage, setEditingMessage] = useState<MessageResponse | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<MessageResponse | null>(null);
  const [inspectingAttachment, setInspectingAttachment] = useState<{
    attachmentId: string;
    message: MessageResponse;
  } | null>(null);

  const messageStreamEndRef = useRef<HTMLDivElement>(null);
  const messageStreamContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of message list
  const scrollToBottom = useCallback((smooth = true) => {
    if (messageStreamEndRef.current) {
      messageStreamEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  // Handle incoming realtime message
  const handleRealtimeMessage = useCallback(
    (event: RealtimeMessageCreatedEvent) => {
      setMessages((prev) => {
        // Reconcile if message is already in list (via clientMessageId or messageId)
        const existingIdx = prev.findIndex(
          (m) =>
            m.id === event.messageId ||
            (event.clientMessageId && m.clientMessageId === event.clientMessageId),
        );

        if (existingIdx !== -1) {
          const updated = [...prev];
          const existing = updated[existingIdx]!;
          updated[existingIdx] = {
            ...existing,
            id: event.messageId || existing.id,
            sequence: event.sequence || existing.sequence,
            content: event.content || existing.content,
            status: (event.status as any) || existing.status || 'SENT',
            createdAt: event.createdAt || existing.createdAt,
          };
          return updated;
        }

        const newMsg: MessageResponse = {
          id: event.messageId,
          conversationId: event.conversationId,
          senderId: event.senderId,
          sequence: event.sequence,
          clientMessageId: event.clientMessageId,
          content: event.content,
          status: 'SENT',
          attachments: event.attachments || [],
          deletedAt: null,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
        };

        // Maintain monotonic order by sequence
        const combined = [...prev, newMsg];
        combined.sort((a, b) => {
          const seqA = BigInt(a.sequence || '0');
          const seqB = BigInt(b.sequence || '0');
          if (seqA !== seqB) return seqA < seqB ? -1 : 1;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        return combined;
      });

      // Update read pointer for inbound messages
      if (user && event.senderId !== user.id) {
        messagingWorkflowService
          .markConversationRead(conversationId, event.sequence, accessToken ?? undefined)
          .catch(() => {});
      }

      setTimeout(() => scrollToBottom(true), 50);
    },
    [conversationId, accessToken, user, scrollToBottom],
  );

  // Realtime hook
  const { isConnected, isBlocked: isBlockedBySocket } = useRealtimeChat({
    conversationId: conversationId || null,
    accessToken: accessToken ?? null,
    onMessageCreated: handleRealtimeMessage,
    enabled: Boolean(conversationId && accessToken && !isAuthLoading),
  });

  const isBlocked = isBlockedLocally || isBlockedBySocket;

  // Load conversation details and initial message history
  const loadInitialData = useCallback(async () => {
    if (!conversationId) return;
    setIsLoadingHistory(true);
    setError(null);

    try {
      const token = accessToken ?? undefined;

      // 1. Fetch conversation metadata
      const convData = await messagingWorkflowService.getConversation(conversationId, token);
      setConversation(convData);

      // 2. Fetch message history
      const historyData = await messagingWorkflowService.listMessages(
        conversationId,
        { limit: 50, direction: 'prev' },
        token,
      );

      // Sort chronological ascending (older first, newer at bottom)
      const sorted = [...historyData.items].sort((a, b) => {
        const seqA = BigInt(a.sequence || '0');
        const seqB = BigInt(b.sequence || '0');
        if (seqA !== seqB) return seqA < seqB ? -1 : 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      setMessages(sorted);
      setNextCursor(historyData.nextCursor);
      setHasMore(historyData.hasMore);

      // 3. Mark read if there are unread messages
      if (sorted.length > 0) {
        const latestMsg = sorted[sorted.length - 1]!;
        messagingWorkflowService
          .markConversationRead(conversationId, latestMsg.sequence, token)
          .catch(() => {});
      }

      setTimeout(() => scrollToBottom(false), 80);
    } catch (err: any) {
      setError(err?.message || 'Conversation not found or access denied.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [conversationId, accessToken, scrollToBottom]);

  // Load initial data on mount or auth change
  useEffect(() => {
    if (!isAuthLoading && conversationId) {
      loadInitialData();
    }
  }, [isAuthLoading, conversationId, loadInitialData]);

  // Keyset pagination: load older messages
  const handleLoadOlderMessages = async () => {
    if (!nextCursor || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const token = accessToken ?? undefined;
      const historyData = await messagingWorkflowService.listMessages(
        conversationId,
        { cursor: nextCursor, limit: 30, direction: 'prev' },
        token,
      );

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newItems = historyData.items.filter((m) => !existingIds.has(m.id));
        const combined = [...newItems, ...prev];
        combined.sort((a, b) => {
          const seqA = BigInt(a.sequence || '0');
          const seqB = BigInt(b.sequence || '0');
          if (seqA !== seqB) return seqA < seqB ? -1 : 1;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        return combined;
      });

      setNextCursor(historyData.nextCursor);
      setHasMore(historyData.hasMore);
    } catch (err: any) {
      // Keyset pagination error is non-fatal for current view
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send message
  const handleSendMessage = async (payload: { clientMessageId: string; content: string }) => {
    const token = accessToken ?? undefined;
    const result = await messagingWorkflowService.sendMessage(conversationId, payload, token);

    // Reconcile sent message with current state
    setMessages((prev) => {
      const idx = prev.findIndex(
        (m) => m.id === result.id || m.clientMessageId === result.clientMessageId,
      );
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = result;
        return next;
      }
      return [...prev, result];
    });

    setTimeout(() => scrollToBottom(true), 50);
  };

  // Confirm edit
  const handleConfirmEdit = async (messageId: string, newContent: string) => {
    const token = accessToken ?? undefined;
    const updated = await messagingWorkflowService.editMessage(
      conversationId,
      messageId,
      { content: newContent },
      token,
    );

    setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
  };

  // Confirm delete
  const handleConfirmDelete = async (messageId: string) => {
    const token = accessToken ?? undefined;
    await messagingWorkflowService.deleteMessage(conversationId, messageId, token);

    // Soft-delete in state
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              deletedAt: new Date().toISOString(),
              status: 'DELETED' as any,
              content: '[This message was deleted]',
            }
          : m,
      ),
    );
  };

  // Toggle local block status
  const handleToggleBlock = () => {
    setIsBlockedLocally((prev) => !prev);
  };

  // 1. Auth loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#6F675E]">
          <Loader2 className="w-8 h-8 animate-spin text-[#725C00]" />
          <p className="text-xs font-semibold">Authenticating session...</p>
        </div>
      </div>
    );
  }

  // 2. Error / Access Denied State (Anti-enumeration compliant)
  if (error) {
    return (
      <main className="min-h-screen bg-[#FAF6EF] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto bg-white p-8 sm:p-10 rounded-3xl border border-[#E7E0D5] shadow-xs text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#FFDAD6] text-[#BA1A1A] flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#14110F]">
            Conversation Inaccessible
          </h1>
          <p className="text-sm text-[#6F675E] leading-relaxed">
            {error ||
              'This conversation does not exist or you do not have participant authorization to access its messages.'}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={loadInitialData}
              className="px-4 py-2 rounded-full border border-[#E7E0D5] text-xs font-bold text-[#14110F] hover:bg-[#FAF6EF] transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <Link
              href="/messages"
              className="bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] px-5 py-2 rounded-full text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Inbox</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Conversation Loading Skeleton
  if (isLoadingHistory || !conversation) {
    return (
      <main className="min-h-screen bg-[#FAF6EF] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="h-10 w-48 bg-[#EFE9DF] rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white h-[650px] rounded-3xl border border-[#E7E0D5] animate-pulse p-6" />
            <div className="hidden lg:block lg:col-span-4 bg-white h-[450px] rounded-3xl border border-[#E7E0D5] animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  const currentUserId = user?.id;
  const peerUserId = getPeerParticipantId(conversation, currentUserId);
  const displayName =
    conversation.title || (peerUserId ? `User ${peerUserId.slice(0, 8)}` : 'Direct Conversation');
  const peerInitial =
    displayName
      .replace(/^User\s+/, '')
      .charAt(0)
      .toUpperCase() || 'P';
  const userInitial = user?.firstName?.charAt(0).toUpperCase() || 'Y';

  // Group messages by day
  let lastDateSeparator = '';

  return (
    <main className="min-h-screen bg-[#FAF6EF] py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Breadcrumb Navigation Strip */}
        <nav className="flex items-center gap-2 text-xs text-[#6F675E]" aria-label="Breadcrumb">
          <Link
            href="/messages"
            className="hover:text-[#14110F] transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Messages Inbox</span>
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#14110F]">{displayName}</span>
          {isConnected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
              Live Realtime
            </span>
          )}
        </nav>

        {/* 12-Column Desktop Grid Layout (Stitch I04 Specification) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Chat Canvas (~8 Columns on Desktop) */}
          <section className="lg:col-span-8 flex flex-col bg-white rounded-3xl border border-[#E7E0D5] shadow-xs overflow-hidden h-[780px]">
            {/* Header */}
            <ChatHeader
              conversation={conversation}
              currentUserId={currentUserId}
              isBlocked={isBlocked}
              onToggleBlock={handleToggleBlock}
            />

            {/* Message Stream Body */}
            <div
              ref={messageStreamContainerRef}
              className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1 bg-[#FAF6EF]/30"
            >
              {/* Load older messages button */}
              {hasMore && (
                <div className="flex justify-center my-2">
                  <button
                    onClick={handleLoadOlderMessages}
                    disabled={isLoadingMore}
                    className="px-4 py-1.5 rounded-full bg-white border border-[#E7E0D5] text-xs font-semibold text-[#14110F] hover:bg-[#FAF6EF] shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#725C00]" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5 text-[#6F675E]" />
                    )}
                    <span>
                      {isLoadingMore ? 'Loading older history...' : 'Load older messages'}
                    </span>
                  </button>
                </div>
              )}

              {/* Empty Stream State */}
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#6F675E]">
                  <div className="w-12 h-12 rounded-full bg-[#EFE9DF] flex items-center justify-center mb-3 text-[#14110F]">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#14110F] mb-1">
                    No messages in thread yet
                  </h3>
                  <p className="text-xs max-w-sm leading-relaxed">
                    Start the discussion by typing a message below. All communications are verified
                    with keyset ordering.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const dateSep = formatMessageDateSeparator(message.createdAt);
                  const showSeparator = dateSep && dateSep !== lastDateSeparator;
                  if (showSeparator) {
                    lastDateSeparator = dateSep;
                  }

                  const peerParticipant = conversation.participants.find(
                    (p) => p.userId !== currentUserId,
                  );
                  const peerLastRead = BigInt(peerParticipant?.lastReadSequence || '0');
                  const isRead = peerLastRead >= BigInt(message.sequence || '0');

                  return (
                    <React.Fragment key={message.id}>
                      {showSeparator && (
                        <div className="flex items-center justify-center my-3">
                          <span className="bg-[#EFE9DF] text-[#14110F] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                            {dateSep}
                          </span>
                        </div>
                      )}

                      <ChatMessageBubble
                        message={message}
                        currentUserId={currentUserId}
                        peerInitial={peerInitial}
                        userInitial={userInitial}
                        isRead={isRead}
                        onEdit={(msg) => setEditingMessage(msg)}
                        onDelete={(msg) => setDeletingMessage(msg)}
                        onInspectAttachment={(att, msg) =>
                          setInspectingAttachment({ attachmentId: att.id, message: msg })
                        }
                      />
                    </React.Fragment>
                  );
                })
              )}

              <div ref={messageStreamEndRef} />
            </div>

            {/* Composer */}
            <ChatComposer
              onSendMessage={handleSendMessage}
              isBlocked={isBlocked}
              disabled={isBlocked}
              placeholder={`Write a message to ${displayName}... (Shift + Enter for new line)`}
            />
          </section>

          {/* Context Rail (~4 Columns on Desktop, Stitch I04 Specification) */}
          <div className="lg:col-span-4">
            <ChatContextRail conversation={conversation} currentUserId={currentUserId} />
          </div>
        </div>
      </div>

      {/* Edit Dialog (15-Minute Window) */}
      <EditMessageDialog
        message={editingMessage}
        isOpen={Boolean(editingMessage)}
        onClose={() => setEditingMessage(null)}
        onConfirmEdit={handleConfirmEdit}
      />

      {/* Delete Dialog (Stitch I04 Rule 4.2 Modal) */}
      <DeleteMessageDialog
        message={deletingMessage}
        isOpen={Boolean(deletingMessage)}
        onClose={() => setDeletingMessage(null)}
        onConfirmDelete={handleConfirmDelete}
      />

      {/* Attachment Viewer Modal (Stitch I05) */}
      {inspectingAttachment && (
        <AttachmentViewerModal
          isOpen={Boolean(inspectingAttachment)}
          onClose={() => setInspectingAttachment(null)}
          conversationId={conversationId}
          attachmentId={inspectingAttachment.attachmentId}
          token={accessToken}
          originMessage={inspectingAttachment.message}
          peerName={displayName}
        />
      )}
    </main>
  );
}
