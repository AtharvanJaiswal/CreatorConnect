'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { VerificationCentrePanel } from '../../components/profile/verification-centre-panel';

export default function VerificationPage() {
  const router = useRouter();

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      <VerificationCentrePanel
        initialIsVerified={false}
        onNavigateOverview={() => router.push('/profiles/me')}
        onNavigateBack={() => router.push('/profiles/me?tab=socials')}
      />
    </div>
  );
}
