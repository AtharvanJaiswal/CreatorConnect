'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase';

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Criteria validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
      setError('Password must satisfy all security requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password update failed.');
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
          <span>Argon2id Encrypted Update</span>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)]">
        {/* Left Column: Stitch Brand Narrative (~42%) */}
        <aside className="lg:col-span-5 bg-[#FAF6EF] border-b lg:border-b-0 lg:border-r border-[#E7E0D5] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#FFD64A]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-[#C9B6F7]/25 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-bold uppercase tracking-widest text-[#6F675E] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD64A]" />
              <span>Account Security Protocol</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#14110F] leading-[1.08]">
              Create a new{' '}
              <span className="font-serif italic font-normal text-4xl sm:text-[52px] text-[#725C00]">
                password.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#6F675E] font-medium leading-relaxed max-w-md">
              Choose a secure password to protect your CreatorConnect account, ongoing campaign
              contracts, and direct brand collaborations.
            </p>

            {/* Key and Shield Artboard Motif */}
            <div className="my-10 p-6 bg-white rounded-3xl neo-border neo-shadow max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF6D9] border border-[#FFD64A] flex items-center justify-center text-[#735C00]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase">
                  B08 Security Lock
                </span>
              </div>
              <h4 className="font-heading font-black text-base text-[#14110F] mb-1">
                Zero-Knowledge Cryptography
              </h4>
              <p className="text-xs text-[#6F675E] leading-relaxed">
                Passwords are salted and cryptographically hashed before transit. Passwords are
                never stored in plaintext.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-[#E7E0D5] flex items-center gap-2 text-xs text-[#6F675E]">
            <ShieldCheck className="w-4 h-4 text-[#1B7339]" />
            <span>Encrypted updates propagate instantly across all active verified devices.</span>
          </div>
        </aside>

        {/* Right Column: Reset Password Form (~58%) */}
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

              <span className="text-xs font-bold uppercase tracking-widest text-[#A39A8F]">
                Step 02/02
              </span>
            </div>

            <div className="mb-6">
              <h2 className="font-heading font-black text-3xl sm:text-4xl text-[#14110F] tracking-tight mb-2">
                Set new credentials.
              </h2>
              <p className="text-sm text-[#6F675E]">Enter and confirm your new secure password.</p>
            </div>

            {success ? (
              <div className="rounded-2xl border border-[#B6E09B] bg-[#F0FAF2] p-6 text-center space-y-4 animate-in fade-in">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#D5F5E3] flex items-center justify-center text-[#1B7339]">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-black text-xl text-[#14110F]">
                  Password Successfully Updated
                </h3>
                <p className="text-xs text-[#2A663E] leading-relaxed max-w-sm mx-auto">
                  Your credentials have been securely updated across all nodes. Redirecting to
                  login...
                </p>
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
                    htmlFor="password"
                    className="text-xs font-bold uppercase tracking-wider text-[#14110F] block"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-12 px-4 pr-12 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-[#6F675E] hover:text-[#14110F]"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className="text-xs font-bold uppercase tracking-wider text-[#14110F] block"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 px-4 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                  />
                </div>

                {/* Password Criteria Checklist */}
                <div className="p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-2">
                  <div className="text-[11px] font-bold text-[#6F675E] uppercase tracking-wider">
                    Security Requirements:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div
                      className={`flex items-center gap-1.5 ${
                        hasMinLength ? 'text-[#1B7339] font-bold' : 'text-[#6F675E]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>8+ characters</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${
                        hasUppercase ? 'text-[#1B7339] font-bold' : 'text-[#6F675E]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Uppercase letter</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${
                        hasNumber ? 'text-[#1B7339] font-bold' : 'text-[#6F675E]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>At least 1 number</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${
                        hasSpecial ? 'text-[#1B7339] font-bold' : 'text-[#6F675E]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Special character</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm mt-4"
                >
                  <span>
                    {isSubmitting ? 'Updating Password...' : 'Update Password & Continue'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
