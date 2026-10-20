'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../providers/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/creator';

  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
          <span>Verified Session Gate</span>
        </div>
      </header>

      {/* Main 50/50 Split Grid */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)]">
        {/* Left Column: Stitch B06 Brand Narrative & Architecture (~42%) */}
        <aside className="lg:col-span-5 bg-[#FAF6EF] border-b lg:border-b-0 lg:border-r border-[#E7E0D5] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#FFD64A]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-[#C9B6F7]/25 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-bold uppercase tracking-widest text-[#6F675E] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD64A]" />
              <span>MODULE B • AUTHENTICATION</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#14110F] leading-[1.08]">
              Welcome{' '}
              <span className="font-serif italic font-normal text-4xl sm:text-[52px] text-[#725C00]">
                back.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#6F675E] font-medium leading-relaxed max-w-md">
              Access your verified creator portfolio, active brand campaign deliverables, and
              milestone payouts.
            </p>

            {/* Active Node Trust Card */}
            <div className="my-8 p-6 bg-white rounded-3xl neo-border neo-shadow max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#FFD64A] neo-border" />
                  <span className="font-bold text-xs uppercase tracking-wider text-[#14110F]">
                    Identity Node
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1B7339] bg-[#D5F5E3] px-2.5 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-xs text-[#6F675E] leading-relaxed">
                Last authenticated role auto-restored on login. Zero session collision across
                multiple devices.
              </p>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E7E0D5]">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6F675E] bg-[#FAF6EF] px-2.5 py-1 rounded-full">
                  <KeyRound className="w-3 h-3 text-[#725C00]" />
                  Argon2id Passkey
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6F675E] bg-[#FAF6EF] px-2.5 py-1 rounded-full">
                  <Lock className="w-3 h-3 text-[#65558F]" />
                  Zero-Knowledge Escrow
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-[#E7E0D5] flex flex-col gap-2 text-xs text-[#6F675E]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1B7339]" />
                45,000+ Verified Nodes
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#725C00]" />
                RBI-Compliant Escrow
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono text-[#A39A8F]">
              CreatorConnect Architecture v3.4.2 • Bangalore Edge DC-01
            </span>
          </div>
        </aside>

        {/* Right Column: Stitch Login Workspace (~58%) */}
        <main className="lg:col-span-7 bg-white flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[480px]">
            {/* Top Navigation */}
            <div className="flex items-center justify-between pb-6 mb-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-bold uppercase tracking-wider text-[#6F675E]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD64A]" />
                <span>Returning User Access</span>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="font-heading font-black text-3xl sm:text-4xl text-[#14110F] tracking-tight mb-2">
                Sign in to your account.
              </h2>
              <p className="text-sm text-[#6F675E]">
                Enter your credentials to access your CreatorConnect workspace.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 mb-6">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-bold uppercase tracking-wider text-[#14110F] block"
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
                  className="w-full h-12 px-4 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="password"
                    className="font-bold uppercase tracking-wider text-[#14110F]"
                  >
                    Password
                  </label>
                  <Link
                    href="/reset-password"
                    className="text-xs text-[#6F675E] hover:text-[#14110F] underline underline-offset-2"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    className="w-full h-12 px-4 pr-12 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A] transition-all"
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

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#6F675E]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-[#14110F] text-[#14110F] focus:ring-[#FFD64A]"
                  />
                  <span>Remember this device</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] active:scale-[0.98] text-[#14110F] font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all mt-4"
              >
                <span>{isSubmitting ? 'Authenticating Session...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Social Login Divider */}
              <div className="relative flex items-center justify-center py-4">
                <div className="w-full border-t border-[#E7E0D5]" />
                <span className="absolute bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-[#A39A8F]">
                  OR CONTINUE WITH
                </span>
              </div>

              {/* Google SSO Button */}
              <button
                type="button"
                onClick={() => router.push('/auth/callback')}
                className="w-full h-12 rounded-full bg-white hover:bg-[#FAF6EF] border border-[#E7E0D5] text-[#14110F] font-bold text-sm flex items-center justify-center gap-3 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </form>

            <p className="text-center text-xs text-[#6F675E] mt-8">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-bold text-[#14110F] hover:underline">
                Create an account
              </Link>
            </p>

            <div className="border-t border-[#E7E0D5] mt-8 pt-4 flex items-center justify-between text-[11px] text-[#A39A8F]">
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
    </div>
  );
}
