'use client';

import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, Loader2, CheckCircle2 } from 'lucide-react';
import type {
  CreateReportInput,
  ReportCategory,
  ReportResponse,
  ReportTargetType,
} from '@creatorconnect/contracts';

export interface ReportAbuseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetName?: string;
  onSubmitReport: (input: CreateReportInput) => Promise<ReportResponse>;
}

const CATEGORY_OPTIONS: Array<{ value: ReportCategory; label: string }> = [
  { value: 'SPAM', label: 'Spam or unsolicited messages' },
  { value: 'HARASSMENT', label: 'Harassment, intimidation, or bullying' },
  { value: 'ABUSE', label: 'Platform abuse or hate speech' },
  { value: 'SCAM', label: 'Scam, fraud, or off-platform payment solicitation' },
  {
    value: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate, explicit, or copyright-infringing content',
  },
  { value: 'MALICIOUS_FILE', label: 'Malicious attachment, virus, or phishing link' },
  { value: 'OTHER', label: 'Other Trust & Safety policy violation' },
];

export function ReportAbuseDialog({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetName,
  onSubmitReport,
}: ReportAbuseDialogProps) {
  const [category, setCategory] = useState<ReportCategory>('SPAM');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<ReportResponse | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSubmitting) return; // Prevent closing mid-flight
    setCategory('SPAM');
    setDetails('');
    setError(null);
    setSubmittedReport(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submittedReport) return;

    const trimmedDetails = details.trim();
    if (trimmedDetails.length < 10) {
      setError('Please provide at least 10 characters explaining the issue.');
      return;
    }
    if (trimmedDetails.length > 5000) {
      setError('Details cannot exceed 5,000 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmitReport({
        targetType,
        targetId,
        category,
        details: trimmedDetails,
      });
      setSubmittedReport(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit report. Please verify your connection and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Report ${targetType.toLowerCase()}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-[#EFE9DF] flex flex-col gap-5 text-[#14110F]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#FFDAD6] text-[#BA1A1A]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#14110F]">
                {submittedReport
                  ? 'Report Submitted'
                  : `Report ${targetType === 'USER' ? 'Participant' : 'Content'}`}
              </h3>
              <p className="text-xs text-[#6F675E]">
                {targetName
                  ? `Target: ${targetName}`
                  : `Target Reference: ${targetId.slice(0, 8)}...`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6F675E] hover:bg-[#FAF2EE] transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {submittedReport ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="p-4 bg-[#E8F5E9] rounded-2xl border border-[#C8E6C9] flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#2E7D32] shrink-0 mt-0.5" />
              <div className="text-xs text-[#1B5E20] leading-relaxed">
                <p className="font-bold text-sm">Thank you for reporting this issue.</p>
                <p className="mt-1">
                  Our Trust &amp; Safety team has logged this incident and will review it in
                  accordance with CreatorConnect Community Guidelines.
                </p>
                <p className="font-mono text-[11px] mt-2 text-[#2E7D32]">
                  Report Reference: {submittedReport.id}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 px-4 rounded-full bg-[#FFD64A] hover:bg-[#F2CA3D] text-[#14110F] text-xs font-bold transition-colors shadow-xs"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Informational Policy Notice */}
            <div className="p-3 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF] text-xs text-[#6F675E] leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#725C00] shrink-0 mt-0.5" />
              <p>
                Abuse reports are confidential and forwarded directly to Platform Safety. False or
                malicious reports may result in account penalties.
              </p>
            </div>

            {/* Violation Category Selector */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-category" className="text-xs font-semibold text-[#14110F]">
                Violation Category <span className="text-[#BA1A1A]">*</span>
              </label>
              <select
                id="report-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDD5C7] focus:outline-none focus:border-[#725C00] bg-[#FAF9F5] text-[#14110F] font-medium"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Details Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="report-details" className="text-xs font-semibold text-[#14110F]">
                  Specific Details &amp; Context <span className="text-[#BA1A1A]">*</span>
                </label>
                <span className="text-[10px] text-[#8C827A] font-mono">
                  {details.length}/5,000 (min 10)
                </span>
              </div>
              <textarea
                id="report-details"
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                placeholder="Describe what occurred, citing relevant timestamps, messages, or files (minimum 10 characters)..."
                rows={4}
                maxLength={5000}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDD5C7] focus:outline-none focus:border-[#725C00] resize-none bg-[#FAF9F5] text-[#14110F]"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="p-3 bg-[#FFDAD6] text-[#BA1A1A] text-xs rounded-xl border border-[#FFB4AB] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-full bg-[#FAF2EE] hover:bg-[#EFE9DF] text-[#14110F] text-xs font-bold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || details.trim().length < 10}
                className="px-5 py-2 rounded-full bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Safety Report</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
