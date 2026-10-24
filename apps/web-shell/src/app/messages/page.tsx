'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../providers/auth-provider';
import {
  messagingWorkflowService,
  getPeerParticipantId,
} from '../../lib/messaging-workflow-service';
import type { DirectConversationResponse, MessageRequestResponse } from '@creatorconnect/contracts';
import { ConversationCard } from '../../components/messaging/conversation-card';
import { MessageRequestCard } from '../../components/messaging/message-request-card';
import { MessageRequestDetailPane } from '../../components/messaging/message-request-detail-pane';
import { ComposeRequestModal } from '../../components/messaging/compose-request-modal';
import { InboxLoadingSkeleton } from '../../components/messaging/inbox-loading-skeleton';
import { InboxEmptyState } from '../../components/messaging/inbox-empty-state';
import { InboxErrorState } from '../../components/messaging/inbox-error-state';
import { ConversationPreviewPane } from '../../components/messaging/conversation-preview-pane';
import {
  useRealtimeMessageRequests,
  type RealtimeMessageRequestEvent,
} from '../../lib/use-realtime-message-requests';
import {
  Search,
  WifiOff,
  MessageSquare,
  Plus,
  RefreshCw,
  Inbox,
  Send,
  Sparkles,
} from 'lucide-react';

export default function MessagesInboxPage() {
  const { user, accessToken, isLoading: isAuthLoading } = useAuth();

  // Conversations State
  const [conversations, setConversations] = useState<DirectConversationResponse[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'requests'>('all');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  // Message Requests State (Milestone 2D)
  const [requests, setRequests] = useState<MessageRequestResponse[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestsDirection, setRequestsDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [pendingIncomingCount, setPendingIncomingCount] = useState<number>(0);

  // Monitor browser network status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!window.navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Active Conversations
  const loadConversations = useCallback(
    async (isManualRetry = false) => {
      if (isManualRetry) {
        setIsRetrying(true);
      } else {
        setIsLoadingConversations(true);
      }
      setConversationError(null);

      try {
        const token = accessToken ?? undefined;
        const res = await messagingWorkflowService.listConversations({ limit: 50 }, token);
        setConversations(res.items);

        // Auto-select first conversation if none selected and on desktop
        if (res.items.length > 0 && !selectedConversationId) {
          setSelectedConversationId(res.items[0]?.id ?? null);
        }
      } catch (err: any) {
        setConversationError(err.message || 'Failed to load conversations.');
      } finally {
        setIsLoadingConversations(false);
        setIsRetrying(false);
      }
    },
    [accessToken, selectedConversationId],
  );

  // Load Message Requests
  const loadMessageRequests = useCallback(
    async (direction: 'incoming' | 'outgoing' = requestsDirection) => {
      setIsLoadingRequests(true);
      setRequestsError(null);

      try {
        const token = accessToken ?? undefined;
        const res = await messagingWorkflowService.listMessageRequests(
          { direction, limit: 50 },
          token,
        );
        setRequests(res.items);

        if (res.items.length > 0) {
          setSelectedRequestId(res.items[0]?.id ?? null);
        } else {
          setSelectedRequestId(null);
        }

        // Update pending badge count if incoming
        if (direction === 'incoming') {
          const pending = res.items.filter((r) => r.status === 'PENDING').length;
          setPendingIncomingCount(pending);
        }
      } catch (err: any) {
        setRequestsError(err.message || 'Failed to load message requests.');
      } finally {
        setIsLoadingRequests(false);
      }
    },
    [accessToken, requestsDirection],
  );

  // Fetch pending badge count on initial load
  const loadPendingIncomingBadge = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await messagingWorkflowService.listMessageRequests(
        { direction: 'incoming', status: 'PENDING', limit: 50 },
        accessToken,
      );
      setPendingIncomingCount(res.items.length);
    } catch {
      // Non-critical badge count failure
    }
  }, [accessToken]);

  // Initial load once auth resolves
  useEffect(() => {
    if (!isAuthLoading) {
      loadConversations();
      loadPendingIncomingBadge();
    }
  }, [isAuthLoading, loadConversations, loadPendingIncomingBadge]);

  // When switching to Requests tab, load requests
  useEffect(() => {
    if (activeTab === 'requests' && !isAuthLoading) {
      loadMessageRequests(requestsDirection);
    }
  }, [activeTab, requestsDirection, isAuthLoading, loadMessageRequests]);

  // Realtime Socket.IO handler for MessageRequest lifecycle events
  const handleRealtimeEvent = useCallback(
    (event: RealtimeMessageRequestEvent) => {
      switch (event.eventType) {
        case 'message_request:created': {
          // If incoming proposal for current user, increment badge and prepend if viewing incoming
          if (event.recipientId === user?.id) {
            setPendingIncomingCount((prev) => prev + 1);
            if (activeTab === 'requests' && requestsDirection === 'incoming') {
              loadMessageRequests('incoming');
            }
          } else if (event.senderId === user?.id) {
            if (activeTab === 'requests' && requestsDirection === 'outgoing') {
              loadMessageRequests('outgoing');
            }
          }
          break;
        }
        case 'message_request:accepted': {
          // Update in-memory requests status
          setRequests((prev) =>
            prev.map((r) =>
              r.id === event.requestId
                ? {
                    ...r,
                    status: 'ACCEPTED',
                    conversationId: event.conversationId || r.conversationId,
                  }
                : r,
            ),
          );
          if (event.recipientId === user?.id) {
            setPendingIncomingCount((prev) => Math.max(0, prev - 1));
          }
          // Refresh conversation list so newly created direct conversation is present
          loadConversations();
          break;
        }
        case 'message_request:declined': {
          setRequests((prev) =>
            prev.map((r) => (r.id === event.requestId ? { ...r, status: 'DECLINED' } : r)),
          );
          if (event.recipientId === user?.id) {
            setPendingIncomingCount((prev) => Math.max(0, prev - 1));
          }
          break;
        }
        case 'message_request:cancelled': {
          setRequests((prev) =>
            prev.map((r) => (r.id === event.requestId ? { ...r, status: 'CANCELLED' } : r)),
          );
          if (event.recipientId === user?.id) {
            setPendingIncomingCount((prev) => Math.max(0, prev - 1));
          }
          break;
        }
        case 'message_request:expired': {
          setRequests((prev) =>
            prev.map((r) => (r.id === event.requestId ? { ...r, status: 'EXPIRED' } : r)),
          );
          if (event.recipientId === user?.id) {
            setPendingIncomingCount((prev) => Math.max(0, prev - 1));
          }
          break;
        }
      }
    },
    [user?.id, activeTab, requestsDirection, loadMessageRequests, loadConversations],
  );

  // Hook into shared Realtime Socket.IO connection
  useRealtimeMessageRequests({
    accessToken,
    onEvent: handleRealtimeEvent,
    onReconnect: () => {
      loadConversations();
      loadMessageRequests(requestsDirection);
      loadPendingIncomingBadge();
    },
    enabled: Boolean(accessToken),
  });

  // Mark conversation as read
  const handleMarkRead = async (conversationId: string, sequence: string) => {
    if (!conversationId) return;
    setIsMarkingRead(true);
    try {
      await messagingWorkflowService.markConversationRead(
        conversationId,
        sequence,
        accessToken ?? undefined,
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      );
    } catch {
      // Non-critical background update failure
    } finally {
      setIsMarkingRead(false);
    }
  };

  // Actions for Message Requests
  const handleAcceptRequest = async (requestId: string) => {
    const res = await messagingWorkflowService.acceptMessageRequest(
      requestId,
      accessToken ?? undefined,
    );
    // Update local state
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: 'ACCEPTED', conversationId: res.conversation.id } : r,
      ),
    );
    setPendingIncomingCount((prev) => Math.max(0, prev - 1));

    // Prepend new direct conversation into conversations directory
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === res.conversation.id);
      if (exists) return prev;
      return [res.conversation, ...prev];
    });

    return res;
  };

  const handleDeclineRequest = async (requestId: string, reason?: string) => {
    const updated = await messagingWorkflowService.declineMessageRequest(
      requestId,
      reason ? { reason } : {},
      accessToken ?? undefined,
    );
    setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
    setPendingIncomingCount((prev) => Math.max(0, prev - 1));
  };

  const handleCancelRequest = async (requestId: string) => {
    const updated = await messagingWorkflowService.cancelMessageRequest(
      requestId,
      accessToken ?? undefined,
    );
    setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
  };

  const handleRequestCreated = (newReq: MessageRequestResponse) => {
    setRequests((prev) => [newReq, ...prev]);
    setSelectedRequestId(newReq.id);
    if (requestsDirection !== 'outgoing') {
      setRequestsDirection('outgoing');
    }
  };

  const handleOpenConversation = (conversationId: string) => {
    setActiveTab('all');
    setSelectedConversationId(conversationId);
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeTab === 'unread' && (!c.unreadCount || c.unreadCount <= 0)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const peerId = getPeerParticipantId(c, user?.id);
        const titleMatch = c.title?.toLowerCase().includes(q) ?? false;
        const peerMatch = peerId?.toLowerCase().includes(q) ?? false;
        const assignmentMatch = c.assignmentId?.toLowerCase().includes(q) ?? false;
        return titleMatch || peerMatch || assignmentMatch;
      }
      return true;
    });
  }, [conversations, activeTab, searchQuery, user?.id]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const peerMatch =
          r.senderProfile?.displayName?.toLowerCase().includes(q) ||
          r.senderId.toLowerCase().includes(q) ||
          r.recipientId.toLowerCase().includes(q);
        const messageMatch = r.initialMessage?.toLowerCase().includes(q) ?? false;
        return peerMatch || messageMatch;
      }
      return true;
    });
  }, [requests, searchQuery]);

  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversationId) ?? null;
  }, [conversations, selectedConversationId]);

  const selectedRequest = useMemo(() => {
    return requests.find((r) => r.id === selectedRequestId) ?? null;
  }, [requests, selectedRequestId]);

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0);
  }, [conversations]);

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Offline Banner matching Stitch I01_inbox / I01_hub */}
        {isOffline && (
          <div
            className="w-full bg-[#14110F] text-[#FAF6EF] px-5 py-3 rounded-2xl mb-6 flex items-center justify-between shadow-md"
            role="status"
          >
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 text-[#FFD64A]" />
              <span className="text-xs font-bold">
                Offline Protocol Engaged — Displaying local cached messaging state.
              </span>
            </div>
            <button
              onClick={() => {
                loadConversations(true);
                if (activeTab === 'requests') loadMessageRequests();
              }}
              className="text-xs font-bold text-[#FFD64A] hover:underline"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Page Title & Stats Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-[#14110F] tracking-tight">
              Messages & Conversations
            </h1>
            <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
              Consent-gated messaging for assignments, talent briefings, and verified collaboration
              proposals.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadConversations(true);
                if (activeTab === 'requests') loadMessageRequests();
              }}
              disabled={isRetrying || isLoadingConversations || isLoadingRequests}
              className="p-2 rounded-full border border-[#DDD5C7] text-[#14110F] hover:bg-[#F2ECE1] transition-colors disabled:opacity-50"
              title="Refresh Inbox"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isRetrying || isLoadingConversations || isLoadingRequests ? 'animate-spin' : ''
                }`}
              />
            </button>
            <button
              onClick={() => setIsComposeModalOpen(true)}
              className="bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs px-4 py-2 rounded-full shadow-2xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Start Conversation
            </button>
          </div>
        </div>

        {/* Split-Pane Inbox Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: Directory List (5 cols desktop) */}
          <section
            className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl p-5 sm:p-6 flex flex-col gap-5 border border-[#E7E0D5] shadow-xs"
            aria-label="Conversation Directory"
          >
            {/* Search Input Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#8C827A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'requests'
                    ? 'Filter requests by peer or text...'
                    : 'Filter messages by participant or project...'
                }
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF6EF] text-[#14110F] text-xs font-medium rounded-full border border-[#E7E0D5] focus:outline-none focus:ring-2 focus:ring-[#14110F] placeholder:text-[#8C827A]"
              />
            </div>

            {/* Filter Tabs (All / Unread / Requests) */}
            <div className="flex items-center gap-1.5 p-1 bg-[#FAF6EF] rounded-full border border-[#E7E0D5]">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 text-xs font-bold py-1.5 rounded-full transition-all text-center ${
                  activeTab === 'all'
                    ? 'bg-white text-[#14110F] shadow-xs'
                    : 'text-[#6F675E] hover:text-[#14110F]'
                }`}
              >
                All Chats
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`flex-1 text-xs font-bold py-1.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 ${
                  activeTab === 'unread'
                    ? 'bg-white text-[#14110F] shadow-xs'
                    : 'text-[#6F675E] hover:text-[#14110F]'
                }`}
              >
                Unread
                {totalUnreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FFD64A] text-[#14110F] text-[10px] font-extrabold">
                    {totalUnreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 text-xs font-bold py-1.5 rounded-full transition-all text-center flex items-center justify-center gap-1.5 ${
                  activeTab === 'requests'
                    ? 'bg-white text-[#14110F] shadow-xs'
                    : 'text-[#6F675E] hover:text-[#14110F]'
                }`}
              >
                Requests
                {pendingIncomingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FFD64A] text-[#14110F] text-[10px] font-extrabold">
                    {pendingIncomingCount}
                  </span>
                )}
              </button>
            </div>

            {/* Sub-Tabs for Requests (Incoming vs Outgoing) */}
            {activeTab === 'requests' && (
              <div className="flex items-center justify-between gap-2 border-b border-[#EFE9DF] pb-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setRequestsDirection('incoming');
                      loadMessageRequests('incoming');
                    }}
                    className={`text-xs font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                      requestsDirection === 'incoming'
                        ? 'bg-[#14110F] text-[#FAF6EF]'
                        : 'text-[#6F675E] hover:bg-[#FAF6EF]'
                    }`}
                  >
                    <Inbox className="w-3.5 h-3.5" /> Inbound
                    {pendingIncomingCount > 0 && (
                      <span className="ml-0.5 text-[10px] text-[#FFD64A] font-extrabold">
                        ({pendingIncomingCount})
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setRequestsDirection('outgoing');
                      loadMessageRequests('outgoing');
                    }}
                    className={`text-xs font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                      requestsDirection === 'outgoing'
                        ? 'bg-[#14110F] text-[#FAF6EF]'
                        : 'text-[#6F675E] hover:bg-[#FAF6EF]'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" /> Outgoing
                  </button>
                </div>

                <button
                  onClick={() => setIsComposeModalOpen(true)}
                  className="text-xs font-bold text-[#14110F] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-[#B08800]" /> New Request
                </button>
              </div>
            )}

            {/* Content List Area: Requests vs Conversations */}
            {activeTab === 'requests' ? (
              isLoadingRequests ? (
                <InboxLoadingSkeleton />
              ) : requestsError ? (
                <InboxErrorState
                  message={requestsError}
                  onRetry={() => loadMessageRequests(requestsDirection)}
                  isRetrying={isLoadingRequests}
                />
              ) : filteredRequests.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-center flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#8C827A] mb-2.5 shadow-2xs">
                    <Sparkles className="w-5 h-5 text-[#B08800]" />
                  </div>
                  <p className="text-xs font-bold text-[#14110F]">
                    {searchQuery
                      ? 'No matching requests'
                      : requestsDirection === 'incoming'
                        ? 'No incoming message requests'
                        : 'No outgoing message requests'}
                  </p>
                  <p className="text-xs text-[#6F675E] mt-1 max-w-xs">
                    {searchQuery
                      ? 'Try adjusting your search terms.'
                      : requestsDirection === 'incoming'
                        ? 'When new creators or brands reach out to connect, their proposals will appear here.'
                        : 'Send an introductory proposal to a peer to start a consent-gated conversation.'}
                  </p>
                  {requestsDirection === 'outgoing' && !searchQuery && (
                    <button
                      onClick={() => setIsComposeModalOpen(true)}
                      className="mt-3 text-xs font-bold px-4 py-1.5 rounded-full bg-[#14110F] text-[#FAF6EF] hover:bg-[#2C2724] transition-all"
                    >
                      Send Proposal
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[640px] pr-1">
                  {filteredRequests.map((req) => (
                    <MessageRequestCard
                      key={req.id}
                      request={req}
                      isSelected={req.id === selectedRequestId}
                      onSelect={() => setSelectedRequestId(req.id)}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              )
            ) : isLoadingConversations ? (
              <InboxLoadingSkeleton />
            ) : conversationError ? (
              <InboxErrorState
                message={conversationError}
                onRetry={() => loadConversations(true)}
                isRetrying={isRetrying}
              />
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-center">
                <MessageSquare className="w-8 h-8 text-[#8C827A] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#14110F]">
                  {searchQuery ? 'No matching conversations' : 'No active conversations'}
                </p>
                <p className="text-xs text-[#6F675E] mt-1">
                  {searchQuery
                    ? 'Try adjusting your search keywords.'
                    : 'Start a new conversation to get started.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[640px] pr-1">
                {filteredConversations.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    isSelected={conv.id === selectedConversationId}
                    onSelect={() => setSelectedConversationId(conv.id)}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* RIGHT PANEL: Preview / Main Content Stage (7 cols desktop) */}
          <section className="lg:col-span-7 xl:col-span-8">
            {activeTab === 'requests' ? (
              isLoadingRequests ? (
                <div className="h-[580px] bg-white rounded-3xl border border-[#E7E0D5] p-8 animate-pulse flex flex-col justify-between">
                  <div className="h-10 w-48 bg-[#EFE9DF] rounded-xl" />
                  <div className="h-40 w-full bg-[#FAF6EF] rounded-2xl" />
                  <div className="h-6 w-64 bg-[#EFE9DF] rounded-md" />
                </div>
              ) : (
                <MessageRequestDetailPane
                  request={selectedRequest}
                  currentUserId={user?.id}
                  onAccept={handleAcceptRequest}
                  onDecline={handleDeclineRequest}
                  onCancel={handleCancelRequest}
                  onOpenConversation={handleOpenConversation}
                />
              )
            ) : isLoadingConversations ? (
              <div className="h-[580px] bg-white rounded-3xl border border-[#E7E0D5] p-8 animate-pulse flex flex-col justify-between">
                <div className="h-10 w-48 bg-[#EFE9DF] rounded-xl" />
                <div className="h-40 w-full bg-[#FAF6EF] rounded-2xl" />
                <div className="h-6 w-64 bg-[#EFE9DF] rounded-md" />
              </div>
            ) : conversations.length === 0 && !conversationError ? (
              <InboxEmptyState />
            ) : (
              <ConversationPreviewPane
                conversation={selectedConversation}
                currentUserId={user?.id}
                onMarkRead={handleMarkRead}
                isMarkingRead={isMarkingRead}
              />
            )}
          </section>
        </div>
      </main>

      {/* Compose Request Modal */}
      <ComposeRequestModal
        isOpen={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        onRequestCreated={handleRequestCreated}
        accessToken={accessToken}
      />
    </div>
  );
}
