import Link from 'next/link';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
} from '@creatorconnect/ui';
import {
  Sparkles,
  ArrowRight,
  Video,
  Briefcase,
  Building2,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  Layers,
} from 'lucide-react';

const PERSONAS = [
  {
    title: 'Creator Hub',
    role: 'Content Creators & Influencers',
    description:
      'Manage incoming brand deals, post production briefs, hire verified crew, and review video deliverables with milestone escrows.',
    href: '/creator',
    icon: Video,
    accent: 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30',
    badgeText: 'Creator Persona',
    badgeVariant: 'default' as const,
    highlights: ['Brief Posting', 'Crew Contracting', 'Milestone Approvals'],
  },
  {
    title: 'Production Talent',
    role: 'Editors, Colorists, VFX & DP',
    description:
      'Display verified showreels, set transparent rate cards, apply to high-value briefs, and receive guaranteed payouts upon sign-off.',
    href: '/pro',
    icon: Briefcase,
    accent: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-500/30',
    badgeText: 'Pro Persona',
    badgeVariant: 'secondary' as const,
    highlights: ['Showreel Showcase', 'Contract Invoicing', 'Safe Escrow Funds'],
  },
  {
    title: 'Brand Campaigns',
    role: 'Enterprises & Agencies',
    description:
      'Launch multi-creator campaigns, review talent applications, fund milestone escrows via Razorpay, and verify raw footage deliverables.',
    href: '/brand',
    icon: Building2,
    accent: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
    badgeText: 'Brand Persona',
    badgeVariant: 'success' as const,
    highlights: ['Escrow Protection', 'Talent Discovery', 'Audit Invoicing'],
  },
  {
    title: 'Admin Cockpit',
    role: 'Operations & Compliance',
    description:
      'Isolated operational cockpit for KYC verification, escrow release approvals, dispute arbitration, and real-time security audit trails.',
    href: '/admin',
    icon: ShieldCheck,
    accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',
    badgeText: 'Admin Domain',
    badgeVariant: 'warning' as const,
    highlights: ['KYC Verification', 'Dispute Resolution', 'Audit Compliance'],
  },
];

const ARCH_PILLARS = [
  {
    title: 'Multi-Zone Microfrontends',
    description:
      'Independently deployable Next.js route zones sharing a unified design system and TypeScript contracts.',
    icon: Layers,
  },
  {
    title: 'Library-First Design System',
    description:
      'Radix UI primitives and Tailwind tokens ensure zero WCAG 2.1 AA accessibility violations and unified aesthetics.',
    icon: Sparkles,
  },
  {
    title: 'Defense-in-Depth Security',
    description:
      'Zero-trust backend RBAC, CSP headers, OWASP protections, and strict escrow invariant verification.',
    icon: Lock,
  },
  {
    title: 'Sub-Millisecond Speed',
    description:
      'Fastify backend runtime, Turbo build caching, and Next.js 15.5 static rendering deliver peak performance.',
    icon: Zap,
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="container max-w-7xl px-4 sm:px-8 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-6 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Phase 2: Unified Design System & Microfrontends Live</span>
          </div>

          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl md:text-6xl max-w-4xl tracking-tight leading-tight sm:leading-none">
            Where Creators, Production Pros & Brands{' '}
            <span className="gradient-text">Build the Next Media Economy</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            CreatorConnect unifies creators, crew, brands, and platform operations into dedicated,
            high-performance microfrontend workspaces powered by verifiable escrow payments and
            strong API contracts.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/creator">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/25">
                <span>Enter Creator Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/brand">
              <Button size="lg" variant="outline" className="gap-2">
                <span>Explore Brand Portal</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Persona Portals Section */}
      <section className="container max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col items-center text-center mb-12">
          <Badge variant="outline" className="mb-3">
            Domain Microfrontends
          </Badge>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">
            Tailored Experiences for Every Persona
          </h2>
          <p className="mt-2 text-muted-foreground max-w-xl">
            Each persona operates within a dedicated domain shell, eliminating UI clutter and
            delivering focused workflow efficiency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PERSONAS.map((persona) => {
            const Icon = persona.icon;
            return (
              <Card
                key={persona.title}
                glass
                className={`relative overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 bg-gradient-to-br ${persona.accent}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-card/80 border border-border shadow-sm">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant={persona.badgeVariant}>{persona.badgeText}</Badge>
                  </div>
                  <CardTitle className="mt-4 text-2xl font-bold font-heading">
                    {persona.title}
                  </CardTitle>
                  <CardDescription className="text-sm font-medium text-foreground/80">
                    {persona.role}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {persona.description}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {persona.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-card/60 border border-border/60 px-2.5 py-1 rounded-md"
                      >
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        {highlight}
                      </span>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Link href={persona.href} className="w-full">
                    <Button variant="outline" className="w-full justify-between group">
                      <span>Launch {persona.title}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Architecture Pillars */}
      <section className="container max-w-7xl px-4 sm:px-8 pt-6">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-8 sm:p-12 glass-card">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h3 className="font-heading font-bold text-2xl sm:text-3xl">
              Engineered with SOLID & Library-First Discipline
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Built on battle-tested foundations to guarantee high availability, strict security,
              and zero dependency duplication.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ARCH_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="flex flex-col space-y-2 p-4 rounded-xl bg-background/50 border border-border/40"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold text-base">{pillar.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
