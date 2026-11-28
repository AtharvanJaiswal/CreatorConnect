'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { AdminButton } from './AdminButton';
import type { AdminErrorState } from '../../../lib/admin-error';

export interface AdminErrorBannerProps {
  error: AdminErrorState;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

export function AdminErrorBanner({ error, onRetry, className = '' }: AdminErrorBannerProps) {
  const Icon = error.isForbidden || error.isUnauthorized ? ShieldAlert : AlertCircle;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`p-4 rounded-2xl bg-[#FBE9E7] border border-[#F5C6CB] text-[#14110F] flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-[#D8483C] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-[#B32D22] font-sans-body">{error.title}</h3>
            {error.status !== null && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white border border-[#F5C6CB] text-[#D8483C]">
                HTTP {error.status}
                {error.code ? ` · ${error.code}` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-[#6F1D17] leading-relaxed">{error.detail}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {error.isUnauthorized && (
          <Link
            href="/admin/login"
            className="btn-pill btn-pill-primary px-4 py-1.5 text-xs font-bold"
          >
            Sign In Again
          </Link>
        )}
        {onRetry && (
          <AdminButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry
          </AdminButton>
        )}
      </div>
    </div>
  );
}
