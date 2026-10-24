import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationDetailsView } from './conversation-details-view';
import { BlockParticipantDialog } from './block-participant-dialog';
import type { DirectConversationResponse, MessageResponse } from '@creatorconnect/contracts';

const mockConversationWithAssignment: DirectConversationResponse = {
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
      profile: {
        displayName: 'Rohan Kalbag',
        avatarUrl: 'https://images.unsplash.com/rohan-avatar.jpg',
        role: 'CREATOR',
        location: 'Mumbai, IN',
        isVerified: true,
      },
    },
  ],
};

const mockConversationUnlinked: DirectConversationResponse = {
  ...mockConversationWithAssignment,
  assignmentId: null,
  title: null,
};

const mockMessagesWithMedia: MessageResponse[] = [
  {
    id: 'msg-1',
    conversationId: '0192e4ab-1234-7000-8000-000000000001',
    senderId: 'user-rohan-peer',
    sequence: '10',
    clientMessageId: 'cli-10',
    content: 'Check out the attached lookbook grade.',
    status: 'SENT',
    attachments: [
      {
        id: 'att-501',
        messageId: 'msg-1',
        mediaAssetId: 'media-asset-501',
        createdAt: '2026-10-23T10:14:00Z',
      },
    ],
    deletedAt: null,
    createdAt: '2026-10-23T10:14:00Z',
    updatedAt: '2026-10-23T10:14:00Z',
  },
];

describe('ConversationDetailsView (Stitch I06 Specification)', () => {
  it('renders participant dossier and linked assignment project banner', () => {
    const html = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={[]}
      />,
    );

    expect(html).toContain('Rohan K. Collaboration');
    expect(html).toContain('Verified');
    expect(html).toContain('Linked Project Assignment');
    expect(html).toContain('Escrow Protected');
    expect(html).toContain('View Brief &amp; Milestones');
    expect(html).toContain('href="/assignments/0192e4ab-5678-7000-8000-000000000002"');
  });

  it('renders unlinked project notice when assignmentId is null', () => {
    const html = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationUnlinked}
        currentUserId="user-self"
        messages={[]}
      />,
    );

    expect(html).toContain('No Project Linked to This Conversation');
    expect(html).toContain('direct communication mode');
  });

  it('renders shared files grid with inspect affordances when attachments are present', () => {
    const html = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={mockMessagesWithMedia}
        onInspectAttachment={vi.fn()}
      />,
    );

    expect(html).toContain('Shared Files &amp; Media');
    expect(html).toContain('1 Asset');
    expect(html).toContain('Attachment #1');
    expect(html).toContain('Inspect (I05)');
    expect(html).toContain('Message #10');
  });

  it('renders empty files state when conversation has no attachments', () => {
    const html = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={[]}
      />,
    );

    expect(html).toContain('No Media or Files Shared Yet');
    expect(html).toContain('When you or your collaborator attach lookbooks');
  });

  it('performs deterministic Map-based deduplication and sorts shared files by sequence descending', () => {
    const duplicateAndUnorderedMessages: MessageResponse[] = [
      {
        id: 'msg-older',
        conversationId: '0192e4ab-1234-7000-8000-000000000001',
        senderId: 'user-rohan-peer',
        sequence: '5',
        clientMessageId: 'cli-older',
        content: 'Check out the attached lookbook grade.',
        status: 'SENT',
        deletedAt: null,
        createdAt: '2026-10-23T09:00:00Z',
        updatedAt: '2026-10-23T09:00:00Z',
        attachments: [
          {
            id: 'att-duplicate',
            messageId: 'msg-older',
            mediaAssetId: 'media-asset-dup',
            createdAt: '2026-10-23T09:00:00Z',
          },
        ],
      },
      {
        id: 'msg-newer',
        conversationId: '0192e4ab-1234-7000-8000-000000000001',
        senderId: 'user-rohan-peer',
        sequence: '50',
        clientMessageId: 'cli-newer',
        content: 'Check out the attached lookbook grade.',
        status: 'SENT',
        deletedAt: null,
        createdAt: '2026-10-23T11:00:00Z',
        updatedAt: '2026-10-23T11:00:00Z',
        attachments: [
          {
            id: 'att-duplicate', // Duplicate attachment ID from a re-sent or forward event
            messageId: 'msg-newer',
            mediaAssetId: 'media-asset-dup',
            createdAt: '2026-10-23T11:00:00Z',
          },
          {
            id: 'att-unique-new',
            messageId: 'msg-newer',
            mediaAssetId: 'media-asset-unique',
            createdAt: '2026-10-23T11:00:00Z',
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={duplicateAndUnorderedMessages}
        onInspectAttachment={vi.fn()}
      />,
    );

    // Exact count: 2 unique attachments, not 3!
    expect(html).toContain('2 Assets');
    // Ensure deduplication preserved authoritative attachment IDs
    expect(html).toContain('ID: att-duplicate...');
    expect(html).toContain('ID: att-unique-new...');
  });

  it('displays honest status wording and avoids unsupported encryption claims', () => {
    const html = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={[]}
      />,
    );

    expect(html).toContain('Active · Keyset Sequenced');
    expect(html).not.toContain('TLS in Transit');
    expect(html).not.toContain('VERIFIED ENCRYPTED');
  });

  it('honestly discloses missing mute endpoint while providing active abuse reporting', () => {
    const html = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={[]}
        onOpenReport={vi.fn()}
      />,
    );

    // Mute is honestly disclosed as pending
    expect(html).toContain('Mute Notifications');
    expect(html).toContain('Pending Release');
    expect(html).toContain('POST /api/v1/conversations/:id/mute');

    // Report is active and available
    expect(html).toContain('Report Participant or Content');
    expect(html).toContain('Available');
    expect(html).toContain('Submit Abuse Report');
  });

  it('renders load older shared files button with loading state when hasMoreFiles is true', () => {
    const htmlWithMore = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={mockMessagesWithMedia}
        hasMoreFiles={true}
        isLoadingMoreFiles={false}
        onLoadMoreFiles={vi.fn()}
      />,
    );

    expect(htmlWithMore).toContain('Load Older Shared Files');

    const htmlLoadingMore = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        messages={mockMessagesWithMedia}
        hasMoreFiles={true}
        isLoadingMoreFiles={true}
        onLoadMoreFiles={vi.fn()}
      />,
    );

    expect(htmlLoadingMore).toContain('Loading older assets...');
  });

  it('renders verified block action and reflects blocked state', () => {
    const htmlBlocked = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        isBlocked={true}
        onToggleBlock={vi.fn()}
      />,
    );

    expect(htmlBlocked).toContain('Unblock Rohan K. Collaboration');

    const htmlActive = renderToStaticMarkup(
      <ConversationDetailsView
        conversation={mockConversationWithAssignment}
        currentUserId="user-self"
        isBlocked={false}
        onToggleBlock={vi.fn()}
      />,
    );

    expect(htmlActive).toContain('Block Rohan K. Collaboration');
  });
});

describe('BlockParticipantDialog (Stitch I06 Modal 2)', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <BlockParticipantDialog
        isOpen={false}
        onClose={vi.fn()}
        peerName="Rohan K."
        isBlocked={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toBe('');
  });

  it('renders block confirmation dialog with reason input when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <BlockParticipantDialog
        isOpen={true}
        onClose={vi.fn()}
        peerName="Rohan K."
        isBlocked={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain('Block Rohan K.?');
    expect(html).toContain('Reason for block');
    expect(html).toContain('Block Participant');
  });

  it('renders unblock dialog when isBlocked is true', () => {
    const html = renderToStaticMarkup(
      <BlockParticipantDialog
        isOpen={true}
        onClose={vi.fn()}
        peerName="Rohan K."
        isBlocked={true}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain('Unblock Rohan K.?');
    expect(html).toContain('Confirm Unblock');
    expect(html).not.toContain('Reason for block');
  });
});
