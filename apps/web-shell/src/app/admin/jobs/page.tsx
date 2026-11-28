'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, RefreshCw } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { AdminErrorBanner } from '../../../components/admin/ui/AdminErrorBanner';
import { apiClient } from '../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../lib/admin-error';
import type { QueueMetricsResponse } from '@creatorconnect/contracts';

export default function AdminJobsPage() {
  const [queues, setQueues] = useState<QueueMetricsResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);
  const [retryingQueue, setRetryingQueue] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchQueues = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<QueueMetricsResponse[]>('/api/v1/admin/jobs/queues');
      setQueues(Array.isArray(data) ? data : []);
    } catch (err) {
      setQueues([]);
      setFetchError(parseAdminApiError(err, 'Failed to fetch BullMQ queue metrics from API.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  const handleRetryFailed = async (queueName: string) => {
    setRetryingQueue(queueName);
    setMessage(null);
    setActionError(null);
    try {
      const res = await apiClient.post<{ retriedCount: number }>(
        `/api/v1/admin/jobs/queues/${queueName}/retry-failed`,
      );
      setMessage(`Successfully re-queued ${res?.retriedCount ?? 0} failed jobs in ${queueName}.`);
      await fetchQueues();
    } catch (err: unknown) {
      setActionError(parseAdminApiError(err, 'Failed to retry failed queue jobs.').detail);
    } finally {
      setRetryingQueue(null);
    }
  };

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Background Worker Queues
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Real-time BullMQ Redis worker health, queue latency, and failed job remediation.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchQueues}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchQueues} />}

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#FBE9E7] border border-[#F5C6CB] text-xs font-bold text-[#D8483C]"
        >
          {actionError}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="p-4 rounded-xl bg-[#E6F4EC] border border-[#BEE4D0] text-xs font-bold text-[#1B7339]"
        >
          {message}
        </div>
      )}

      {/* Queue Cards Grid */}
      {!fetchError && !isLoading && queues.length === 0 ? (
        <AdminCard padding="lg" className="text-center text-xs text-[#6F675E]">
          No BullMQ queues reported by backend worker telemetry.
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {queues.map((q) => (
            <AdminCard key={q.queueName} padding="md" className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm text-[#14110F] font-mono-code">
                    {q.queueName}
                  </span>
                  <AdminBadge variant={q.failed > 0 ? 'warning' : 'success'} size="sm" dot>
                    {q.failed > 0 ? `${q.failed} Failed` : q.paused ? 'Paused' : 'Active'}
                  </AdminBadge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center my-4">
                  <div className="p-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                    <span className="text-[10px] text-[#6F675E] uppercase font-bold block">
                      Waiting
                    </span>
                    <span className="text-base font-black text-[#14110F] font-mono-code">
                      {q.waiting}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                    <span className="text-[10px] text-[#6F675E] uppercase font-bold block">
                      Active
                    </span>
                    <span className="text-base font-black text-[#2B73C2] font-mono-code">
                      {q.active}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]">
                    <span className="text-[10px] text-[#6F675E] uppercase font-bold block">
                      Completed
                    </span>
                    <span className="text-base font-black text-[#2E9E6B] font-mono-code">
                      {q.completed}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EFE9DF] flex items-center justify-between">
                <span className="text-xs text-[#6F675E]">Delayed: {q.delayed}</span>
                <PermissionGate permission="settings.manage">
                  <AdminButton
                    variant="outline"
                    size="sm"
                    disabled={q.failed === 0}
                    loading={retryingQueue === q.queueName}
                    onClick={() => handleRetryFailed(q.queueName)}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    Retry Failed
                  </AdminButton>
                </PermissionGate>
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </div>
  );
}
