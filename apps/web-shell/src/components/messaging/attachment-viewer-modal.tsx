import React from 'react';
import { X } from 'lucide-react';
import type { MessageResponse } from '@creatorconnect/contracts';
import { AttachmentViewer } from './attachment-viewer';

export interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  attachmentId: string;
  token?: string | null | undefined;
  originMessage?: MessageResponse | undefined;
  peerName?: string | undefined;
  allAttachments?:
    | Array<{ id: string; fileName?: string | undefined; mediaAssetId?: string | undefined }>
    | undefined;
  onSelectAttachment?: ((attachmentId: string) => void) | undefined;
}

export function AttachmentViewerModal({
  isOpen,
  onClose,
  conversationId,
  attachmentId,
  token,
  originMessage,
  peerName,
  allAttachments,
  onSelectAttachment,
}: AttachmentViewerModalProps) {
  // Close on ESC key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is active
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attachment Viewer"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-6xl max-h-[95vh] overflow-y-auto bg-[#FBF9F4] rounded-3xl p-4 sm:p-6 shadow-2xl border border-[#EFE9DF]">
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-[#14110F] shadow-sm flex items-center justify-center transition-colors border border-[#E7E0D5]"
          aria-label="Close attachment viewer"
        >
          <X className="w-4 h-4" />
        </button>

        <AttachmentViewer
          conversationId={conversationId}
          attachmentId={attachmentId}
          token={token}
          onClose={onClose}
          originMessage={originMessage}
          peerName={peerName}
          allAttachments={allAttachments}
          onSelectAttachment={onSelectAttachment}
        />
      </div>
    </div>
  );
}
