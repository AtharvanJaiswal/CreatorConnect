'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Clock,
  FileText,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Scale,
  History,
  Lock,
} from 'lucide-react';
import type { DisputeResponse } from '@creatorconnect/contracts';
import {
  getDispute,
  addDisputeEvidence,
  canAddEvidence,
  canResolveDispute,
  validateAddEvidence,
  type UserProjectRole,
} from '../../lib/disputes-workflow-service';

interface DisputeDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  disputeId: string;
  projectTitle: string;
  userRole: UserProjectRole;
  currentUserId?: string | undefined;
  isAdmin?: boolean;
  accessToken?: string | null;
  onOpenResolve?: (dispute: DisputeResponse) => void;
}

export function DisputeDetailsDialog({
  isOpen,
  onClose,
  disputeId,
  projectTitle,
  userRole,
  currentUserId,
  isAdmin = false,
  accessToken,
  onOpenResolve,
}: DisputeDetailsDialogProps) {
  const [dispute, setDispute] = useState<DisputeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Evidence Form State
  const [isAddingEvidence, setIsAddingEvidence] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const loadDispute = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDispute(disputeId, accessToken);
      setDispute(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dispute details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && disputeId) {
      loadDispute();
      setIsAddingEvidence(false);
      setEvidenceTitle('');
      setEvidenceDescription('');
      setEvidenceError(null);
    }
  }, [isOpen, disputeId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmittingEvidence) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmittingEvidence, onClose]);

  if (!isOpen) return null;

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateAddEvidence({
      title: evidenceTitle,
      description: evidenceDescription,
    });
    if (!validation.valid) {
      setEvidenceError(validation.errors[0] || 'Invalid evidence submission.');
      return;
    }

    setIsSubmittingEvidence(true);
    setEvidenceError(null);

    try {
      await addDisputeEvidence(
        disputeId,
        {
          title: evidenceTitle.trim(),
          ...(evidenceDescription.trim() ? { description: evidenceDescription.trim() } : {}),
        },
        accessToken,
      );

      // Refresh dispute to get updated evidence and history
      await loadDispute();
      setIsAddingEvidence(false);
      setEvidenceTitle('');
      setEvidenceDescription('');
    } catch (err: any) {
      setEvidenceError(err.message || 'Failed to add evidence.');
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FDE8E8] text-[#C93B2B] border border-[#C93B2B]/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Active Dispute
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF8E7] text-[#B88700] border border-[#F2C93D]/30">
            <Clock className="w-3.5 h-3.5" />
            Under Administrative Review
          </span>
        );
      case 'EVIDENCE_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Evidence Requested
          </span>
        );
      case 'RESOLVED_FOR_CLIENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#2E9E6B] border border-[#2E9E6B]/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolved in Client Favor
          </span>
        );
      case 'RESOLVED_FOR_CREATOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#2E9E6B] border border-[#2E9E6B]/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolved in Creator Favor
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF6EF] text-[#6F675E] border border-[#E7E0D5]">
            <Lock className="w-3.5 h-3.5" />
            Dispute Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF6EF] text-[#6F675E]">
            {status}
          </span>
        );
    }
  };

  const isEvidenceAllowed = dispute ? canAddEvidence(dispute.status, userRole) : false;
  const isResolutionAllowed = dispute ? canResolveDispute(dispute.status, isAdmin) : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-details-dialog-title"
    >
      <div className="relative w-full max-w-[720px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#6F675E]" />
            <p className="text-sm text-[#6F675E]">Loading dispute details & evidence locker...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-4 rounded-2xl bg-[#FDE8E8] border border-[#C93B2B]/20 text-sm text-[#C93B2B] flex items-start gap-3 my-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load dispute</p>
              <p className="mt-0.5 text-xs opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Dispute Content */}
        {!isLoading && dispute && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                {getStatusBadge(dispute.status)}
                <span className="text-xs text-[#8F877D]">
                  Opened on{' '}
                  {new Date(dispute.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <h2
                id="dispute-details-dialog-title"
                className="font-serif text-2xl font-bold text-[#14110F]"
              >
                Dispute: {dispute.reason.replace(/_/g, ' ')}
              </h2>
              <p className="text-sm text-[#6F675E] mt-0.5">
                Project: <span className="font-medium text-[#14110F]">{projectTitle}</span>
              </p>
            </div>

            {/* Requester's Explanation */}
            <div className="p-5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6F675E] mb-2">
                Dispute Summary
              </h3>
              <p className="text-sm text-[#14110F] whitespace-pre-line leading-relaxed">
                {dispute.description}
              </p>
            </div>

            {/* Resolution Card if resolved */}
            {(dispute.status === 'RESOLVED_FOR_CLIENT' ||
              dispute.status === 'RESOLVED_FOR_CREATOR') && (
              <div className="p-5 rounded-2xl bg-[#E6F4EA] border border-[#2E9E6B]/30 text-sm">
                <div className="flex items-center gap-2 text-[#2E9E6B] font-semibold mb-2">
                  <Scale className="w-4 h-4" />
                  <span>Administrative Arbitration Decision</span>
                </div>
                <p className="text-xs text-[#14110F] font-semibold">
                  Outcome:{' '}
                  {dispute.status === 'RESOLVED_FOR_CLIENT'
                    ? 'Resolved for Client (Refund Authorized)'
                    : 'Resolved for Creator (Escrow Authorized)'}
                </p>
                {dispute.resolutionReason && (
                  <p className="text-xs text-[#265337] mt-1.5 leading-relaxed">
                    <span className="font-semibold">Reasoning:</span> {dispute.resolutionReason}
                  </p>
                )}
                {dispute.resolutionNotes && (
                  <p className="text-xs text-[#265337] mt-1 leading-relaxed">
                    <span className="font-semibold">Arbitrator Notes:</span>{' '}
                    {dispute.resolutionNotes}
                  </p>
                )}
                {dispute.resolvedAt && (
                  <p className="text-[11px] text-[#2E9E6B]/80 mt-2">
                    Resolved on {new Date(dispute.resolvedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Evidence Locker */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6F675E]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                    Evidence Locker ({(dispute.evidence || []).length})
                  </h3>
                </div>

                {isEvidenceAllowed && !isAddingEvidence && (
                  <button
                    onClick={() => setIsAddingEvidence(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-xs font-semibold text-[#14110F] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Evidence</span>
                  </button>
                )}
              </div>

              {/* Add Evidence Inline Form */}
              {isAddingEvidence && (
                <form
                  onSubmit={handleAddEvidence}
                  className="mb-4 p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold text-[#14110F]">
                      Submit Supplemental Evidence
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingEvidence(false)}
                      className="text-xs text-[#6F675E] hover:text-[#14110F]"
                    >
                      Cancel
                    </button>
                  </div>

                  {evidenceError && (
                    <p className="text-xs text-[#C93B2B] bg-[#FDE8E8] p-2.5 rounded-xl border border-[#C93B2B]/20">
                      {evidenceError}
                    </p>
                  )}

                  <div>
                    <input
                      type="text"
                      value={evidenceTitle}
                      onChange={(e) => setEvidenceTitle(e.target.value)}
                      placeholder="Evidence Title (e.g. Revision request email thread screenshot)"
                      maxLength={150}
                      disabled={isSubmittingEvidence}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E7E0D5] text-xs text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
                    />
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      value={evidenceDescription}
                      onChange={(e) => setEvidenceDescription(e.target.value)}
                      placeholder="Context or notes about this piece of evidence (optional)..."
                      maxLength={5000}
                      disabled={isSubmittingEvidence}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E7E0D5] text-xs text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A] resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingEvidence(false)}
                      disabled={isSubmittingEvidence}
                      className="px-3 py-1.5 rounded-full text-xs font-medium text-[#6F675E]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingEvidence || !evidenceTitle.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FFD64A] hover:bg-[#F2C93D] text-[#14110F] text-xs font-semibold shadow-sm disabled:opacity-50"
                    >
                      {isSubmittingEvidence ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <span>Submit Evidence</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Evidence Items List */}
              {!dispute.evidence || dispute.evidence.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] text-center text-xs text-[#8F877D]">
                  No formal evidence items have been submitted yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dispute.evidence.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#14110F]">{item.title}</p>
                        {item.description && (
                          <p className="text-[#6F675E] mt-0.5 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                        <span className="text-[11px] text-[#8F877D] mt-1 inline-block">
                          Added {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#E7E0D5]/50 text-[10px] font-semibold text-[#6F675E] shrink-0">
                        {item.uploadedById === currentUserId ? 'You' : 'Participant'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline Audit History */}
            {dispute.history && dispute.history.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-[#6F675E]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6F675E]">
                    Dispute Lifecycle History
                  </h3>
                </div>

                <div className="space-y-2">
                  {dispute.history.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 rounded-xl bg-white border border-[#E7E0D5] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#6F675E]">
                          {record.fromStatus}
                        </span>
                        <span className="text-[#8F877D]">&rarr;</span>
                        <span className="font-semibold text-[#14110F]">{record.toStatus}</span>
                        {record.reason && (
                          <span className="text-[#6F675E] italic text-[11px] ml-2">
                            ({record.reason})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#8F877D] shrink-0 ml-3">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#E7E0D5]">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#6F675E] hover:text-[#14110F] transition-colors"
              >
                Close
              </button>

              {/* Admin Arbitration Button */}
              {isResolutionAllowed && onOpenResolve && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenResolve(dispute);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#14110F] hover:bg-[#2C2724] text-white text-sm font-semibold shadow-sm transition-all"
                >
                  <Scale className="w-4 h-4 text-[#FFD64A]" />
                  <span>Arbitrate Dispute</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
