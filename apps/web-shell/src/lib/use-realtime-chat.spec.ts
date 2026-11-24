import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupRealtimeChatSession, getRealtimeServerUrl } from './use-realtime-chat';

describe('Realtime Chat Session Manager (Module I / Milestone 2)', () => {
  let mockSocket: any;
  let listeners: Record<string, (...args: any[]) => void>;
  let mockClientFactory: any;
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};

    mockSocket = {
      connected: true,
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        listeners[event] = cb;
      }),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      disconnect: vi.fn(),
    };

    mockClientFactory = vi.fn().mockReturnValue(mockSocket);
  });

  it('creates socket with authorization token and transport options', () => {
    setupRealtimeChatSession({
      conversationId: 'conv-123',
      accessToken: 'jwt-auth-token',
      realtimeUrl: 'http://localhost:3001',
      clientFactory: mockClientFactory,
    });

    expect(mockClientFactory).toHaveBeenCalledWith(
      'http://localhost:3001',
      expect.objectContaining({
        auth: { token: 'jwt-auth-token' },
        transports: ['websocket', 'polling'],
        reconnection: true,
      }),
    );
  });

  it('emits conversation:join on socket connect and updates status', () => {
    const onStatusChange = vi.fn();
    setupRealtimeChatSession({
      conversationId: 'conv-123',
      accessToken: 'jwt-auth-token',
      onStatusChange,
      clientFactory: mockClientFactory,
    });

    // Trigger connect event
    listeners['connect']?.();

    expect(onStatusChange).toHaveBeenCalledWith({
      isConnected: true,
      isBlocked: false,
      error: null,
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'conversation:join',
      { conversationId: 'conv-123' },
      expect.any(Function),
    );
  });

  it('detects USER_BLOCKED ack response and notifies consumer', () => {
    const onStatusChange = vi.fn();

    mockSocket.emit.mockImplementation((event: string, _payload: any, ack?: any) => {
      if (event === 'conversation:join' && typeof ack === 'function') {
        ack({
          success: false,
          error: {
            code: 'USER_BLOCKED',
            message: 'Cannot join room: conversation is blocked.',
          },
        });
      }
    });

    setupRealtimeChatSession({
      conversationId: 'conv-blocked-789',
      accessToken: 'jwt-auth-token',
      onStatusChange,
      clientFactory: mockClientFactory,
    });

    listeners['connect']?.();

    expect(onStatusChange).toHaveBeenCalledWith({
      isConnected: false,
      isBlocked: true,
      error: 'Cannot join room: conversation is blocked.',
    });
  });

  it('forwards message:created events when conversationId matches', () => {
    const onMessageCreated = vi.fn();

    setupRealtimeChatSession({
      conversationId: 'conv-123',
      accessToken: 'jwt-auth-token',
      onMessageCreated,
      clientFactory: mockClientFactory,
    });

    listeners['connect']?.();

    const liveEvent = {
      messageId: 'msg-live-1',
      conversationId: 'conv-123',
      senderId: 'user-rohan',
      sequence: '10',
      clientMessageId: 'cli-uuid-1',
      content: 'Here is the preliminary color grade pass.',
      createdAt: '2026-10-23T10:14:00Z',
    };

    listeners['message:created']?.(liveEvent);
    expect(onMessageCreated).toHaveBeenCalledWith(liveEvent);
  });

  it('ignores message:created events destined for another conversation room', () => {
    const onMessageCreated = vi.fn();

    setupRealtimeChatSession({
      conversationId: 'conv-123',
      accessToken: 'jwt-auth-token',
      onMessageCreated,
      clientFactory: mockClientFactory,
    });

    listeners['connect']?.();

    const otherConvEvent = {
      messageId: 'msg-other-1',
      conversationId: 'conv-999-other',
      senderId: 'user-someone',
      sequence: '1',
      clientMessageId: 'cli-other',
      content: 'Irrelevant message',
      createdAt: '2026-10-23T10:14:00Z',
    };

    listeners['message:created']?.(otherConvEvent);
    expect(onMessageCreated).not.toHaveBeenCalled();
  });

  it('syncMessages invokes conversation:sync and returns missed events', async () => {
    mockSocket.emit.mockImplementation((event: string, payload: any, ack?: any) => {
      if (event === 'conversation:sync' && typeof ack === 'function') {
        expect(payload).toEqual({
          conversationId: 'conv-123',
          sinceSequence: '5',
        });
        ack({
          success: true,
          data: {
            messages: [{ id: 'msg-6', sequence: '6', content: 'Catch up msg' }],
            latestSequence: '6',
          },
        });
      }
    });

    const session = setupRealtimeChatSession({
      conversationId: 'conv-123',
      accessToken: 'jwt-auth-token',
      clientFactory: mockClientFactory,
    });

    const result = await session.syncMessages('5');
    expect(result).toEqual({
      messages: [{ id: 'msg-6', sequence: '6', content: 'Catch up msg' }],
      latestSequence: '6',
    });
  });

  it('disconnect cleanly leaves room and tears down socket listeners', () => {
    const session = setupRealtimeChatSession({
      conversationId: 'conv-123',
      accessToken: 'jwt-auth-token',
      clientFactory: mockClientFactory,
    });

    listeners['connect']?.();

    session.disconnect();

    expect(mockSocket.emit).toHaveBeenCalledWith('conversation:leave', {
      conversationId: 'conv-123',
    });
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  describe('Realtime Configuration Hardening (Stage 1 / Workstream D)', () => {
    it('returns null in production when NEXT_PUBLIC_REALTIME_URL is absent (no localhost/guessing)', () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.NEXT_PUBLIC_REALTIME_URL;

      const url = getRealtimeServerUrl();
      expect(url).toBeNull();
    });

    it('returns null in production when NEXT_PUBLIC_REALTIME_URL is an invalid URL', () => {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.NEXT_PUBLIC_REALTIME_URL = 'not-a-valid-url';

      const url = getRealtimeServerUrl();
      expect(url).toBeNull();
    });

    it('returns valid URL in production when NEXT_PUBLIC_REALTIME_URL is configured properly', () => {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.NEXT_PUBLIC_REALTIME_URL = 'https://realtime.creatorconnect.com';

      const url = getRealtimeServerUrl();
      expect(url).toBe('https://realtime.creatorconnect.com');
    });

    it('falls back safely to localhost:3001 in development/test environment', () => {
      vi.stubEnv('NODE_ENV', 'development');
      delete process.env.NEXT_PUBLIC_REALTIME_URL;

      const url = getRealtimeServerUrl();
      expect(url).toBe('http://localhost:3001');
    });

    it('fails gracefully without connecting when realtimeUrl is null or unconfigured', () => {
      const onStatusChange = vi.fn();

      const session = setupRealtimeChatSession({
        conversationId: 'conv-prod-123',
        accessToken: 'jwt-auth-token',
        realtimeUrl: null,
        onStatusChange,
        clientFactory: mockClientFactory,
      });

      // Socket should NEVER be instantiated
      expect(mockClientFactory).not.toHaveBeenCalled();

      // Non-sensitive visible diagnostic should be reported
      expect(onStatusChange).toHaveBeenCalledWith({
        isConnected: false,
        isBlocked: false,
        error: 'Realtime service URL not configured. Realtime features unavailable.',
      });

      // Session handle should be safe no-op
      expect(() => session.disconnect()).not.toThrow();
    });
  });
});
