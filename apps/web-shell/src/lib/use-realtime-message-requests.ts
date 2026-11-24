'use client';

import { useEffect, useRef, useState } from 'react';
import { io as createClient, type Socket } from 'socket.io-client';
import { getRealtimeServerUrl, getOrCreateSharedSocket } from './use-realtime-chat';

export interface RealtimeMessageRequestEvent {
  eventId?: string;
  eventType: string;
  aggregateId?: string;
  requestId: string;
  senderId?: string;
  recipientId?: string;
  conversationId?: string | null;
  expiresAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
}

export interface RealtimeStatus {
  isConnected: boolean;
  error: string | null;
}

export interface MessageRequestRealtimeOptions {
  accessToken: string;
  onEvent?: (event: RealtimeMessageRequestEvent) => void;
  onStatusChange?: (status: RealtimeStatus) => void;
  onReconnect?: () => void;
  realtimeUrl?: string | null;
  clientFactory?: typeof createClient;
}

export interface MessageRequestRealtimeHandle {
  disconnect: () => void;
  getSocket: () => Socket;
}

export interface UseRealtimeMessageRequestsOptions {
  accessToken: string | null;
  onEvent?: (event: RealtimeMessageRequestEvent) => void;
  onReconnect?: () => void;
  enabled?: boolean;
}

export interface UseRealtimeMessageRequestsResult {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

/**
 * Pure session manager for MessageRequest lifecycle event subscriptions.
 * Reuses the shared authenticated Socket.IO connection to eliminate duplicate transports.
 * Subscribes to the 5 lifecycle events: created, accepted, declined, cancelled, expired.
 */
export function setupRealtimeMessageRequestsSession({
  accessToken,
  onEvent,
  onStatusChange,
  onReconnect,
  realtimeUrl,
  clientFactory = createClient,
}: MessageRequestRealtimeOptions): MessageRequestRealtimeHandle {
  const resolvedUrl = realtimeUrl !== undefined ? realtimeUrl : getRealtimeServerUrl();

  if (!resolvedUrl) {
    onStatusChange?.({
      isConnected: false,
      error:
        'Realtime service URL not configured. Realtime message request notifications unavailable.',
    });
    return {
      disconnect: () => {},
      getSocket: () => null as unknown as Socket,
    };
  }

  const { socket, release } = getOrCreateSharedSocket(resolvedUrl, accessToken, clientFactory);

  // In-memory deduplication cache for outbox events (up to 100 recent IDs)
  const processedEventIds = new Set<string>();

  const handleMessageRequestEvent = (eventType: string) => (payload: any) => {
    if (!payload || typeof payload !== 'object') return;

    const eventId = payload.eventId;
    if (eventId && processedEventIds.has(eventId)) {
      return; // Deduplicate repeated realtime delivery
    }
    if (eventId) {
      if (processedEventIds.size >= 100) {
        const firstKey = processedEventIds.values().next().value;
        if (firstKey) processedEventIds.delete(firstKey);
      }
      processedEventIds.add(eventId);
    }

    onEvent?.({
      ...payload,
      eventType,
    });
  };

  let wasConnected = false;

  const handleConnect = () => {
    onStatusChange?.({ isConnected: true, error: null });
    if (wasConnected) {
      // Reconnect occurred: invoke onReconnect to resync authoritative API state
      onReconnect?.();
    }
    wasConnected = true;
  };

  const handleConnectError = (err: Error) => {
    onStatusChange?.({
      isConnected: false,
      error: err.message || 'Realtime connection error',
    });
  };

  const handleDisconnect = () => {
    onStatusChange?.({ isConnected: false, error: null });
  };

  const onCreated = handleMessageRequestEvent('message_request:created');
  const onAccepted = handleMessageRequestEvent('message_request:accepted');
  const onDeclined = handleMessageRequestEvent('message_request:declined');
  const onCancelled = handleMessageRequestEvent('message_request:cancelled');
  const onExpired = handleMessageRequestEvent('message_request:expired');

  socket.on('connect', handleConnect);
  socket.on('connect_error', handleConnectError);
  socket.on('disconnect', handleDisconnect);

  socket.on('message_request:created', onCreated);
  socket.on('message_request:accepted', onAccepted);
  socket.on('message_request:declined', onDeclined);
  socket.on('message_request:cancelled', onCancelled);
  socket.on('message_request:expired', onExpired);

  // If already connected when this session attaches
  if (socket.connected) {
    handleConnect();
  }

  const disconnect = () => {
    socket.off('connect', handleConnect);
    socket.off('connect_error', handleConnectError);
    socket.off('disconnect', handleDisconnect);

    socket.off('message_request:created', onCreated);
    socket.off('message_request:accepted', onAccepted);
    socket.off('message_request:declined', onDeclined);
    socket.off('message_request:cancelled', onCancelled);
    socket.off('message_request:expired', onExpired);

    release();
  };

  return {
    disconnect,
    getSocket: () => socket,
  };
}

/**
 * React hook for subscribing to realtime message request events in the web shell.
 * Connects to the user's private notification channel, updates request list state live,
 * and refetches authoritative state on reconnect.
 */
export function useRealtimeMessageRequests({
  accessToken,
  onEvent,
  onReconnect,
  enabled = true,
}: UseRealtimeMessageRequestsOptions): UseRealtimeMessageRequestsResult {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<MessageRequestRealtimeHandle | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!enabled || !accessToken) {
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    setError(null);

    const session = setupRealtimeMessageRequestsSession({
      accessToken,
      onEvent: (event) => onEventRef.current?.(event),
      onReconnect: () => onReconnectRef.current?.(),
      onStatusChange: (status) => {
        setIsConnected(status.isConnected);
        setError(status.error);
        setIsConnecting(false);
      },
    });

    sessionRef.current = session;

    return () => {
      session.disconnect();
      sessionRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    };
  }, [accessToken, enabled]);

  return {
    isConnected,
    isConnecting,
    error,
  };
}
