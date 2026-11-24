'use client';

import React from 'react';

export interface AdminCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'flat' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function AdminCard({
  children,
  variant = 'elevated',
  padding = 'md',
  className = '',
  ...props
}: AdminCardProps) {
  const variantStyles = {
    elevated:
      'bg-white border border-[#E7E0D5] rounded-2xl shadow-[0_4px_16px_rgba(20,17,15,0.04)]',
    flat: 'bg-white border border-[#E7E0D5] rounded-2xl',
    subtle: 'bg-[#FDFBF7] border border-[#EAE3D5] rounded-2xl',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function AdminCardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#EFE9DF] ${className}`}
    >
      <div>
        <h3 className="text-base sm:text-lg font-bold text-[#14110F] font-sans-body tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#6F675E] font-sans-body mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
