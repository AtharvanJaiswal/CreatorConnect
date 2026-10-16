'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CcLogoSquare, CapsuleBadge } from '../../components/ui/cc-brand';
import { Zap, MapPin, ArrowRight, ShieldCheck, Video, Users } from 'lucide-react';

interface OnboardingSlide {
  id: string;
  badge: string;
  badgeVariant: 'default' | 'amber' | 'purple';
  titlePrefix: string;
  titleItalic: string;
  titleSuffix: string;
  subtitle: string;
  features: { icon: React.ElementType; text: string }[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'collaborators',
    badge: "FIND COLLABORATORS • INDIA'S NETWORK",
    badgeVariant: 'default',
    titlePrefix: 'Discover the ',
    titleItalic: 'right',
    titleSuffix: ' collaborators.',
    subtitle:
      'Search verified creators and production professionals by skill, category and location.',
    features: [
      { icon: Zap, text: 'Skill & Category Filters' },
      { icon: MapPin, text: 'City & Location Discovery' },
    ],
  },
  {
    id: 'escrow',
    badge: 'SECURE MILESTONES • ZERO DISPUTES',
    badgeVariant: 'amber',
    titlePrefix: 'Collaborate with ',
    titleItalic: 'guaranteed',
    titleSuffix: ' milestone escrow.',
    subtitle:
      'Lock funds safely before production starts and release automatically upon deliverable sign-off.',
    features: [
      { icon: ShieldCheck, text: 'RBI-Compliant Escrow Workflows' },
      { icon: Video, text: 'Deliverable Verification Checks' },
    ],
  },
  {
    id: 'talent',
    badge: 'VERIFIED PORTFOLIOS • INSTANT CONTRACTS',
    badgeVariant: 'purple',
    titlePrefix: 'Elevate your ',
    titleItalic: 'creative',
    titleSuffix: ' production pipeline.',
    subtitle:
      'Join thousands of creators, editors, podcasts, and forward-thinking brands across India.',
    features: [
      { icon: Users, text: '45,000+ Creative Nodes' },
      { icon: Zap, text: 'Direct Instant Messaging' },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const slide: OnboardingSlide = SLIDES[currentSlideIndex] ?? SLIDES[0]!;

  const handleNext = () => {
    if (currentSlideIndex < SLIDES.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      router.push('/register');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#121212] flex flex-col justify-between px-6 py-8 sm:px-12 sm:py-10">
      {/* Top Header */}
      <header className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5 group">
          <CcLogoSquare size="sm" />
          <span className="font-heading font-extrabold text-base tracking-tight text-[#121212]">
            CREATOR
            <span className="font-serif italic font-normal text-muted-foreground">connect</span>
          </span>
        </Link>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <Link
            href="/register"
            className="text-[#6B655C] hover:text-[#121212] transition-colors uppercase tracking-wider"
          >
            Skip
          </Link>
          <Link
            href="/login"
            className="text-[#121212] hover:underline transition-colors uppercase tracking-wider"
          >
            Log In
          </Link>
        </div>
      </header>

      {/* Main Slide Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto my-12">
        <CapsuleBadge variant={slide.badgeVariant} className="mb-8">
          {slide.badge}
        </CapsuleBadge>

        <h1 className="font-heading font-extrabold text-4xl sm:text-6xl text-[#121212] tracking-tight leading-[1.1] mb-6">
          {slide.titlePrefix}
          <span className="font-serif italic font-normal text-[#121212]">{slide.titleItalic}</span>
          {slide.titleSuffix}
        </h1>

        <p className="text-[#5C564E] text-base sm:text-lg max-w-xl mb-10 leading-relaxed">
          {slide.subtitle}
        </p>

        {/* Slide Pagination Indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlideIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                idx === currentSlideIndex
                  ? 'w-7 bg-[#FFCE38]'
                  : 'w-2.5 bg-[#D6CEBF] hover:bg-[#B8AF9F]'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={handleNext}
          className="bg-[#FFCE38] hover:bg-[#F5C32C] active:scale-[0.98] text-[#121212] font-semibold text-base px-9 py-3.5 rounded-full shadow-sm inline-flex items-center gap-2.5 transition-all mb-16"
        >
          <span>Next</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Bottom Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 pt-4 border-t border-[#EAE3D5] w-full">
          {slide.features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs font-semibold text-[#5C564E]"
              >
                <Icon className="h-4 w-4 text-[#FFCE38]" />
                <span>{feature.text}</span>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-[#8C8479]">
        <p>CreatorConnect Network © 2025 • Algorithmic Talent & Creative Foundry</p>
      </footer>
    </div>
  );
}
