'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Send,
  Loader2,
  Lock,
  Sparkles,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import {
  formatMinorUnitsToCurrency,
  getAssignmentStatusBadgeVariant,
} from '../../../lib/assignments-workflow-service';

export default function AssignmentDetailPage() {
  const params = useParams();
  const assignmentId = params?.id as string;
  const { user, accessToken } = useAuth();

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Proposal form state
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedRateRupees, setProposedRateRupees] = useState('');
  const [durationDays, setDurationDays] = useState('7');

  useEffect(() => {
    async function loadAssignment() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const res = await fetch(`/api/v1/assignments/${assignmentId}`, { headers });
        if (!res.ok) {
          throw new Error('Could not load assignment details.');
        }
        const data = await res.json();
        setAssignment(data);
      } catch (err: any) {
        setError(err.message || 'Error loading assignment');
      } finally {
        setLoading(false);
      }
    }
    if (assignmentId) {
      loadAssignment();
    }
  }, [assignmentId, accessToken]);

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const ratePaise = proposedRateRupees ? parseInt(proposedRateRupees, 10) * 100 : undefined;

      const res = await fetch(`/api/v1/assignments/${assignmentId}/apply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          coverLetter,
          proposedRate: ratePaise,
          durationDays: durationDays ? parseInt(durationDays, 10) : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 409) {
          throw new Error('You have already submitted a proposal for this assignment brief.');
        }
        if (errJson.code === 'ASSIGNMENT_DEADLINE_EXPIRED') {
          throw new Error(
            'The deadline for this assignment brief has expired. Submissions are closed.',
          );
        }
        throw new Error(errJson.detail || 'Failed to submit proposal.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#FFD64A] border-t-[#14110F]" />
        <p className="mt-4 text-xs font-bold text-[#6F675E] uppercase tracking-wider">
          Loading assignment brief...
        </p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] py-16 px-4 text-center">
        <div className="max-w-md mx-auto rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-8 shadow-2xs">
          <AlertTriangle className="h-10 w-10 text-[#C98A16] mx-auto mb-3" />
          <h2 className="text-xl font-black font-heading text-[#14110F]">
            Assignment Brief Not Found
          </h2>
          <p className="text-xs text-[#6F675E] mt-1 mb-6">
            The brief you are looking for may have been closed, deleted, or requires authorization.
          </p>
          <Link href="/assignments">
            <button className="rounded-full bg-[#14110F] px-5 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#2C2724]">
              Back to Marketplace
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = new Date(assignment.deadline).getTime() < Date.now();
  const isOwner = user?.id === assignment.brandId;
  const statusBadge = getAssignmentStatusBadgeVariant(assignment.status);

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] antialiased py-8 px-4 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Navigation Breadcrumb & Meta */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/assignments"
            className="flex items-center gap-1.5 text-xs font-bold text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Briefs
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD64A] bg-[#FFD64A]/20 px-3.5 py-1 text-xs font-bold text-[#875A00]">
            <Sparkles className="h-3.5 w-3.5 text-[#875A00]" />
            Google Stitch G03 · Assignment Creative Brief
          </div>
        </div>

        {/* Header Brief Card */}
        <div className="rounded-[28px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs mb-8">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
            >
              {statusBadge.label}
            </span>
            {isExpired ? (
              <span className="rounded-full bg-[#FFB6C8]/25 border border-[#FFB6C8] px-3 py-0.5 text-xs font-bold text-[#A02842] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Submissions Closed
              </span>
            ) : (
              <span className="rounded-full bg-[#FAF6EF] border border-[#E7E0D5] px-3 py-0.5 text-xs font-semibold text-[#6F675E] flex items-center gap-1">
                <Calendar className="h-3 w-3 text-[#875A00]" />
                Deadline:{' '}
                {new Date(assignment.deadline).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
            {assignment.isRemote && (
              <span className="rounded-full bg-[#C9B6F7]/25 border border-[#C9B6F7] px-3 py-0.5 text-xs font-bold text-[#4F3690]">
                🌐 Remote
              </span>
            )}
          </div>

          <h1 className="font-heading font-black text-2xl sm:text-4xl text-[#14110F] tracking-tight">
            {assignment.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#F2ECE1] pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center text-[#875A00]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#14110F] flex items-center gap-1.5">
                  {assignment.brand?.companyName || 'Verified Platform Partner'}
                  <ShieldCheck className="h-4 w-4 text-[#2E9E6B]" />
                </div>
                <div className="text-[11px] text-[#6F675E]">
                  Commissioning Entity · Verified Identity
                </div>
              </div>
            </div>

            {isOwner && (
              <Link href={`/assignments/${assignment.id}/applications`}>
                <button className="flex items-center gap-2 rounded-full bg-[#FFD64A] px-5 py-2 text-xs font-bold text-[#14110F] hover:bg-[#F5CB35] shadow-2xs">
                  <Users className="h-4 w-4" />
                  Review Applicants (G08)
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Content Columns: Scope (Left) & Proposal Box (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Scope & Deliverables */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs space-y-4">
              <h3 className="font-heading font-black text-lg text-[#14110F]">
                Project Scope & Creative Brief
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-[#6F675E] whitespace-pre-line">
                {assignment.description}
              </p>
            </div>

            {assignment.requirements && assignment.requirements.length > 0 && (
              <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs space-y-4">
                <h3 className="font-heading font-black text-lg text-[#14110F]">
                  Required Deliverables ({assignment.requirements.length})
                </h3>
                <div className="space-y-2.5">
                  {assignment.requirements.map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-4 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-[#2E9E6B] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[#14110F]">{r.title}</span>
                          {r.description && (
                            <p className="text-[11px] text-[#6F675E] mt-0.5">{r.description}</p>
                          )}
                        </div>
                      </div>
                      {r.isMandatory && (
                        <span className="rounded-full bg-[#FFD64A]/30 border border-[#FFD64A] px-2 py-0.5 text-[10px] font-bold text-[#875A00] shrink-0">
                          Mandatory
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Escrow & Proposal Form */}
          <div className="space-y-6">
            <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs space-y-4">
              <div className="border-b border-[#F2ECE1] pb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
                  Allocated Escrow
                </span>
                <div className="font-heading font-black text-2xl text-[#14110F] mt-1">
                  {assignment.budgetType === 'RANGE'
                    ? `${formatMinorUnitsToCurrency(assignment.budgetMin, assignment.currency)} - ${formatMinorUnitsToCurrency(assignment.budgetMax, assignment.currency)}`
                    : formatMinorUnitsToCurrency(assignment.budgetMin, assignment.currency)}
                </div>
                <p className="text-[11px] text-[#6F675E] mt-1">
                  Protected under CreatorConnect Milestone Escrow.
                </p>
              </div>

              {/* Proposal Form */}
              {success ? (
                <div className="rounded-2xl border border-[#B6E09B] bg-[#B6E09B]/20 p-5 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-[#2E9E6B] mx-auto" />
                  <h4 className="font-bold text-sm text-[#14110F]">Proposal Submitted!</h4>
                  <p className="text-xs text-[#6F675E]">
                    The client has been notified. You can track this proposal in{' '}
                    <Link href="/assignments/my" className="font-bold text-[#14110F] underline">
                      My Assignments
                    </Link>
                    .
                  </p>
                </div>
              ) : isExpired ? (
                <div className="rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-5 text-center space-y-2">
                  <Lock className="h-6 w-6 text-[#A39A8F] mx-auto" />
                  <div className="font-bold text-xs text-[#14110F]">Submissions Closed</div>
                  <p className="text-[11px] text-[#6F675E]">
                    The deadline for this brief has passed. No further applications are accepted.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitProposal} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#14110F] uppercase tracking-wider">
                      Cover Pitch & Portfolio Link *
                    </label>
                    <textarea
                      required
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Outline your vision, relevant samples, turnaround, and gear/software..."
                      rows={4}
                      className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3 text-xs text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#14110F] uppercase tracking-wider">
                      Proposed Fee Quote (INR ₹)
                    </label>
                    <input
                      type="number"
                      value={proposedRateRupees}
                      onChange={(e) => setProposedRateRupees(e.target.value)}
                      placeholder="e.g. 85000"
                      className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3 text-xs font-mono font-bold text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#14110F] uppercase tracking-wider">
                      Turnaround Timeline (Days)
                    </label>
                    <input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      placeholder="7"
                      className="w-full rounded-2xl border border-[#E7E0D5] bg-[#FAF6EF] p-3 text-xs text-[#14110F] focus:border-[#14110F] focus:bg-[#FFFFFF] focus:outline-none"
                    />
                  </div>

                  {error && (
                    <div className="text-xs font-semibold text-[#A02842] p-3 rounded-xl bg-[#FFB6C8]/20 border border-[#FFB6C8]">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !coverLetter.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-[#14110F] hover:bg-[#2C2724] py-3 text-xs font-bold text-[#FFFFFF] shadow-2xs transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>Submit Proposal</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
