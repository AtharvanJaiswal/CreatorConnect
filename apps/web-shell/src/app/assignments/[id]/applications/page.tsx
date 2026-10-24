'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../../providers/auth-provider';
import {
  formatMinorUnitsToCurrency,
  getApplicationStatusBadgeVariant,
} from '../../../../lib/assignments-workflow-service';

interface ApplicationItem {
  id: string;
  assignmentId: string;
  applicantId: string;
  coverLetter: string;
  proposedRate: number | null;
  currency: string;
  durationDays: number | null;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  version: number;
  createdAt: string;
}

export default function BrandApplicationsReviewPage() {
  const params = useParams();
  const assignmentId = params?.id as string;
  const { accessToken } = useAuth();

  const [assignment, setAssignment] = useState<any>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const loadData = async () => {
    if (!assignmentId || !accessToken) return;
    setLoading(true);
    setConflictError(null);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };

      const [assignRes, appsRes] = await Promise.all([
        fetch(`/api/v1/assignments/${assignmentId}`, { headers }),
        fetch(`/api/v1/assignments/${assignmentId}/applications`, { headers }),
      ]);

      if (assignRes.ok) {
        setAssignment(await assignRes.json());
      }
      if (appsRes.ok) {
        setApplications(await appsRes.json());
      }
    } catch {
      // Error handled via state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assignmentId && accessToken) {
      loadData();
    }
  }, [assignmentId, accessToken]);

  const handleStatusTransition = async (
    applicationId: string,
    targetStatus: 'SHORTLISTED' | 'REJECTED',
  ) => {
    setActionInProgressId(applicationId);
    setConflictError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(`/api/v1/applications/${applicationId}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: targetStatus,
          reason: targetStatus === 'SHORTLISTED' ? 'QUALIFIED_CANDIDATE' : 'NOT_SELECTED',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Status transition failed.');
      }

      await loadData();
    } catch (err: any) {
      setConflictError(err.message);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleAtomicAccept = async (app: ApplicationItem) => {
    setActionInProgressId(app.id);
    setConflictError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(`/api/v1/assignments/${assignmentId}/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          applicationId: app.id,
          expectedVersion: assignment.version,
          expectedApplicationVersion: app.version,
        }),
      });

      if (res.status === 409) {
        throw new Error(
          '409 Conflict: This assignment or application was concurrently modified. Another candidate may have just been accepted or the proposal was updated.',
        );
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Acceptance failed.');
      }

      await loadData();
    } catch (err: any) {
      setConflictError(err.message);
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] antialiased py-8 px-4 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/assignments/${assignmentId}`}
            className="flex items-center gap-1.5 text-xs font-bold text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Brief Overview
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD64A] bg-[#FFD64A]/20 px-3.5 py-1 text-xs font-bold text-[#875A00]">
            <Sparkles className="h-3.5 w-3.5 text-[#875A00]" />
            Google Stitch G08 / G09 · Applicant Review Cockpit
          </div>
        </div>

        {/* Header Summary */}
        <div className="rounded-[28px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="rounded-full bg-[#FFD64A]/25 border border-[#FFD64A] px-3 py-0.5 text-xs font-bold text-[#875A00] flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Atomic Selection Engine
              </span>
              <span className="text-xs text-[#A39A8F]">Version: v{assignment?.version || 1}</span>
            </div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#14110F]">
              Review Proposals ({applications.length})
            </h1>
            <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
              Assignment: <strong>{assignment?.title}</strong>
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-4 py-2 text-xs font-bold text-[#14110F] hover:bg-[#F2ECE1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Proposals
          </button>
        </div>

        {/* Concurrency Conflict Banner */}
        {conflictError && (
          <div className="mb-6 rounded-2xl border border-[#FFB6C8] bg-[#FFB6C8]/15 p-4 text-xs font-bold text-[#A02842] flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-black">Concurrency / Optimistic Lock Notice</div>
              <div className="text-[11px] mt-0.5 opacity-90">{conflictError}</div>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-[#FFFFFF] rounded-[24px] border border-[#E7E0D5]">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#FFD64A] border-t-[#14110F]" />
            <p className="mt-4 text-xs font-bold text-[#6F675E] uppercase tracking-wider">
              Retrieving applicant records...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && applications.length === 0 && (
          <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-12 text-center shadow-2xs">
            <Users className="mx-auto h-12 w-12 text-[#A39A8F]" />
            <h3 className="mt-4 font-heading font-black text-lg text-[#14110F]">
              No proposals submitted yet
            </h3>
            <p className="mt-1 text-xs text-[#6F675E] max-w-sm mx-auto">
              This assignment is currently published in the marketplace. Verified creators will
              submit proposals here.
            </p>
          </div>
        )}

        {/* Applications List (G08 / G09) */}
        {!loading && applications.length > 0 && (
          <div className="space-y-4">
            {applications.map((app) => {
              const statusVariant = getApplicationStatusBadgeVariant(app.status);
              const isAccepted = app.status === 'ACCEPTED';
              const isActionable = app.status === 'SUBMITTED' || app.status === 'SHORTLISTED';
              const isBusy = actionInProgressId === app.id;

              return (
                <div
                  key={app.id}
                  className={`rounded-[24px] border p-6 transition-all shadow-2xs ${
                    isAccepted
                      ? 'border-[#B6E09B] bg-[#B6E09B]/10'
                      : 'border-[#E7E0D5] bg-[#FFFFFF] hover:border-[#FFD64A]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}
                        >
                          {statusVariant.label}
                        </span>
                        <span className="text-[11px] text-[#A39A8F]">
                          Submitted: {new Date(app.createdAt).toLocaleDateString('en-IN')}
                        </span>
                        <span className="text-[#E7E0D5]">•</span>
                        <span className="text-[11px] text-[#6F675E]">
                          Applicant ID:{' '}
                          <code className="font-mono">{app.applicantId.slice(0, 8)}</code>
                        </span>
                      </div>

                      <div className="rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-4 text-xs text-[#14110F] whitespace-pre-line mb-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F] mb-1">
                          Cover Pitch & Approach
                        </div>
                        {app.coverLetter}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#6F675E]">
                        {app.proposedRate !== null && (
                          <span>
                            Quote:{' '}
                            <strong className="text-[#14110F]">
                              {formatMinorUnitsToCurrency(app.proposedRate, app.currency)}
                            </strong>
                          </span>
                        )}
                        {app.durationDays !== null && (
                          <span>
                            Estimated Turnaround:{' '}
                            <strong className="text-[#14110F]">{app.durationDays} days</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t sm:border-t-0 border-[#E7E0D5] pt-3 sm:pt-0">
                      {isActionable && (
                        <div className="flex items-center gap-2">
                          {app.status === 'SUBMITTED' && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleStatusTransition(app.id, 'SHORTLISTED')}
                              className="rounded-full border border-[#C9B6F7] bg-[#C9B6F7]/20 px-3.5 py-1.5 text-xs font-bold text-[#4F3690] hover:bg-[#C9B6F7]/40 transition-all"
                            >
                              Shortlist
                            </button>
                          )}

                          <button
                            disabled={isBusy}
                            onClick={() => handleStatusTransition(app.id, 'REJECTED')}
                            className="rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-bold text-[#A02842] hover:bg-[#FFB6C8]/20 transition-all"
                          >
                            Decline
                          </button>

                          <button
                            disabled={isBusy}
                            onClick={() => handleAtomicAccept(app)}
                            className="flex items-center gap-1.5 rounded-full bg-[#14110F] hover:bg-[#FFD64A] hover:text-[#14110F] px-4 py-1.5 text-xs font-bold text-[#FFFFFF] shadow-2xs transition-all"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Hire & Fund Escrow
                          </button>
                        </div>
                      )}

                      {isAccepted && (
                        <div className="rounded-full bg-[#B6E09B]/25 border border-[#B6E09B] px-3.5 py-1 text-xs font-bold text-[#2D6A2E] flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Hired Collaborator
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
