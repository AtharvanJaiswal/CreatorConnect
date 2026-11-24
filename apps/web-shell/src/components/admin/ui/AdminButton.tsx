'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'dark' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-sans-body font-semibold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#FFD64A] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-2.5 gap-2.5',
    };

    const variantStyles = {
      primary: 'bg-[#FFD64A] hover:bg-[#F0C52F] text-[#14110F] border border-[#FFD64A] shadow-sm',
      dark: 'bg-[#14110F] hover:bg-[#2A2420] text-white border border-[#14110F] shadow-sm',
      secondary: 'bg-[#F2ECE1] hover:bg-[#E8E0D2] text-[#14110F] border border-[#E7E0D5]',
      outline: 'bg-transparent hover:bg-[#F2ECE1] text-[#14110F] border border-[#E7E0D5]',
      danger: 'bg-[#D8483C] hover:bg-[#C23C31] text-white border border-[#D8483C] shadow-sm',
      ghost:
        'bg-transparent hover:bg-[#F2ECE1] text-[#6F675E] hover:text-[#14110F] border border-transparent',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);

AdminButton.displayName = 'AdminButton';
