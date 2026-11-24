'use client';

import React from 'react';

export type AdminBadgeVariant =
  'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'brand' | 'outline';

export interface AdminBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: AdminBadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function AdminBadge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}: AdminBadgeProps) {
  const sizeStyles = {
    sm: 'text-[11px] px-2.5 py-0.5 gap-1.5',
    md: 'text-xs px-3 py-1 gap-1.5',
  };

  const variantStyles = {
    success: 'bg-[#E6F4EC] text-[#2E9E6B] border-[#BEE4D0]',
    warning: 'bg-[#FBF1DC] text-[#C98A16] border-[#F5DFB3]',
    danger: 'bg-[#FBE9E7] text-[#D8483C] border-[#F6C4C0]',
    info: 'bg-[#EBF3FD] text-[#2B73C2] border-[#BDD8F8]',
    purple: 'bg-[#F3EEFC] text-[#7C5CBF] border-[#DAC9F8]',
    neutral: 'bg-[#F2ECE1] text-[#6F675E] border-[#E7E0D5]',
    brand: 'bg-[#FFF8D6] text-[#7A5B00] border-[#FCE192]',
    outline: 'bg-transparent text-[#14110F] border-[#E7E0D5]',
  };

  const dotColors = {
    success: 'bg-[#2E9E6B]',
    warning: 'bg-[#C98A16]',
    danger: 'bg-[#D8483C]',
    info: 'bg-[#2B73C2]',
    purple: 'bg-[#7C5CBF]',
    neutral: 'bg-[#6F675E]',
    brand: 'bg-[#FFD64A]',
    outline: 'bg-[#14110F]',
  };

  return (
    <span
      className={`inline-flex items-center font-sans-body font-semibold rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
