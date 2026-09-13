import Link from 'next/link';
import { Sparkles, Shield, Cpu, Lock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-card/50 py-12 text-muted-foreground">
      <div className="container max-w-7xl px-4 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-heading font-bold text-lg text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>CreatorConnect</span>
            </div>
            <p className="text-sm leading-relaxed">
              Multi-sided creator economy platform powering seamless collaborations, verifiable
              escrow payments, and production talent matchmaking.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Persona Portals
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/creator" className="hover:text-foreground transition-colors">
                  Creator Workspace
                </Link>
              </li>
              <li>
                <Link href="/pro" className="hover:text-foreground transition-colors">
                  Production Freelancers
                </Link>
              </li>
              <li>
                <Link href="/brand" className="hover:text-foreground transition-colors">
                  Brand Campaigns
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-foreground transition-colors">
                  Operations & Compliance
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Platform Security
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-success" /> Escrow Invariant Protection
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> RBAC & Ownership Proofs
              </li>
              <li className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-accent" /> OpenAPI 3.1 & Next.js 15.5
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Engineering Status
            </h4>
            <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span>Phase:</span>
                <span className="font-semibold text-foreground">
                  Phase 2 (Design & Microfrontends)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Security State:</span>
                <span className="font-semibold text-success">Clean / Reconciled</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Architecture:</span>
                <span className="font-semibold text-primary">Multi-Zone Monorepo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs">
          <p>© {new Date().getFullYear()} CreatorConnect. All rights reserved.</p>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <span className="text-muted-foreground">Version 0.2.0-dev</span>
            <span>•</span>
            <span className="text-emerald-500 font-medium">Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
