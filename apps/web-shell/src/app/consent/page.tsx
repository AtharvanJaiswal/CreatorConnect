'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, ShieldCheck, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';

export default function AgeAndConsentPage() {
  const router = useRouter();
  const [dobDay, setDobDay] = useState('15');
  const [dobMonth, setDobMonth] = useState('08');
  const [dobYear, setDobYear] = useState('2000');
  const [isAdult, setIsAdult] = useState(true);
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the CreatorConnect terms and code of conduct.');
      return;
    }
    if (!isAdult && (!guardianName.trim() || !guardianEmail.trim())) {
      setError('Guardian details are required for creators under 18.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setTimeout(() => {
      setIsSubmitting(false);
      router.push('/creator');
    }, 700);
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
          <span>DPDP Act & RBI Compliant</span>
        </div>
      </header>

      {/* Main Split Grid */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)]">
        {/* Left Column: Stitch Storytelling & Abstract Art (~42%) */}
        <aside className="lg:col-span-5 bg-[#FAF6EF] border-b lg:border-b-0 lg:border-r border-[#E7E0D5] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#FFD64A]/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full bg-[#C9B6F7]/25 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[10px] font-bold uppercase tracking-widest text-[#6F675E] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD64A]" />
              <span>Module B • Authentication</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#14110F] leading-[1.08]">
              Let’s make this{' '}
              <span className="font-serif italic font-normal text-4xl sm:text-[52px] text-[#725C00]">
                official.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#6F675E] font-medium leading-relaxed max-w-md">
              CreatorConnect ensures a safe, compliant marketplace for creators, brands, and
              creative professionals across South Asia.
            </p>

            {/* Calendar & Verification Artboard */}
            <div className="my-10 p-6 bg-white rounded-3xl neo-border neo-shadow max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF6D9] border border-[#FFD64A] flex items-center justify-center text-[#735C00]">
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D5F5E3] text-[#1B7339] text-[10px] font-bold uppercase">
                  Verified Age Gate
                </span>
              </div>
              <h4 className="font-heading font-black text-base text-[#14110F] mb-1">
                Legal Contract Protection
              </h4>
              <p className="text-xs text-[#6F675E] leading-relaxed">
                Escrow payouts, copyright assignments, and creative contracts require verified
                contracting capacity under South Asian digital commercial law.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-[#E7E0D5] flex items-center gap-2 text-xs text-[#6F675E]">
            <ShieldCheck className="w-4 h-4 text-[#1B7339]" />
            <span>Digital Personal Data Protection Act (DPDP) Standard</span>
          </div>
        </aside>

        {/* Right Column: Stitch Consent Form (~58%) */}
        <main className="lg:col-span-7 bg-white flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[480px]">
            {/* Top Back Action */}
            <div className="flex items-center justify-between pb-6 mb-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Link>

              <span className="text-xs font-bold uppercase tracking-widest text-[#A39A8F]">
                Step 04 • Compliance
              </span>
            </div>

            <div className="mb-6">
              <h2 className="font-heading font-black text-3xl sm:text-4xl text-[#14110F] tracking-tight mb-2">
                Age & Guardian Verification.
              </h2>
              <p className="text-sm text-[#6F675E]">
                Please confirm your date of birth to finalize your verified creator profile.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Date of Birth 3-Field Group */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#14110F] block">
                  Date of Birth
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={dobDay}
                    onChange={(e) => setDobDay(e.target.value)}
                    className="h-12 px-3 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm font-medium text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d).padStart(2, '0')}>
                        {String(d).padStart(2, '0')}
                      </option>
                    ))}
                  </select>

                  <select
                    value={dobMonth}
                    onChange={(e) => setDobMonth(e.target.value)}
                    className="h-12 px-3 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm font-medium text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                  >
                    {[
                      'Jan',
                      'Feb',
                      'Mar',
                      'Apr',
                      'May',
                      'Jun',
                      'Jul',
                      'Aug',
                      'Sep',
                      'Oct',
                      'Nov',
                      'Dec',
                    ].map((m, idx) => (
                      <option key={m} value={String(idx + 1).padStart(2, '0')}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={dobYear}
                    onChange={(e) => setDobYear(e.target.value)}
                    className="h-12 px-3 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] text-sm font-medium text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                  >
                    {Array.from({ length: 60 }, (_, i) => 2012 - i).map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 18+ Affirmation */}
              <div className="p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAdult}
                    onChange={(e) => setIsAdult(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#14110F] text-[#14110F] focus:ring-[#FFD64A]"
                  />
                  <span className="text-xs text-[#14110F] font-medium leading-relaxed">
                    I confirm that I am at least 18 years of age (or have verified parental/guardian
                    authorization to enter commercial creative contracts).
                  </span>
                </label>

                {!isAdult && (
                  <div className="pt-3 border-t border-[#E7E0D5] space-y-3 animate-in fade-in">
                    <span className="text-[11px] font-bold text-[#864D5D] block">
                      Minor Creator Policy: Guardian Consent Required
                    </span>
                    <input
                      type="text"
                      required={!isAdult}
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Parent / Legal Guardian Full Name"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#E7E0D5] bg-white text-xs text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                    />
                    <input
                      type="email"
                      required={!isAdult}
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      placeholder="Parent / Guardian Email Address"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#E7E0D5] bg-white text-xs text-[#14110F] outline-none focus:ring-2 focus:ring-[#FFD64A]"
                    />
                  </div>
                )}
              </div>

              {/* Terms and Privacy Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#14110F] text-[#14110F] focus:ring-[#FFD64A]"
                />
                <span className="text-xs text-[#6F675E] leading-relaxed">
                  I agree to the CreatorConnect{' '}
                  <strong className="text-[#14110F]">Terms of Service</strong>,{' '}
                  <strong className="text-[#14110F]">Creator Code of Conduct</strong>, and{' '}
                  <strong className="text-[#14110F]">DPDP Act Privacy Policy</strong>.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm mt-6"
              >
                <span>
                  {isSubmitting ? 'Finalizing Profile...' : 'Complete Registration & Launch Hub'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
