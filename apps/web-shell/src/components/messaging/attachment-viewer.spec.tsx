import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttachmentViewer } from './attachment-viewer';
import { AttachmentViewerModal } from './attachment-viewer-modal';
import { ChatMessageBubble } from './chat-message-bubble';
import type { MessageResponse } from '@creatorconnect/contracts';

const mockMessageWithAttachments: MessageResponse = {
  id: 'msg-att-1',
  conversationId: '0192e4ab-1234-7000-8000-000000000001',
  senderId: 'user-rohan-peer',
  sequence: '15',
  clientMessageId: 'cli-att-1',
  content: 'Here is the graded still and storyboard for review.',
  status: 'SENT',
  attachments: [
    {
      id: 'att-101',
      messageId: 'msg-att-1',
      mediaAssetId: 'media-501',
      createdAt: '2026-10-23T10:14:00Z',
    },
    {
      id: 'att-102',
      messageId: 'msg-att-1',
      mediaAssetId: 'media-502',
      createdAt: '2026-10-23T10:14:00Z',
    },
  ],
  deletedAt: null,
  createdAt: '2026-10-23T10:14:00Z',
  updatedAt: '2026-10-23T10:14:00Z',
};

describe('AttachmentViewer (Stitch I05 Specification)', () => {
  it('renders complete I05 two-column workspace with dark cinema canvas and media dossier', () => {
    const html = renderToStaticMarkup(
      <AttachmentViewer
        conversationId="conv-1"
        attachmentId="att-101"
        peerName="Elena Rostova"
        onClose={vi.fn()}
      />,
    );

    // Breadcrumb and return navigation bar
    expect(html).toContain('Return to Thread');
    expect(html).toContain('Conversations');
    expect(html).toContain('Elena Rostova');

    // Dark Cinema Media Stage container
    expect(html).toContain('bg-[#14110F]');
    expect(html).toContain('VAULT ASSET VERIFIED');
    expect(html).not.toContain('ACTIVE MEDIA SCAN');

    // Media Vault Security Footnote
    expect(html).toContain('CreatorConnect Media Vault');
    expect(html).not.toContain('Anti-Malware Active');
    expect(html).toContain('Presigned Asset Link (15m expiry)');
    expect(html).toContain('Access Audit Logged');

    // Right Column Dossier & Provenance Sidebar
    expect(html).toContain('Attachment Details');
    expect(html).toContain('Authorized');
    expect(html).toContain('Active File');
    expect(html).toContain('Sender Provenance');
    expect(html).toContain('15 Minutes');
    expect(html).toContain('Download Unavailable');
  });

  it('renders multi-attachment pager when allAttachments list is provided', () => {
    const html = renderToStaticMarkup(
      <AttachmentViewer
        conversationId="conv-1"
        attachmentId="att-101"
        peerName="Elena Rostova"
        allAttachments={[
          { id: 'att-101', fileName: 'lookbook_01.png' },
          { id: 'att-102', fileName: 'lookbook_02.png' },
          { id: 'att-103', fileName: 'lookbook_03.png' },
        ]}
      />,
    );

    expect(html).toContain('File 1 of 3');
    expect(html).toContain('Previous attachment');
    expect(html).toContain('Next attachment');
  });

  it('renders origin message anchor in dossier when provided', () => {
    const html = renderToStaticMarkup(
      <AttachmentViewer
        conversationId="conv-1"
        attachmentId="att-101"
        peerName="Rohan Kalbag"
        originMessage={mockMessageWithAttachments}
      />,
    );

    expect(html).toContain('Sent in message');
    expect(html).toContain('Here is the graded still and storyboard for review.');
  });
});

describe('AttachmentViewerModal (Stitch I05)', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <AttachmentViewerModal
        isOpen={false}
        onClose={vi.fn()}
        conversationId="conv-1"
        attachmentId="att-101"
      />,
    );

    expect(html).toBe('');
  });

  it('renders modal dialog with backdrop and close button when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <AttachmentViewerModal
        isOpen={true}
        onClose={vi.fn()}
        conversationId="conv-1"
        attachmentId="att-101"
        peerName="Elena Rostova"
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Attachment Viewer"');
    expect(html).toContain('aria-label="Close attachment viewer"');
    expect(html).toContain('Attachment Details');
  });
});

describe('ChatMessageBubble attachment integration (Stitch I04 to I05)', () => {
  it('renders attachment cards and Inspect affordances when message has attachments', () => {
    const html = renderToStaticMarkup(
      <ChatMessageBubble
        message={mockMessageWithAttachments}
        currentUserId="user-self"
        onInspectAttachment={vi.fn()}
      />,
    );

    expect(html).toContain('Attachment #1');
    expect(html).toContain('Attachment #2');
    expect(html).toContain('Inspect');
    expect(html).toContain('title="Inspect in Attachment Viewer (I05)"');
  });

  it('does not render inspect affordances on deleted messages', () => {
    const deletedWithAtt: MessageResponse = {
      ...mockMessageWithAttachments,
      deletedAt: '2026-10-23T10:20:00Z',
      status: 'DELETED',
    };

    const html = renderToStaticMarkup(
      <ChatMessageBubble
        message={deletedWithAtt}
        currentUserId="user-self"
        onInspectAttachment={vi.fn()}
      />,
    );

    expect(html).toContain('[This message was deleted]');
    expect(html).not.toContain('Attachment #1');
    expect(html).not.toContain('Inspect');
  });
});
