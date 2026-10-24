'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io as createClient, type Socket } from 'socket.io-client';

export interface RealtimeMessageCreatedEvent {
  eventId?: string;
  eventType?: string;
  messageId: string;
  conversationId: string;
  senderId: string;
  sequence: string;
  clientMessageId: string;
  content: string;
  attachmentCount?: number;
  createdAt: string;
  attachments?: any[];
  deletedAt?: string | null;
  status?: string;
}

export interface RealtimeStatus {
  isConnected: boolean;
  isBlocked: boolean;
  error: string | null;
}

export interface RealtimeSessionOptions {
  conversationId: string;
  accessToken: string;
  onMessageCreated?: (event: RealtimeMessageCreatedEvent) => void;
  onStatusChange?: (status: RealtimeStatus) => void;
  realtimeUrl?: string | null;
  clientFactory?: typeof createClient;
}

export interface RealtimeSessionHandle {
  disconnect: () => void;
  syncMessages: (
    sinceSequence: string,
  ) => Promise<{ messages: any[]; latestSequence: string } | null>;
  getSocket: () => Socket;
}

export interface UseRealtimeChatOptions {
  conversationId: string | null;
  accessToken: string | null;
  onMessageCreated?: (event: RealtimeMessageCreatedEvent) => void;
  enabled?: boolean;
}

export interface UseRealtimeChatResult {
  isConnected: boolean;
  isConnecting: boolean;
  isBlocked: boolean;
  error: string | null;
  syncMessages: (
    sinceSequence: string,
  ) => Promise<{ messages: any[]; latestSequence: string } | null>;
}

export const getRealtimeServerUrl = (): string | null => {
  const envUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    try {
      const parsed = new URL(envUrl.trim());
      if (['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
        return envUrl.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  // In production, strictly reject localhost and guessed hostname fallbacks
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Safe fallback strictly for local development and non-production testing
  return 'http://localhost:3001';
};

interface SharedSocketEntry {
  socket: Socket;
  refCount: number;
}
const sharedSocketPool = new Map<string, SharedSocketEntry>();

export function clearSharedSocketPoolForTesting(): void {
  for (const entry of sharedSocketPool.values()) {
    entry.socket.removeAllListeners();
    entry.socket.disconnect();
  }
  sharedSocketPool.clear();
}

/**
 * Reuses or establishes a single authenticated Socket.IO connection per server URL and token.
 * Reference-counted to safely disconnect only when all active consumers unmount.
 */
export function getOrCreateSharedSocket(
  resolvedUrl: string,
  accessToken: string,
  clientFactory: typeof createClient = createClient,
): { socket: Socket; release: () => void } {
  const poolKey = `${resolvedUrl}::${accessToken}`;
  let entry = sharedSocketPool.get(poolKey);

  if (!entry) {
    const socket = clientFactory(resolvedUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    entry = { socket, refCount: 0 };
    sharedSocketPool.set(poolKey, entry);
  }

  entry.refCount++;

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const currentEntry = sharedSocketPool.get(poolKey);
    if (!currentEntry) return;

    currentEntry.refCount--;
    if (currentEntry.refCount <= 0) {
      currentEntry.socket.removeAllListeners();
      currentEntry.socket.disconnect();
      sharedSocketPool.delete(poolKey);
    }
  };

  return { socket: entry.socket, release };
}

/**
 * Pure session manager for Socket.IO realtime connection lifecycle.
 * Enforces room joining, verified event listening, block detection, and clean teardown.
 */
export function setupRealtimeChatSession({
  conversationId,
  accessToken,
  onMessageCreated,
  onStatusChange,
  realtimeUrl,
  clientFactory = createClient,
}: RealtimeSessionOptions): RealtimeSessionHandle {
  const resolvedUrl = realtimeUrl !== undefined ? realtimeUrl : getRealtimeServerUrl();

  if (!resolvedUrl) {
    onStatusChange?.({
      isConnected: false,
      isBlocked: false,
      error: 'Realtime service URL not configured. Realtime features unavailable.',
    });
    return {
      disconnect: () => {},
      syncMessages: async () => null,
      getSocket: () => null as unknown as Socket,
    };
  }

  const socket = clientFactory(resolvedUrl, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 5000,
  });

  const handleConnect = () => {
    onStatusChange?.({ isConnected: true, isBlocked: false, error: null });

    // Join authorized conversation room
    socket.emit(
      'conversation:join',
      { conversationId },
      (ack?: {
        success: boolean;
        data?: { conversationId: string };
        error?: { code: string; message: string };
      }) => {
        if (ack && !ack.success && ack.error) {
          const isBlocked = ack.error.code === 'USER_BLOCKED';
          onStatusChange?.({
            isConnected: !isBlocked,
            isBlocked,
            error: ack.error.message || 'Failed to join conversation room.',
          });
        }
      },
    );
  };

  const handleConnectError = (err: Error) => {
    onStatusChange?.({
      isConnected: false,
      isBlocked: false,
      error: err.message || 'Realtime connection error',
    });
  };

  const handleDisconnect = () => {
    onStatusChange?.({ isConnected: false, isBlocked: false, error: null });
  };

  const handleMessageCreated = (payload: RealtimeMessageCreatedEvent) => {
    if (payload && payload.conversationId === conversationId) {
      onMessageCreated?.(payload);
    }
  };

  socket.on('connect', handleConnect);
  socket.on('connect_error', handleConnectError);
  socket.on('disconnect', handleDisconnect);
  socket.on('message:created', handleMessageCreated);

  const syncMessages = async (
    sinceSequence: string,
  ): Promise<{ messages: any[]; latestSequence: string } | null> => {
    if (!socket.connected) return null;

    return new Promise((resolve) => {
      socket.emit(
        'conversation:sync',
        { conversationId, sinceSequence },
        (ack: {
          success: boolean;
          data?: { messages: any[]; latestSequence: string };
          error?: { code: string; message: string };
        }) => {
          if (ack && ack.success && ack.data) {
            resolve(ack.data);
          } else {
            resolve(null);
          }
        },
      );
    });
  };

  const disconnect = () => {
    if (socket.connected) {
      socket.emit('conversation:leave', { conversationId });
    }
    if (typeof socket.off === 'function') {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:created', handleMessageCreated);
    }
    if (typeof socket.removeAllListeners === 'function') {
      socket.removeAllListeners();
    }
    if (typeof socket.disconnect === 'function') {
      socket.disconnect();
    }
  };

  return {
    disconnect,
    syncMessages,
    getSocket: () => socket,
  };
}

/**
 * Verified Realtime Chat Hook for Module I Messaging.
 * Connects to the CreatorConnect realtime cluster, joins the authorized conversation room,
 * listens for verified `message:created` events, and manages clean lifecycle and teardown.
 */
export function useRealtimeChat({
  conversationId,
  accessToken,
  onMessageCreated,
  enabled = true,
}: UseRealtimeChatOptions): UseRealtimeChatResult {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<RealtimeSessionHandle | null>(null);
  const onMessageCreatedRef = useRef(onMessageCreated);
  onMessageCreatedRef.current = onMessageCreated;

  const syncMessages = useCallback(
    async (sinceSequence: string): Promise<{ messages: any[]; latestSequence: string } | null> => {
      if (!sessionRef.current) return null;
      return await sessionRef.current.syncMessages(sinceSequence);
    },
    [],
  );

  useEffect(() => {
    if (!enabled || !conversationId || !accessToken) {
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    setError(null);
    setIsBlocked(false);

    const session = setupRealtimeChatSession({
      conversationId,
      accessToken,
      onMessageCreated: (event) => onMessageCreatedRef.current?.(event),
      onStatusChange: (status) => {
        setIsConnected(status.isConnected);
        setIsBlocked(status.isBlocked);
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
  }, [conversationId, accessToken, enabled]);

  return {
    isConnected,
    isConnecting,
    isBlocked,
    error,
    syncMessages,
  };
}
