import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MessagingWorkflowService,
  formatConversationTime,
  getPeerParticipantId,
  isMessageEditable,
  getMessageEditTimeRemainingMinutes,
  formatMessageTimestamp,
  formatMessageDateSeparator,
  MESSAGE_EDIT_WINDOW_MS,
  categorizeMediaType,
  formatFileSize,
  calculateBackoffDelayMs,
  parseRetryAfterHeader,
  getPeerParticipant,
  getPeerDisplayName,
} from './messaging-workflow-service';
import type {
  DirectConversationResponse,
  AttachmentDownloadResponse,
  CreateReportInput,
} from '@creatorconnect/contracts';

describe('MessagingWorkflowService (Module I / Milestone 1)', () => {
  let service: MessagingWorkflowService;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    service = new MessagingWorkflowService('http://test-api:3000');
  });

  describe('listConversations', () => {
    it('calls GET /api/v1/conversations with query parameters and auth headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'conv-1',
              type: 'DIRECT',
              title: null,
              currentSequence: '12',
              unreadCount: 2,
              participants: [],
              createdAt: '2026-10-23T10:00:00Z',
              updatedAt: '2026-10-23T11:00:00Z',
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      });

      const res = await service.listConversations({ limit: 15 }, 'jwt-token-123');
      expect(res.items.length).toBe(1);
      expect(res.items[0]?.id).toBe('conv-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations?limit=15',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token-123',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('propagates error message when API returns non-200 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Authentication required.' }),
      });

      await expect(service.listConversations({}, 'bad-token')).rejects.toThrow(
        'Authentication required.',
      );
    });
  });

  describe('getConversation', () => {
    it('calls GET /api/v1/conversations/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'conv-abc',
          type: 'DIRECT',
          title: 'Project Discussion',
          currentSequence: '5',
          participants: [],
          createdAt: '2026-10-23T10:00:00Z',
          updatedAt: '2026-10-23T10:05:00Z',
        }),
      });

      const res = await service.getConversation('conv-abc', 'jwt-token-123');
      expect(res.id).toBe('conv-abc');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations/conv-abc',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('createDirectConversation', () => {
    it('calls POST /api/v1/conversations with recipientId payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'new-conv-1',
          type: 'DIRECT',
          title: null,
          currentSequence: '0',
          participants: [],
          createdAt: '2026-10-23T12:00:00Z',
          updatedAt: '2026-10-23T12:00:00Z',
        }),
      });

      const res = await service.createDirectConversation(
        { recipientId: 'user-recipient-456' },
        'jwt-token-123',
      );
      expect(res.id).toBe('new-conv-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ recipientId: 'user-recipient-456' }),
        }),
      );
    });
  });

  describe('markConversationRead', () => {
    it('calls POST /api/v1/conversations/:id/read with sequence', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversationId: 'conv-1',
          lastReadSequence: '25',
          updatedAt: '2026-10-23T12:00:00Z',
        }),
      });

      const res = await service.markConversationRead('conv-1', '25', 'jwt-token-123');
      expect(res.conversationId).toBe('conv-1');
      expect(res.lastReadSequence).toBe('25');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations/conv-1/read',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sequence: '25' }),
        }),
      );
    });
  });

  describe('listMessages (Milestone 2)', () => {
    it('calls GET /api/v1/conversations/:id/messages with keyset query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'msg-1',
              conversationId: 'conv-123',
              senderId: 'user-1',
              sequence: '1',
              clientMessageId: 'cli-1',
              content: 'Hello World',
              status: 'SENT',
              attachments: [],
              deletedAt: null,
              createdAt: '2026-10-23T10:00:00Z',
              updatedAt: '2026-10-23T10:00:00Z',
            },
          ],
          nextCursor: 'cursor-token',
          hasMore: true,
        }),
      });

      const res = await service.listMessages(
        'conv-123',
        { limit: 20, cursor: 'prev-cursor', direction: 'prev' },
        'jwt-token',
      );
      expect(res.items.length).toBe(1);
      expect(res.hasMore).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations/conv-123/messages?cursor=prev-cursor&limit=20&direction=prev',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token',
          }),
        }),
      );
    });

    it('throws error when message listing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Conversation not found or access denied.' }),
      });

      await expect(service.listMessages('conv-404', {}, 'jwt-token')).rejects.toThrow(
        'Conversation not found or access denied.',
      );
    });
  });

  describe('sendMessage (Milestone 2)', () => {
    it('calls POST /api/v1/conversations/:id/messages with clientMessageId and content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg-new',
          conversationId: 'conv-123',
          senderId: 'user-self',
          sequence: '5',
          clientMessageId: 'uuidv7-idempotency-key',
          content: 'Test message body',
          status: 'SENT',
          attachments: [],
          deletedAt: null,
          createdAt: '2026-10-23T10:14:00Z',
          updatedAt: '2026-10-23T10:14:00Z',
        }),
      });

      const res = await service.sendMessage(
        'conv-123',
        { clientMessageId: 'uuidv7-idempotency-key', content: 'Test message body' },
        'jwt-token',
      );

      expect(res.id).toBe('msg-new');
      expect(res.sequence).toBe('5');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations/conv-123/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            clientMessageId: 'uuidv7-idempotency-key',
            content: 'Test message body',
          }),
        }),
      );
    });
  });

  describe('editMessage (Milestone 2)', () => {
    it('calls PATCH /api/v1/conversations/:id/messages/:messageId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg-1',
          conversationId: 'conv-123',
          senderId: 'user-self',
          sequence: '5',
          clientMessageId: 'uuid-1',
          content: 'Edited content',
          status: 'SENT',
          attachments: [],
          deletedAt: null,
          createdAt: '2026-10-23T10:14:00Z',
          updatedAt: '2026-10-23T10:18:00Z',
        }),
      });

      const res = await service.editMessage(
        'conv-123',
        'msg-1',
        { content: 'Edited content' },
        'jwt-token',
      );

      expect(res.content).toBe('Edited content');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations/conv-123/messages/msg-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ content: 'Edited content' }),
        }),
      );
    });
  });

  describe('deleteMessage (Milestone 2)', () => {
    it('calls DELETE /api/v1/conversations/:id/messages/:messageId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await expect(
        service.deleteMessage('conv-123', 'msg-1', 'jwt-token'),
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations/conv-123/messages/msg-1',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('isMessageEditable & getMessageEditTimeRemainingMinutes (15-min window)', () => {
    it('returns true when message was created within 15 minutes and not deleted', () => {
      const now = 1700000000000;
      const createdAt = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min ago
      expect(isMessageEditable(createdAt, null, now)).toBe(true);
      expect(getMessageEditTimeRemainingMinutes(createdAt, now)).toBe(10);
    });

    it('returns false when message is older than 15 minutes', () => {
      const now = 1700000000000;
      const createdAt = new Date(now - 16 * 60 * 1000).toISOString(); // 16 min ago
      expect(isMessageEditable(createdAt, null, now)).toBe(false);
      expect(getMessageEditTimeRemainingMinutes(createdAt, now)).toBe(0);
    });

    it('returns false when message is soft-deleted even within 15 minutes', () => {
      const now = 1700000000000;
      const createdAt = new Date(now - 2 * 60 * 1000).toISOString();
      const deletedAt = new Date(now - 1 * 60 * 1000).toISOString();
      expect(isMessageEditable(createdAt, deletedAt, now)).toBe(false);
    });

    it('handles exact 15-minute boundary', () => {
      const now = 1700000000000;
      const createdAtExact = new Date(now - MESSAGE_EDIT_WINDOW_MS).toISOString();
      expect(isMessageEditable(createdAtExact, null, now)).toBe(true);
      expect(getMessageEditTimeRemainingMinutes(createdAtExact, now)).toBe(0);

      // 10 seconds before expiration
      const createdAtJustBefore = new Date(now - MESSAGE_EDIT_WINDOW_MS + 10000).toISOString();
      expect(isMessageEditable(createdAtJustBefore, null, now)).toBe(true);
      expect(getMessageEditTimeRemainingMinutes(createdAtJustBefore, now)).toBe(1);
    });
  });

  describe('formatMessageTimestamp & formatMessageDateSeparator', () => {
    it('formats timestamp as HH:MM format', () => {
      const ts = new Date('2026-10-23T10:14:00Z').toISOString();
      const result = formatMessageTimestamp(ts);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('formats today date separator as Today', () => {
      const now = new Date();
      expect(formatMessageDateSeparator(now.toISOString())).toBe('Today');
    });

    it('formats yesterday date separator as Yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatMessageDateSeparator(yesterday.toISOString())).toBe('Yesterday');
    });
  });

  describe('formatConversationTime', () => {
    it('returns empty string for invalid date', () => {
      expect(formatConversationTime('invalid-date')).toBe('');
    });

    it('formats today timestamp as hour:minute', () => {
      const now = new Date();
      const res = formatConversationTime(now.toISOString());
      expect(res).toMatch(/[0-9]{1,2}:[0-9]{2}/);
    });
  });

  describe('getPeerParticipantId', () => {
    it('extracts peer user ID when current user ID is given', () => {
      const conv: DirectConversationResponse = {
        id: 'c-1',
        type: 'DIRECT',
        title: null,
        assignmentId: null,
        applicationId: null,
        currentSequence: '1',
        createdAt: '2026-10-23T10:00:00Z',
        updatedAt: '2026-10-23T10:00:00Z',
        participants: [
          {
            id: 'p-1',
            conversationId: 'c-1',
            userId: 'user-self',
            role: 'MEMBER',
            lastReadSequence: '1',
            mutedUntil: null,
            leftAt: null,
            joinedAt: '2026-10-23T10:00:00Z',
            updatedAt: '2026-10-23T10:00:00Z',
          },
          {
            id: 'p-2',
            conversationId: 'c-1',
            userId: 'user-peer',
            role: 'MEMBER',
            lastReadSequence: '0',
            mutedUntil: null,
            leftAt: null,
            joinedAt: '2026-10-23T10:00:00Z',
            updatedAt: '2026-10-23T10:00:00Z',
          },
        ],
      };

      expect(getPeerParticipantId(conv, 'user-self')).toBe('user-peer');
    });

    it('returns first participant if current user ID is not found', () => {
      const conv: DirectConversationResponse = {
        id: 'c-1',
        type: 'DIRECT',
        title: null,
        assignmentId: null,
        applicationId: null,
        currentSequence: '1',
        createdAt: '2026-10-23T10:00:00Z',
        updatedAt: '2026-10-23T10:00:00Z',
        participants: [
          {
            id: 'p-1',
            conversationId: 'c-1',
            userId: 'user-a',
            role: 'MEMBER',
            lastReadSequence: '1',
            mutedUntil: null,
            leftAt: null,
            joinedAt: '2026-10-23T10:00:00Z',
            updatedAt: '2026-10-23T10:00:00Z',
          },
        ],
      };

      expect(getPeerParticipantId(conv, 'user-unknown')).toBe('user-a');
    });

    it('returns peer participant and derives display name with profile fallback', () => {
      const convWithProfile: DirectConversationResponse = {
        id: 'c-1',
        type: 'DIRECT',
        title: null,
        assignmentId: null,
        applicationId: null,
        currentSequence: '1',
        createdAt: '2026-10-23T10:00:00Z',
        updatedAt: '2026-10-23T10:00:00Z',
        participants: [
          {
            id: 'p-1',
            conversationId: 'c-1',
            userId: 'user-self',
            role: 'MEMBER',
            lastReadSequence: '1',
            mutedUntil: null,
            leftAt: null,
            joinedAt: '2026-10-23T10:00:00Z',
            updatedAt: '2026-10-23T10:00:00Z',
            profile: {
              displayName: 'Self User',
              avatarUrl: null,
              role: 'CREATOR',
            },
          },
          {
            id: 'p-2',
            conversationId: 'c-1',
            userId: '0192e4ab-0000-7000-8000-000000000002',
            role: 'MEMBER',
            lastReadSequence: '0',
            mutedUntil: null,
            leftAt: null,
            joinedAt: '2026-10-23T10:00:00Z',
            updatedAt: '2026-10-23T10:00:00Z',
            profile: {
              displayName: 'Acme Media Labs',
              avatarUrl: 'https://images.unsplash.com/photo-brand',
              role: 'BRAND',
              location: 'Mumbai, IN',
              isVerified: true,
            },
          },
        ],
      };

      const peer = getPeerParticipant(convWithProfile, 'user-self');
      expect(peer?.userId).toBe('0192e4ab-0000-7000-8000-000000000002');
      expect(peer?.profile?.displayName).toBe('Acme Media Labs');
      expect(getPeerDisplayName(convWithProfile, 'user-self')).toBe('Acme Media Labs');

      // Conversation title takes precedence when explicitly set
      const titledConv = { ...convWithProfile, title: 'Summer Campaign Collab' };
      expect(getPeerDisplayName(titledConv, 'user-self')).toBe('Summer Campaign Collab');

      // Falls back to User ID prefix when profile is absent
      const noProfileConv: DirectConversationResponse = {
        ...convWithProfile,
        participants: convWithProfile.participants.map((p) => {
          const { profile: _omitted, ...rest } = p;
          return rest;
        }),
      };
      expect(getPeerDisplayName(noProfileConv, 'user-self')).toBe('User 0192e4ab');
    });
  });

  describe('getAttachmentDownload (Milestone 3 / I05)', () => {
    it('calls GET /api/v1/conversations/:convId/attachments/:attId/download with auth', async () => {
      const mockDownload: AttachmentDownloadResponse = {
        attachmentId: 'att-101',
        mediaAssetId: 'media-asset-500',
        fileName: 'commercial_storyboard_v2.png',
        fileSize: 4200000,
        mimeType: 'image/png',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/signed-token-download',
        expiresInSeconds: 900,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDownload,
      });

      const res = await service.getAttachmentDownload('conv-1', 'att-101', 'jwt-token');

      expect(res.downloadUrl).toBe(mockDownload.downloadUrl);
      expect(res.expiresInSeconds).toBe(900);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/conversations/conv-1/attachments/att-101/download',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token',
          }),
        }),
      );
    });

    it('throws error when download presigning fails or is rejected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Access denied or attachment quarantined.' }),
      });

      await expect(
        service.getAttachmentDownload('conv-1', 'att-quarantine', 'jwt-token'),
      ).rejects.toThrow('Access denied or attachment quarantined.');
    });
  });

  describe('categorizeMediaType (Milestone 3 / I05 media safety)', () => {
    it('categorizes image mime types correctly', () => {
      expect(categorizeMediaType('image/png', 'photo.png')).toBe('image');
      expect(categorizeMediaType('image/jpeg', 'photo.jpg')).toBe('image');
      expect(categorizeMediaType('image/webp', 'photo.webp')).toBe('image');
    });

    it('treats SVG as unsupported to prevent active code execution in DOM', () => {
      expect(categorizeMediaType('image/svg+xml', 'vector.svg')).toBe('unsupported');
    });

    it('categorizes video mime types correctly', () => {
      expect(categorizeMediaType('video/mp4', 'reel.mp4')).toBe('video');
      expect(categorizeMediaType('video/webm', 'reel.webm')).toBe('video');
      expect(categorizeMediaType('video/quicktime', 'reel.mov')).toBe('video');
    });

    it('categorizes PDF mime type correctly', () => {
      expect(categorizeMediaType('application/pdf', 'contract.pdf')).toBe('pdf');
    });

    it('categorizes arbitrary binaries and raw files as unsupported', () => {
      expect(categorizeMediaType('application/octet-stream', 'grade.cube')).toBe('unsupported');
      expect(categorizeMediaType('application/zip', 'assets.zip')).toBe('unsupported');
    });
  });

  describe('formatFileSize helper', () => {
    it('formats bytes into readable human units', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(4.2 * 1024 * 1024)).toBe('4.2 MB');
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
    });
  });

  describe('User Block Moderation (Milestone 3 / I06)', () => {
    it('calls POST /api/v1/blocks with targetUserId and reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'blk-1',
          blockerId: 'user-self',
          blockedId: 'user-target',
          reason: 'Spamming off-platform links',
          createdAt: '2026-10-23T10:00:00Z',
        }),
      });

      const res = await service.blockUser(
        'user-target',
        'Spamming off-platform links',
        'jwt-token',
      );
      expect(res.id).toBe('blk-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/blocks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            targetUserId: 'user-target',
            reason: 'Spamming off-platform links',
          }),
        }),
      );
    });

    it('calls DELETE /api/v1/blocks/:id to unblock', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await service.unblockUser('user-target', 'jwt-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/blocks/user-target',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('checks block status accurately from listBlocks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'blk-1',
              blockerId: 'user-self',
              blockedId: 'user-blocked',
              reason: null,
              createdAt: '2026-10-23T10:00:00Z',
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      });

      const blockedRes = await service.checkBlockStatus('user-blocked', 'jwt-token');
      expect(blockedRes.isBlocked).toBe(true);
      expect(blockedRes.blockId).toBe('blk-1');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          nextCursor: null,
          hasMore: false,
        }),
      });

      const unblockedRes = await service.checkBlockStatus('user-not-blocked', 'jwt-token');
      expect(unblockedRes.isBlocked).toBe(false);
    });
  });

  describe('Bounded Exponential Backoff with Jitter (Workstream G)', () => {
    it('calculates delay accurately: d_k = min(d_max, d_0 * 2^k) + J_k', () => {
      // With fixed randomFn returning 0.5 (jitter = 50ms)
      const mockRandom = () => 0.5;

      // attempt 0: min(3000, 150 * 1) + 50 = 200ms
      const d0 = calculateBackoffDelayMs(0, {
        baseDelayMs: 150,
        maxDelayMs: 3000,
        jitterMs: 100,
        randomFn: mockRandom,
      });
      expect(d0).toBe(200);

      // attempt 1: min(3000, 150 * 2) + 50 = 350ms
      const d1 = calculateBackoffDelayMs(1, {
        baseDelayMs: 150,
        maxDelayMs: 3000,
        jitterMs: 100,
        randomFn: mockRandom,
      });
      expect(d1).toBe(350);

      // attempt 2: min(3000, 150 * 4) + 50 = 650ms
      const d2 = calculateBackoffDelayMs(2, {
        baseDelayMs: 150,
        maxDelayMs: 3000,
        jitterMs: 100,
        randomFn: mockRandom,
      });
      expect(d2).toBe(650);

      // High attempt capped strictly at maxDelayMs (3000ms)
      const dHigh = calculateBackoffDelayMs(10, {
        baseDelayMs: 150,
        maxDelayMs: 3000,
        jitterMs: 100,
        randomFn: mockRandom,
      });
      expect(dHigh).toBe(3000);
    });

    it('parses Retry-After header with integer seconds and HTTP-date formats', () => {
      // 1. Seconds
      expect(parseRetryAfterHeader('5')).toBe(5000);
      expect(parseRetryAfterHeader('0')).toBe(0);

      // 2. Future HTTP-date
      const futureDate = new Date(Date.now() + 10000).toUTCString();
      const parsedMs = parseRetryAfterHeader(futureDate);
      expect(parsedMs).toBeGreaterThan(8000);
      expect(parsedMs).toBeLessThanOrEqual(10000);

      // 3. Null / invalid
      expect(parseRetryAfterHeader(null)).toBeNull();
      expect(parseRetryAfterHeader('')).toBeNull();
      expect(parseRetryAfterHeader('invalid-string')).toBeNull();
    });
  });

  describe('fetchWithRetry Resilience & Policy (Workstream G)', () => {
    it('retries transient 500 error and succeeds on subsequent attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: async () => ({ detail: 'Transient database deadlock' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ items: [], nextCursor: null, hasMore: false }),
        });

      const res = await service.fetchWithRetry(
        'http://test-api:3000/api/v1/conversations',
        { method: 'GET' },
        { maxRetries: 2, baseDelayMs: 5, jitterMs: 0 },
      );

      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('immediately aborts and does NOT retry permanent 4xx client errors (400, 401, 403, 404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ detail: 'Access forbidden: not a conversation participant' }),
      });

      const res = await service.fetchWithRetry(
        'http://test-api:3000/api/v1/conversations/conv-secret',
        { method: 'GET' },
        { maxRetries: 3, baseDelayMs: 5 },
      );

      // Must NOT retry 403
      expect(res.status).toBe(403);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('respects Retry-After header delay when provided on transient 429 response', async () => {
      const headers = new Headers();
      headers.set('Retry-After', '1');

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers,
          json: async () => ({ detail: 'Rate limit exceeded' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ success: true }),
        });

      const res = await service.fetchWithRetry(
        'http://test-api:3000/api/v1/conversations',
        { method: 'GET' },
        { maxRetries: 1, baseDelayMs: 5 },
      );

      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('aborts immediately and cancels when AbortSignal is triggered', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        service.fetchWithRetry(
          'http://test-api:3000/api/v1/conversations',
          { method: 'GET' },
          { signal: controller.signal },
        ),
      ).rejects.toThrow();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('parses HTTP-date Retry-After deterministically with injected clock', () => {
      const simulatedNow = new Date('2026-10-24T12:00:00.000Z').getTime();
      const nowFn = () => simulatedNow;

      // 30 seconds in future
      const futureHttpDate = 'Sat, 24 Oct 2026 12:00:30 GMT';
      expect(parseRetryAfterHeader(futureHttpDate, nowFn)).toBe(30000);

      // Date in the past clamps to 0
      const pastHttpDate = 'Sat, 24 Oct 2026 11:59:00 GMT';
      expect(parseRetryAfterHeader(pastHttpDate, nowFn)).toBe(0);
    });

    it('enforces total deadline budget across retries using injected clock', async () => {
      let currentTime = 1000;
      const nowFn = () => currentTime;

      // First call fails with 503
      mockFetch.mockImplementation(async () => {
        // Advance clock past the 500ms budget upon call
        currentTime += 600;
        return {
          ok: false,
          status: 503,
          headers: new Headers(),
          json: async () => ({ detail: 'Service Unavailable' }),
        };
      });

      const res = await service.fetchWithRetry(
        'http://test-api:3000/api/v1/conversations',
        { method: 'GET' },
        {
          maxRetries: 3,
          timeoutMs: 500,
          nowFn,
          baseDelayMs: 10,
        },
      );

      // Total deadline was exceeded after first attempt, so it does not retry further
      expect(res.status).toBe(503);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('caps delay within remaining total deadline budget', async () => {
      let currentTime = 1000;
      const nowFn = () => currentTime;

      const headers = new Headers();
      headers.set('Retry-After', '60'); // Server asks for 60 seconds

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers,
          json: async () => ({ detail: 'Rate limited' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ success: true }),
        });

      // Budget is only 200ms
      const res = await service.fetchWithRetry(
        'http://test-api:3000/api/v1/conversations',
        { method: 'GET' },
        {
          maxRetries: 1,
          timeoutMs: 200,
          nowFn,
          maxDelayMs: 100, // Capped to 100ms or remaining budget
        },
      );

      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('interrupts backoff timer when AbortSignal triggers mid-delay', async () => {
      const controller = new AbortController();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({ detail: 'Unavailable' }),
      });

      const promise = service.fetchWithRetry(
        'http://test-api:3000/api/v1/conversations',
        { method: 'GET' },
        {
          maxRetries: 2,
          baseDelayMs: 2000, // Large delay to ensure abort triggers while waiting
          signal: controller.signal,
        },
      );

      // Trigger abort shortly after launch
      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow('Aborted');
    });
  });

  describe('Abuse Report Submission (Workstream E / POST /api/v1/reports)', () => {
    it('calls POST /api/v1/reports with validated payload and auth headers', async () => {
      const reportInput: CreateReportInput = {
        targetType: 'USER',
        targetId: '0192e4ab-0000-7000-8000-000000000002',
        category: 'HARASSMENT',
        details: 'User sent repeated abusive messages threatening off-platform doxxing.',
      };

      const mockReportResponse = {
        id: '0192e4ab-9999-7000-8000-000000000001',
        reporterId: '0192e4ab-0000-7000-8000-000000000001',
        targetType: 'USER',
        targetId: '0192e4ab-0000-7000-8000-000000000002',
        category: 'HARASSMENT',
        details: reportInput.details,
        status: 'PENDING',
        createdAt: '2026-10-23T12:00:00Z',
        updatedAt: '2026-10-23T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => mockReportResponse,
      });

      const result = await service.submitReport(reportInput, 'jwt-token');

      expect(result.id).toBe('0192e4ab-9999-7000-8000-000000000001');
      expect(result.status).toBe('PENDING');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/reports',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(reportInput),
        }),
      );
    });

    it('throws descriptive error when report submission is rejected by backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        json: async () => ({ detail: 'SELF_REPORT_NOT_ALLOWED' }),
      });

      await expect(
        service.submitReport(
          {
            targetType: 'USER',
            targetId: '0192e4ab-0000-7000-8000-000000000001',
            category: 'SPAM',
            details: 'This is a test details string that is long enough.',
          },
          'jwt-token',
        ),
      ).rejects.toThrow('SELF_REPORT_NOT_ALLOWED');
    });
  });

  describe('MessageRequest Workflow API (Milestone 2D)', () => {
    const mockRequest = {
      id: '01912952-4a00-7000-8000-000000000001',
      senderId: '01912952-4a00-7000-8000-000000000002',
      recipientId: '01912952-4a00-7000-8000-000000000003',
      conversationId: null,
      initialMessage: 'Introductory pitch',
      status: 'PENDING',
      declinedReason: null,
      expiresAt: '2026-10-31T10:00:00Z',
      respondedAt: null,
      createdAt: '2026-10-24T10:00:00Z',
      updatedAt: '2026-10-24T10:00:00Z',
    };

    it('listMessageRequests constructs query params and returns paginated response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          items: [mockRequest],
          nextCursor: null,
          hasMore: false,
        }),
      });

      const result = await service.listMessageRequests(
        { direction: 'incoming', status: 'PENDING', limit: 10 },
        'jwt-token',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(mockRequest.id);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/chat/requests?direction=incoming&status=PENDING&limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token',
          }),
        }),
      );
    });

    it('getMessageRequest fetches specific request by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockRequest,
      });

      const result = await service.getMessageRequest(mockRequest.id, 'jwt-token');

      expect(result.id).toBe(mockRequest.id);
      expect(mockFetch).toHaveBeenCalledWith(
        `http://test-api:3000/api/v1/chat/requests/${mockRequest.id}`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('createMessageRequest sends proposal payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => mockRequest,
      });

      const result = await service.createMessageRequest(
        { recipientId: mockRequest.recipientId, initialMessage: 'Introductory pitch' },
        'jwt-token',
      );

      expect(result.id).toBe(mockRequest.id);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3000/api/v1/chat/requests',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            recipientId: mockRequest.recipientId,
            initialMessage: 'Introductory pitch',
          }),
        }),
      );
    });

    it('acceptMessageRequest calls /accept endpoint and returns conversation', async () => {
      const mockAcceptResponse = {
        request: { ...mockRequest, status: 'ACCEPTED', conversationId: 'conv-100' },
        conversation: { id: 'conv-100', type: 'DIRECT' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockAcceptResponse,
      });

      const result = await service.acceptMessageRequest(mockRequest.id, 'jwt-token');

      expect(result.request.status).toBe('ACCEPTED');
      expect(result.conversation.id).toBe('conv-100');
      expect(mockFetch).toHaveBeenCalledWith(
        `http://test-api:3000/api/v1/chat/requests/${mockRequest.id}/accept`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('declineMessageRequest calls /decline endpoint with optional reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ...mockRequest, status: 'DECLINED', declinedReason: 'Busy' }),
      });

      const result = await service.declineMessageRequest(
        mockRequest.id,
        { reason: 'Busy' },
        'jwt-token',
      );

      expect(result.status).toBe('DECLINED');
      expect(mockFetch).toHaveBeenCalledWith(
        `http://test-api:3000/api/v1/chat/requests/${mockRequest.id}/decline`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'Busy' }),
        }),
      );
    });

    it('cancelMessageRequest calls /cancel endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ ...mockRequest, status: 'CANCELLED' }),
      });

      const result = await service.cancelMessageRequest(mockRequest.id, 'jwt-token');

      expect(result.status).toBe('CANCELLED');
      expect(mockFetch).toHaveBeenCalledWith(
        `http://test-api:3000/api/v1/chat/requests/${mockRequest.id}/cancel`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
