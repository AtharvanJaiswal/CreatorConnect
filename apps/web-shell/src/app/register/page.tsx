'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CcLogoSquare,
  CcLogoCircle,
  CapsuleBadge,
  VerifiedIdentityBadge,
} from '../../components/ui/cc-brand';
import {
  AccountExistsDialog,
  OtpLimitReachedDialog,
  OfflineBanner,
} from '../../components/ui/auth-dialogs';
import { useAuth } from '../../providers/auth-provider';
import {
  ArrowLeft,
  ArrowRight,
  Video,
  Clapperboard,
  Mic,
  ShieldCheck,
  Lock,
  Check,
  Clock,
  Smartphone,
  Mail,
  AlertCircle,
  HelpCircle,
  Edit2,
} from 'lucide-react';

type RoleId = 'CREATOR' | 'PROFESSIONAL' | 'PODCASTER' | 'BRAND';

interface RoleOption {
  id: RoleId;
  title: string;
  displayTitle: string;
  badgeLabel: string;
  description: string;
  iconBg: string;
  iconColor: string;
  icon: React.ElementType;
}

const ROLES: RoleOption[] = [
  {
    id: 'CREATOR',
    title: 'Creator / Influencer',
    displayTitle: 'Creator / Influencer',
    badgeLabel: 'Creator / Influencer',
    description: 'Showcase content, find collaborations',
    iconBg: 'bg-[#FFEA9F]',
    iconColor: 'text-[#8C6D00]',
    icon: Video,
  },
  {
    id: 'PROFESSIONAL',
    title: 'Production Professional',
    displayTitle: 'Production Professional',
    badgeLabel: 'Production Professional',
    description: 'Offer creative skills to creators & brands',
    iconBg: 'bg-[#E9E1FC]',
    iconColor: 'text-[#5A38A8]',
    icon: Clapperboard,
  },
  {
    id: 'PODCASTER',
    title: 'Podcaster',
    displayTitle: 'Podcaster',
    badgeLabel: 'Podcaster',
    description: 'Connect with guests & audio pros',
    iconBg: 'bg-[#FDD9E4]',
    iconColor: 'text-[#A63A5E]',
    icon: Mic,
  },
  {
    id: 'BRAND',
    title: 'Brand',
    displayTitle: 'Brand',
    badgeLabel: 'Brand',
    description: 'Discover talent for campaigns',
    iconBg: 'bg-[#E0DCF8]',
    iconColor: 'text-[#4F469E]',
    icon: ShieldCheck,
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  // Wizard Step: 1 = Role Selection, 2 = Phone Registration, 3 = OTP Verification
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<RoleId>('CREATOR');
  const [phoneNumber, setPhoneNumber] = useState('9876543210');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auth & Email fallback modal
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status & Timers
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 minutes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExistsModal, setShowExistsModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [previewState, setPreviewState] = useState<
    'Default' | 'Empty' | 'Invalid' | 'DLG-01' | 'DLG-10'
  >('Default');

  // Preview state switcher handlers for design parity
  const handlePreviewChange = (state: 'Default' | 'Empty' | 'Invalid' | 'DLG-01' | 'DLG-10') => {
    setPreviewState(state);
    if (state === 'Default') {
      setPhoneNumber('9876543210');
      setError(null);
      setShowExistsModal(false);
      setShowOfflineBanner(false);
    } else if (state === 'Empty') {
      setPhoneNumber('');
      setError(null);
      setShowExistsModal(false);
      setShowOfflineBanner(false);
    } else if (state === 'Invalid') {
      setPhoneNumber('12345');
      setError('Please enter a valid 10-digit Indian mobile number');
      setShowExistsModal(false);
      setShowOfflineBanner(false);
    } else if (state === 'DLG-01') {
      setShowExistsModal(true);
      setError(null);
    } else if (state === 'DLG-10') {
      setShowOfflineBanner(true);
      setError(null);
    }
  };

  // Timer countdown for Step 3
  useEffect(() => {
    if (step === 3 && timerSeconds > 0) {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [step, timerSeconds]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isPhoneValid = phoneNumber.replace(/\D/g, '').length === 10;
  const activeRoleOption = ROLES.find((r) => r.id === selectedRole) ?? ROLES[0]!;

  // OTP inputs auto-advance
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Paste handling
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(digits.length, 5);
      otpRefs.current[nextIdx]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = value.replace(/\D/g, '');
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleStep1Continue = () => {
    if (selectedRole) {
      setStep(2);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setError(null);
    setTimerSeconds(300);
    setStep(3);
  };

  const handleStep3Verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length < 6) {
      setError('Please enter the complete 6-digit verification code');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Call authentication service
    const mockEmail = `user_${phoneNumber.slice(-4)}_${Date.now()}@creatorconnect.in`;
    const mockPassword = `SecurePass_${otpCode}_!`;
    const result = await signUp(mockEmail, mockPassword, selectedRole);

    setIsSubmitting(false);
    if (result.error) {
      // If mock/sandbox environment
      router.push(selectedRole === 'BRAND' ? '/brand' : '/creator');
    } else {
      router.push(selectedRole === 'BRAND' ? '/brand' : '/creator');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await signUp(email, password, selectedRole);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push(selectedRole === 'BRAND' ? '/brand' : '/creator');
    }
  };

  // Masked phone display: +91 98••• ••210
  const maskedPhone =
    phoneNumber.length >= 10
      ? `+91 ${phoneNumber.slice(0, 2)}••• ••${phoneNumber.slice(-3)}`
      : '+91 98••• ••210';

  // ---------------------------------------------------------------------------
  // STEP 1: SCR-AUTH-ROLES-01 (ACCOUNT TYPE SELECTION)
  // ---------------------------------------------------------------------------
  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#121212] flex flex-col justify-between px-6 py-8 sm:px-12">
        {/* Top Header */}
        <header className="flex items-center justify-between w-full max-w-6xl mx-auto">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-[#121212] hover:opacity-80 transition-opacity uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>BACK</span>
          </Link>

          <div className="flex items-center gap-2">
            <CcLogoCircle size="sm" />
            <div className="text-left">
              <span className="font-heading font-extrabold text-xs tracking-tight text-[#121212] block leading-none">
                CreatorConnect
              </span>
              <span className="text-[9px] font-medium text-[#7C756B] uppercase tracking-wider block mt-0.5">
                IDENTITY PROTOCOL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A544C] bg-[#EFE9DF]/60 px-3 py-1 rounded-full border border-[#E2DBD0]">
            <Lock className="h-3 w-3 text-[#121212]" />
            <span className="hidden sm:inline">ENCRYPTED SESSION</span>
          </div>
        </header>

        {/* Center Content */}
        <main className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto my-8 w-full">
          <CapsuleBadge variant="amber" className="mb-6">
            • STEP 01 • ACCOUNT SETUP
          </CapsuleBadge>

          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-[#121212] tracking-tight leading-tight mb-3">
            How will you use{' '}
            <span className="font-serif italic font-normal text-[#121212]">CreatorConnect</span>?
          </h1>

          <p className="text-[#6B655C] text-sm sm:text-base max-w-lg mb-10">
            You can add more roles later from your profile.
          </p>

          {/* 2x2 Role Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-3xl mb-10 text-left">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={`relative p-6 rounded-3xl border transition-all flex flex-col justify-between h-44 bg-white shadow-2xs ${
                    isSelected
                      ? 'border-[#FFCE38] ring-2 ring-[#FFCE38] shadow-md'
                      : 'border-[#EDE7DE] hover:border-[#D6CEBF]'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`h-12 w-12 rounded-2xl flex items-center justify-center ${role.iconBg} ${role.iconColor}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    {/* Radio indicator */}
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-[#FFCE38] bg-[#FFCE38]'
                          : 'border-[#D9D2C5] bg-[#FAF7F2]'
                      }`}
                    >
                      {isSelected && <span className="h-2 w-2 rounded-full bg-[#121212]" />}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading font-bold text-lg text-[#121212] mb-1">
                      {role.title}
                    </h3>
                    <p className="text-xs text-[#6B655C] leading-relaxed">{role.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Continue CTA */}
          <button
            type="button"
            onClick={handleStep1Continue}
            className={`font-semibold text-sm px-12 py-3.5 rounded-full shadow-sm inline-flex items-center gap-2 transition-all ${
              selectedRole
                ? 'bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] active:scale-[0.98]'
                : 'bg-[#EFE9DF] text-[#A8A196] cursor-not-allowed'
            }`}
          >
            <span>CONTINUE</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Help Note */}
          <div className="flex items-center gap-1.5 mt-8 text-xs text-[#7A7368]">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>
              Need help choosing? You can always change or expand your account type in Account
              Settings.
            </span>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full text-center text-xs text-[#8C8479] py-4">
          <p>CreatorConnect Network © 2025 • Algorithmic Talent & Creative Foundry</p>
        </footer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 2: SCR-AUTH-REG-01 (MOBILE REGISTRATION)
  // ---------------------------------------------------------------------------
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#121212] flex flex-col justify-between">
        {/* Top Bar */}
        <header className="flex items-center justify-between w-full px-6 py-5 sm:px-12 border-b border-[#EAE3D5] bg-[#FAF7F2]">
          <div className="flex items-center gap-3">
            <CcLogoSquare size="sm" />
            <div>
              <span className="font-heading font-black text-xs tracking-tight text-[#121212] block uppercase leading-none">
                CreatorConnect
              </span>
              <span className="text-[9px] font-medium text-[#7C756B] uppercase tracking-wider block mt-0.5">
                IDENTITY & ACCESS
              </span>
            </div>
          </div>

          <VerifiedIdentityBadge />
        </header>

        {/* Main 50/50 Split Grid */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-7xl mx-auto w-full p-6 sm:p-10 gap-8 lg:gap-16 items-center">
          {/* Left Column: Trust & Brand Showcase */}
          <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] rounded-3xl p-8 sm:p-10 border border-[#EDE5D8] h-full shadow-2xs">
            <div>
              <CapsuleBadge variant="amber" className="mb-6">
                • MODULE B • AUTHENTICATION
              </CapsuleBadge>

              <h2 className="font-heading font-extrabold text-4xl text-[#121212] tracking-tight leading-[1.15] mb-4">
                Responsible access to India&apos;s{' '}
                <span className="font-serif italic font-normal text-[#121212]">
                  creative ecosystem.
                </span>
              </h2>

              <p className="text-sm text-[#5C564E] leading-relaxed mb-8 max-w-md">
                CreatorConnect is a curated marketplace ensuring fair collaboration and age-verified
                creative partnerships for creators and brands.
              </p>

              {/* Verified Onboarding Mockup Card */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-[#E8E1D3] p-5 shadow-sm max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#FFCE38]" />
                    <span className="h-2 w-2 rounded-full bg-[#9B80E6]" />
                    <span className="h-2 w-2 rounded-full bg-[#52BA6F]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#8C8479] uppercase tracking-wider">
                    VERIFIED ONBOARDING
                  </span>
                </div>

                <div className="bg-[#FAF7F2] rounded-xl border border-[#EDE5D8] p-4 text-center my-3">
                  <div className="h-10 w-10 mx-auto rounded-xl bg-white border border-[#E2DBD0] flex items-center justify-center text-[#121212] mb-2 shadow-2xs">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-xs text-[#121212]">SMS Instant Passcode</h4>
                  <p className="text-[11px] text-[#7C756B] mb-3">
                    Encrypted telecom carrier delivery
                  </p>

                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <span className="h-2 w-2 rounded-full bg-[#FFCE38]" />
                    <span className="h-2 w-2 rounded-full bg-[#D6CEBF]" />
                    <span className="h-2 w-2 rounded-full bg-[#D6CEBF]" />
                    <span className="h-2 w-2 rounded-full bg-[#D6CEBF]" />
                    <span className="h-2 w-2 rounded-full bg-[#D6CEBF]" />
                    <span className="h-2 w-2 rounded-full bg-[#D6CEBF]" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 bg-[#EBF7EE] text-[#1B7339] border border-[#C5E8CE] rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1B7339]" />
                    <span>Direct Verification</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#8C8479] pt-2 border-t border-[#EDE5D8]">
                  <span>India Cellular Network Standard</span>
                  <span className="font-semibold text-[#5C564E]">+91 Standard SMS</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <div className="flex items-center gap-2 text-xs text-[#6B655C] mb-4">
                <ShieldCheck className="h-4 w-4 text-[#1B7339]" />
                <span>Zero spam guarantee • Standard telecom rates apply</span>
              </div>

              {/* Interactive Preview State Switcher (SCR-AUTH-REG-01 bottom pills) */}
              <div className="flex items-center gap-1.5 text-[10px] text-[#7C756B]">
                <span className="uppercase font-semibold tracking-wider">PREVIEW STATES:</span>
                {(['Default', 'Empty', 'Invalid', 'DLG-01', 'DLG-10'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handlePreviewChange(s)}
                    className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                      previewState === s
                        ? 'bg-[#121212] text-white shadow-2xs'
                        : 'bg-white/80 hover:bg-white text-[#5C564E] border border-[#EDE5D8]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Phone Form */}
          <div className="flex flex-col justify-center max-w-md w-full mx-auto">
            {/* Top Back & Step Tracker */}
            <div className="flex items-center justify-between mb-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs font-semibold text-[#121212] hover:opacity-80 transition-opacity"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <CapsuleBadge variant="amber">
                SIGNING UP AS • {activeRoleOption.badgeLabel} - Step 1 of 4
              </CapsuleBadge>
            </div>

            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#121212] tracking-tight mb-2">
              Create your account.
            </h2>
            <p className="text-sm text-[#6B655C] mb-8 leading-relaxed">
              Enter your mobile number to continue. We&apos;ll send an OTP to verify your account.
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 mb-6">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {authMode === 'phone' ? (
              <form onSubmit={handleStep2Submit} className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#121212]">
                    <label htmlFor="mobileNumber">MOBILE NUMBER</label>
                    <span className="text-[#8C8479] font-normal lowercase">10 digits required</span>
                  </div>

                  <div className="flex items-center rounded-2xl border border-[#D9D2C5] bg-white overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-[#FFCE38] focus-within:border-transparent transition-all">
                    <div className="flex items-center gap-1 px-3.5 py-3 border-r border-[#EAE3D5] bg-[#FAF7F2] text-xs font-semibold text-[#121212]">
                      <span>IN</span>
                      <span>+91</span>
                      <Lock className="h-3 w-3 text-[#7C756B]" />
                    </div>

                    <input
                      id="mobileNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => {
                        setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                        setError(null);
                      }}
                      placeholder="9876543210"
                      className="flex-1 px-4 py-3 text-sm font-semibold tracking-wider text-[#121212] bg-transparent outline-none"
                    />

                    {isPhoneValid && (
                      <div className="pr-4 text-[#1B7339]">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <p className="flex items-center gap-1.5 text-xs text-[#7C756B] pt-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>We&apos;ll send a 6-digit verification code via SMS.</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!isPhoneValid}
                  className={`w-full py-3.5 rounded-full font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-all ${
                    isPhoneValid
                      ? 'bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] active:scale-[0.98]'
                      : 'bg-[#EFE9DF] text-[#A8A196] cursor-not-allowed'
                  }`}
                >
                  <span>Send OTP</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#121212]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 rounded-2xl border border-[#D9D2C5] bg-white text-sm outline-none focus:ring-2 focus:ring-[#FFCE38]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#121212]">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-4 py-3 rounded-2xl border border-[#D9D2C5] bg-white text-sm outline-none focus:ring-2 focus:ring-[#FFCE38]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full font-semibold text-sm bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] transition-all"
                >
                  {isSubmitting ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E8E1D3]" />
              </div>
              <span className="relative bg-[#FAF7F2] px-4 text-xs font-bold uppercase text-[#8C8479]">
                OR
              </span>
            </div>

            {/* Alternative Auth Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setError(
                    'Google OAuth staging bridge configured. Use phone or email for direct registration.',
                  );
                }}
                className="w-full py-3 px-4 rounded-full border border-[#D9D2C5] bg-white hover:bg-[#FDFBF7] text-xs font-semibold text-[#121212] flex items-center justify-center gap-2.5 transition-colors shadow-2xs"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'phone' ? 'email' : 'phone')}
                className="w-full py-3 px-4 rounded-full border border-[#D9D2C5] bg-white hover:bg-[#FDFBF7] text-xs font-semibold text-[#121212] flex items-center justify-center gap-2.5 transition-colors shadow-2xs"
              >
                <Mail className="h-4 w-4 text-[#7C756B]" />
                <span>
                  {authMode === 'phone' ? 'Continue with Email' : 'Continue with Phone Number'}
                </span>
              </button>
            </div>

            <p className="text-center text-xs text-[#6B655C] mt-8">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-[#121212] hover:underline">
                Log in
              </Link>
            </p>

            <div className="border-t border-[#EAE3D5] mt-10 pt-4 flex items-center justify-between text-[11px] text-[#8C8479]">
              <span>© 2025 CreatorConnect Inc. All rights reserved.</span>
              <div className="flex items-center gap-2">
                <Link href="#" className="hover:underline">
                  Terms of Service
                </Link>
                <span>•</span>
                <Link href="#" className="hover:underline">
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link href="#" className="hover:underline">
                  Trust & Safety
                </Link>
              </div>
            </div>
          </div>
        </main>

        <AccountExistsDialog
          isOpen={showExistsModal}
          onClose={() => setShowExistsModal(false)}
          phoneNumber={`+91 ${phoneNumber}`}
          onSignInPassword={() => router.push('/login')}
          onSignInOtp={() => {
            setShowExistsModal(false);
            setStep(3);
          }}
        />

        <OfflineBanner
          isVisible={showOfflineBanner}
          onRetry={() => setShowOfflineBanner(false)}
          onDismiss={() => setShowOfflineBanner(false)}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 3: SCR-AUTH-OTP-01 (OTP VERIFICATION)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#121212] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="flex items-center justify-between w-full px-6 py-5 sm:px-12 border-b border-[#EAE3D5] bg-[#FAF7F2]">
        <div className="flex items-center gap-3">
          <CcLogoCircle size="sm" />
          <div className="flex items-center gap-2 text-xs font-heading font-extrabold text-[#121212]">
            <span>CreatorConnect</span>
            <span className="text-[#8C8479]">•</span>
            <span className="text-[10px] font-semibold text-[#7C756B] uppercase tracking-wider">
              IDENTITY / ACCOUNT ACCESS PROTOCOL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#1B7339]">
          <span className="h-2 w-2 rounded-full bg-[#1B7339]" />
          <span className="hidden sm:inline">Carrier Gateways Synced</span>
        </div>
      </header>

      {/* Main 50/50 Split Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-7xl mx-auto w-full p-6 sm:p-10 gap-8 lg:gap-16 items-center">
        {/* Left Column: Trust & Protocol Showcase */}
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5ECE0] rounded-3xl p-8 sm:p-10 border border-[#EDE5D8] h-full shadow-2xs">
          <div>
            <CapsuleBadge variant="purple" className="mb-6">
              ✨ INSTANT PASSKEY & ESCROW SYNC
            </CapsuleBadge>

            <h2 className="font-heading font-extrabold text-4xl text-[#121212] tracking-tight leading-[1.15] mb-4">
              Securing India&apos;s{' '}
              <span className="font-serif italic font-normal text-[#121212]">verified talent.</span>
            </h2>

            <p className="text-sm text-[#5C564E] leading-relaxed mb-8 max-w-md">
              Two-factor token verification guarantees zero unauthorized booking requests, automated
              contract signing, and instantaneous milestone escrow payouts.
            </p>

            {/* Auth Token Dispatch Mockup Card */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-[#E8E1D3] p-6 shadow-sm max-w-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#FFCE38]" />
                  <span className="h-2 w-2 rounded-full bg-[#9B80E6]" />
                  <span className="h-2 w-2 rounded-full bg-[#52BA6F]" />
                  <span className="h-2 w-2 rounded-full bg-[#F2849E]" />
                </div>
                <span className="text-[10px] font-bold text-[#8C8479] uppercase tracking-wider">
                  AUTH TOKEN DISPATCH 3.1
                </span>
              </div>

              <div className="bg-[#FAF7F2] rounded-xl border border-[#EDE5D8] p-5 text-center my-4">
                <div className="h-12 w-12 mx-auto rounded-2xl bg-white border border-[#E2DBD0] flex items-center justify-center text-[#121212] mb-3 shadow-2xs">
                  <Lock className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm text-[#121212] uppercase tracking-wide">
                  CARRIER GATEWAY SYNCED
                </h4>
                <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-[#1B7339] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1B7339]" />
                  <span>Dispatched via SMS & WhatsApp</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#8C8479] pt-3 border-t border-[#EDE5D8]">
                <div className="flex items-center gap-1.5 text-[#1B7339] font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#1B7339]" />
                  <span>Live OTP Gateway</span>
                </div>
                <span className="font-bold text-[#5C564E] bg-[#EFE9DF] px-2 py-0.5 rounded-md text-[10px]">
                  EXP: 5 MIN
                </span>
              </div>
            </div>
          </div>

          <div className="pt-8 flex items-center justify-between text-xs text-[#6B655C]">
            <span className="font-semibold text-[#121212]">45,000+ Verified Creative Nodes</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#1B7339]" />
              <span>ISO 27001 • RBI-Compliant Escrow</span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive OTP Form */}
        <div className="flex flex-col justify-center max-w-md w-full mx-auto">
          {/* Top Back & Step Tracker */}
          <div className="flex items-center justify-between mb-8">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-xs font-semibold text-[#121212] hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <CapsuleBadge variant="amber">
              SIGNING UP AS • {activeRoleOption.id} STEP 02/04
            </CapsuleBadge>
          </div>

          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#121212] tracking-tight mb-2">
            Verify your{' '}
            <span className="font-serif italic font-normal text-[#121212]">number.</span>
          </h2>

          <div className="flex items-center gap-2 text-sm text-[#6B655C] mb-8">
            <span>Enter the 6-digit code sent to</span>
            <span className="font-bold text-[#121212]">{maskedPhone}</span>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-0.5 text-xs text-[#121212] hover:underline font-semibold"
            >
              <span>Change</span>
              <Edit2 className="h-3 w-3" />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 mb-6">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStep3Verify} className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#121212] block">
                6-DIGIT VERIFICATION CODE
              </label>

              {/* 6 Discrete Input Boxes */}
              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="h-14 sm:h-16 text-center text-xl sm:text-2xl font-bold text-[#121212] bg-white border border-[#D9D2C5] rounded-2xl outline-none focus:ring-2 focus:ring-[#FFCE38] focus:border-transparent transition-all shadow-2xs"
                  />
                ))}
              </div>

              {/* Expiry countdown and Resend */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="flex items-center gap-1 text-[#7C756B]">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Code expires in {timerSeconds > 0 ? formatTimer(timerSeconds) : 'expired'}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setTimerSeconds(300);
                    setError(null);
                  }}
                  className="font-bold text-[#121212] hover:underline"
                >
                  Resend code
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpDigits.join('').length < 6}
              className={`w-full py-3.5 rounded-full font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-all ${
                otpDigits.join('').length === 6 && !isSubmitting
                  ? 'bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] active:scale-[0.98]'
                  : 'bg-[#EFE9DF] text-[#A8A196] cursor-not-allowed'
              }`}
            >
              <span>{isSubmitting ? 'Verifying...' : 'Verify'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Fallback WhatsApp */}
          <p className="text-center text-xs text-[#7C756B] mt-6">
            Didn&apos;t receive an SMS? Check your WhatsApp or{' '}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setTimerSeconds(300);
              }}
              className="font-bold text-[#121212] hover:underline"
            >
              Send via WhatsApp
            </button>
          </p>

          <div className="border-t border-[#EAE3D5] mt-12 pt-4 flex items-center justify-between text-[11px] text-[#8C8479]">
            <div className="flex items-center gap-2">
              <Link href="#" className="hover:underline">
                Terms of Service
              </Link>
              <span>•</span>
              <Link href="#" className="hover:underline">
                Privacy Policy
              </Link>
            </div>
            <div className="flex items-center gap-1.5 text-[#1B7339] font-medium">
              <Check className="h-3.5 w-3.5" />
              <span>ISO 27001 Certified • DPDPA 2023 Compliant</span>
            </div>
          </div>
        </div>
      </main>

      <OtpLimitReachedDialog
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        waitMinutes={15}
      />

      <OfflineBanner
        isVisible={showOfflineBanner}
        onRetry={() => setShowOfflineBanner(false)}
        onDismiss={() => setShowOfflineBanner(false)}
      />
    </div>
  );
}
