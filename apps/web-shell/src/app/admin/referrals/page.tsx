'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Sliders } from 'lucide-react';

export default function AdminReferralsPage() {
  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
          Referrals & Subscription Programs
        </h1>
        <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
          Growth incentives, creator affiliate commissions, and membership tier governance.
        </p>
      </div>

      {/* Architectural Status Banner */}
      <div className="p-8 rounded-3xl bg-white border border-[#E7E0D5] shadow-xs">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF8D6] border border-[#FCE192] text-[#7A5B00] text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phase 5 Planned Growth Architecture</span>
          </div>

          <h2 className="text-2xl font-bold text-[#14110F] mb-3">
            Referrals Model Currently Managed via Platform Settings
          </h2>

          <p className="text-sm text-[#6F675E] leading-relaxed mb-6">
            In accordance with the repository architecture audit, dynamic referral rewards and tier
            limitations are currently governed through global parameter keys in the Platform
            Configuration service. Dedicated affiliate database entities are planned for the Phase 5
            Growth Module.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/config"
              className="btn-pill btn-pill-primary text-xs px-5 py-2.5 font-bold shadow-xs inline-flex items-center gap-2"
            >
              <Sliders className="w-4 h-4" />
              <span>Configure Referral Keys in Platform Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
