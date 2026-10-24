'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  CheckCircle2,
  RotateCcw,
  Clock,
  FileDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type {
  ProjectDeliverableResponse,
  DeliverableSubmissionResponse,
  DeliverableAttachmentResponse,
} from '@creatorconnect/contracts';
import {
  fetchDeliverableSubmissions,
  fetchDeliverableAttachment,
} from '../../lib/milestone-workflow-service';

interface SubmissionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  milestone: ProjectDeliverableResponse;
  accessToken?: string | null;
}

export function SubmissionHistoryDialog({
  isOpen,
  onClose,
  projectId,
  milestone,
  accessToken,
}: SubmissionHistoryDialogProps) {
  const [submissions, setSubmissions] = useState<DeliverableSubmissionResponse[]>([]);
  const [attachments, setAttachments] = useState<Record<string, DeliverableAttachmentResponse>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);
    setError(null);

    fetchDeliverableSubmissions(projectId, milestone.id, accessToken)
      .then(async (data) => {
        if (!mounted) return;
        setSubmissions(data);

        // Fetch attachment metadata for submissions with attachments
        const attachmentMap: Record<string, DeliverableAttachmentResponse> = {};
        for (const sub of data) {
          if (sub.submittedAssetId) {
            try {
              const att = await fetchDeliverableAttachment(
                projectId,
                milestone.id,
                sub.submittedAssetId,
                accessToken,
              );
              attachmentMap[sub.submittedAssetId] = att;
            } catch {
              // Non-blocking if asset download URL is unavailable
            }
          }
        }
        if (mounted) {
          setAttachments(attachmentMap);
        }
      })
      .catch((err: any) => {
        if (mounted) {
          setError(err.message || 'Failed to load submission history.');
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, projectId, milestone.id, accessToken]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-dialog-title"
    >
      <div className="relative w-full max-w-[620px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[#14110F] text-[10px] font-bold uppercase tracking-wider mb-3">
            <History className="w-3.5 h-3.5 text-[#6F675E]" />
            <span>Audit Trail • Deliverable Submissions</span>
          </div>

          <h2
            id="history-dialog-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight"
          >
            Submission & Review History
          </h2>
          <p className="text-sm text-[#6F675E] mt-1">
            Milestone: <span className="font-semibold text-[#14110F]">{milestone.title}</span>
          </p>
        </div>

        {/* Body Content */}
        {isLoading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#FFD64A]" />
            <p className="text-xs text-[#6F675E]">Loading submission iterations...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-[#FCE8E6] border border-[#D8483C] text-xs text-[#D8483C] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6F675E] bg-[#FAF6EF] rounded-2xl border border-[#E7E0D5] p-6">
            <History className="w-8 h-8 text-[#A39A8F] mx-auto mb-2" />
            <p className="font-semibold text-[#14110F]">No submissions recorded yet</p>
            <p className="text-[#A39A8F] mt-1">
              Once the creator submits a deliverable, version history will be tracked here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => {
              const attachment = sub.submittedAssetId ? attachments[sub.submittedAssetId] : null;

              return (
                <div
                  key={sub.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] space-y-3"
                >
                  {/* Version header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E0D5]/70 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-extrabold text-sm text-[#14110F]">
                        Version {sub.version}
                      </span>
                      <span className="text-[11px] text-[#A39A8F] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(sub.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      {sub.reviewStatus === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#2E9E6B] text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                      )}
                      {sub.reviewStatus === 'REVISION_REQUESTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF6D9] text-[#C98A16] text-[10px] font-bold">
                          <RotateCcw className="w-3 h-3" />
                          <span>Revision Requested</span>
                        </span>
                      )}
                      {sub.reviewStatus === 'SUBMITTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EBF3FE] text-[#1B66C9] text-[10px] font-bold">
                          <Clock className="w-3 h-3" />
                          <span>Pending Client Review</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submission Description */}
                  {sub.submissionNotes && (
                    <div className="text-xs text-[#14110F]">
                      <span className="font-semibold text-[#6F675E] block mb-0.5">
                        Creator Notes:
                      </span>
                      <p className="whitespace-pre-wrap">{sub.submissionNotes}</p>
                    </div>
                  )}

                  {/* Client Feedback if Revision Requested */}
                  {sub.reviewNotes && (
                    <div className="p-3 rounded-xl bg-white border border-[#E7E0D5] text-xs space-y-1">
                      <span className="font-bold text-[#C98A16] block">
                        Client Review Feedback:
                      </span>
                      <p className="text-[#14110F] italic">{sub.reviewNotes}</p>
                      {sub.reviewedAt && (
                        <span className="text-[10px] text-[#A39A8F] block">
                          Reviewed on {new Date(sub.reviewedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Attachment metadata and secure download */}
                  {attachment && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E7E0D5]">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-[#14110F] truncate">
                          {attachment.originalName}
                        </p>
                        <p className="text-[10px] text-[#A39A8F]">
                          {(attachment.byteSize / 1024 / 1024).toFixed(2)} MB •{' '}
                          {attachment.mimeType}
                        </p>
                      </div>

                      {attachment.downloadUrl ? (
                        <a
                          href={attachment.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF6EF] hover:bg-[#FFD64A] text-[11px] font-bold text-[#14110F] transition-colors"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-[#A39A8F]">Attachment secured</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-5 mt-5 border-t border-[#E7E0D5]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#FAF6EF] text-[#14110F] hover:bg-[#F5ECE8] text-xs font-bold border border-[#E7E0D5] transition-colors"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
}
