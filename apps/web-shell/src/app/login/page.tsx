'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CcLogoSquare, CapsuleBadge, VerifiedIdentityBadge } from '../../components/ui/cc-brand';
import { useAuth } from '../../providers/auth-provider';
import { ArrowLeft, ArrowRight, Lock, AlertCircle, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/creator';

  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push(redirectUrl);
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
              IDENTITY & ACCESS
            </span>
          </div>
        </Link>

        <VerifiedIdentityBadge />
      </header>

      {/* Main 50/50 Split Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-7xl mx-auto w-full p-6 sm:p-10 gap-8 lg:gap-16 items-center">
        {/* Left Column: Visual Brand Identity */}
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] rounded-3xl p-8 sm:p-10 border border-[#EDE5D8] h-full shadow-2xs">
          <div>
            <CapsuleBadge variant="amber" className="mb-6">
              • AUTHENTICATED ACCESS •
            </CapsuleBadge>

            <h2 className="font-heading font-extrabold text-4xl text-[#121212] tracking-tight leading-[1.15] mb-4">
              Return to your{' '}
              <span className="font-serif italic font-normal text-[#121212]">
                collaborative workspace.
              </span>
            </h2>

            <p className="text-sm text-[#5C564E] leading-relaxed mb-8 max-w-md">
              Secure, zero-trust session protocol with cryptographic signatures for creator payouts,
              milestone approvals, and verified brand campaigns.
            </p>

            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-[#E8E1D3] p-6 shadow-sm max-w-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-[#FFCE38]/20 flex items-center justify-center text-[#7A5B00]">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#121212] uppercase tracking-wider">
                    Asymmetric JWKS Handshake
                  </h4>
                  <p className="text-[11px] text-[#7C756B]">Fastify Microservices Synced</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#8C8479] pt-3 border-t border-[#EDE5D8]">
                <div className="flex items-center gap-1.5 text-[#1B7339] font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#1B7339]" />
                  <span>Session Active</span>
                </div>
                <span className="text-[10px] bg-[#EFE9DF] px-2 py-0.5 rounded text-[#5C564E] font-medium">
                  TLS 1.3
                </span>
              </div>
            </div>
          </div>

          <div className="pt-8 flex items-center justify-between text-xs text-[#6B655C]">
            <span className="font-semibold text-[#121212]">CreatorConnect Network</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#1B7339]" />
              <span>ISO 27001 • RBI-Compliant Escrow</span>
            </div>
          </div>
        </div>

        {/* Right Column: Login Form */}
        <div className="flex flex-col justify-center max-w-md w-full mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-semibold text-[#121212] hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Link>

            <CapsuleBadge variant="amber">IDENTITY LOGIN</CapsuleBadge>
          </div>

          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#121212] tracking-tight mb-2">
            Welcome back.
          </h2>
          <p className="text-sm text-[#6B655C] mb-8 leading-relaxed">
            Enter your credentials to access your CreatorConnect ecosystem account.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 mb-6">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-bold uppercase tracking-wider text-[#121212] block"
              >
                Email Address
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="password"
                  className="font-bold uppercase tracking-wider text-[#121212]"
                >
                  Password
                </label>
                <Link
                  href="/reset-password"
                  className="text-xs text-[#7C756B] hover:text-[#121212] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-2xl border border-[#D9D2C5] bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFCE38] focus:border-transparent transition-all shadow-2xs"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-full font-semibold text-sm bg-[#FFCE38] hover:bg-[#F5C32C] active:scale-[0.98] text-[#121212] shadow-sm flex items-center justify-center gap-2 transition-all mt-6"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="text-center text-xs text-[#6B655C] mt-8">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-bold text-[#121212] hover:underline">
              Create an account
            </Link>
          </p>

          <div className="border-t border-[#EAE3D5] mt-10 pt-4 flex items-center justify-between text-[11px] text-[#8C8479]">
            <span>© 2025 CreatorConnect Inc.</span>
            <div className="flex items-center gap-2">
              <Link href="#" className="hover:underline">
                Terms
              </Link>
              <span>•</span>
              <Link href="#" className="hover:underline">
                Privacy
              </Link>
              <span>•</span>
              <Link href="#" className="hover:underline">
                Security
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
