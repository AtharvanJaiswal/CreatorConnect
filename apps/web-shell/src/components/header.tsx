import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { CcLogoSquare } from './ui/cc-brand';
import { Compass, Video, Briefcase, Building2, ShieldCheck, User } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/discovery', label: 'Discover', icon: Compass },
  { href: '/creator', label: 'Creator Hub', icon: Video },
  { href: '/professional', label: 'Production Talent', icon: Briefcase },
  { href: '/brand', label: 'Brand Campaigns', icon: Building2 },
  { href: '/profiles/me', label: 'My Profile', icon: User },
  { href: '/admin', label: 'Admin Cockpit', icon: ShieldCheck },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#EAE3D5] bg-[#FAF7F2]/90 backdrop-blur-md">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <CcLogoSquare size="sm" />
            <span className="font-heading font-extrabold text-lg tracking-tight text-[#121212]">
              CREATOR<span className="font-serif italic font-normal text-[#5C564E]">connect</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-[#5C564E] transition-colors hover:bg-[#EFE9DF] hover:text-[#121212]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <button className="text-xs font-semibold px-4 py-2 rounded-full text-[#121212] hover:bg-[#EFE9DF] transition-colors">
              Sign In
            </button>
          </Link>
          <Link href="/register">
            <button className="bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] font-semibold text-xs px-4 py-2 rounded-full shadow-2xs transition-all">
              Get Started
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}
