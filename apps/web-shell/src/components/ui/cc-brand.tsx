import React from 'react';

export function CcChainGlyph({ className = 'h-6 w-6 text-[#FFD64A]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M26 14C26 10.6863 23.3137 8 20 8C13.3726 8 8 13.3726 8 20C8 26.6274 13.3726 32 20 32C23.3137 32 26 29.3137 26 26"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M22 34C22 37.3137 24.6863 40 28 40C34.6274 40 40 34.6274 40 28C40 21.3726 34.6274 16 28 16C24.6863 16 22 18.6863 22 22"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CcLogoSquare({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeMap = {
    sm: 'h-8 w-8 rounded-lg p-1.5',
    md: 'h-10 w-10 rounded-xl p-2',
    lg: 'h-14 w-14 rounded-2xl p-3',
    xl: 'h-20 w-20 rounded-3xl p-4 shadow-xl',
  };

  const glyphMap = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <div
      className={`bg-[#121212] flex items-center justify-center shrink-0 text-[#FFCE38] ${sizeMap[size]} ${className}`}
    >
      <CcChainGlyph className={`${glyphMap[size]} text-[#FFCE38]`} />
    </div>
  );
}

export function CcLogoCircle({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeMap = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
  };

  return (
    <div
      className={`bg-[#FFCE38] text-[#121212] font-black rounded-full flex items-center justify-center shrink-0 tracking-tighter shadow-sm font-sans ${sizeMap[size]} ${className}`}
    >
      CC
    </div>
  );
}

export function CapsuleBadge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'amber' | 'green' | 'purple';
  className?: string;
}) {
  const variantStyles = {
    default: 'bg-[#F2ECE3] text-[#5C564E] border-[#E5DDD2]',
    amber: 'bg-[#FFF6D9] text-[#7A5B00] border-[#FCE192]',
    green: 'bg-[#EBF7EE] text-[#1B7339] border-[#C5E8CE]',
    purple: 'bg-[#F1EDFC] text-[#553896] border-[#DDD3F7]',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  );
}

export function VerifiedIdentityBadge({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[#CDEBD4] bg-[#F0FAF2] px-3 py-1 text-xs font-semibold text-[#1B7339] shadow-2xs ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-[#1B7339]" />
      <span>Verified Identity Portal</span>
    </div>
  );
}
