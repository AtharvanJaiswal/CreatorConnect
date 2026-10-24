import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageRequestCard } from './message-request-card';
import { MessageRequestDetailPane } from './message-request-detail-pane';
import { ComposeRequestModal } from './compose-request-modal';
import { DeclineRequestDialog } from './decline-request-dialog';
import {
  formatMessageRequestExpiry,
  formatMessageRequestStatus,
} from '../../lib/messaging-workflow-service';
import type { MessageRequestResponse } from '@creatorconnect/contracts';

const mockPendingInboundRequest: MessageRequestResponse = {
  id: '01912952-4a00-7000-8000-000000000001',
  senderId: '01912952-4a00-7000-8000-000000000002',
  recipientId: '01912952-4a00-7000-8000-000000000003',
  conversationId: null,
  initialMessage: 'Hi! I would love to collaborate on your upcoming luxury lifestyle campaign.',
  status: 'PENDING',
  declinedReason: null,
  expiresAt: new Date(Date.now() + 6 * 86400000).toISOString(), // 6 days in future
  respondedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  senderProfile: {
    displayName: 'Elena Rostova',
    avatarUrl: null,
    role: 'Fashion Model & Creator',
    location: 'Milan, Italy',
    isVerified: true,
  },
};

const mockAcceptedRequest: MessageRequestResponse = {
  ...mockPendingInboundRequest,
  id: '01912952-4a00-7000-8000-000000000004',
  status: 'ACCEPTED',
  conversationId: '01912952-4a00-7000-8000-000000000005',
  respondedAt: new Date().toISOString(),
};

const mockDeclinedRequest: MessageRequestResponse = {
  ...mockPendingInboundRequest,
  id: '01912952-4a00-7000-8000-000000000006',
  status: 'DECLINED',
  declinedReason: 'Currently fully booked for Q4 collaborations.',
  respondedAt: new Date().toISOString(),
};

const mockExpiredRequest: MessageRequestResponse = {
  ...mockPendingInboundRequest,
  id: '01912952-4a00-7000-8000-000000000007',
  status: 'EXPIRED',
  expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour in the past
};

describe('MessageRequest UI Components (Milestone 2D)', () => {
  describe('formatMessageRequestExpiry', () => {
    it('formats days remaining', () => {
      const now = Date.now();
      const expiresAt = new Date(now + 3 * 86400000).toISOString();
      const result = formatMessageRequestExpiry(expiresAt, now);
      expect(result.isExpired).toBe(false);
      expect(result.label).toBe('Expires in 3 days');
    });

    it('formats hours remaining', () => {
      const now = Date.now();
      const expiresAt = new Date(now + 5 * 3600000).toISOString();
      const result = formatMessageRequestExpiry(expiresAt, now);
      expect(result.isExpired).toBe(false);
      expect(result.label).toBe('Expires in 5h');
    });

    it('returns Expired when time has passed', () => {
      const now = Date.now();
      const expiresAt = new Date(now - 1000).toISOString();
      const result = formatMessageRequestExpiry(expiresAt, now);
      expect(result.isExpired).toBe(true);
      expect(result.label).toBe('Expired');
    });
  });

  describe('formatMessageRequestStatus', () => {
    it('returns appropriate badge styling for all 5 statuses', () => {
      expect(formatMessageRequestStatus('PENDING').label).toBe('Pending Response');
      expect(formatMessageRequestStatus('ACCEPTED').label).toBe('Accepted');
      expect(formatMessageRequestStatus('DECLINED').label).toBe('Declined');
      expect(formatMessageRequestStatus('EXPIRED').label).toBe('Expired');
      expect(formatMessageRequestStatus('CANCELLED').label).toBe('Cancelled');
    });
  });

  describe('MessageRequestCard', () => {
    it('renders inbound request with sender display name, role, verified badge, and message preview', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestCard, {
          request: mockPendingInboundRequest,
          isSelected: false,
          onSelect: vi.fn(),
          currentUserId: '01912952-4a00-7000-8000-000000000003', // recipient
        }),
      );

      expect(html).toContain('Elena Rostova');
      expect(html).toContain('Fashion Model &amp; Creator');
      expect(html).toContain('Inbound Request');
      expect(html).toContain('Pending Response');
      expect(html).toContain('luxury lifestyle campaign');
    });

    it('renders outgoing request with outgoing proposal label', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestCard, {
          request: mockPendingInboundRequest,
          isSelected: true,
          onSelect: vi.fn(),
          currentUserId: '01912952-4a00-7000-8000-000000000002', // sender
        }),
      );

      expect(html).toContain('Outgoing Proposal');
    });

    it('renders selected styling when isSelected is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestCard, {
          request: mockPendingInboundRequest,
          isSelected: true,
          onSelect: vi.fn(),
          currentUserId: '01912952-4a00-7000-8000-000000000003',
        }),
      );

      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('border-[#14110F]');
    });
  });

  describe('MessageRequestDetailPane', () => {
    it('renders empty placeholder when request is null', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestDetailPane, {
          request: null,
          currentUserId: '01912952-4a00-7000-8000-000000000003',
          onAccept: vi.fn(),
          onDecline: vi.fn(),
          onCancel: vi.fn(),
          onOpenConversation: vi.fn(),
        }),
      );

      expect(html).toContain('No Request Selected');
    });

    it('renders Accept and Decline buttons for eligible inbound pending request', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestDetailPane, {
          request: mockPendingInboundRequest,
          currentUserId: '01912952-4a00-7000-8000-000000000003', // recipient
          onAccept: vi.fn(),
          onDecline: vi.fn(),
          onCancel: vi.fn(),
          onOpenConversation: vi.fn(),
        }),
      );

      expect(html).toContain('Accept &amp; Start Chat');
      expect(html).toContain('Decline');
      expect(html).not.toContain('Cancel Request');
      expect(html).not.toContain('Open Active Conversation');
    });

    it('renders Cancel button for outgoing pending request', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestDetailPane, {
          request: mockPendingInboundRequest,
          currentUserId: '01912952-4a00-7000-8000-000000000002', // sender
          onAccept: vi.fn(),
          onDecline: vi.fn(),
          onCancel: vi.fn(),
          onOpenConversation: vi.fn(),
        }),
      );

      expect(html).toContain('Cancel Request');
      expect(html).not.toContain('Accept &amp; Start Chat');
    });

    it('renders Open Active Conversation button ONLY after request is ACCEPTED', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestDetailPane, {
          request: mockAcceptedRequest,
          currentUserId: '01912952-4a00-7000-8000-000000000003',
          onAccept: vi.fn(),
          onDecline: vi.fn(),
          onCancel: vi.fn(),
          onOpenConversation: vi.fn(),
        }),
      );

      expect(html).toContain('Open Active Conversation');
      expect(html).not.toContain('Accept &amp; Start Chat');
      expect(html).not.toContain('Decline');
    });

    it('displays decline reason when request is DECLINED', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestDetailPane, {
          request: mockDeclinedRequest,
          currentUserId: '01912952-4a00-7000-8000-000000000002',
          onAccept: vi.fn(),
          onDecline: vi.fn(),
          onCancel: vi.fn(),
          onOpenConversation: vi.fn(),
        }),
      );

      expect(html).toContain('Decline Reason:');
      expect(html).toContain('Currently fully booked for Q4 collaborations.');
      expect(html).not.toContain('Accept &amp; Start Chat');
    });

    it('does not display accept or open conversation buttons when EXPIRED', () => {
      const html = renderToStaticMarkup(
        React.createElement(MessageRequestDetailPane, {
          request: mockExpiredRequest,
          currentUserId: '01912952-4a00-7000-8000-000000000003',
          onAccept: vi.fn(),
          onDecline: vi.fn(),
          onCancel: vi.fn(),
          onOpenConversation: vi.fn(),
        }),
      );

      expect(html).not.toContain('Accept &amp; Start Chat');
      expect(html).not.toContain('Open Active Conversation');
      expect(html).toContain('This request expired after 7 days');
    });
  });

  describe('ComposeRequestModal', () => {
    it('renders dialog with recipient input, 500-char textarea limit, and advisory notice', () => {
      const html = renderToStaticMarkup(
        React.createElement(ComposeRequestModal, {
          isOpen: true,
          onClose: vi.fn(),
          onRequestCreated: vi.fn(),
        }),
      );

      expect(html).toContain('Start Message Request');
      expect(html).toContain('Consent-Gated Communication');
      expect(html).toContain('500 characters');
      expect(html).toContain('Send Message Request');
    });

    it('renders nothing when isOpen is false', () => {
      const html = renderToStaticMarkup(
        React.createElement(ComposeRequestModal, {
          isOpen: false,
          onClose: vi.fn(),
          onRequestCreated: vi.fn(),
        }),
      );

      expect(html).toBe('');
    });
  });

  describe('DeclineRequestDialog', () => {
    it('renders decline confirmation with 30-day cooldown explanation', () => {
      const html = renderToStaticMarkup(
        React.createElement(DeclineRequestDialog, {
          isOpen: true,
          request: mockPendingInboundRequest,
          onClose: vi.fn(),
          onConfirmDecline: vi.fn(),
        }),
      );

      expect(html).toContain('Decline Request');
      expect(html).toContain('30-Day Re-Request Cooldown');
      expect(html).toContain('Elena Rostova');
    });
  });
});
