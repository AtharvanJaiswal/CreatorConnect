'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Headphones,
} from 'lucide-react';
import { createClient } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password reset request failed.');
    } finally {
      setIsSubmitting(false);
    }
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
          <span className="w-2 h-2 rounded-full bg-[#1B7339]" />
          <span>ISO 27001 & SOC2 Certified</span>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)]">
        {/* Left Column: Stitch Brand Narrative (~42%) */}
        <aside className="lg:col-span-5 bg-[#FAF6EF] border-b lg:border-b-0 lg:border-r border-[#E7E0D5] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#C9B6F7]/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-[#FFD64A]/20 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9DDFF] text-[10px] font-bold uppercase tracking-widest text-[#210F47] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#65558F]" />
              <span>Account Recovery Protocol</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#14110F] leading-[1.08]">
              <span className="font-serif italic font-normal text-4xl sm:text-[52px] text-[#725C00] block">
                Regain access
              </span>
              to India&apos;s leading creator marketplace.
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#6F675E] font-medium leading-relaxed max-w-md">
              Security-first access control built for top digital creators, talent agencies, and
              high-velocity brands across South Asia.
            </p>

            <div className="space-y-4 pt-8">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E7E0D5] flex items-center justify-center text-[#725C00] shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#14110F]">
                    End-to-End Cryptographic Guard
                  </h4>
                  <p className="text-xs text-[#6F675E]">
                    One-time magic reset tokens expire strictly within 15 minutes of issuance.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E7E0D5] flex items-center justify-center text-[#65558F] shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#14110F]">
                    Biometric & MFA Reconciliation
                  </h4>
                  <p className="text-xs text-[#6F675E]">
                    Algorithmic monitoring safeguards brand campaign escrows and verified payouts.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E7E0D5] flex items-center justify-center text-[#864D5D] shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#14110F]">
                    Human Escalation Available
                  </h4>
                  <p className="text-xs text-[#6F675E]">
                    Concierge support engineers standing by 24/7 in Mumbai and Bengaluru.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-[#E7E0D5] flex items-center justify-between text-xs text-[#6F675E]">
            <span>© 2025 CreatorConnect Inc.</span>
            <div className="flex items-center gap-3">
              <Link href="#" className="hover:underline">
                Privacy
              </Link>
              <span>•</span>
              <Link href="#" className="hover:underline">
                Security
              </Link>
              <span>•</span>
              <Link href="#" className="hover:underline">
                Help
              </Link>
            </div>
          </div>
        </aside>

        {/* Right Column: Stitch Reset Password Form (~58%) */}
        <main className="lg:col-span-7 bg-white flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[480px]">
            {/* Top Navigation */}
            <div className="flex items-center justify-between pb-6 mb-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Login</span>
              </Link>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-bold uppercase tracking-wider text-[#6F675E]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#65558F]" />
                <span>Self-Service Recovery</span>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="font-heading font-black text-3xl sm:text-4xl text-[#14110F] tracking-tight mb-2">
                Reset your{' '}
                <span className="font-serif italic font-normal text-3xl sm:text-4xl text-[#725C00]">
                  password.
                </span>
              </h2>
              <p className="text-sm text-[#6F675E]">
                Enter the email address associated with your account and we&apos;ll send
                verification instructions.
              </p>
            </div>

            {success ? (
              <div className="rounded-2xl border border-[#B6E09B] bg-[#F0FAF2] p-6 text-center space-y-4 animate-in fade-in">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#D5F5E3] flex items-center justify-center text-[#1B7339]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-black text-xl text-[#14110F]">
                  Recovery Instructions Dispatched
                </h3>
                <p className="text-xs text-[#2A663E] leading-relaxed max-w-sm mx-auto">
                  We have dispatched secure recovery instructions to{' '}
                  <strong className="text-[#14110F]">{email}</strong> if an account exists. The
                  reset key expires in 15 minutes.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
                >
                  <span>Return to Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-bold uppercase tracking-wider text-[#14110F] block"
                  >
                    Account Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-12 px-4 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm mt-4"
                >
                  <span>{isSubmitting ? 'Transmitting Instructions...' : 'Send Reset Link'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-center gap-1.5 pt-3 text-xs text-[#A39A8F]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>One-time reset key expires in 15 minutes</span>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
