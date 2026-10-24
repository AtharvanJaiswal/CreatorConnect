'use client';

import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@creatorconnect/ui';
import {
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  AlertCircle,
  Loader2,
  Building2,
} from 'lucide-react';
import type { InvitationResponse } from '@creatorconnect/contracts';
import { collaborationWorkflowService } from '../../lib/collaboration-workflow-service';

export function CreatorInvitationsPanel() {
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  async function loadInvitations() {
    setLoading(true);
    setError(null);
    try {
      const res = await collaborationWorkflowService.listReceivedInvitations();
      setInvitations(res.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load invitations.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(id: string, projectTitle: string) {
    setProcessingId(id);
    setError(null);
    setActionSuccessMessage(null);
    try {
      await collaborationWorkflowService.acceptInvitation(id);
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: 'ACCEPTED' as any } : inv)),
      );
      setActionSuccessMessage(
        `Invitation for "${projectTitle}" accepted! Collaboration established.`,
      );
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDecline(id: string, projectTitle: string) {
    if (!confirm(`Decline the invitation for "${projectTitle}"?`)) return;

    setProcessingId(id);
    setError(null);
    setActionSuccessMessage(null);
    try {
      await collaborationWorkflowService.declineInvitation(id);
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: 'DECLINED' as any } : inv)),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to decline invitation.');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-lg text-[#121212]">
            Collaboration Invitations
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Projects you have been directly invited to collaborate on by verified brands and
            clients.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {invitations.filter((i) => i.status === 'PENDING').length} Pending
        </Badge>
      </div>

      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl border border-green-200 bg-green-50 text-green-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-xs">Loading received invitations...</span>
        </div>
      ) : invitations.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-xs space-y-2">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p>No project invitations received yet.</p>
          <p className="text-[11px] text-[#8C8479]">
            Ensure your public profile is complete and visible so clients can discover and invite
            you.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => {
            const isPending = inv.status === 'PENDING';
            const isProcessing = processingId === inv.id;

            return (
              <Card
                key={inv.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-bold text-base text-[#121212]">
                      {inv.project.title}
                    </h4>
                    {inv.status === 'PENDING' && (
                      <Badge variant="warning" className="text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        <span>Pending Your Response</span>
                      </Badge>
                    )}
                    {inv.status === 'ACCEPTED' && (
                      <Badge variant="success" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        <span>Accepted</span>
                      </Badge>
                    )}
                    {inv.status === 'DECLINED' && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <XCircle className="h-2.5 w-2.5" />
                        <span>Declined</span>
                      </Badge>
                    )}
                    {inv.status === 'WITHDRAWN' && (
                      <Badge variant="secondary" className="text-[10px]">
                        Withdrawn by Client
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#5C564E]">
                    <span className="flex items-center gap-1 font-medium">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      {inv.inviter.displayName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 font-semibold text-[#14110F]">
                      <DollarSign className="h-3.5 w-3.5 text-green-600" />₹
                      {inv.project.totalAmount.toLocaleString('en-IN')}
                    </span>
                    {inv.expiresAt && isPending && (
                      <>
                        <span>•</span>
                        <span className="text-[11px] text-[#8C8479]">
                          Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-[#6B655C] bg-[#FAF7F2] p-3 rounded-xl border border-[#EDE7DE] mt-1 italic">
                    &ldquo;{inv.message}&rdquo;
                  </p>
                </div>

                {isPending && (
                  <div className="flex sm:flex-col items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handleAccept(inv.id, inv.project.title)}
                      className="w-full text-xs font-semibold bg-[#FFD64A] text-[#14110F] hover:bg-[#E0A800]"
                    >
                      {isProcessing ? 'Processing...' : 'Accept Invitation'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isProcessing}
                      onClick={() => handleDecline(inv.id, inv.project.title)}
                      className="w-full text-xs text-muted-foreground hover:text-red-600"
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
