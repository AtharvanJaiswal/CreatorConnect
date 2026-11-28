'use client';

import React from 'react';
import { CalendarClock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';

export default function AdminReferralsPage() {
  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Referrals & Affiliate Program
          </h1>
          <AdminBadge variant="warning" size="sm">
            Planned Feature
          </AdminBadge>
        </div>
        <p className="text-xs sm:text-sm text-[#6F675E]">
          Creator affiliate attribution, invitation rewards, and growth commission governance.
        </p>
      </div>

      {/* Explicit Not Yet Available State */}
      <AdminCard padding="lg">
        <div className="max-w-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FBF1DC] text-[#C98A16] flex items-center justify-center">
            <CalendarClock className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#14110F] mb-1">
              Backend Implementation Not Yet Available
            </h2>
            <p className="text-sm text-[#6F675E] leading-relaxed">
              In accordance with Phase 4.1 engineering integrity guidelines, this screen does not
              display simulated metrics, fabricated conversion rates, or placeholder referral
              records.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#C98A16] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#14110F] block mb-0.5">Architectural Status</strong>
                <span className="text-[#6F675E] leading-relaxed">
                  No relational database schema, ledger attribution tables, or backend service
                  endpoints currently exist for affiliate referral tracking in the platform.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#2E9E6B] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#14110F] block mb-0.5">Target Delivery Milestone</strong>
                <span className="text-[#6F675E] leading-relaxed">
                  A formal technical proposal covering double-entry commission accounting,
                  anti-fraud attribution guards, and referral lifecycle workflows will precede
                  database schema introduction in a subsequent milestone.
                </span>
              </div>
            </div>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}
