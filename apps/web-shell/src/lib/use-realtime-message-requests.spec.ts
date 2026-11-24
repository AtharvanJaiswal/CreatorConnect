import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupRealtimeMessageRequestsSession } from './use-realtime-message-requests';

describe('Realtime Message Requests Session Manager (Milestone 2D)', () => {
  let mockSocket: any;
  let listeners: Record<string, (...args: any[]) => void>;
  let mockClientFactory: any;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};

    mockSocket = {
      connected: false,
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        listeners[event] = cb;
      }),
      off: vi.fn((event: string) => {
        delete listeners[event];
      }),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      disconnect: vi.fn(),
    };

    mockClientFactory = vi.fn().mockReturnValue(mockSocket);
  });

  it('connects to realtime server and registers all 5 lifecycle listeners', () => {
    const onEvent = vi.fn();
    const onStatusChange = vi.fn();

    const session = setupRealtimeMessageRequestsSession({
      accessToken: 'test-user-jwt',
      onEvent,
      onStatusChange,
      realtimeUrl: 'http://localhost:3001',
      clientFactory: mockClientFactory,
    });

    expect(mockClientFactory).toHaveBeenCalledWith(
      'http://localhost:3001',
      expect.objectContaining({
        auth: { token: 'test-user-jwt' },
        transports: ['websocket', 'polling'],
        reconnection: true,
      }),
    );

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message_request:created', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message_request:accepted', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message_request:declined', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message_request:cancelled', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message_request:expired', expect.any(Function));

    session.disconnect();
  });

  it('forwards message_request:created and message_request:accepted events', () => {
    const onEvent = vi.fn();

    const session = setupRealtimeMessageRequestsSession({
      accessToken: 'test-user-jwt',
      onEvent,
      realtimeUrl: 'http://localhost:3001',
      clientFactory: mockClientFactory,
    });

    // Simulate created event
    listeners['message_request:created']?.({
      eventId: 'evt-1',
      requestId: 'req-1',
      senderId: 'user-a',
      recipientId: 'user-b',
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'message_request:created',
        requestId: 'req-1',
      }),
    );

    // Simulate accepted event
    listeners['message_request:accepted']?.({
      eventId: 'evt-2',
      requestId: 'req-1',
      conversationId: 'conv-100',
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'message_request:accepted',
        conversationId: 'conv-100',
      }),
    );

    session.disconnect();
  });

  it('deduplicates events when same eventId is delivered twice', () => {
    const onEvent = vi.fn();

    const session = setupRealtimeMessageRequestsSession({
      accessToken: 'test-user-jwt',
      onEvent,
      realtimeUrl: 'http://localhost:3001',
      clientFactory: mockClientFactory,
    });

    // Send twice
    listeners['message_request:created']?.({
      eventId: 'duplicate-evt-id',
      requestId: 'req-dup',
    });
    listeners['message_request:created']?.({
      eventId: 'duplicate-evt-id',
      requestId: 'req-dup',
    });

    expect(onEvent).toHaveBeenCalledTimes(1);

    session.disconnect();
  });

  it('triggers onReconnect when connection is restored after a disconnect', () => {
    const onReconnect = vi.fn();

    const session = setupRealtimeMessageRequestsSession({
      accessToken: 'test-user-jwt',
      onReconnect,
      realtimeUrl: 'http://localhost:3001',
      clientFactory: mockClientFactory,
    });

    // First connect
    listeners['connect']?.();
    expect(onReconnect).not.toHaveBeenCalled();

    // Disconnect
    listeners['disconnect']?.();

    // Reconnect
    listeners['connect']?.();
    expect(onReconnect).toHaveBeenCalledTimes(1);

    session.disconnect();
  });

  it('cleanly removes all event listeners on disconnect', () => {
    const session = setupRealtimeMessageRequestsSession({
      accessToken: 'test-user-jwt',
      realtimeUrl: 'http://localhost:3001',
      clientFactory: mockClientFactory,
    });

    session.disconnect();

    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('message_request:created', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('message_request:accepted', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('message_request:declined', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('message_request:cancelled', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('message_request:expired', expect.any(Function));
  });
});
