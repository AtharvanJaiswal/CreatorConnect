'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function ReactivateAccountPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('9876543210');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReactivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setError('Please enter your mobile number or registered email.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/creator');
      }, 1500);
    }, 800);
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
              Identity & Access
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs font-bold text-[#6F675E]">
          <Link
            href="/login"
            className="text-xs font-bold uppercase tracking-wider text-[#14110F] hover:text-[#725C00]"
          >
            Sign In Instead
          </Link>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)]">
        {/* Left Column: Stitch Storytelling (~42%) */}
        <aside className="lg:col-span-5 bg-[#FAF6EF] border-b lg:border-b-0 lg:border-r border-[#E7E0D5] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#C9B6F7]/30 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-[#FFD64A]/25 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9DDFF] text-[10px] font-bold uppercase tracking-widest text-[#210F47] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#65558F]" />
              <span>Account Recovery Protocol</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#14110F] leading-[1.08]">
              Come back to{' '}
              <span className="font-serif italic font-normal text-4xl sm:text-[52px] text-[#725C00]">
                creating.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#6F675E] font-medium leading-relaxed max-w-md">
              Restore your profile, collaborations, and community access with quick one-step
              verification.
            </p>

            {/* Central Graphic Vector Tile */}
            <div className="my-10 relative flex items-center justify-center">
              <div className="relative w-64 h-64 rounded-full bg-[#C9B6F7]/40 flex items-center justify-center">
                <div className="absolute inset-4 rounded-full bg-[#FFD64A]/30" />
                <div className="relative z-10 w-36 h-36 rounded-full bg-white shadow-xl flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#FAF6EF] flex items-center justify-center text-[#725C00] mb-1">
                    <RotateCcw className="w-5 h-5 animate-spin duration-3000" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#14110F]">
                    100% Retained
                  </span>
                  <span className="text-[9px] text-[#6F675E]">Profile & Network</span>
                </div>

                <div className="absolute top-2 right-4 px-3 py-1 rounded-full bg-[#FFB6C8] text-[9px] font-bold text-[#14110F] shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Indian Creator Pool</span>
                </div>

                <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-white text-[9px] font-bold text-[#14110F] shadow-sm flex items-center gap-1 border border-[#E7E0D5]">
                  <ShieldCheck className="w-3 h-3 text-[#1B7339]" />
                  <span>Algorithmic Sync</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-[#E7E0D5] flex items-center gap-2 text-xs text-[#6F675E]">
            <CheckCircle2 className="w-4 h-4 text-[#1B7339]" />
            <span>Eligible accounts are restored immediately upon verification.</span>
          </div>
        </aside>

        {/* Right Column: Stitch Reactivation Workspace (~58%) */}
        <main className="lg:col-span-7 bg-white flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[480px]">
            {/* Top Back Action */}
            <div className="flex items-center justify-between pb-6 mb-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </Link>

              <span className="text-xs font-bold uppercase tracking-widest text-[#A39A8F]">
                Quick Restore
              </span>
            </div>

            <div className="mb-6">
              <h2 className="font-heading font-black text-3xl sm:text-4xl text-[#14110F] tracking-tight mb-2">
                Verify to restore access.
              </h2>
              <p className="text-sm text-[#6F675E]">
                Enter your mobile number or registered email to verify your identity and reactivate
                your profile.
              </p>
            </div>

            {isSuccess ? (
              <div className="rounded-2xl border border-[#B6E09B] bg-[#F0FAF2] p-6 text-center space-y-4 animate-in fade-in">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#D5F5E3] flex items-center justify-center text-[#1B7339]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-black text-xl text-[#14110F]">
                  Account Successfully Reactivated!
                </h3>
                <p className="text-xs text-[#2A663E] leading-relaxed max-w-sm mx-auto">
                  Your creative portfolio, milestone connections, and messaging history have been
                  restored. Redirecting to your workspace...
                </p>
              </div>
            ) : (
              <form onSubmit={handleReactivate} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="identifier"
                    className="text-xs font-bold uppercase tracking-wider text-[#14110F] block"
                  >
                    Mobile Number or Registered Email
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. 9876543210 or creator@example.com"
                    className="w-full px-4 py-3.5 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm text-[#14110F] font-medium outline-none focus:ring-2 focus:ring-[#FFD64A] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="verificationCode"
                    className="text-xs font-bold uppercase tracking-wider text-[#14110F] block"
                  >
                    One-Time Passcode (if received via SMS)
                  </label>
                  <input
                    id="verificationCode"
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit OTP (optional for instant restore)"
                    className="w-full px-4 py-3.5 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm font-mono text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A] transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm mt-4"
                >
                  <span>{isSubmitting ? 'Restoring Profile...' : 'Reactivate Account Now'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-[11px] text-[#A39A8F] text-center leading-relaxed pt-2">
                  By clicking Reactivate, you confirm your identity and agree to resume your
                  CreatorConnect contractual agreements and platform terms.
                </p>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
