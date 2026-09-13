import Link from 'next/link';
import { Button } from '@creatorconnect/ui';
import { ThemeToggle } from './theme-toggle';
import { Sparkles, Compass, Video, Briefcase, Building2, ShieldCheck } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Explore', icon: Compass },
  { href: '/creator', label: 'Creator Hub', icon: Video },
  { href: '/pro', label: 'Production Talent', icon: Briefcase },
  { href: '/brand', label: 'Brand Campaigns', icon: Building2 },
  { href: '/admin', label: 'Admin Cockpit', icon: ShieldCheck },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-heading font-bold text-xl tracking-tight"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="gradient-text text-xl font-extrabold tracking-tight">
              CreatorConnect
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            Sign In
          </Button>
          <Button size="sm" className="shadow-sm">
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
}
