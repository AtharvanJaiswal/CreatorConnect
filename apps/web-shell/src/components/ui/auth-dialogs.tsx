'use client';

import React from 'react';
import Link from 'next/link';
import { WifiOff, ArrowRight, ShieldAlert, Clock, X, Phone, Mail, UserCheck } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * DLG-01: Account Already Exists Dialog
 */
export function AccountExistsDialog({
  isOpen,
  onClose,
  phoneNumber,
  onSignInPassword,
  onSignInOtp,
}: DialogProps & {
  phoneNumber?: string;
  onSignInPassword: () => void;
  onSignInOtp: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-01-title"
    >
      <div className="relative w-full max-w-[420px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-7 shadow-2xl flex flex-col justify-between">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#65558F]" />
            <span>DLG-01 • Duplicate Found</span>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#FFF6D9] border border-[#FFD64A] flex items-center justify-center text-[#735C00] mb-4">
            <Phone className="w-6 h-6" />
          </div>

          <h3
            id="dlg-01-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight mb-2"
          >
            Account already exists
          </h3>

          <p className="text-sm text-[#6F675E] leading-relaxed mb-6">
            An active CreatorConnect account is already registered with{' '}
            <strong className="text-[#14110F]">{phoneNumber || '+91 ••••• •••••'}</strong>. How
            would you like to proceed?
          </p>

          <div className="space-y-2.5">
            <button
              onClick={onSignInPassword}
              className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] active:scale-[0.98] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <span>Sign in with Password</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onSignInOtp}
              className="w-full h-12 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span>Verify with SMS OTP</span>
            </button>
          </div>
        </div>

        <div className="pt-5 mt-5 border-t border-[#E7E0D5] text-center">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#6F675E] hover:text-[#14110F] underline underline-offset-2 transition-colors"
          >
            Use a different mobile number
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DLG-02: OTP Resend Limit Reached Dialog
 */
export function OtpLimitReachedDialog({
  isOpen,
  onClose,
  waitMinutes = 15,
}: DialogProps & { waitMinutes?: number }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-02-title"
    >
      <div className="relative w-full max-w-[420px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-7 shadow-2xl flex flex-col justify-between">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDAD6] text-[#93000A] text-[10px] font-bold uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BA1A1A]" />
            <span>DLG-02 • Rate Limited</span>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#FFDAD6]/60 border border-[#BA1A1A]/30 flex items-center justify-center text-[#BA1A1A] mb-4">
            <Clock className="w-6 h-6" />
          </div>

          <h3
            id="dlg-02-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight mb-2"
          >
            Resend limit reached
          </h3>

          <p className="text-sm text-[#6F675E] leading-relaxed mb-6">
            For account protection and SMS gateway safety, please wait{' '}
            <strong className="text-[#14110F]">{waitMinutes} minutes</strong> before requesting
            another one-time password.
          </p>

          <div className="rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] p-4 text-xs text-[#6F675E] space-y-1 mb-6">
            <div className="font-bold text-[#14110F]">Need immediate access?</div>
            <div>
              Try signing in with your email and password or contact our 24/7 concierge support.
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center transition-all shadow-sm"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DLG-03: Google Sign-in Handoff / Link Account Dialog
 */
export function GoogleHandoffDialog({
  isOpen,
  onClose,
  googleEmail,
  onLinkAccount,
  onCreateNew,
}: DialogProps & {
  googleEmail?: string;
  onLinkAccount: () => void;
  onCreateNew: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-03-title"
    >
      <div className="relative w-full max-w-[420px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-7 shadow-2xl flex flex-col justify-between">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#65558F]" />
            <span>DLG-03 • SSO Reconciliation</span>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#14110F] mb-4">
            <Mail className="w-6 h-6" />
          </div>

          <h3
            id="dlg-03-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight mb-2"
          >
            Link Google Account
          </h3>

          <p className="text-sm text-[#6F675E] leading-relaxed mb-6">
            Signed in with <strong className="text-[#14110F]">{googleEmail || 'Google'}</strong>.
            Connect this authentication provider to your verified CreatorConnect profile.
          </p>

          <div className="space-y-2.5">
            <button
              onClick={onLinkAccount}
              className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <span>Link to Existing Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onCreateNew}
              className="w-full h-12 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span>Create New Profile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DLG-04: Reactivate Account Confirmation Dialog
 */
export function ReactivateAccountDialog({
  isOpen,
  onClose,
  onConfirmReactivate,
}: DialogProps & {
  onConfirmReactivate: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-04-title"
    >
      <div className="relative w-full max-w-[420px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-7 shadow-2xl flex flex-col justify-between">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D5F5E3] text-[#1B7339] text-[10px] font-bold uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1B7339]" />
            <span>DLG-04 • Account Recovery</span>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#14110F] mb-4">
            <UserCheck className="w-6 h-6 text-[#1B7339]" />
          </div>

          <h3
            id="dlg-04-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight mb-2"
          >
            Reactivate your account?
          </h3>

          <p className="text-sm text-[#6F675E] leading-relaxed mb-6">
            Your account was previously paused. Reactivating will immediately restore your showcase
            portfolio, messages, and brand network.
          </p>

          <div className="space-y-2.5">
            <button
              onClick={onConfirmReactivate}
              className="w-full h-12 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <span>Yes, Reactivate My Profile</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-full h-12 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-[#14110F] font-bold text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DLG-05: Account Blocked / Locked Notice Sheet
 */
export function AccountBlockedSheet({
  isOpen,
  onClose,
  reason = 'Security verification review in progress',
  referenceId = 'CC-SEC-9842',
}: DialogProps & {
  reason?: string;
  referenceId?: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/70 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-05-title"
    >
      <div className="relative w-full max-w-[460px] rounded-[32px] bg-white border border-[#E7E0D5] p-7 sm:p-8 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFDAD6] text-[#93000A] text-[10px] font-bold uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BA1A1A]" />
            <span>DLG-05 • Security Protection Hold</span>
          </div>

          <div className="w-14 h-14 rounded-3xl bg-[#FFDAD6]/50 border border-[#BA1A1A]/30 flex items-center justify-center text-[#BA1A1A] mb-5">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h3
            id="dlg-05-title"
            className="font-heading font-extrabold text-2xl sm:text-3xl text-[#14110F] tracking-tight mb-2"
          >
            Account temporarily on hold
          </h3>

          <p className="text-sm text-[#6F675E] leading-relaxed mb-6">
            Access to this CreatorConnect account has been paused in accordance with our community
            and payment security standards.
          </p>

          <div className="rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] p-4 text-xs space-y-2 mb-6">
            <div className="flex justify-between text-[#6F675E]">
              <span>Reason:</span>
              <strong className="text-[#14110F]">{reason}</strong>
            </div>
            <div className="flex justify-between text-[#6F675E]">
              <span>Reference Case:</span>
              <code className="font-mono text-[#14110F]">{referenceId}</code>
            </div>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/contact-support"
              className="w-full h-12 rounded-full bg-[#14110F] hover:bg-[#2A2420] text-[#FFD64A] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <span>Submit Expedited Appeal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              onClick={onClose}
              className="w-full h-12 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-[#14110F] font-bold text-sm transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DLG-10: Persistent Offline Toast / Banner
 */
export function OfflineBanner({
  isVisible,
  onRetry,
  onDismiss,
}: {
  isVisible: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (!isVisible) return null;

  return (
    <aside
      aria-label="Offline Alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 transition-all duration-300 animate-in slide-in-from-top-4"
    >
      <div className="bg-[#14110F] text-white px-5 py-3.5 rounded-2xl border-2 border-[#D8483C] shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-[#D8483C] shrink-0 animate-pulse" />
          <div className="text-xs sm:text-sm font-medium">
            <strong className="text-white">Connection lost.</strong> Working in offline mode.
            Changes will sync once network is restored.
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] text-xs font-bold rounded-lg transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onDismiss}
            aria-label="Dismiss offline banner"
            className="p-1 text-white/60 hover:text-white rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
