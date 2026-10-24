'use client';

import React from 'react';
import Link from 'next/link';
import { CcLogoSquare } from './ui/cc-brand';

export function SplashHero({ onDismiss }: { onDismiss?: () => void }) {
  const [activeDot, setActiveDot] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveDot((prev) => (prev + 1) % 3);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full min-h-[92vh] bg-[#FFD64A] flex flex-col justify-between items-center overflow-hidden p-6 select-none">
      {/* Stitch A01 Top-left subtle warm paper cropped disc */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 md:w-96 md:h-96 rounded-full bg-white/90 pointer-events-none transition-transform duration-1000 ease-out"
        aria-hidden="true"
      />

      {/* Stitch A01 Top-right playful organic pill accent */}
      <div
        className="absolute top-12 -right-16 md:top-20 md:-right-10 w-44 h-24 md:w-56 md:h-28 rounded-full bg-[#FAF2EE] rotate-12 pointer-events-none"
        aria-hidden="true"
      />

      {/* Stitch A01 Bottom-right soft lilac editorial capsule shape */}
      <div
        className="absolute -bottom-24 -right-20 md:-bottom-32 md:-right-24 w-72 h-80 md:w-[28rem] md:h-[28rem] rounded-full bg-[#D0BCFE] -rotate-12 pointer-events-none"
        aria-hidden="true"
      />

      {/* Stitch A01 Bottom-left soft blush secondary counterweight */}
      <div
        className="absolute -bottom-20 -left-20 w-48 h-48 md:w-64 md:h-64 rounded-full bg-[#FFCDD8]/70 pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Navigation Strip */}
      <div className="w-full max-w-7xl flex justify-end z-10 pt-2">
        <Link
          href="/onboarding"
          className="text-xs font-bold uppercase tracking-wider bg-[#14110F]/10 hover:bg-[#14110F]/20 text-[#14110F] px-4 py-2 rounded-full transition-all"
        >
          View Onboarding →
        </Link>
      </div>

      {/* Center Brand Identity (A01 Splash — CreatorConnect) */}
      <div className="flex flex-col items-center justify-center text-center z-10 my-auto py-12">
        <div className="mb-6 transform hover:scale-105 transition-transform duration-300">
          <CcLogoSquare size="xl" className="shadow-2xl bg-[#14110F]" />
        </div>

        <h1 className="font-heading font-black text-3xl sm:text-5xl tracking-[-0.03em] text-[#14110F] uppercase mb-1">
          CREATORCONNECT
        </h1>

        <p className="font-serif italic text-xl sm:text-2xl text-[#14110F]/90">create together</p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/onboarding"
            className="bg-[#14110F] text-[#FFD64A] hover:bg-[#2A2420] font-bold text-sm px-7 py-3 rounded-full shadow-md transition-all inline-flex items-center gap-2"
          >
            Get Started
          </Link>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="bg-white hover:bg-[#FAF6EF] text-[#14110F] font-bold text-sm px-6 py-3 rounded-full border border-[#E7E0D5] shadow-sm transition-all"
            >
              Explore Hub
            </button>
          )}
        </div>
      </div>

      {/* Stitch A01 Lower-Center Transition Indicator */}
      <div className="relative z-10 pb-6 flex items-center justify-center space-x-2.5">
        <span
          className={`w-2.5 h-2.5 rounded-full bg-[#14110F] transition-opacity duration-500 ${
            activeDot === 0 ? 'opacity-100' : 'opacity-30'
          }`}
        />
        <span
          className={`w-2.5 h-2.5 rounded-full bg-[#14110F] transition-opacity duration-500 ${
            activeDot === 1 ? 'opacity-100' : 'opacity-30'
          }`}
        />
        <span
          className={`w-2.5 h-2.5 rounded-full bg-[#14110F] transition-opacity duration-500 ${
            activeDot === 2 ? 'opacity-100' : 'opacity-30'
          }`}
        />
      </div>
    </div>
  );
}
