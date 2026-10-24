'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { ProjectDeliverableResponse, SubmitDeliverableInput } from '@creatorconnect/contracts';
import {
  validateSubmission,
  generateIdempotencyKey,
  uploadDeliverableAttachment,
  submitDeliverable,
  type DeliverableAttachmentItem,
} from '../../lib/milestone-workflow-service';

interface MilestoneSubmissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
  milestone: ProjectDeliverableResponse;
  accessToken?: string | null;
}

export function MilestoneSubmissionDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  milestone,
  accessToken,
}: MilestoneSubmissionDialogProps) {
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [attachments, setAttachments] = useState<DeliverableAttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubmissionNotes('');
      setAttachments([]);
      setUploadError(null);
      setSubmitError(null);
    }
  }, [isOpen]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !files[0]) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const file = files[0];
      const item = await uploadDeliverableAttachment(file, accessToken);
      setAttachments((prev) => [...prev, item]);
    } catch (err: any) {
      setUploadError(err.message || 'Attachment upload failed.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (assetId: string) => {
    setAttachments((prev) => prev.filter((a) => a.assetId !== assetId));
  };

  const validation = validateSubmission({
    submissionNotes,
    attachments,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const idempotencyKey = generateIdempotencyKey();
      const firstAttachment = attachments[0];
      const payload: SubmitDeliverableInput = {
        submissionNotes: submissionNotes.trim(),
        idempotencyKey,
        ...(firstAttachment?.assetId ? { submittedAssetId: firstAttachment.assetId } : {}),
      };
      await submitDeliverable(projectId, milestone.id, payload, accessToken);

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Deliverable submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRevision = milestone.status === 'REVISION_REQUESTED';
  const targetVersion = isRevision ? milestone.version + 1 : milestone.version || 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14110F]/60 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-dialog-title"
    >
      <div className="relative w-full max-w-[560px] rounded-[28px] bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#6F675E] hover:text-[#14110F] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#65558F]" />
            <span>
              {isRevision
                ? `Revision Submission • v${targetVersion}`
                : `Deliverable Submission • v${targetVersion}`}
            </span>
          </div>

          <h2
            id="submission-dialog-title"
            className="font-heading font-extrabold text-2xl text-[#14110F] tracking-tight"
          >
            {isRevision ? 'Submit Revised Deliverable' : 'Submit Milestone Deliverable'}
          </h2>
          <p className="text-sm text-[#6F675E] mt-1">
            Milestone: <span className="font-semibold text-[#14110F]">{milestone.title}</span>
          </p>

          {isRevision && milestone.revisionNotes && (
            <div className="mt-3 p-3.5 rounded-xl bg-[#FFF6D9] border border-[#FFD64A]/60 text-xs text-[#735C00]">
              <span className="font-bold block mb-1">Client Revision Feedback:</span>
              <p className="italic">{milestone.revisionNotes}</p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Notes Input */}
          <div>
            <label
              htmlFor="submission-notes"
              className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-2"
            >
              Deliverable Description & Change Notes <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              id="submission-notes"
              rows={4}
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Detail what was created or revised, link instructions, and export specifications..."
              className="w-full px-4 py-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-sm text-[#14110F] placeholder-[#A39A8F] focus:outline-none focus:border-[#FFD64A] focus:ring-1 focus:ring-[#FFD64A] transition-all"
              required
            />
            <span className="text-[11px] text-[#A39A8F] mt-1 block">
              Minimum 5 characters required. Current: {submissionNotes.length}
            </span>
          </div>

          {/* Attachment Upload Area */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-2">
              Deliverable Attachments
            </label>

            <div className="relative border-2 border-dashed border-[#E7E0D5] hover:border-[#FFD64A] rounded-2xl p-4 sm:p-5 text-center bg-[#FAF6EF]/60 transition-colors">
              <input
                type="file"
                id="deliverable-file"
                onChange={handleFileChange}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Upload deliverable attachment"
              />
              <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#14110F]" />
                ) : (
                  <Upload className="w-6 h-6 text-[#6F675E]" />
                )}
                <div className="text-xs text-[#14110F] font-semibold">
                  {isUploading
                    ? 'Uploading & verifying with media service...'
                    : 'Click or drop deliverable file to attach'}
                </div>
                <div className="text-[11px] text-[#A39A8F]">
                  MP4, MOV, PDF, ZIP, PNG, JPEG up to 500MB
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="mt-2 text-xs text-[#D8483C] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.assetId}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-[#6F675E] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#14110F] truncate">
                          {att.filename}
                        </p>
                        <p className="text-[10px] text-[#A39A8F]">
                          {(att.byteSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {att.status === 'ACTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#2E9E6B] text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Clean & Verified</span>
                        </span>
                      )}
                      {att.status === 'PENDING_SCAN' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF6D9] text-[#C98A16] text-[10px] font-bold">
                          <ShieldCheck className="w-3 h-3 animate-pulse" />
                          <span>Scanning...</span>
                        </span>
                      )}
                      {(att.status === 'REJECTED_INVALID' || att.status === 'QUARANTINED') && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FCE8E6] text-[#D8483C] text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Rejected</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.assetId)}
                        className="p-1 rounded-lg text-[#6F675E] hover:text-[#D8483C] transition-colors"
                        aria-label="Remove attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Validation Errors Alert */}
          {!validation.valid && submissionNotes.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#FCE8E6] border border-[#D8483C]/30 text-xs text-[#D8483C] space-y-1">
              {validation.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {submitError && (
            <div className="p-3.5 rounded-xl bg-[#FCE8E6] border border-[#D8483C] text-xs text-[#D8483C] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#6F675E] hover:text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!validation.valid || isSubmitting || isUploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Deliverable...</span>
                </>
              ) : (
                <span>Confirm & Submit Deliverable</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
