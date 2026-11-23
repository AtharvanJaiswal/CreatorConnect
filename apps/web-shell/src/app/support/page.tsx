'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../providers/auth-provider';
import { supportFrontendService } from '../../services/support.service';
import type {
  SupportTicketResponse,
  SupportTicketMessageResponse,
} from '@creatorconnect/contracts';
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  Paperclip,
  ArrowLeft,
  Lock,
  AlertCircle,
  RefreshCw,
  WifiOff,
  Download,
  ExternalLink,
  HelpCircle,
  FileText,
  LogIn,
  PlusCircle,
} from 'lucide-react';

interface SupportMessage {
  id: string;
  sender: 'agent' | 'user' | 'system';
  authorName: string;
  authorRole: string;
  time: string;
  text: string;
  attachment?:
    | {
        name: string;
        size: string;
        type: string;
      }
    | undefined;
}

const DEMO_INITIAL_MESSAGES: SupportMessage[] = [
  {
    id: 'msg-1',
    sender: 'agent',
    authorName: 'Anya Sen',
    authorRole: 'Trust & Safety Desk 4 • Verified Specialist',
    time: '10:30 AM',
    text: 'Hello Kavya. We have received your inquiry regarding Milestone #MS-02 escrow reconciliation for Assignment #PRJ-8841 (Monsoon Fashion Campaign). Let me review the ledger state for your account.',
  },
  {
    id: 'msg-2',
    sender: 'user',
    authorName: 'Kavya Nair',
    authorRole: 'Studio Atelier',
    time: '10:33 AM',
    text: 'Hi Anya, thank you! The brand approved our final deliverables yesterday afternoon, but the milestone status in our dashboard still displays "PENDING_DISBURSEMENT". Could you check if the bank gateway webhook was acknowledged?',
  },
  {
    id: 'msg-3',
    sender: 'system',
    authorName: 'System Audit Event',
    authorRole: 'Escrow Ledger',
    time: '10:35 AM',
    text: 'Audit Event #EVT-4912: Escrow Release #REL-9012 authorized. Bank reconciliation reference: #TXN-90214-IN. Escrow amount ₹1,20,000 confirmed into payout queue.',
  },
  {
    id: 'msg-4',
    sender: 'agent',
    authorName: 'Anya Sen',
    authorRole: 'Trust & Safety Desk 4 • Verified Specialist',
    time: '10:36 AM',
    text: 'The milestone disbursement has been successfully reconciled. The delay was caused by a banking batch settlement window. Your disbursement of ₹1,20,000 has been dispatched to your verified HDFC account ending in 4108 and will credit within 2 business hours.',
    attachment: {
      name: 'Escrow_Reconciliation_Voucher_PRJ8841.pdf',
      size: '248 KB',
      type: 'PDF Document',
    },
  },
];

function mapToUiMessage(msg: SupportTicketMessageResponse): SupportMessage {
  const isAgent = msg.authorRole === 'STAFF';
  const isSystem = msg.authorRole === 'SYSTEM';
  const authorName = msg.author
    ? [msg.author.firstName, msg.author.lastName].filter(Boolean).join(' ') ||
      (isAgent ? 'Trust & Safety Specialist' : 'User')
    : isAgent
      ? 'Trust & Safety Desk 4 • Verified Specialist'
      : isSystem
        ? 'Escrow Ledger'
        : 'User';
  const authorRole = isAgent
    ? 'Trust & Safety Desk 4 • Verified Specialist'
    : isSystem
      ? 'Escrow Ledger'
      : 'Requester';
  return {
    id: msg.id,
    sender: isSystem ? 'system' : isAgent ? 'agent' : 'user',
    authorName,
    authorRole,
    time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: msg.body,
    attachment: msg.attachmentName
      ? {
          name: msg.attachmentName,
          size: msg.attachmentSize || '240 KB',
          type: msg.attachmentType || 'Document',
        }
      : undefined,
  };
}

export default function SupportChatPage() {
  const { user, accessToken, isLoading: isAuthLoading } = useAuth();
  const token = accessToken;
  const isAuthenticated = !!accessToken && !!user;

  // Explicit demo simulation is strictly forbidden in production mode
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicketResponse | null>(null);

  const [qaState, setQaState] = useState<
    'active' | 'empty' | 'uploading' | 'failed' | 'closed' | 'network-error'
  >('active');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [ticketStatus, setTicketStatus] = useState<'IN_INVESTIGATION' | 'RESOLVED'>(
    'IN_INVESTIGATION',
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Check demo simulation eligibility (strictly non-production with explicit opt-in)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('qa_demo') === 'true' ||
        process.env.NEXT_PUBLIC_ENABLE_QA_SIMULATION === 'true'
      ) {
        setIsDemoMode(true);
      }
    }
  }, []);

  // Primary Data Loading Effect
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      // In demo mode, load simulated fixture data for QA verification
      if (isDemoMode) {
        if (mounted) {
          setMessages(DEMO_INITIAL_MESSAGES);
          setIsLoadingTickets(false);
          setTicketError(null);
        }
        return;
      }

      // If authentication has resolved and user is unauthenticated, stop loading
      if (!isAuthLoading && (!isAuthenticated || !token)) {
        if (mounted) {
          setIsLoadingTickets(false);
          setMessages([]);
        }
        return;
      }

      if (!isAuthenticated || !token) return;

      setIsLoadingTickets(true);
      setTicketError(null);

      try {
        const res = await supportFrontendService.getMyTickets(undefined, token);
        if (!mounted) return;

        if (res.items.length > 0) {
          const t = res.items[0];
          if (t) {
            setActiveTicket(t);
            setTicketStatus(
              t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'RESOLVED' : 'IN_INVESTIGATION',
            );
            if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
              setQaState('closed');
            }

            const msgRes = await supportFrontendService.getMessages(t.id, undefined, token);
            if (mounted) {
              setMessages(msgRes.items.map(mapToUiMessage));
            }
          }
        } else {
          setActiveTicket(null);
          setMessages([]);
        }
      } catch (err: any) {
        if (mounted) {
          setTicketError(
            err.message || 'Unable to load support inquiries from Trust & Safety desk.',
          );
          setActiveTicket(null);
          setMessages([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingTickets(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, token, isAuthLoading, isDemoMode]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !inputMessage.trim() ||
      isSubmitting ||
      ticketStatus === 'RESOLVED' ||
      qaState === 'closed'
    ) {
      return;
    }

    const messageText = inputMessage.trim();
    setSendError(null);

    // In demo mode: simulate client message
    if (isDemoMode) {
      const demoMsg: SupportMessage = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        authorName: user
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Kavya Nair'
          : 'Kavya Nair',
        authorRole: 'Studio Atelier',
        time: 'Just now',
        text: messageText,
      };
      setMessages((prev) => [...prev, demoMsg]);
      setInputMessage('');
      return;
    }

    if (!activeTicket || !token) {
      setSendError('No active support ticket available.');
      return;
    }

    setIsSubmitting(true);
    try {
      const persisted = await supportFrontendService.sendMessage(
        activeTicket.id,
        { body: messageText },
        token,
      );
      setMessages((prev) => [...prev, mapToUiMessage(persisted)]);
      setInputMessage('');
    } catch (err: any) {
      setSendError(err.message || 'Message delivery failed. Please verify your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveTicket = async () => {
    setResolveError(null);

    // In demo mode: simulate local resolution
    if (isDemoMode) {
      setTicketStatus('RESOLVED');
      setQaState('closed');
      return;
    }

    if (!activeTicket || !token) {
      setResolveError('No active ticket to resolve.');
      return;
    }

    setIsResolving(true);
    try {
      const resolved = await supportFrontendService.resolveTicket(activeTicket.id, token);
      setActiveTicket(resolved);
      setTicketStatus('RESOLVED');
      setQaState('closed');
    } catch (err: any) {
      setResolveError(err.message || 'Failed to mark inquiry resolved.');
    } finally {
      setIsResolving(false);
    }
  };

  // Render Authentication Required Screen when unauthenticated outside explicit demo mode
  if (!isAuthLoading && !isAuthenticated && !isDemoMode) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col font-sans selection:bg-[#FFD64A] selection:text-[#14110F]">
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-16 flex flex-col items-center justify-center">
          <div className="w-full bg-white rounded-3xl border border-[#E7E0D5] p-8 sm:p-12 shadow-sm flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-[#C9B6F7] text-[#14110F] flex items-center justify-center border border-[#14110F] shadow-[2px_2px_0px_#14110F]">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-2 max-w-md">
              <span className="inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#725C00] bg-[#FAF2EE] px-3 py-1 rounded-full border border-[#E7E0D5]">
                <Lock className="w-3.5 h-3.5" /> Authentication Required
              </span>
              <h1 className="font-black text-2xl sm:text-3xl text-[#14110F]">
                CreatorConnect Official Support Desk
              </h1>
              <p className="text-sm text-[#4D4634] leading-relaxed">
                Trust &amp; Safety channels are strictly authenticated to protect creator payment
                ledgers, escrow releases, and milestone arbitration data.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-sm pt-4 border-t border-[#E7E0D5]">
              <Link
                href="/login?redirect=/support"
                className="w-full py-3 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] shadow-[1px_1px_0px_#14110F] hover:brightness-95 transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Access Desk</span>
              </Link>
              <Link
                href="/messages"
                className="w-full py-3 rounded-full bg-[#FAF2EE] text-[#14110F] font-bold text-xs uppercase tracking-wider border border-[#E7E0D5] hover:bg-white transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Inbox</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayTicketNumber = activeTicket
    ? activeTicket.ticketNumber
    : isDemoMode
      ? '#SUP-2025-0419'
      : 'No Ticket Selected';

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col font-sans selection:bg-[#FFD64A] selection:text-[#14110F]">
      {/* QA Test Harness Rig Bar - Strictly Restricted to Non-Production Demo Mode */}
      {isDemoMode && (
        <aside
          aria-label="QA Test Harness"
          className="w-full bg-[#EFE6E3] border-b border-[#E7E0D5] px-4 sm:px-8 py-2 z-30"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#725C00] animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-[#4D4634]">
                Simulate Inquiry State (QA Rig) • Module I07 Support Chat
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5" role="tablist">
              {(
                [
                  { id: 'active', label: 'Active Thread (Default)' },
                  { id: 'empty', label: 'No Messages Yet' },
                  { id: 'uploading', label: 'Sending / Uploading' },
                  { id: 'failed', label: 'Send Failed (Retry)' },
                  { id: 'closed', label: 'Ticket Resolved / Closed' },
                  { id: 'network-error', label: 'Network Error' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  role="tab"
                  aria-selected={qaState === st.id}
                  onClick={() => setQaState(st.id)}
                  className={`px-3 py-1 rounded-full font-bold uppercase text-[11px] tracking-wider transition-all ${
                    qaState === st.id
                      ? 'bg-[#14110F] text-[#FAF6EF] shadow-sm'
                      : 'bg-white/80 hover:bg-white text-[#4D4634] border border-[#E7E0D5]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Top Context & Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6F675E]">
            <Link href="/messages" className="hover:text-[#14110F] transition-colors">
              Inbox (I01)
            </Link>
            <span>/</span>
            <span className="text-[#14110F] font-bold">Official Support (I07)</span>
            <span>/</span>
            <span className="px-2 py-0.5 rounded bg-[#FAF2EE] text-[#14110F] font-mono text-[11px] font-bold border border-[#E7E0D5]">
              {displayTicketNumber}
            </span>
          </div>

          <Link
            href="/messages"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to All Conversations</span>
          </Link>
        </div>

        {/* API Error Alert State */}
        {ticketError && (
          <div className="p-4 rounded-2xl bg-[#FFDAD6] border border-[#FFB4AB] flex items-center justify-between gap-4 text-xs text-[#BA1A1A]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{ticketError}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 rounded-full bg-[#14110F] text-white font-bold uppercase tracking-wider text-[11px] hover:brightness-110"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Main Viewport Grid (68% / 32%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Main Conversation Pane (8 cols of 12) */}
          <main className="lg:col-span-8 flex flex-col bg-white rounded-3xl border border-[#E7E0D5] shadow-sm overflow-hidden">
            {/* Thread Support Banner */}
            <header className="p-6 bg-[#FAF2EE] border-b border-[#E7E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#C9B6F7] text-[#14110F] flex items-center justify-center shrink-0 border border-[#14110F] shadow-[1px_1px_0px_#14110F]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-black text-lg text-[#14110F]">
                      CreatorConnect Official Support
                    </h1>
                    <span className="inline-flex items-center gap-1 bg-[#D0BCFE] text-[#14110F] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <Shield className="w-3 h-3" /> Desk Verified
                    </span>
                  </div>
                  <p className="text-xs text-[#4D4634] mt-0.5">
                    Direct administrative channel for milestone disbursements, escrow
                    reconciliation, and contract validation.
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-[#E7E0D5] shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#2E9E6B] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#14110F]">
                  Secure Channel
                </span>
              </div>
            </header>

            {/* Channel Safety Notice Banner */}
            <div className="px-6 py-2.5 bg-[#EFE6E3] border-b border-[#E7E0D5] flex items-center gap-2 text-xs text-[#4D4634]">
              <Lock className="w-3.5 h-3.5 text-[#864D5D] shrink-0" />
              <span>
                All communications are logged for audit compliance and monitored exclusively by the
                Trust &amp; Safety team.
              </span>
            </div>

            {/* Loading Tickets State */}
            {isLoadingTickets && (
              <div className="p-16 flex flex-col items-center justify-center gap-3 text-center">
                <RefreshCw className="w-8 h-8 text-[#725C00] animate-spin" />
                <p className="font-bold text-xs uppercase tracking-wider text-[#4D4634]">
                  Connecting to Trust &amp; Safety Desk...
                </p>
              </div>
            )}

            {/* Legitimate Empty State: Authenticated with no tickets */}
            {!isLoadingTickets && !ticketError && !activeTicket && !isDemoMode && (
              <div className="p-16 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#FFD64A]/30 text-[#725C00] flex items-center justify-center">
                  <HelpCircle className="w-7 h-7" />
                </div>
                <div className="flex flex-col gap-1 max-w-sm">
                  <h3 className="font-black text-base text-[#14110F]">No Active Inquiries</h3>
                  <p className="text-xs text-[#6F675E]">
                    You have no active support tickets or escrow reconciliation disputes with Trust
                    &amp; Safety.
                  </p>
                </div>
                <Link
                  href="/messages"
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] shadow-[1px_1px_0px_#14110F]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Return to Messages</span>
                </Link>
              </div>
            )}

            {/* QA STATE: Network Error */}
            {isDemoMode && qaState === 'network-error' && (
              <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[#FFDAD6] text-[#BA1A1A] flex items-center justify-center">
                  <WifiOff className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base text-[#14110F]">
                  Support Network Connection Lost
                </h3>
                <p className="text-xs text-[#6F675E] max-w-sm">
                  We could not establish a real-time link with the Trust &amp; Safety desk. Your
                  messages will queue locally.
                </p>
                <button
                  onClick={() => setQaState('active')}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#14110F] text-[#FAF6EF] font-bold text-xs uppercase tracking-wider"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reconnect Desk</span>
                </button>
              </div>
            )}

            {/* QA STATE: No Messages Yet */}
            {isDemoMode && qaState === 'empty' && (
              <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#FFD64A]/30 text-[#725C00] flex items-center justify-center">
                  <HelpCircle className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base text-[#14110F]">
                  Ticket {displayTicketNumber} Created
                </h3>
                <p className="text-xs text-[#6F675E] max-w-sm">
                  Type your message below to connect with a Trust &amp; Safety specialist regarding
                  your project or escrow inquiry.
                </p>
              </div>
            )}

            {/* Messages Viewport */}
            {!isLoadingTickets &&
              (activeTicket || isDemoMode) &&
              qaState !== 'network-error' &&
              qaState !== 'empty' && (
                <div className="p-6 flex flex-col gap-5 max-h-[500px] overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      {msg.sender === 'system' ? (
                        <div className="w-full my-2 p-3.5 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] flex items-center gap-3 text-xs text-[#4D4634]">
                          <CheckCircle2 className="w-4 h-4 text-[#2E9E6B] shrink-0" />
                          <span className="font-mono text-[11px]">{msg.text}</span>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[85%] rounded-3xl p-4 flex flex-col gap-1.5 shadow-xs ${
                            msg.sender === 'user'
                              ? 'bg-[#FFD64A] text-[#14110F] border border-[#14110F] rounded-tr-xs'
                              : 'bg-[#FAF2EE] text-[#14110F] border border-[#E7E0D5] rounded-tl-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px]">
                            <span className="font-bold uppercase tracking-wider">
                              {msg.authorName}
                            </span>
                            <span className="opacity-75">{msg.time}</span>
                          </div>

                          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.text}
                          </p>

                          {msg.attachment && (
                            <div className="mt-2 p-2.5 rounded-2xl bg-white border border-[#E7E0D5] flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-[#725C00]" />
                                <div className="flex flex-col text-left">
                                  <span className="font-bold text-[11px] text-[#14110F]">
                                    {msg.attachment.name}
                                  </span>
                                  <span className="text-[9px] text-[#6F675E]">
                                    {msg.attachment.size} • {msg.attachment.type}
                                  </span>
                                </div>
                              </div>
                              <button
                                className="p-1 rounded-full hover:bg-[#FAF2EE] text-[#14110F]"
                                aria-label="Download attachment"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {qaState === 'uploading' && (
                    <div className="flex items-center gap-2 text-xs text-[#6F675E] italic">
                      <span className="w-2 h-2 rounded-full bg-[#FFD64A] animate-ping" />
                      <span>Uploading attachment (Escrow_Proof.png)...</span>
                    </div>
                  )}

                  {qaState === 'failed' && (
                    <div className="p-3 rounded-2xl bg-[#FFDAD6] border border-[#FFB4AB] flex items-center justify-between gap-3 text-xs text-[#BA1A1A]">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Message delivery failed due to network timeout.</span>
                      </div>
                      <button
                        onClick={() => setQaState('active')}
                        className="font-bold underline uppercase tracking-wider"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* Send Error Notice */}
            {sendError && (
              <div className="mx-6 mb-2 p-3 rounded-2xl bg-[#FFDAD6] border border-[#FFB4AB] flex items-center justify-between gap-3 text-xs text-[#BA1A1A]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{sendError}</span>
                </div>
                <button
                  onClick={() => setSendError(null)}
                  className="font-bold underline text-[11px] uppercase"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Chat Composer Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-[#FAF2EE] border-t border-[#E7E0D5] flex items-center gap-3"
            >
              <button
                type="button"
                className="p-2.5 rounded-full hover:bg-white text-[#6F675E] hover:text-[#14110F] transition-colors border border-transparent hover:border-[#E7E0D5]"
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                disabled={
                  isLoadingTickets ||
                  (!activeTicket && !isDemoMode) ||
                  ticketStatus === 'RESOLVED' ||
                  qaState === 'closed'
                }
                placeholder={
                  ticketStatus === 'RESOLVED' || qaState === 'closed'
                    ? 'This support inquiry has been resolved and closed.'
                    : !activeTicket && !isDemoMode
                      ? 'No active inquiry selected.'
                      : 'Type official response or inquiry update...'
                }
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 h-11 px-4 rounded-full bg-white border border-[#E7E0D5] text-xs text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] disabled:bg-[#EFE6E3] disabled:text-[#6F675E]"
              />

              <button
                type="submit"
                disabled={
                  !inputMessage.trim() ||
                  isLoadingTickets ||
                  (!activeTicket && !isDemoMode) ||
                  ticketStatus === 'RESOLVED' ||
                  qaState === 'closed' ||
                  isSubmitting
                }
                className="h-11 px-6 rounded-full bg-[#FFD64A] disabled:bg-[#D8D1C6] text-[#14110F] font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] shadow-[1px_1px_0px_#14110F] hover:brightness-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </main>

          {/* Right Column: Ticket Metadata Rail (4 cols of 12) */}
          <aside className="lg:col-span-4 flex flex-col gap-6 w-full">
            {/* Case Summary Card */}
            <div className="rounded-3xl bg-white border border-[#E7E0D5] p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-3">
                <span className="font-mono text-xs font-bold text-[#14110F]">
                  {displayTicketNumber}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    ticketStatus === 'RESOLVED' || qaState === 'closed'
                      ? 'bg-[#B6E09B] text-[#14110F]'
                      : 'bg-[#FFD64A] text-[#14110F]'
                  }`}
                >
                  {ticketStatus === 'RESOLVED' || qaState === 'closed'
                    ? 'Resolved'
                    : 'In Investigation'}
                </span>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <span className="text-[#6F675E]">Inquiry Subject</span>
                  <p className="font-bold text-[#14110F]">
                    {activeTicket?.subject ||
                      (isDemoMode
                        ? 'Milestone #MS-02 Disbursement Reconciliation'
                        : 'No Active Case')}
                  </p>
                </div>

                <div>
                  <span className="text-[#6F675E]">Linked Assignment</span>
                  <p className="font-bold text-[#14110F] flex items-center gap-1">
                    <span>
                      {activeTicket?.linkedAssignmentId
                        ? `#${activeTicket.linkedAssignmentId.slice(0, 8)}`
                        : isDemoMode
                          ? '#PRJ-8841 (Monsoon Lookbook 2026)'
                          : 'None'}
                    </span>
                    {(activeTicket?.linkedAssignmentId || isDemoMode) && (
                      <Link
                        href={
                          activeTicket?.linkedAssignmentId
                            ? `/assignments/${activeTicket.linkedAssignmentId}`
                            : '/assignments/PRJ-8841'
                        }
                        className="text-[#725C00]"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-[#6F675E]">Escrow Amount</span>
                  <p className="font-black text-sm text-[#14110F]">
                    {activeTicket?.escrowAmount !== null && activeTicket?.escrowAmount !== undefined
                      ? `₹${activeTicket.escrowAmount.toLocaleString('en-IN')} INR`
                      : isDemoMode
                        ? '₹1,20,000 INR'
                        : 'N/A'}
                  </p>
                </div>

                <div>
                  <span className="text-[#6F675E]">Assigned Desk</span>
                  <p className="font-bold text-[#14110F]">
                    {activeTicket?.assignedTo
                      ? `Trust & Safety Desk (${[activeTicket.assignedTo.firstName, activeTicket.assignedTo.lastName].filter(Boolean).join(' ')})`
                      : isDemoMode
                        ? 'Trust & Safety Desk 4 (Anya Sen)'
                        : 'Unassigned (Pending Triage)'}
                  </p>
                </div>

                <div>
                  <span className="text-[#6F675E]">Target Resolution SLA</span>
                  <p className="font-bold text-[#2E9E6B] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>&lt; 2 Banking Hours</span>
                  </p>
                </div>
              </div>

              {/* Resolution Error Alert */}
              {resolveError && (
                <div className="p-3 rounded-2xl bg-[#FFDAD6] border border-[#FFB4AB] text-xs text-[#BA1A1A]">
                  <span>{resolveError}</span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t border-[#E7E0D5]">
                <button
                  onClick={() => alert('Official audit transcript exported (PDF).')}
                  className="w-full py-2.5 rounded-full bg-[#FAF2EE] hover:bg-[#F5ECE8] text-[#14110F] font-bold text-xs uppercase tracking-wider border border-[#E7E0D5] flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Audit Transcript</span>
                </button>

                {(activeTicket || isDemoMode) &&
                  ticketStatus !== 'RESOLVED' &&
                  qaState !== 'closed' && (
                    <button
                      onClick={handleResolveTicket}
                      disabled={isResolving}
                      className="w-full py-2.5 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs uppercase tracking-wider border border-[#14110F] shadow-[1px_1px_0px_#14110F] disabled:opacity-50"
                    >
                      {isResolving ? 'Resolving...' : 'Mark Inquiry Resolved'}
                    </button>
                  )}
              </div>
            </div>

            {/* Platform Trust & Safety Guarantee Box */}
            <div className="rounded-3xl bg-[#FAF2EE] border border-[#E7E0D5] p-6 flex flex-col gap-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#14110F] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#725C00]" />
                <span>Arbitration &amp; Escrow Guarantee</span>
              </h4>
              <p className="text-xs text-[#6F675E] leading-relaxed">
                CreatorConnect guarantees all milestone funds deposited in platform escrow.
                Arbitrators possess statutory dispute powers under Rule 14 of the CreatorConnect
                Terms of Service.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
