import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatHeader } from './chat-header';
import { ChatMessageBubble } from './chat-message-bubble';
import { ChatComposer } from './chat-composer';
import { ChatContextRail } from './chat-context-rail';
import { EditMessageDialog } from './edit-message-dialog';
import { DeleteMessageDialog } from './delete-message-dialog';
import type { DirectConversationResponse, MessageResponse } from '@creatorconnect/contracts';

const mockConversation: DirectConversationResponse = {
  id: '0192e4ab-1234-7000-8000-000000000001',
  type: 'DIRECT',
  title: 'Rohan K. Collaboration',
  assignmentId: '0192e4ab-5678-7000-8000-000000000002',
  applicationId: null,
  currentSequence: '42',
  unreadCount: 0,
  createdAt: '2026-10-23T10:00:00Z',
  updatedAt: '2026-10-23T10:30:00Z',
  participants: [
    {
      id: 'p-1',
      conversationId: '0192e4ab-1234-7000-8000-000000000001',
      userId: 'user-self',
      role: 'MEMBER',
      lastReadSequence: '42',
      mutedUntil: null,
      leftAt: null,
      joinedAt: '2026-10-23T10:00:00Z',
      updatedAt: '2026-10-23T10:00:00Z',
    },
    {
      id: 'p-2',
      conversationId: '0192e4ab-1234-7000-8000-000000000001',
      userId: 'user-rohan-peer',
      role: 'MEMBER',
      lastReadSequence: '42',
      mutedUntil: null,
      leftAt: null,
      joinedAt: '2026-10-23T10:00:00Z',
      updatedAt: '2026-10-23T10:00:00Z',
    },
  ],
};

const mockInboundMessage: MessageResponse = {
  id: 'msg-inbound-1',
  conversationId: '0192e4ab-1234-7000-8000-000000000001',
  senderId: 'user-rohan-peer',
  sequence: '10',
  clientMessageId: 'cli-10',
  content: "Hi Ananya, I've ingested all 4K ProRes 422 HQ footage from Day 1.",
  status: 'SENT',
  attachments: [],
  deletedAt: null,
  createdAt: '2026-10-23T10:14:00Z',
  updatedAt: '2026-10-23T10:14:00Z',
};

const mockOutboundRecentMessage: MessageResponse = {
  id: 'msg-outbound-1',
  conversationId: '0192e4ab-1234-7000-8000-000000000001',
  senderId: 'user-self',
  sequence: '11',
  clientMessageId: 'cli-11',
  content: 'Looks great! Make sure skin tones remain natural.',
  status: 'SENT',
  attachments: [],
  deletedAt: null,
  createdAt: new Date().toISOString(), // recent, within 15m
  updatedAt: new Date().toISOString(),
};

const mockDeletedMessage: MessageResponse = {
  id: 'msg-deleted-1',
  conversationId: '0192e4ab-1234-7000-8000-000000000001',
  senderId: 'user-self',
  sequence: '12',
  clientMessageId: 'cli-12',
  content: '[This message was deleted]',
  status: 'DELETED',
  attachments: [],
  deletedAt: '2026-10-23T10:20:00Z',
  createdAt: '2026-10-23T10:15:00Z',
  updatedAt: '2026-10-23T10:20:00Z',
};

describe('Stitch I04 Chat Components Unit Tests', () => {
  describe('ChatHeader', () => {
    it('renders conversation title, verified badge when peer is verified, and back link', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatHeader, {
          conversation: {
            ...mockConversation,
            participants: [
              mockConversation.participants[0]!,
              {
                ...mockConversation.participants[1]!,
                profile: {
                  displayName: 'Rohan Kalbag',
                  avatarUrl: null,
                  isVerified: true,
                  role: 'CREATOR',
                },
              },
            ],
          },
          currentUserId: 'user-self',
        }),
      );

      expect(html).toContain('Rohan K. Collaboration');
      expect(html).toContain('Verified');
      expect(html).toContain('href="/messages"');
      expect(html).toContain('Assignment #0192e4ab');
      expect(html).toContain('Keyset Sequenced');
      expect(html).not.toContain('Escrow Protected');
    });

    it('does not display verified badge when peer is not verified', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatHeader, {
          conversation: mockConversation,
          currentUserId: 'user-self',
        }),
      );

      expect(html).not.toContain('Verified');
    });

    it('displays blocked indicator when thread is blocked', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatHeader, {
          conversation: mockConversation,
          currentUserId: 'user-self',
          isBlocked: true,
        }),
      );

      expect(html).toContain('title="Blocked"');
    });
  });

  describe('ChatMessageBubble', () => {
    it('renders inbound message correctly with peer initial', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatMessageBubble, {
          message: mockInboundMessage,
          currentUserId: 'user-self',
          peerInitial: 'R',
          userInitial: 'A',
        }),
      );

      expect(html).toContain('4K ProRes 422 HQ');
      expect(html).toContain('R');
      expect(html).toContain('Peer');
      // Should not contain "Read" receipt for inbound
      expect(html).not.toContain('Read');
    });

    it('renders outbound message with You, yellow container, and Read receipt', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatMessageBubble, {
          message: mockOutboundRecentMessage,
          currentUserId: 'user-self',
          peerInitial: 'R',
          userInitial: 'A',
          isRead: true,
          onEdit: vi.fn(),
          onDelete: vi.fn(),
        }),
      );

      expect(html).toContain('skin tones remain natural');
      expect(html).toContain('You');
      expect(html).toContain('Read');
      // Should contain Edit and Delete action affordances
      expect(html).toContain('Edit');
      expect(html).toContain('Delete');
    });

    it('renders soft-deleted message cleanly without action affordances', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatMessageBubble, {
          message: mockDeletedMessage,
          currentUserId: 'user-self',
        }),
      );

      expect(html).toContain('[This message was deleted]');
      expect(html).not.toContain('Edit');
      expect(html).not.toContain('Copy');
    });
  });

  describe('ChatComposer', () => {
    it('renders composer textarea and send button', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatComposer, {
          onSendMessage: vi.fn(),
          placeholder: 'Type a message...',
        }),
      );

      expect(html).toContain('placeholder="Type a message..."');
      expect(html).toContain('Send');
      expect(html).toContain('Attach file (25MB)');
      expect(html).toContain('Platform Safety Protocol • Monotonic Keyset Integrity');
      expect(html).not.toContain('Escrow-backed messaging safety protocol');
    });

    it('renders blocked notice when thread is blocked', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatComposer, {
          onSendMessage: vi.fn(),
          isBlocked: true,
        }),
      );

      expect(html).toContain('This conversation is restricted or blocked.');
    });

    it('renders composer with placeholder and attach button', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatComposer, {
          onSendMessage: vi.fn(),
          placeholder: 'Write a message...',
        }),
      );

      expect(html).toContain('placeholder="Write a message..."');
      expect(html).toContain('Send');
      expect(html).toContain('Attach file (25MB)');
    });
  });

  describe('ChatContextRail', () => {
    it('renders participant dossier, escrow snapshot, and safety rules', () => {
      const html = renderToStaticMarkup(
        React.createElement(ChatContextRail, {
          conversation: mockConversation,
          currentUserId: 'user-self',
        }),
      );

      expect(html).toContain('Rohan K. Collaboration');
      expect(html).toContain('Verified G10');
      expect(html).toContain('15-Minute Global Delete');
      expect(html).toContain('Anti-Tampering Ledger');
    });
  });

  describe('EditMessageDialog', () => {
    it('renders dialog with remaining minutes and save button', () => {
      const html = renderToStaticMarkup(
        React.createElement(EditMessageDialog, {
          message: mockOutboundRecentMessage,
          isOpen: true,
          onClose: vi.fn(),
          onConfirmEdit: vi.fn(),
        }),
      );

      expect(html).toContain('Edit Message');
      expect(html).toContain('Save Changes');
      expect(html).toContain('minutes remaining');
    });
  });

  describe('DeleteMessageDialog', () => {
    it('renders delete dialog with Rule 4.2 notice and confirm button', () => {
      const html = renderToStaticMarkup(
        React.createElement(DeleteMessageDialog, {
          message: mockOutboundRecentMessage,
          isOpen: true,
          onClose: vi.fn(),
          onConfirmDelete: vi.fn(),
        }),
      );

      expect(html).toContain('Delete Message?');
      expect(html).toContain('CreatorConnect Rule 4.2');
      expect(html).toContain('Delete for Everyone');
      expect(html).toContain('Keep Message');
    });
  });
});
