'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminSelect } from '../../../components/admin/ui/AdminInput';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { AdminErrorBanner } from '../../../components/admin/ui/AdminErrorBanner';
import { apiClient } from '../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../lib/admin-error';
import type { SupportTicketResponse, SupportTicketListResponse } from '@creatorconnect/contracts';

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);

  // Response Modal State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketResponse | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState<string>('RESOLVED');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<SupportTicketListResponse>('/api/v1/admin/support/tickets');
      setTickets(data?.items || []);
    } catch (err) {
      setTickets([]);
      setFetchError(parseAdminApiError(err, 'Failed to fetch support tickets from backend API.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) {
      setErrorMsg('A reply message is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post(`/api/v1/admin/support/tickets/${selectedTicket.id}/reply`, {
        body: replyMessage.trim(),
      });

      await apiClient.post(`/api/v1/admin/support/tickets/${selectedTicket.id}/status`, {
        status: newStatus,
        expectedVersion: selectedTicket.version,
      });

      setSelectedTicket(null);
      await fetchTickets();
    } catch (err: unknown) {
      setErrorMsg(parseAdminApiError(err, 'Failed to submit response.').detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<SupportTicketResponse>[] = [
    {
      key: 'subject',
      header: 'Ticket Subject & Category',
      render: (row) => (
        <div className="flex flex-col max-w-md">
          <span className="font-bold text-[#14110F]">{row.subject}</span>
          <span className="text-xs text-[#6F675E] font-mono-code">
            #{row.ticketNumber} • {row.category} • Requester: {row.requesterId.slice(0, 8)}...
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <AdminBadge
          variant={row.priority === 'HIGH' || row.priority === 'URGENT' ? 'danger' : 'neutral'}
          size="sm"
        >
          {row.priority}
        </AdminBadge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <AdminBadge
          variant={
            row.status === 'RESOLVED' ? 'success' : row.status === 'OPEN' ? 'warning' : 'info'
          }
          size="sm"
          dot
        >
          {row.status}
        </AdminBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Response',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <PermissionGate permission="support.reply">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTicket(row);
                setReplyMessage('');
                setNewStatus('RESOLVED');
                setErrorMsg(null);
              }}
              className="text-xs"
            >
              Respond
            </AdminButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Customer Support Inquiries
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Staff ticketing hub for user technical assistance, billing inquiries, and escrow
            clarifications.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchTickets}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Table */}
      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchTickets} />}
      <AdminTable columns={columns} data={tickets} isLoading={isLoading} />

      {/* Reply Modal */}
      <AdminModal
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        title="Respond to Support Ticket"
        subtitle={`Ticket: ${selectedTicket?.subject}`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setSelectedTicket(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleSendReply}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Send Staff Reply
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Customer-Visible Reply Message <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={4}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your official response to the customer..."
              required
            />
          </div>

          <AdminSelect
            label="Transition Ticket Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            options={[
              { value: 'RESOLVED', label: 'Mark as Resolved' },
              { value: 'IN_PROGRESS', label: 'In Progress (Awaiting Information)' },
              { value: 'CLOSED', label: 'Close Ticket' },
            ]}
          />
        </div>
      </AdminModal>
    </div>
  );
}
