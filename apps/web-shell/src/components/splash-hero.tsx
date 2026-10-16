'use client';

import React from 'react';
import Link from 'next/link';
import { CcLogoSquare } from './ui/cc-brand';

export function SplashHero({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="relative w-full min-h-[92vh] bg-[#FFCE38] flex flex-col justify-between items-center overflow-hidden p-6 select-none">
      {/* Decorative organic shapes */}
      {/* Top-left white half-circle */}
      <div
        className="absolute -top-16 -left-16 w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-white/95 pointer-events-none"
        aria-hidden="true"
      />

      {/* Top-right white angled capsule */}
      <div
        className="absolute top-10 -right-12 w-44 h-20 sm:w-60 sm:h-28 rounded-full bg-white/95 -rotate-12 pointer-events-none"
        aria-hidden="true"
      />

      {/* Bottom-left peach/pastel orange circle */}
      <div
        className="absolute -bottom-16 -left-16 w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-[#FBD7BA]/90 pointer-events-none"
        aria-hidden="true"
      />

      {/* Bottom-right soft lavender circle */}
      <div
        className="absolute -bottom-20 -right-20 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-[#D6C4FD]/90 pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Spacer / Quick action */}
      <div className="w-full max-w-7xl flex justify-end z-10 pt-2">
        <Link
          href="/onboarding"
          className="text-xs font-semibold uppercase tracking-wider bg-black/10 hover:bg-black/20 text-[#121212] px-3.5 py-1.5 rounded-full transition-all"
        >
          View Onboarding →
        </Link>
      </div>

      {/* Center Brand Identity (SCR-SPLASH-01) */}
      <div className="flex flex-col items-center justify-center text-center z-10 my-auto py-12">
        <div className="mb-6 transform hover:scale-105 transition-transform duration-300">
          <CcLogoSquare size="xl" className="shadow-2xl" />
        </div>

        <h1 className="font-heading font-black text-2xl sm:text-4xl tracking-tight text-[#121212] uppercase mb-1">
          CREATORCONNECT
        </h1>

        <p className="font-serif italic text-base sm:text-lg text-[#121212]/85 tracking-wide">
          create together
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/onboarding"
            className="bg-[#121212] text-[#FFCE38] hover:bg-[#222222] font-semibold text-sm px-6 py-2.5 rounded-full shadow-md transition-all inline-flex items-center gap-2"
          >
            Get Started
          </Link>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="bg-white/80 hover:bg-white text-[#121212] font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm transition-all"
            >
              Explore Hub
            </button>
          )}
        </div>
      </div>

      {/* Bottom Pagination Dots */}
      <div className="flex items-center gap-2 z-10 pb-4">
        <span className="h-1.5 w-1.5 rounded-full bg-[#121212]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#121212]/40" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#121212]/40" />
      </div>
    </div>
  );
}
