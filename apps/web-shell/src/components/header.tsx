import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { CcLogoSquare } from './ui/cc-brand';
import {
  Compass,
  Video,
  Briefcase,
  Building2,
  ShieldCheck,
  User,
  MessageSquare,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/discovery', label: 'Discover', icon: Compass },
  { href: '/assignments', label: 'Assignments', icon: Briefcase },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/creator', label: 'Creator Hub', icon: Video },
  { href: '/professional', label: 'Production Talent', icon: Briefcase },
  { href: '/brand', label: 'Brand Campaigns', icon: Building2 },
  { href: '/auth-dialogs', label: 'Auth States & Dialogs', icon: ShieldCheck },
  { href: '/profiles/me', label: 'My Profile', icon: User },
  { href: '/admin', label: 'Admin Cockpit', icon: ShieldCheck },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E7E0D5] bg-[#FAF6EF]/90 backdrop-blur-md">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <CcLogoSquare size="sm" />
            <span className="font-heading font-black text-lg tracking-tight text-[#14110F]">
              CREATOR<span className="font-serif italic font-normal text-[#6F675E]">connect</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 text-xs font-bold">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-[#6F675E] transition-colors hover:bg-[#F2ECE1] hover:text-[#14110F]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <button className="text-xs font-bold px-4 py-2 rounded-full text-[#14110F] hover:bg-[#F2ECE1] transition-colors">
              Sign In
            </button>
          </Link>
          <Link href="/register">
            <button className="bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs px-4 py-2 rounded-full shadow-2xs transition-all">
              Get Started
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}
