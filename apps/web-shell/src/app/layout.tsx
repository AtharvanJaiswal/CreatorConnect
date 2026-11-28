import type { Metadata } from 'next';
import { headers } from 'next/headers';
import React from 'react';
import '@creatorconnect/design-system/globals.css';
import { AuthProvider } from '../providers/auth-provider';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CreatorConnect — Admin Operations Console',
  description: 'Enterprise administration, moderation, and ledger management portal.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Opt into per-request dynamic rendering so middleware-generated CSP nonces bind safely on every render
  const requestHeaders = await headers();
  void requestHeaders.get('x-nonce');

  return (
    <html lang="en" className="light">
      <head />
      <body className="min-h-screen bg-[#FAF6EF] font-sans text-foreground antialiased selection:bg-[#FFD64A]/30 selection:text-[#14110F]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
