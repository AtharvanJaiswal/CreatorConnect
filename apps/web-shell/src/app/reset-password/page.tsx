'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CcLogoSquare, CapsuleBadge, VerifiedIdentityBadge } from '../../components/ui/cc-brand';
import { createClient } from '../../lib/supabase';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password reset request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#121212] flex flex-col justify-between">
      {/* Top Header */}
      <header className="flex items-center justify-between w-full px-6 py-5 sm:px-12 border-b border-[#EAE3D5] bg-[#FAF7F2]">
        <Link href="/" className="flex items-center gap-3">
          <CcLogoSquare size="sm" />
          <div>
            <span className="font-heading font-black text-xs tracking-tight text-[#121212] block uppercase leading-none">
              CreatorConnect
            </span>
            <span className="text-[9px] font-medium text-[#7C756B] uppercase tracking-wider block mt-0.5">
              ACCOUNT RECOVERY
            </span>
          </div>
        </Link>

        <VerifiedIdentityBadge />
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-md w-full mx-auto my-8">
        <div className="w-full">
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/login"
              className="flex items-center gap-1 text-xs font-semibold text-[#121212] hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Login</span>
            </Link>

            <CapsuleBadge variant="amber">PASSWORD RECOVERY</CapsuleBadge>
          </div>

          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#121212] tracking-tight mb-2">
            Reset your{' '}
            <span className="font-serif italic font-normal text-[#121212]">password.</span>
          </h2>
          <p className="text-sm text-[#6B655C] mb-8 leading-relaxed">
            Enter the email address associated with your account and we&apos;ll send verification
            instructions.
          </p>

          {success ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#C5E8CE] bg-[#F0FAF2] p-5 text-sm text-[#1B7339]">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Check your inbox</span>
                </div>
                <p className="text-xs text-[#2A663E] leading-relaxed">
                  We have dispatched secure recovery instructions to{' '}
                  <strong className="text-[#121212]">{email}</strong> if an account exists.
                </p>
              </div>

              <Link
                href="/login"
                className="w-full py-3.5 rounded-full font-semibold text-sm bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] shadow-sm flex items-center justify-center gap-2 transition-all"
              >
                <span>Return to Login</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-bold uppercase tracking-wider text-[#121212] block"
                >
                  Account Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-2xl border border-[#D9D2C5] bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFCE38] focus:border-transparent transition-all shadow-2xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full font-semibold text-sm bg-[#FFCE38] hover:bg-[#F5C32C] active:scale-[0.98] text-[#121212] shadow-sm flex items-center justify-center gap-2 transition-all mt-6"
              >
                <span>{isSubmitting ? 'Sending instructions...' : 'Send Reset Link'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          <div className="border-t border-[#EAE3D5] mt-12 pt-4 flex items-center justify-between text-[11px] text-[#8C8479]">
            <span>© 2025 CreatorConnect Inc.</span>
            <div className="flex items-center gap-2">
              <Link href="#" className="hover:underline">
                Terms
              </Link>
              <span>•</span>
              <Link href="#" className="hover:underline">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
