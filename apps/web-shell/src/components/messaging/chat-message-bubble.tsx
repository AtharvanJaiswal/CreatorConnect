import React from 'react';
import {
  Check,
  CheckCheck,
  Edit2,
  Trash2,
  Copy,
  AlertTriangle,
  Paperclip,
  Eye,
} from 'lucide-react';
import type { MessageResponse, MessageAttachmentResponse } from '@creatorconnect/contracts';
import {
  isMessageEditable,
  getMessageEditTimeRemainingMinutes,
  formatMessageTimestamp,
} from '../../lib/messaging-workflow-service';

export interface ChatMessageBubbleProps {
  message: MessageResponse;
  currentUserId?: string | undefined;
  onEdit?: ((message: MessageResponse) => void) | undefined;
  onDelete?: ((message: MessageResponse) => void) | undefined;
  onInspectAttachment?:
    ((attachment: MessageAttachmentResponse, message: MessageResponse) => void) | undefined;
  peerInitial?: string | undefined;
  userInitial?: string | undefined;
  isRead?: boolean | undefined;
}

export function ChatMessageBubble({
  message,
  currentUserId,
  onEdit,
  onDelete,
  onInspectAttachment,
  peerInitial = 'C',
  userInitial = 'Y',
  isRead = false,
}: ChatMessageBubbleProps) {
  const [copied, setCopied] = React.useState(false);
  const isOutbound = message.senderId === currentUserId;
  const isDeleted = Boolean(message.deletedAt) || message.status === 'DELETED';
  const editable =
    isOutbound && !isDeleted && isMessageEditable(message.createdAt, message.deletedAt);
  const minutesRemaining = editable ? getMessageEditTimeRemainingMinutes(message.createdAt) : 0;
  const timestamp = formatMessageTimestamp(message.createdAt);

  const handleCopy = () => {
    if (isDeleted) return;
    navigator.clipboard?.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`group flex items-start gap-3 my-2 max-w-[85%] sm:max-w-[75%] transition-all ${
        isOutbound ? 'self-end flex-row-reverse' : 'self-start flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-1 shadow-2xs border ${
          isOutbound
            ? 'bg-[#725C00] text-white border-[#564500]'
            : 'bg-[#EFE9DF] text-[#14110F] border-[#E0D8CB]'
        }`}
      >
        {isOutbound ? userInitial : peerInitial}
      </div>

      {/* Bubble Container */}
      <div className={`flex flex-col gap-1 ${isOutbound ? 'items-end' : 'items-start'}`}>
        {/* Header Metadata */}
        <div className="flex items-baseline gap-1.5 px-1 text-[11px] text-[#6F675E]">
          <span className="font-bold text-[#14110F]">{isOutbound ? 'You' : 'Peer'}</span>
          <span>•</span>
          <span>{timestamp}</span>
          {message.updatedAt !== message.createdAt && !isDeleted && (
            <span className="text-[10px] italic text-[#8C827A]">(edited)</span>
          )}
        </div>

        {/* Message Content Bubble with Action Affordances */}
        <div className="relative group/bubble">
          <div
            className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed shadow-xs transition-shadow ${
              isOutbound
                ? isDeleted
                  ? 'bg-[#F5ECE8]/60 text-[#8C827A] italic border border-[#E7E0D5] rounded-tr-xs'
                  : 'bg-[#FFD64A] text-[#231B00] font-normal rounded-tr-xs'
                : isDeleted
                  ? 'bg-[#FAF6EF]/60 text-[#8C827A] italic border border-[#E7E0D5] rounded-tl-xs'
                  : 'bg-[#FAF2EE] text-[#1E1B19] border border-[#EFE9DF] rounded-tl-xs'
            }`}
          >
            {isDeleted ? (
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#8C827A]" />
                [This message was deleted]
              </span>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {message.attachments.map((att, idx) => (
                      <div
                        key={att.id}
                        className={`flex items-center justify-between gap-3 p-2 rounded-xl text-xs border transition-colors ${
                          isOutbound
                            ? 'bg-[#E6BE36]/30 border-[#B8941E]/40 hover:bg-[#E6BE36]/40'
                            : 'bg-white/80 border-[#E7E0D5] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="w-3.5 h-3.5 text-[#6F675E] shrink-0" />
                          <span className="font-semibold truncate text-[11px] text-[#14110F]">
                            Attachment #{idx + 1}
                          </span>
                        </div>
                        {onInspectAttachment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectAttachment(att, message);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[#14110F] text-[10px] font-bold shadow-2xs hover:bg-[#FAF2EE] transition-colors border border-[#E7E0D5]"
                            title="Inspect in Attachment Viewer (I05)"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Floating Hover Actions (Stitch I04 Specification) */}
          {!isDeleted && (
            <div
              className={`absolute -top-3.5 ${
                isOutbound ? 'right-2' : 'left-2'
              } hidden group-hover/bubble:flex items-center gap-1 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-full shadow-md border border-[#E7E0D5] text-[11px] font-semibold text-[#14110F] z-10`}
            >
              <button
                onClick={handleCopy}
                className="hover:text-[#725C00] transition-colors flex items-center gap-1 px-1"
                title="Copy message content"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {editable && onEdit && (
                <>
                  <span className="text-[#DDD5C7]">|</span>
                  <button
                    onClick={() => onEdit(message)}
                    className="hover:text-[#725C00] transition-colors flex items-center gap-1 px-1"
                    title={`Edit message (${minutesRemaining}m remaining)`}
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </>
              )}

              {editable && onDelete && (
                <>
                  <span className="text-[#DDD5C7]">|</span>
                  <button
                    onClick={() => onDelete(message)}
                    className="hover:text-[#BA1A1A] text-[#BA1A1A] transition-colors flex items-center gap-1 px-1"
                    title={`Delete message (${minutesRemaining}m remaining)`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete ({minutesRemaining}m left)</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Outbound Delivery / Read Status (Stitch I04 Specification) */}
        {isOutbound && !isDeleted && (
          <div className="flex items-center gap-1 text-[11px] text-[#6F675E] px-1 mt-0.5">
            {isRead ? (
              <>
                <span>Read</span>
                <CheckCheck className="w-3.5 h-3.5 text-[#2E7D32]" />
              </>
            ) : (
              <>
                <span>Delivered</span>
                <Check className="w-3.5 h-3.5 text-[#8C827A]" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
