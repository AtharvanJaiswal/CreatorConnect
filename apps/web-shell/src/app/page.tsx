import React from 'react';
import Link from 'next/link';
import { SplashHero } from '../components/splash-hero';
import { CapsuleBadge } from '../components/ui/cc-brand';
import {
  Video,
  Clapperboard,
  Mic,
  Building2,
  ArrowRight,
  CheckCircle2,
  Search,
} from 'lucide-react';

const PERSONAS = [
  {
    title: 'Creator / Influencer',
    role: 'Content Creators & Influencers',
    description:
      'Manage incoming brand deals, post production briefs, hire verified crew, and review deliverables with milestone escrows.',
    href: '/creator',
    icon: Video,
    iconBg: 'bg-[#FFEA9F]',
    iconColor: 'text-[#8C6D00]',
    badgeText: 'Creator Hub',
    highlights: ['Brief Posting', 'Crew Contracting', 'Milestone Approvals'],
  },
  {
    title: 'Production Professional',
    role: 'Editors, Colorists, VFX & DP',
    description:
      'Display verified showreels, set transparent rate cards, apply to high-value briefs, and receive guaranteed payouts upon sign-off.',
    href: '/pro',
    icon: Clapperboard,
    iconBg: 'bg-[#E9E1FC]',
    iconColor: 'text-[#5A38A8]',
    badgeText: 'Pro Talent',
    highlights: ['Showreel Showcase', 'Contract Invoicing', 'Safe Escrow Funds'],
  },
  {
    title: 'Brand / Sponsor',
    role: 'Enterprises & Agencies',
    description:
      'Launch multi-creator campaigns, review talent applications, fund milestone escrows via Razorpay, and verify raw footage deliverables.',
    href: '/brand',
    icon: Building2,
    iconBg: 'bg-[#E0DCF8]',
    iconColor: 'text-[#4F469E]',
    badgeText: 'Brand Portal',
    highlights: ['Escrow Protection', 'Talent Discovery', 'Audit Invoicing'],
  },
  {
    title: 'Podcaster',
    role: 'Audio & Video Hosts',
    description:
      'Connect with industry guests, hire sound engineers and audio mixers, manage production schedules and distribute episodes.',
    href: '/creator',
    icon: Mic,
    iconBg: 'bg-[#FDD9E4]',
    iconColor: 'text-[#A63A5E]',
    badgeText: 'Podcast Studio',
    highlights: ['Guest Booking', 'Audio Engineering', 'Sponsorship Deals'],
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col bg-[#FAF7F2] text-[#121212]">
      {/* 1. Approved Splash Screen (SCR-SPLASH-01) */}
      <SplashHero />

      {/* 2. Design System Showcase / Quick Navigation Banner */}
      <section className="border-y border-[#EAE3D5] bg-[#F7F2E9] py-6 px-4 sm:px-8">
        <div className="container max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CapsuleBadge variant="amber">GOOGLE STITCH UI/UX SPECIFICATION</CapsuleBadge>
            <span className="text-xs text-[#6F675E] font-medium hidden sm:inline">
              Warm Editorial Neo-Pop Reconstructed
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Link
              href="/onboarding"
              className="bg-white hover:bg-[#F2ECE1] text-[#14110F] px-3.5 py-1.5 rounded-full border border-[#E7E0D5] transition-colors"
            >
              A02 Onboarding (3 Slides)
            </Link>
            <Link
              href="/register"
              className="bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] px-3.5 py-1.5 rounded-full transition-colors"
            >
              A03 / B01 / B02 (Registration & OTP)
            </Link>
            <Link
              href="/consent"
              className="bg-white hover:bg-[#F2ECE1] text-[#14110F] px-3.5 py-1.5 rounded-full border border-[#E7E0D5] transition-colors"
            >
              B09 Age & Consent
            </Link>
            <Link
              href="/account-blocked"
              className="bg-white hover:bg-[#F2ECE1] text-[#14110F] px-3.5 py-1.5 rounded-full border border-[#E7E0D5] transition-colors"
            >
              B10 Account Blocked
            </Link>
            <Link
              href="/reactivate"
              className="bg-white hover:bg-[#F2ECE1] text-[#14110F] px-3.5 py-1.5 rounded-full border border-[#E7E0D5] transition-colors"
            >
              B11 Reactivate
            </Link>
            <Link
              href="/auth-dialogs"
              className="bg-[#C9B6F7] hover:bg-[#BBA4F5] text-[#14110F] px-3.5 py-1.5 rounded-full transition-colors"
            >
              Module B Dialogs (DLG 01-10)
            </Link>
            <Link
              href="/discovery"
              className="bg-white hover:bg-[#F2ECE1] text-[#14110F] px-3.5 py-1.5 rounded-full border border-[#E7E0D5] transition-colors"
            >
              Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Hero Introduction */}
      <section className="py-16 sm:py-24 px-4 sm:px-8">
        <div className="container max-w-5xl mx-auto text-center">
          <CapsuleBadge variant="default" className="mb-6">
            FIND COLLABORATORS • INDIA&apos;S NETWORK
          </CapsuleBadge>

          <h1 className="font-heading font-extrabold text-4xl sm:text-6xl text-[#121212] tracking-tight leading-[1.1] mb-6">
            Discover the <span className="font-serif italic font-normal text-[#121212]">right</span>{' '}
            collaborators.
          </h1>

          <p className="text-[#5C564E] text-base sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            CreatorConnect unifies creators, production pros, and brands into verified workspaces
            backed by milestone escrows and age-verified identity protocols.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="bg-[#FFCE38] hover:bg-[#F5C32C] active:scale-[0.98] text-[#121212] font-semibold text-sm px-8 py-3.5 rounded-full shadow-sm inline-flex items-center gap-2 transition-all"
            >
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/discovery"
              className="bg-white hover:bg-[#FDFBF7] text-[#121212] font-semibold text-sm px-8 py-3.5 rounded-full border border-[#D9D2C5] shadow-2xs inline-flex items-center gap-2 transition-all"
            >
              <Search className="h-4 w-4 text-[#7C756B]" />
              <span>Explore Discovery</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Role / Persona Cards matching SCR-AUTH-ROLES-01 styling */}
      <section className="container max-w-7xl mx-auto px-4 sm:px-8 pb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-[#121212] tracking-tight mb-3">
            Tailored Experiences for Every{' '}
            <span className="font-serif italic font-normal">Creative Node</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#6B655C]">
            Select your persona or explore dedicated domain workflows with role-based access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PERSONAS.map((persona) => {
            const Icon = persona.icon;
            return (
              <div
                key={persona.title}
                className="bg-white rounded-3xl p-8 border border-[#EDE7DE] shadow-2xs hover:shadow-md hover:border-[#D6CEBF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className={`h-12 w-12 rounded-2xl flex items-center justify-center ${persona.iconBg} ${persona.iconColor}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <CapsuleBadge variant="amber">{persona.badgeText}</CapsuleBadge>
                  </div>

                  <h3 className="font-heading font-bold text-xl text-[#121212] mb-1">
                    {persona.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#8C8479] uppercase tracking-wider mb-3">
                    {persona.role}
                  </p>
                  <p className="text-sm text-[#5C564E] leading-relaxed mb-6">
                    {persona.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {persona.highlights.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C564E] bg-[#FAF7F2] border border-[#EAE3D5] px-3 py-1 rounded-full"
                      >
                        <CheckCircle2 className="h-3 w-3 text-[#1B7339]" />
                        <span>{item}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={persona.href}
                  className="w-full py-3 rounded-full border border-[#D9D2C5] bg-[#FAF7F2] hover:bg-white text-xs font-bold text-[#121212] flex items-center justify-between px-5 transition-colors"
                >
                  <span>Launch {persona.title}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
