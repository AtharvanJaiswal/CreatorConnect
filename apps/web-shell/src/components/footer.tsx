import Link from 'next/link';
import { CcLogoSquare } from './ui/cc-brand';
import { Shield, Cpu, Lock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-[#EAE3D5] bg-[#F5ECE0]/60 py-12 text-[#6B655C]">
      <div className="container max-w-7xl px-4 sm:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2">
              <CcLogoSquare size="sm" />
              <span className="font-heading font-extrabold text-base text-[#121212]">
                CREATOR<span className="font-serif italic font-normal text-[#5C564E]">connect</span>
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-[#7C756B]">
              Curated marketplace ensuring fair collaboration, age-verified partnerships, and
              instantaneous milestone escrow payouts for creators and brands across India.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#121212] uppercase tracking-wider">
              Persona Portals
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/creator" className="hover:text-[#121212] transition-colors">
                  Creator / Influencer Workspace
                </Link>
              </li>
              <li>
                <Link href="/pro" className="hover:text-[#121212] transition-colors">
                  Production Professionals
                </Link>
              </li>
              <li>
                <Link href="/brand" className="hover:text-[#121212] transition-colors">
                  Brand Campaigns & Sponsorships
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#121212] transition-colors">
                  Operations & Verification Cockpit
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#121212] uppercase tracking-wider">
              Platform Security
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-[#1B7339]" /> Asymmetric JWKS JWT Verification
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-[#7A5B00]" /> RBI-Compliant Escrow Protection
              </li>
              <li className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-[#553896]" /> OpenAPI 3.1 & Next.js 15.5
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#121212] uppercase tracking-wider">
              Architecture Status
            </h4>
            <div className="rounded-2xl border border-[#EDE7DE] bg-white p-3.5 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8C8479]">UI/UX Spec:</span>
                <span className="font-semibold text-[#121212]">Approved Catalogue</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8C8479]">Security:</span>
                <span className="font-semibold text-[#1B7339]">Zero-Trust Verified</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8C8479]">Network Nodes:</span>
                <span className="font-semibold text-[#121212]">45,000+ Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[#EAE3D5] pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#8C8479]">
          <p>© {new Date().getFullYear()} CreatorConnect Network Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <span>Version 0.3.0-dev</span>
            <span>•</span>
            <span className="text-[#1B7339] font-medium">Identity Protocol Synced</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
