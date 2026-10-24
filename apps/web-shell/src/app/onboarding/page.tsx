'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Sparkles,
  Search,
  SlidersHorizontal,
  Compass,
  Handshake,
  Video,
  Mic,
  Briefcase,
  ShieldCheck,
  Zap,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

interface SlideConfig {
  step: string;
  badge: string;
  tagline: string;
  titlePrimary: string;
  titleItalic: string;
  titleSuffix?: string;
  description: string;
  artBg: string;
  artPill: string;
  artPillIcon: React.ElementType;
  pillColor: string;
  badges: { icon: React.ElementType; text: string }[];
}

const SLIDES: SlideConfig[] = [
  {
    step: '01 / 03',
    badge: 'Introducing CreatorConnect',
    tagline: "India's Network",
    titlePrimary: 'Create. Connect.',
    titleItalic: 'Collaborate.',
    description:
      'One platform where creators, professionals, podcasters and brands build together.',
    artBg: 'bg-[#FFD64A]',
    artPill: 'AI MATCH',
    artPillIcon: Sparkles,
    pillColor: 'bg-[#C9B6F7] text-[#14110F]',
    badges: [
      { icon: ShieldCheck, text: 'Curated Creator Network' },
      { icon: Zap, text: 'Instant Matchmaking' },
    ],
  },
  {
    step: '02 / 03',
    badge: 'Find Collaborators',
    tagline: "India's Network",
    titlePrimary: 'Discover the ',
    titleItalic: 'right',
    titleSuffix: 'collaborators.',
    description:
      'Search verified creators and production professionals by skill, category and location.',
    artBg: 'bg-[#C9B6F7]',
    artPill: 'FIND YOUR PEOPLE',
    artPillIcon: Search,
    pillColor: 'bg-white text-[#14110F]',
    badges: [
      { icon: SlidersHorizontal, text: 'Skill & Category Filters' },
      { icon: MapPin, text: 'City & Location Discovery' },
    ],
  },
  {
    step: '03 / 03',
    badge: 'Milestone Escrow',
    tagline: 'Zero Disputes',
    titlePrimary: 'Collaborate with ',
    titleItalic: 'guaranteed',
    titleSuffix: 'milestone escrow.',
    description:
      'Lock funds safely before production starts and release automatically upon deliverable sign-off.',
    artBg: 'bg-[#B6E09B]',
    artPill: 'OPPORTUNITIES',
    artPillIcon: Handshake,
    pillColor: 'bg-white text-[#14110F]',
    badges: [
      { icon: ShieldCheck, text: 'RBI-Compliant Escrow Workflows' },
      { icon: CheckCircle2, text: 'Automated UPI Milestone Release' },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const slide = SLIDES[currentSlideIndex] ?? SLIDES[0]!;

  const handleNext = () => {
    if (currentSlideIndex < SLIDES.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      router.push('/register');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-8 lg:px-14">
      {/* Top Header */}
      <header className="w-full max-w-[1080px] mx-auto flex items-center justify-between pb-6 sm:pb-8">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-[#FFD64A] border-2 border-[#14110F] neo-shadow-sm flex items-center justify-center font-black text-base tracking-tighter text-[#14110F]">
            CC
          </div>
          <span className="font-heading font-black text-xl tracking-tight uppercase text-[#14110F]">
            Creator<span className="font-serif italic font-normal text-primary">connect</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/register"
            className="text-xs font-bold uppercase tracking-widest text-[#6F675E] hover:text-[#14110F] py-1.5 px-3 rounded-full hover:bg-[#F2ECE1] transition-colors"
          >
            Skip
          </Link>
          <Link
            href="/login"
            className="text-xs font-bold uppercase tracking-widest bg-white border border-[#E7E0D5] text-[#14110F] hover:bg-[#F2ECE1] py-1.5 px-3.5 rounded-full transition-colors"
          >
            Log In
          </Link>
        </div>
      </header>

      {/* Main Two-Column Split Container */}
      <main className="w-full max-w-[1080px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center my-auto py-4">
        {/* Left Column: Stitch Neo-Graphic Artboard */}
        <div className="lg:col-span-5 w-full flex justify-center">
          <div
            className={`relative w-full max-w-[420px] aspect-square rounded-[32px] ${slide.artBg} overflow-hidden p-6 flex flex-col justify-between shadow-sm select-none transition-colors duration-500`}
          >
            {/* Background Neo-Pop Decorative Circles */}
            <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#FFD64A]/80 pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-52 h-52 rounded-full bg-[#FFB6C8]/80 pointer-events-none" />
            <div className="absolute top-1/4 -left-6 w-24 h-40 rounded-full bg-white/70 rotate-12 pointer-events-none" />

            {/* Foreground Content Card */}
            {currentSlideIndex === 0 && (
              <div className="relative z-10 w-full h-full rounded-[24px] bg-white/95 backdrop-blur-sm p-6 flex flex-col items-center justify-between shadow-md">
                <div className="w-full flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9B6F7] text-[#14110F] text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-[#14110F]" />
                    AI MATCH
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A39A8F]">
                    01 / 03
                  </span>
                </div>

                <div className="relative w-36 h-36 flex items-center justify-center my-2">
                  <div className="absolute inset-0 rounded-full bg-[#FFD64A]/30 animate-pulse" />
                  <div className="absolute w-20 h-20 rounded-full bg-[#14110F] flex items-center justify-center text-white z-10 shadow-sm">
                    <Handshake className="w-9 h-9 text-[#FFD64A]" />
                  </div>
                  <div className="absolute -top-1 w-11 h-11 rounded-full bg-[#C9B6F7] text-[#14110F] flex items-center justify-center shadow-sm z-20">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="absolute -bottom-1 -left-1 w-11 h-11 rounded-full bg-[#FFB6C8] text-[#14110F] flex items-center justify-center shadow-sm z-20">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-11 h-11 rounded-full bg-[#B6E09B] text-[#14110F] flex items-center justify-center shadow-sm z-20">
                    <Briefcase className="w-5 h-5" />
                  </div>
                </div>

                <div className="w-full text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#6F675E] mb-1.5">
                    Creative Foundry
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#14110F]" />
                    <span className="w-2 h-2 rounded-full bg-[#C9B6F7]" />
                    <span className="w-2 h-2 rounded-full bg-[#FFB6C8]" />
                    <span className="w-2 h-2 rounded-full bg-[#B6E09B]" />
                  </div>
                </div>
              </div>
            )}

            {currentSlideIndex === 1 && (
              <div className="relative z-10 w-full h-full rounded-[24px] bg-white/95 backdrop-blur-sm p-6 flex flex-col items-center justify-between shadow-md">
                <div className="w-full flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[#14110F] text-[10px] font-bold uppercase tracking-wider">
                    <Search className="w-3.5 h-3.5 text-[#14110F]" />
                    FIND YOUR PEOPLE
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A39A8F]">
                    02 / 03
                  </span>
                </div>

                <div className="relative w-36 h-36 flex items-center justify-center my-2">
                  <div className="absolute -left-1 w-16 h-16 rounded-full bg-[#FFB6C8]/90 flex items-center justify-center shadow-sm">
                    <Search className="w-6 h-6 text-[#14110F]" />
                  </div>
                  <div className="absolute -right-1 w-16 h-16 rounded-full bg-[#FFD64A]/90 flex items-center justify-center shadow-sm">
                    <SlidersHorizontal className="w-6 h-6 text-[#14110F]" />
                  </div>
                  <div className="absolute top-0 w-16 h-16 rounded-full bg-[#B6E09B]/90 flex items-center justify-center shadow-sm">
                    <Compass className="w-6 h-6 text-[#14110F]" />
                  </div>
                  <div className="relative z-10 w-11 h-11 rounded-full bg-[#14110F] flex items-center justify-center text-white shadow-sm">
                    <Handshake className="w-5 h-5 text-[#FFD64A]" />
                  </div>
                </div>

                <div className="w-full text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#6F675E] mb-1.5">
                    Discover Creators
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#B6E09B]" />
                    <span className="w-2 h-2 rounded-full bg-[#14110F]" />
                    <span className="w-2 h-2 rounded-full bg-[#FFB6C8]" />
                    <span className="w-2 h-2 rounded-full bg-[#FFD64A]" />
                  </div>
                </div>
              </div>
            )}

            {currentSlideIndex === 2 && (
              <div className="relative z-10 w-full h-full rounded-[24px] bg-white/95 backdrop-blur-sm p-6 flex flex-col justify-between shadow-md">
                <div className="w-full flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[#14110F] text-[10px] font-bold uppercase tracking-wider">
                    <Handshake className="w-3.5 h-3.5 text-[#1B7339]" />
                    OPPORTUNITIES
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A39A8F]">
                    03 / 03
                  </span>
                </div>

                <div className="bg-[#FAF6EF] border border-[#E7E0D5] rounded-2xl p-4 my-2 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#C9B6F7] text-[#14110F] text-[9px] font-bold uppercase tracking-wider">
                      NEW BRIEF
                    </span>
                    <span className="text-[11px] font-bold text-[#1B7339] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1B7339]" />
                      Active
                    </span>
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-lg text-[#14110F]">
                      Summer Brand Campaign
                    </h3>
                    <p className="text-xs text-[#6F675E]">Reels & Shortform • Delhi NCR</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E7E0D5]">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-[#A39A8F]">
                        Milestone Budget
                      </div>
                      <div className="font-extrabold text-base text-[#14110F]">₹45,000</div>
                    </div>
                    <span className="text-xs font-bold text-[#1B7339] bg-[#D5F5E3] px-2.5 py-1 rounded-full">
                      Escrow Funded
                    </span>
                  </div>
                </div>

                <div className="w-full text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#6F675E] mb-1.5">
                    Safe Escrow Pipeline
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1B7339]" />
                    <span className="w-2 h-2 rounded-full bg-[#FFD64A]" />
                    <span className="w-2 h-2 rounded-full bg-[#C9B6F7]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stitch Editorial Copy & Next Control */}
        <div className="lg:col-span-7 flex flex-col justify-center lg:pl-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-[#F2ECE1] text-[10px] font-bold uppercase tracking-widest text-[#6F675E]">
              {slide.badge}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD64A]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
              {slide.tagline}
            </span>
          </div>

          <h1 className="text-[#14110F] tracking-tight mb-4">
            <span className="block font-heading font-black text-3xl sm:text-5xl text-[#14110F]">
              {slide.titlePrimary}
            </span>
            <span className="block font-serif italic text-3xl sm:text-5xl text-[#14110F] mt-1">
              {slide.titleItalic} {slide.titleSuffix}
            </span>
          </h1>

          <p className="text-base text-[#6F675E] max-w-md leading-relaxed mb-8">
            {slide.description}
          </p>

          {/* Progress and Next Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2">
            <div aria-label="Step progress" className="flex items-center gap-2">
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  aria-label={`Jump to slide ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlideIndex
                      ? 'w-8 bg-[#14110F]'
                      : 'w-2 bg-[#D0C6AE] hover:bg-[#A39A8F]'
                  }`}
                />
              ))}
            </div>

            <button
              id="next-step-btn"
              onClick={handleNext}
              className="inline-flex items-center justify-center gap-2 px-8 h-[52px] rounded-full bg-[#FFD64A] hover:bg-[#F5CB35] active:scale-[0.98] text-[#14110F] font-bold text-sm shadow-sm transition-all"
            >
              <span>{currentSlideIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Feature Badges */}
          <div className="mt-10 pt-4 flex flex-wrap items-center gap-6 opacity-75 border-t border-[#E7E0D5]">
            {slide.badges.map((b, i) => {
              const Icon = b.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-semibold text-[#6F675E]"
                >
                  <Icon className="w-4 h-4 text-[#14110F]" />
                  <span>{b.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footnote */}
      <footer className="w-full text-center text-xs text-[#A39A8F] pt-6">
        <p>© 2025 CreatorConnect • Algorithmic Talent & Creative Escrow Network</p>
      </footer>
    </div>
  );
}
