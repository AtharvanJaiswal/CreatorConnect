import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface InboxErrorStateProps {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function InboxErrorState({
  message = 'Message Sync Disrupted',
  onRetry,
  isRetrying = false,
}: InboxErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-3xl border border-[#F3C4C4] shadow-xs w-full"
      role="alert"
    >
      <div className="w-16 h-16 rounded-full bg-[#FDF2F2] border border-[#F7D0D0] flex items-center justify-center mb-4 text-[#D32F2F]">
        <AlertCircle className="w-8 h-8" />
      </div>

      <h3 className="font-serif text-2xl font-bold text-[#14110F] mb-2 tracking-tight">
        {message}
      </h3>

      <p className="text-sm text-[#6F675E] max-w-md mb-6 leading-relaxed">
        We encountered a communication issue retrieving your conversation list. Your encrypted
        messages and participant permissions remain secure on the ledger.
      </p>

      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="bg-[#14110F] hover:bg-[#2A2421] text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-2xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
        {isRetrying ? 'Connecting...' : 'Retry Connection'}
      </button>
    </div>
  );
}
