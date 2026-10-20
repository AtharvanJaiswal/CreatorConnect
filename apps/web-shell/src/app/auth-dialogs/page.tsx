'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AccountExistsDialog,
  OtpLimitReachedDialog,
  GoogleHandoffDialog,
  ReactivateAccountDialog,
  AccountBlockedSheet,
  OfflineBanner,
} from '../../components/ui/auth-dialogs';
import { WifiOff, CheckCircle2, AlertCircle, Eye } from 'lucide-react';

export default function AuthDialogsCataloguePage() {
  const [activeDialog, setActiveDialog] = useState<
    'none' | 'dlg01' | 'dlg02' | 'dlg03' | 'dlg04' | 'dlg05'
  >('none');
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [filter, setFilter] = useState<'all' | 'dlg' | 'val'>('all');

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col selection:bg-[#FFD64A] selection:text-[#14110F]">
      {/* Offline Banner Toggleable */}
      <OfflineBanner
        isVisible={showOfflineBanner}
        onRetry={() => setShowOfflineBanner(false)}
        onDismiss={() => setShowOfflineBanner(false)}
      />

      {/* Top Header */}
      <header className="w-full h-20 bg-[#FAF6EF] border-b border-[#E7E0D5] px-6 sm:px-10 lg:px-14 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#FFD64A] border-2 border-[#14110F] neo-shadow-sm flex items-center justify-center font-black text-base tracking-tighter text-[#14110F]">
            CC
          </div>
          <div>
            <div className="font-black text-xl tracking-tight leading-none text-[#14110F]">
              CreatorConnect
            </div>
            <span className="text-[10px] uppercase font-bold tracking-[0.16em] text-[#6F675E]">
              Design System / Module B
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOfflineBanner(!showOfflineBanner)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              showOfflineBanner
                ? 'bg-[#14110F] text-[#FFD64A]'
                : 'bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#F2ECE1]'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5 text-[#D8483C]" />
            <span>Toggle DLG-10 Offline Toast</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-10">
        {/* Top Title & Metadata Bar */}
        <div className="flex flex-col gap-6 mb-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFD64A]" />
              <span className="text-xs uppercase font-black tracking-widest text-[#6F675E]">
                Production Component Standards • Build 2.8.4
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#D5F5E3] text-[#1B7339] text-xs font-bold">
              100% Zero-Leak Auth Policy Compliant
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E7E0D5] pb-8">
            <div>
              <h1 className="font-heading font-black text-4xl sm:text-5xl text-[#14110F] tracking-tight">
                Auth States{' '}
                <span className="font-serif italic font-normal text-4xl sm:text-5xl text-[#65558F]">
                  & Dialogs.
                </span>
              </h1>
              <p className="text-base text-[#6F675E] max-w-2xl mt-2 leading-relaxed">
                Approved modal overlays, non-dismissible blocking sheets, and humanized inline
                validation states for CreatorConnect algorithmic network access.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-[#F2ECE1] p-1.5 rounded-full self-start md:self-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  filter === 'all'
                    ? 'bg-[#14110F] text-white shadow-sm'
                    : 'text-[#6F675E] hover:text-[#14110F]'
                }`}
              >
                All Overlays
              </button>
              <button
                onClick={() => setFilter('dlg')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  filter === 'dlg'
                    ? 'bg-[#14110F] text-white shadow-sm'
                    : 'text-[#6F675E] hover:text-[#14110F]'
                }`}
              >
                Modal Dialogs (DLG)
              </button>
              <button
                onClick={() => setFilter('val')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  filter === 'val'
                    ? 'bg-[#14110F] text-white shadow-sm'
                    : 'text-[#6F675E] hover:text-[#14110F]'
                }`}
              >
                Inline Validation (VAL)
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 1: MODAL OVERLAYS & DIALOGS (DLG SERIES) */}
        {(filter === 'all' || filter === 'dlg') && (
          <section className="mb-14">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2.5 h-6 rounded-full bg-[#FFD64A]" />
              <h2 className="font-heading font-black text-2xl text-[#14110F]">
                Modal Overlays & Sheets (DLG Series)
              </h2>
              <span className="text-xs font-bold text-[#6F675E] bg-white border border-[#E7E0D5] px-2.5 py-0.5 rounded-full ml-2">
                420px Fixed Shell Footprint
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* DLG-01: Account Already Exists */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider">
                      DLG-01 • Duplicate Found
                    </span>
                    <span className="text-[11px] text-[#A39A8F]">Soft Dismiss</span>
                  </div>

                  <h3 className="font-heading font-black text-xl text-[#14110F] mb-2">
                    Account Already Exists
                  </h3>
                  <p className="text-xs text-[#6F675E] leading-relaxed mb-6">
                    Triggered when mobile number is registered. Offers instant password login or SMS
                    OTP shortcut.
                  </p>
                </div>

                <button
                  onClick={() => setActiveDialog('dlg01')}
                  className="w-full py-3 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview DLG-01 Live</span>
                </button>
              </div>

              {/* DLG-02: OTP Resend Limit */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-[#FFDAD6] text-[#93000A] text-[10px] font-bold uppercase tracking-wider">
                      DLG-02 • Rate Limit
                    </span>
                    <span className="text-[11px] text-[#A39A8F]">Security Hold</span>
                  </div>

                  <h3 className="font-heading font-black text-xl text-[#14110F] mb-2">
                    OTP Resend Limit Reached
                  </h3>
                  <p className="text-xs text-[#6F675E] leading-relaxed mb-6">
                    Protects SMS gateway and account enumeration attacks with a strict 15-minute
                    cool-off timer.
                  </p>
                </div>

                <button
                  onClick={() => setActiveDialog('dlg02')}
                  className="w-full py-3 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview DLG-02 Live</span>
                </button>
              </div>

              {/* DLG-03: Google Sign-in Handoff */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider">
                      DLG-03 • SSO Reconciliation
                    </span>
                    <span className="text-[11px] text-[#A39A8F]">Account Linking</span>
                  </div>

                  <h3 className="font-heading font-black text-xl text-[#14110F] mb-2">
                    Google Sign-in Handoff
                  </h3>
                  <p className="text-xs text-[#6F675E] leading-relaxed mb-6">
                    Connects OAuth identity token with existing verified phone/creator profile
                    without data collision.
                  </p>
                </div>

                <button
                  onClick={() => setActiveDialog('dlg03')}
                  className="w-full py-3 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview DLG-03 Live</span>
                </button>
              </div>

              {/* DLG-04: Reactivate Account */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-[#D5F5E3] text-[#1B7339] text-[10px] font-bold uppercase tracking-wider">
                      DLG-04 • Account Recovery
                    </span>
                    <span className="text-[11px] text-[#A39A8F]">State Restoration</span>
                  </div>

                  <h3 className="font-heading font-black text-xl text-[#14110F] mb-2">
                    Reactivate Account Confirmation
                  </h3>
                  <p className="text-xs text-[#6F675E] leading-relaxed mb-6">
                    Restores deactivated profiles, existing proposals, rate cards, and previous
                    contracts instantly.
                  </p>
                </div>

                <button
                  onClick={() => setActiveDialog('dlg04')}
                  className="w-full py-3 rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview DLG-04 Live</span>
                </button>
              </div>

              {/* DLG-05: Account Blocked Notice */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-[#FFDAD6] text-[#93000A] text-[10px] font-bold uppercase tracking-wider">
                      DLG-05 • Security Hold
                    </span>
                    <span className="text-[11px] text-[#A39A8F]">Administrative Sheet</span>
                  </div>

                  <h3 className="font-heading font-black text-xl text-[#14110F] mb-2">
                    Account Blocked Notice
                  </h3>
                  <p className="text-xs text-[#6F675E] leading-relaxed mb-6">
                    Non-dismissible safety sheet displaying specific compliance case reference and
                    appeal dispatch.
                  </p>
                </div>

                <button
                  onClick={() => setActiveDialog('dlg05')}
                  className="w-full py-3 rounded-full bg-[#14110F] hover:bg-[#2A2420] text-[#FFD64A] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview DLG-05 Live</span>
                </button>
              </div>

              {/* DLG-10: Connection Lost Banner */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-[#14110F] text-[#FFD64A] text-[10px] font-bold uppercase tracking-wider">
                      DLG-10 • Network Alert
                    </span>
                    <span className="text-[11px] text-[#A39A8F]">Floating Banner</span>
                  </div>

                  <h3 className="font-heading font-black text-xl text-[#14110F] mb-2">
                    Connection Lost Offline Toast
                  </h3>
                  <p className="text-xs text-[#6F675E] leading-relaxed mb-6">
                    Floating alert with automatic state caching and manual retry button when network
                    cuts out.
                  </p>
                </div>

                <button
                  onClick={() => setShowOfflineBanner(true)}
                  className="w-full py-3 rounded-full bg-[#FAF6EF] hover:bg-[#F2ECE1] border border-[#E7E0D5] text-[#14110F] font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <WifiOff className="w-4 h-4 text-[#D8483C]" />
                  <span>Trigger DLG-10 Toast</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: INLINE VALIDATION STATES (VAL SERIES) */}
        {(filter === 'all' || filter === 'val') && (
          <section className="mb-14">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2.5 h-6 rounded-full bg-[#C9B6F7]" />
              <h2 className="font-heading font-black text-2xl text-[#14110F]">
                Humanized Inline Validation States (VAL Series)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VAL-01: Invalid Mobile Format */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#D8483C] bg-[#FFDAD6] px-2.5 py-0.5 rounded-full">
                    VAL-01 • Invalid Mobile
                  </span>
                  <span className="text-xs text-[#A39A8F]">Live Error State</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#14110F]">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    defaultValue="98765"
                    className="w-full h-12 px-4 rounded-2xl border-2 border-[#D8483C] bg-[#FFF8F5] text-sm text-[#14110F] font-medium outline-none"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-[#D8483C] pt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Please enter a valid 10-digit Indian mobile number.</span>
                  </div>
                </div>
              </div>

              {/* VAL-06: Clean Green Check Validated */}
              <div className="bg-white rounded-3xl border border-[#E7E0D5] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1B7339] bg-[#D5F5E3] px-2.5 py-0.5 rounded-full">
                    VAL-06 • Verified Valid
                  </span>
                  <span className="text-xs text-[#A39A8F]">Valid State</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#14110F]">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      defaultValue="9876543210"
                      className="w-full h-12 px-4 rounded-2xl border-2 border-[#1B7339] bg-[#FAF6EF] text-sm text-[#14110F] font-medium outline-none"
                    />
                    <CheckCircle2 className="w-5 h-5 text-[#1B7339] absolute right-4 top-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#1B7339] pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Valid Indian mobile format (+91 Airtel / Jio / Vi).</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Render Modal Overlays */}
      <AccountExistsDialog
        isOpen={activeDialog === 'dlg01'}
        onClose={() => setActiveDialog('none')}
        phoneNumber="+91 98765 43210"
        onSignInPassword={() => setActiveDialog('none')}
        onSignInOtp={() => setActiveDialog('none')}
      />

      <OtpLimitReachedDialog
        isOpen={activeDialog === 'dlg02'}
        onClose={() => setActiveDialog('none')}
        waitMinutes={15}
      />

      <GoogleHandoffDialog
        isOpen={activeDialog === 'dlg03'}
        onClose={() => setActiveDialog('none')}
        googleEmail="creator.talent@gmail.com"
        onLinkAccount={() => setActiveDialog('none')}
        onCreateNew={() => setActiveDialog('none')}
      />

      <ReactivateAccountDialog
        isOpen={activeDialog === 'dlg04'}
        onClose={() => setActiveDialog('none')}
        onConfirmReactivate={() => setActiveDialog('none')}
      />

      <AccountBlockedSheet
        isOpen={activeDialog === 'dlg05'}
        onClose={() => setActiveDialog('none')}
        reason="Security compliance check on campaign escrow milestone."
        referenceId="CC-SEC-9842"
      />
    </div>
  );
}
