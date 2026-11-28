'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminInput, AdminSelect } from '../../../components/admin/ui/AdminInput';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { useAuth } from '../../../providers/auth-provider';
import { hasAdminPermission, type AdminUserLike } from '../../../lib/admin-permissions';
import { apiClient, ApiError } from '../../../lib/api-client';
import {
  AUDIT_PAGE_LIMIT,
  MAX_AUDIT_SEARCH_LENGTH,
  getAuditActionBadgeVariant,
  validateAuditDateRange,
} from '../../../lib/admin-phase41-helpers';
import type {
  AdminAuditLogItem,
  AdminAuditLogResponse,
  AdminAuditLogQuery,
} from '@creatorconnect/contracts';

export default function AdminAuditTrailPage() {
  const { user } = useAuth();
  const canReadAudit = hasAdminPermission(user as AdminUserLike | null, 'audit.read');
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAuthExpired, setIsAuthExpired] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('');
  const [debouncedAction, setDebouncedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Keyset Pagination State
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);

  // Request Ordering & Cancellation Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // Metadata Inspector Modal
  const [inspectedLog, setInspectedLog] = useState<AdminAuditLogItem | null>(null);

  // Debounce free-text inputs cleanly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.slice(0, MAX_AUDIT_SEARCH_LENGTH).trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAction(actionFilter.slice(0, MAX_AUDIT_SEARCH_LENGTH).trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [actionFilter]);

  const fetchAuditLogs = useCallback(
    async (cursorToFetch: string | null = null, resetPagination = false) => {
      const dateError = validateAuditDateRange(startDate, endDate);
      if (dateError) {
        setErrorMsg(dateError);
        setIsAuthExpired(false);
        setLogs([]);
        setNextCursor(null);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const reqId = ++requestIdRef.current;

      setIsLoading(true);
      setErrorMsg(null);
      setIsAuthExpired(false);

      try {
        const params: Record<string, string | number | undefined> = {
          limit: AUDIT_PAGE_LIMIT,
        };

        if (cursorToFetch) {
          params.cursor = cursorToFetch;
        }
        if (debouncedSearch) {
          params.search = debouncedSearch;
        }
        if (entityFilter !== 'ALL') {
          params.entity = entityFilter;
        }
        if (debouncedAction) {
          params.action = debouncedAction;
        }
        if (startDate) {
          params.startDate = new Date(`${startDate}T00:00:00.000Z`).toISOString();
        }
        if (endDate) {
          params.endDate = new Date(`${endDate}T23:59:59.999Z`).toISOString();
        }

        // Enforce shared AdminAuditLogQuery keys at compile time
        const _typeCheck: AdminAuditLogQuery = params;
        void _typeCheck;

        const data = await apiClient.get<AdminAuditLogResponse>('/api/v1/admin/audit', {
          params,
          signal: controller.signal,
        });

        if (reqId !== requestIdRef.current) {
          return;
        }

        setLogs(Array.isArray(data?.items) ? data.items : []);
        const resolvedNext = data?.nextCursor ?? data?.pagination?.nextCursor ?? null;
        const resolvedMore = Boolean(data?.hasMore ?? data?.pagination?.hasMore);
        setNextCursor(resolvedNext);
        setHasMore(resolvedMore);
        setCurrentCursor(cursorToFetch);

        if (resetPagination) {
          setCursorHistory([]);
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError' || reqId !== requestIdRef.current) {
          return;
        }

        if (err instanceof ApiError && err.status === 401) {
          setIsAuthExpired(true);
          setErrorMsg(
            'Your administrative session has expired or is invalid. Please sign in again.',
          );
        } else if (err instanceof ApiError && err.status === 403) {
          setErrorMsg(
            err.problem?.detail ||
              'Access denied: audit.read administrative permission is required.',
          );
        } else {
          const msg =
            err instanceof Error
              ? err.message
              : 'Failed to retrieve administrative audit trail from backend.';
          setErrorMsg(msg);
        }

        setLogs([]);
        setNextCursor(null);
        setHasMore(false);
      } finally {
        if (reqId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [debouncedSearch, entityFilter, debouncedAction, startDate, endDate],
  );

  useEffect(() => {
    if (user && !canReadAudit) {
      setIsLoading(false);
      return;
    }
    fetchAuditLogs(null, true);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAuditLogs, user, canReadAudit]);

  const handleNextPage = () => {
    if (isLoading || !nextCursor || !hasMore) return;
    setCursorHistory((prev) => [...prev, currentCursor]);
    fetchAuditLogs(nextCursor, false);
  };

  const handlePreviousPage = () => {
    if (isLoading || cursorHistory.length === 0) return;
    const prevCursor = cursorHistory[cursorHistory.length - 1] ?? null;
    setCursorHistory((prev) => prev.slice(0, -1));
    fetchAuditLogs(prevCursor, false);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setEntityFilter('ALL');
    setActionFilter('');
    setDebouncedAction('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = Boolean(
    searchInput || entityFilter !== 'ALL' || actionFilter || startDate || endDate,
  );

  const columns: Column<AdminAuditLogItem>[] = [
    {
      key: 'action',
      header: 'Administrative Action & Scope',
      headerClassName: 'w-[280px] lg:w-[28%]',
      className: 'w-[280px] lg:w-[28%]',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <AdminBadge variant={getAuditActionBadgeVariant(row.action)} size="sm">
              {row.action}
            </AdminBadge>
          </div>
          <span className="text-xs text-[#6F675E]">
            Target: <strong className="text-[#14110F]">{row.entity}</strong>
            {row.entityId ? (
              <span className="font-mono-code text-[11px] ml-1 text-[#A39A8F]">
                ({row.entityId.length > 20 ? `${row.entityId.slice(0, 16)}...` : row.entityId})
              </span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Staff Officer & Origin',
      headerClassName: 'w-[240px] lg:w-[24%]',
      className: 'w-[240px] lg:w-[24%]',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs text-[#14110F]">
            {row.actorName || row.actorEmail || row.userEmail || (
              <span className="italic text-[#A39A8F]">System Service</span>
            )}
          </span>
          <span className="text-[10px] text-[#A39A8F] font-mono-code">
            IP: {row.ipAddress || 'Internal Worker'}
          </span>
        </div>
      ),
    },
    {
      key: 'metadata',
      header: 'Audit Context & Metadata',
      headerClassName: 'w-[300px] lg:w-[30%]',
      className: 'w-[300px] lg:w-[30%]',
      render: (row) => {
        const metadata = row.metadata as Record<string, unknown> | null | undefined;
        const reason =
          typeof metadata?.reason === 'string'
            ? metadata.reason
            : typeof metadata?.notes === 'string'
              ? metadata.notes
              : null;

        return (
          <div className="flex items-center justify-between gap-3 max-w-md">
            <span className="text-xs text-[#14110F] font-medium truncate">
              {reason ? (
                `"${reason}"`
              ) : (
                <span className="text-[#A39A8F] text-[11px]">System action executed</span>
              )}
            </span>
            {metadata && Object.keys(metadata).length > 0 && (
              <button
                type="button"
                onClick={() => setInspectedLog(row)}
                className="text-[#6F675E] hover:text-[#14110F] p-1 rounded hover:bg-[#F2ECE1] transition-colors shrink-0"
                title="Inspect sanitized metadata"
                aria-label={`Inspect metadata for audit event ${row.id}`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      headerClassName: 'w-[180px] lg:w-[18%]',
      className: 'w-[180px] lg:w-[18%] whitespace-nowrap',
      render: (row) => (
        <span className="text-xs text-[#6F675E] font-mono-code">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <PermissionGate permission="audit.read" showLockedPlaceholder lockedRole="alert">
      <div className="space-y-6 font-sans-body">
        {/* Title & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
              Immutable Platform Audit Trail
            </h1>
            <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
              Authoritative, append-only record of administrative role assignments, setting
              mutations, refund decisions, and account suspensions.
            </p>
          </div>

          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => fetchAuditLogs(currentCursor, false)}
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </AdminButton>
        </div>

        {/* Explicit Backend Error Banner — Zero Mock Fallbacks */}
        {errorMsg && (
          <div
            role="alert"
            className="p-4 bg-[#FBE9E7] border border-[#D8483C]/30 text-[#D8483C] text-sm rounded-2xl flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <div className="flex items-center gap-2">
              {isAuthExpired ? (
                <Link
                  href="/admin/login"
                  className="btn-pill btn-pill-primary px-4 py-1.5 text-xs font-bold"
                >
                  Sign In Again
                </Link>
              ) : (
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAuditLogs(currentCursor, false)}
                  className="text-xs"
                >
                  Retry Connection
                </AdminButton>
              )}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <AdminCard padding="sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <AdminInput
                label="Search"
                placeholder="Action, entity, or target ID..."
                value={searchInput}
                maxLength={MAX_AUDIT_SEARCH_LENGTH}
                onChange={(e) => setSearchInput(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>

            <div className="md:col-span-2">
              <AdminSelect
                label="Entity"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Target Entities' },
                  { value: 'User', label: 'User & Identity' },
                  { value: 'AdminRole', label: 'RBAC Roles & Permissions' },
                  { value: 'Refund', label: 'Financial & Refunds' },
                  { value: 'PlatformSetting', label: 'Platform Settings' },
                  { value: 'Report', label: 'Moderation Reports' },
                  { value: 'Review', label: 'Reviews & Ratings' },
                  { value: 'SupportTicket', label: 'Support Inquiries' },
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <AdminInput
                label="Exact Action"
                placeholder="e.g. USER_SUSPENDED"
                value={actionFilter}
                maxLength={MAX_AUDIT_SEARCH_LENGTH}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <AdminInput
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <AdminInput
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <AdminButton
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                icon={<X className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Clear Filters
              </AdminButton>
            </div>
          )}
        </AdminCard>

        {/* Table */}
        <AdminTable
          columns={columns}
          data={logs}
          isLoading={isLoading}
          emptyMessage="No administrative audit events recorded for the selected criteria."
        />

        {/* Keyset Cursor Pagination Footer */}
        <div className="flex items-center justify-between px-2 text-xs text-[#6F675E]">
          <span>
            Page {cursorHistory.length + 1} &middot; Showing {logs.length} record
            {logs.length === 1 ? '' : 's'}
          </span>

          <div className="flex items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={cursorHistory.length === 0 || isLoading}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </AdminButton>
            <AdminButton
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasMore || !nextCursor || isLoading}
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </AdminButton>
          </div>
        </div>

        {/* Metadata Inspector Modal */}
        <AdminModal
          isOpen={Boolean(inspectedLog)}
          onClose={() => setInspectedLog(null)}
          title="Sanitized Audit Event Details"
          subtitle={`Event ID: ${inspectedLog?.id}`}
          footer={
            <AdminButton variant="secondary" size="sm" onClick={() => setInspectedLog(null)}>
              Close
            </AdminButton>
          }
        >
          {inspectedLog && (
            <div className="space-y-4 text-xs font-sans-body">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAF6EF] rounded-xl border border-[#E7E0D5]">
                <div>
                  <span className="text-[#6F675E] block">Action</span>
                  <span className="font-bold font-mono-code text-[#14110F]">
                    {inspectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[#6F675E] block">Target Entity</span>
                  <span className="font-bold text-[#14110F]">
                    {inspectedLog.entity} ({inspectedLog.entityId || 'N/A'})
                  </span>
                </div>
                <div>
                  <span className="text-[#6F675E] block">Actor</span>
                  <span className="font-bold text-[#14110F]">
                    {inspectedLog.actorEmail || inspectedLog.userEmail || 'System'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6F675E] block">Client IP / Origin</span>
                  <span className="font-mono-code text-[#14110F] text-[11px] block truncate">
                    {inspectedLog.ipAddress || 'Internal'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-[#14110F] block mb-1.5">
                  Event Payload &amp; Sanitized Context
                </span>
                <pre className="p-3 bg-[#14110F] text-[#FAF6EF] font-mono-code text-[11px] rounded-xl overflow-x-auto max-h-60 custom-scrollbar">
                  {JSON.stringify(inspectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </AdminModal>
      </div>
    </PermissionGate>
  );
}
