'use client';

import React from 'react';

export interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const AdminInput = React.forwardRef<HTMLInputElement, AdminInputProps>(
  ({ label, error, helperText, icon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold text-[#14110F] font-sans-body">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3.5 text-[#A39A8F] pointer-events-none shrink-0">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-xl bg-white border font-sans-body text-sm text-[#14110F] placeholder-[#A39A8F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFD64A] focus:ring-offset-1 disabled:bg-[#F2ECE1] disabled:text-[#A39A8F] disabled:cursor-not-allowed ${
              icon ? 'pl-10 pr-4 py-2.5' : 'px-4 py-2.5'
            } ${error ? 'border-[#D8483C] focus:ring-[#D8483C]' : 'border-[#E7E0D5] hover:border-[#D8D1C6]'} ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-[#D8483C] font-sans-body">{error}</span>}
        {!error && helperText && (
          <span className="text-xs text-[#6F675E] font-sans-body">{helperText}</span>
        )}
      </div>
    );
  },
);

AdminInput.displayName = 'AdminInput';

export interface AdminSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}

export const AdminSelect = React.forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ label, error, helperText, options, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-xs font-bold text-[#14110F] font-sans-body">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-xl bg-white border font-sans-body text-sm text-[#14110F] px-4 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFD64A] focus:ring-offset-1 disabled:bg-[#F2ECE1] disabled:cursor-not-allowed ${
            error ? 'border-[#D8483C]' : 'border-[#E7E0D5] hover:border-[#D8D1C6]'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-[#D8483C] font-sans-body">{error}</span>}
        {!error && helperText && (
          <span className="text-xs text-[#6F675E] font-sans-body">{helperText}</span>
        )}
      </div>
    );
  },
);

AdminSelect.displayName = 'AdminSelect';
