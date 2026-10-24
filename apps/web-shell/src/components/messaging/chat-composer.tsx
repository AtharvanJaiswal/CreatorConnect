'use client';

import React, { useState, useRef } from 'react';
import { Send, Paperclip, Smile, AlertCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { generateUuidV7 } from '@creatorconnect/utils';

export interface ChatComposerProps {
  onSendMessage: (payload: { clientMessageId: string; content: string }) => Promise<void>;
  disabled?: boolean;
  isBlocked?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  onSendMessage,
  disabled = false,
  isBlocked = false,
  placeholder = 'Write a message... (Shift + Enter for new line)',
}: ChatComposerProps) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [failedMessage, setFailedMessage] = useState<{
    clientMessageId: string;
    content: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending || disabled || isBlocked) return;
    if (trimmed.length > 5000) {
      setErrorMessage('Message exceeds 5,000 character maximum limit.');
      return;
    }

    const payload = {
      clientMessageId: generateUuidV7(),
      content: trimmed,
    };

    setIsSending(true);
    setErrorMessage(null);
    setFailedMessage(null);

    try {
      await onSendMessage(payload);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err: any) {
      setFailedMessage(payload);
      setErrorMessage(err?.message || 'Message delivery failed. You can retry safely.');
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = async () => {
    if (!failedMessage || isSending) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      await onSendMessage(failedMessage);
      setFailedMessage(null);
      setContent('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Retry failed. Check network connectivity.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (errorMessage) setErrorMessage(null);

    // Auto-grow height up to 160px
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  return (
    <footer className="flex flex-col bg-[#FFFFFF] border-t border-[#E7E0D5] px-6 py-4 rounded-b-3xl shadow-xs">
      {/* Inline Failed Send Callout (Stitch I04 Specification) */}
      {errorMessage && (
        <div className="mb-3 p-3 rounded-2xl bg-[#FFDAD6] text-[#93000A] flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#BA1A1A]" />
            <div>
              <p className="font-bold">{errorMessage}</p>
              {failedMessage && (
                <p className="text-[11px] opacity-85 truncate max-w-md">
                  "{failedMessage.content}"
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {failedMessage && (
              <button
                onClick={handleRetry}
                disabled={isSending}
                className="px-3 py-1 rounded-full bg-white text-[#14110F] font-bold text-xs hover:bg-[#FAF6EF] shadow-2xs transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isSending ? 'animate-spin' : ''}`} />
                <span>Retry Send</span>
              </button>
            )}
            <button
              onClick={() => {
                setErrorMessage(null);
                setFailedMessage(null);
              }}
              className="p-1 rounded-full hover:bg-white/50 text-[#93000A] transition-colors"
              title="Dismiss warning"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Blocked Conversation Notice */}
      {isBlocked && (
        <div className="mb-3 p-3 rounded-2xl bg-[#FFDAD6]/60 border border-[#BA1A1A]/30 text-[#93000A] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>This conversation is restricted or blocked. Messaging is disabled.</span>
        </div>
      )}

      {/* Composer Input Area */}
      <div className="bg-[#FAF2EE] rounded-2xl p-2.5 border border-[#EFE9DF] focus-within:border-[#725C00] transition-colors shadow-2xs">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isBlocked || isSending}
          placeholder={isBlocked ? 'Messaging disabled for blocked thread.' : placeholder}
          rows={2}
          className="w-full bg-transparent px-3 py-1.5 text-sm text-[#14110F] placeholder-[#6F675E] outline-none resize-none leading-relaxed disabled:opacity-50"
        />

        <div className="flex items-center justify-between pt-2 px-2 border-t border-[#E7E0D5]/60 mt-1">
          {/* Left toolbar affordances */}
          <div className="flex items-center gap-1 text-[#6F675E]">
            <button
              type="button"
              disabled={isBlocked || disabled}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-[#E7E0D5] hover:bg-[#FAF6EF] transition-colors text-[#14110F] disabled:opacity-50"
              title="Attach media or project assets (Milestone 3)"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#6F675E]" />
              <span className="hidden sm:inline">Attach file (25MB)</span>
            </button>

            <button
              type="button"
              disabled={isBlocked || disabled}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white hover:text-[#14110F] transition-colors text-[#6F675E] disabled:opacity-50"
              title="Insert Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          {/* Right send button + Return hint */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[11px] text-[#6F675E]">
              Press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E7E0D5] text-[#14110F] font-mono text-[10px]">
                Return
              </kbd>{' '}
              to send
            </span>

            <button
              onClick={handleSend}
              disabled={!content.trim() || isSending || disabled || isBlocked}
              className="bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] active:scale-95 px-5 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{isSending ? 'Sending...' : 'Send'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#8C827A] mt-2.5">
        <ShieldCheck className="w-3 h-3 text-[#2E7D32]" />
        <span>Platform Safety Protocol • Monotonic Keyset Integrity</span>
      </div>
    </footer>
  );
}
