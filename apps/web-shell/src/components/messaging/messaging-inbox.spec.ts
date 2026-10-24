import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationCard } from './conversation-card';
import { InboxLoadingSkeleton } from './inbox-loading-skeleton';
import { InboxEmptyState } from './inbox-empty-state';
import { InboxErrorState } from './inbox-error-state';
import { ConversationPreviewPane } from './conversation-preview-pane';
import type { DirectConversationResponse } from '@creatorconnect/contracts';

const mockConversation: DirectConversationResponse = {
  id: '0192e4ab-1234-7000-8000-000000000001',
  type: 'DIRECT',
  title: 'Fashion Week Campaign',
  assignmentId: '0192e4ab-5678-7000-8000-000000000002',
  applicationId: null,
  currentSequence: '42',
  unreadCount: 3,
  createdAt: '2026-10-23T10:00:00Z',
  updatedAt: '2026-10-23T10:30:00Z',
  participants: [
    {
      id: 'p-1',
      conversationId: '0192e4ab-1234-7000-8000-000000000001',
      userId: 'user-current',
      role: 'MEMBER',
      lastReadSequence: '39',
      mutedUntil: null,
      leftAt: null,
      joinedAt: '2026-10-23T10:00:00Z',
      updatedAt: '2026-10-23T10:00:00Z',
    },
    {
      id: 'p-2',
      conversationId: '0192e4ab-1234-7000-8000-000000000001',
      userId: 'user-peer-rohan',
      role: 'MEMBER',
      lastReadSequence: '42',
      mutedUntil: null,
      leftAt: null,
      joinedAt: '2026-10-23T10:00:00Z',
      updatedAt: '2026-10-23T10:00:00Z',
    },
  ],
};

describe('Messaging Inbox Components (Stitch I01 UI)', () => {
  describe('ConversationCard', () => {
    it('renders conversation title, unread pill, and linked assignment', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConversationCard, {
          conversation: mockConversation,
          isSelected: false,
          onSelect: vi.fn(),
          currentUserId: 'user-current',
        }),
      );

      expect(html).toContain('Fashion Week Campaign');
      expect(html).toContain('Assignment #0192e4ab');
      expect(html).toContain('3 unread');
      expect(html).toContain('Sequence #42');
    });

    it('applies selection styles when isSelected is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConversationCard, {
          conversation: mockConversation,
          isSelected: true,
          onSelect: vi.fn(),
          currentUserId: 'user-current',
        }),
      );

      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('shadow-[2px_2px_0px_#14110F]');
    });

    it('falls back to peer user ID if title is null', () => {
      const untitledConv = { ...mockConversation, title: null };
      const html = renderToStaticMarkup(
        React.createElement(ConversationCard, {
          conversation: untitledConv,
          isSelected: false,
          onSelect: vi.fn(),
          currentUserId: 'user-current',
        }),
      );

      expect(html).toContain('User user-pee');
    });
  });

  describe('InboxLoadingSkeleton', () => {
    it('renders accessible loading skeleton with aria-busy', () => {
      const html = renderToStaticMarkup(React.createElement(InboxLoadingSkeleton));
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('animate-pulse');
    });
  });

  describe('InboxEmptyState', () => {
    it('renders zero-state guidance and call to action links', () => {
      const html = renderToStaticMarkup(React.createElement(InboxEmptyState));
      expect(html).toContain('No Active Conversations Yet');
      expect(html).toContain('Browse Discovery');
      expect(html).toContain('View Assignments');
    });
  });

  describe('InboxErrorState', () => {
    it('renders error notice and retry trigger', () => {
      const html = renderToStaticMarkup(
        React.createElement(InboxErrorState, {
          message: 'Connection timed out',
          onRetry: vi.fn(),
          isRetrying: false,
        }),
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('Connection timed out');
      expect(html).toContain('Retry Connection');
    });

    it('shows connecting state when isRetrying is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(InboxErrorState, {
          message: 'Failed to load',
          onRetry: vi.fn(),
          isRetrying: true,
        }),
      );

      expect(html).toContain('Connecting...');
    });
  });

  describe('ConversationPreviewPane', () => {
    it('renders selection prompt when conversation is null', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConversationPreviewPane, {
          conversation: null,
        }),
      );

      expect(html).toContain('Select a conversation to start messaging');
    });

    it('renders active thread dossier and jump action when conversation is selected', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConversationPreviewPane, {
          conversation: mockConversation,
          currentUserId: 'user-current',
          onMarkRead: vi.fn(),
        }),
      );

      expect(html).toContain('Fashion Week Campaign');
      expect(html).toContain('Open Chat');
      expect(html).toContain('Mark as Read');
      expect(html).toContain('2 Active');
      expect(html).toContain('#42');
      expect(html).toContain('User user-cur (You)');
      expect(html).toContain('User user-pee');
      expect(html).toContain('Protected by CreatorConnect anti-enumeration');
    });
  });
});
