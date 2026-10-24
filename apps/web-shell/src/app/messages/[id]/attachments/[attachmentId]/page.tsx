'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../providers/auth-provider';
import { AttachmentViewer } from '../../../../../components/messaging/attachment-viewer';
import { Header } from '../../../../../components/header';
import { Loader2 } from 'lucide-react';

export default function AttachmentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = typeof params?.id === 'string' ? params.id : '';
  const attachmentId = typeof params?.attachmentId === 'string' ? params.attachmentId : '';

  const { user, accessToken, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 text-[#6F675E]">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFD64A]" />
            <p className="text-sm font-medium">Verifying credentials and permissions...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user && !isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-[#EFE9DF] shadow-xs flex flex-col items-center gap-4">
            <h2 className="font-bold text-lg text-[#14110F]">Authentication Required</h2>
            <p className="text-xs text-[#6F675E] leading-relaxed">
              You must be signed in with an active conversation account to view secure attachments.
            </p>
            <Link
              href="/login"
              className="px-6 py-2.5 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs"
            >
              Sign In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <AttachmentViewer
          conversationId={conversationId}
          attachmentId={attachmentId}
          token={accessToken}
          onClose={() => router.push(`/messages/${conversationId}`)}
          standalone={true}
        />
      </main>
    </div>
  );
}
