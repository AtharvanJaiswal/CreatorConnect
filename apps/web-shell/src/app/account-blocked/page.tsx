'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
  Lock,
} from 'lucide-react';

export default function AccountBlockedPage() {
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referenceId = 'CC-SEC-9842';
  const blockReason = 'Suspicious automated network activity and milestone dispute safety hold.';

  const handleAppealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealText.trim()) {
      setError('Please provide details for your review request.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setTimeout(() => {
      setIsSubmitting(false);
      setAppealSubmitted(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col justify-between selection:bg-[#FFD64A] selection:text-[#14110F]">
      {/* Top Header */}
      <header className="w-full h-20 bg-[#FAF6EF] border-b border-[#E7E0D5] px-6 sm:px-10 lg:px-14 flex items-center justify-between z-30 shrink-0">
        <Link href="/" className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#FFD64A] border-2 border-[#14110F] neo-shadow-sm flex items-center justify-center font-black text-base tracking-tighter text-[#14110F]">
            CC
          </div>
          <div>
            <div className="font-black text-xl tracking-tight leading-none text-[#14110F]">
              CreatorConnect
            </div>
            <span className="text-[10px] uppercase font-bold tracking-[0.16em] text-[#6F675E]">
              Identity & Access Services
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs font-bold text-[#6F675E]">
          <span className="w-2 h-2 rounded-full bg-[#D8483C] animate-pulse" />
          <span>Security Protocol Enforced</span>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)]">
        {/* Left Column: Stitch Editorial Storytelling & Assurance (~42%) */}
        <aside className="lg:col-span-5 bg-[#FAF6EF] border-b lg:border-b-0 lg:border-r border-[#E7E0D5] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#C9B6F7]/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-[#FFB6C8]/20 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFDAD6] border border-[#D8483C]/30 text-[11px] font-black uppercase tracking-wider text-[#93000A] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D8483C]" />
              <span>Account Protection Notice</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#14110F] leading-[1.12]">
              Account status{' '}
              <span className="font-serif italic font-normal text-4xl sm:text-[44px] text-[#725C00]">
                update.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#6F675E] font-medium leading-relaxed max-w-md">
              CreatorConnect takes community guidelines, ecosystem integrity, and escrow safety
              seriously across all creative milestones.
            </p>

            {/* Emblem Card */}
            <div className="my-10 p-6 bg-white rounded-3xl neo-border neo-shadow max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#FFDAD6] flex items-center justify-center text-[#D8483C] mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h4 className="font-heading font-black text-base text-[#14110F] mb-1">
                Safeguard Review Triggered
              </h4>
              <p className="text-xs text-[#6F675E] leading-relaxed">
                Funds in milestone escrow remain fully protected and segregated under RBI-compliant
                custody protocols while appeals are processed.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-[#E7E0D5] flex items-center gap-2 text-xs text-[#6F675E]">
            <Lock className="w-4 h-4 text-[#A39A8F]" />
            <span>Official Notice • Reference ID: {referenceId}</span>
          </div>
        </aside>

        {/* Right Column: Stitch Formal Resolution Workspace (~58%) */}
        <main className="lg:col-span-7 bg-white flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[500px]">
            {/* Top Back Action */}
            <div className="flex items-center justify-between pb-6 mb-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </Link>

              <span className="text-[11px] font-mono text-[#A39A8F]">{referenceId}</span>
            </div>

            <div className="mb-6">
              <h2 className="font-heading font-black text-3xl sm:text-4xl text-[#14110F] tracking-tight mb-2">
                Action required on your account.
              </h2>
              <p className="text-sm text-[#6F675E]">
                Review the notice details below or submit an appeal to our concierge trust & safety
                team.
              </p>
            </div>

            {/* Notice Metadata Card */}
            <div className="rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] p-5 space-y-3 mb-6">
              <div className="flex items-start justify-between gap-4 text-xs">
                <span className="font-bold text-[#6F675E] uppercase tracking-wider">Status:</span>
                <span className="font-bold text-[#D8483C] bg-[#FFDAD6] px-2.5 py-0.5 rounded-full">
                  Temporary Administrative Hold
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 text-xs border-t border-[#E7E0D5] pt-3">
                <span className="font-bold text-[#6F675E] uppercase tracking-wider">Reason:</span>
                <span className="text-right font-medium text-[#14110F] max-w-[300px]">
                  {blockReason}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 text-xs border-t border-[#E7E0D5] pt-3">
                <span className="font-bold text-[#6F675E] uppercase tracking-wider">Case ID:</span>
                <span className="font-mono font-bold text-[#14110F]">{referenceId}</span>
              </div>
            </div>

            {appealSubmitted ? (
              <div className="rounded-2xl border border-[#B6E09B] bg-[#F0FAF2] p-6 text-center space-y-4 animate-in fade-in">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#D5F5E3] flex items-center justify-center text-[#1B7339]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-black text-xl text-[#14110F]">
                  Appeal Submitted for Expedited Review
                </h3>
                <p className="text-xs text-[#2A663E] leading-relaxed max-w-sm mx-auto">
                  Our Trust & Safety committee reviews disputes within 24 business hours. You will
                  receive an SMS update and email confirmation once verified.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#14110F] text-[#FFD64A] text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
                >
                  <span>Return to Homepage</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleAppealSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="appealText"
                    className="text-xs font-bold uppercase tracking-wider text-[#14110F] block"
                  >
                    Statement / Clarification for Review
                  </label>
                  <textarea
                    id="appealText"
                    rows={4}
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    placeholder="Provide context regarding your recent activity or campaign contracts..."
                    className="w-full px-4 py-3 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm text-[#14110F] font-medium outline-none focus:ring-2 focus:ring-[#FFD64A] transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <span>{isSubmitting ? 'Transmitting Appeal...' : 'Submit Expedited Appeal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-2">
                  <a
                    href="mailto:safety@creatorconnect.in"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6F675E] hover:text-[#14110F] underline underline-offset-2"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Contact Concierge Safety Team Directly</span>
                  </a>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
