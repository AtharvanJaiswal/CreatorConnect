'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Eye, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../../../../providers/auth-provider';
import {
  assignmentsWorkflowService,
  formatMinorUnitsToCurrency,
  getAssignmentStatusBadgeVariant,
} from '../../../../lib/assignments-workflow-service';

export default function ManageAssignmentPage() {
  const params = useParams();
  const assignmentId = params?.id as string;
  const { accessToken } = useAuth();

  const [assignment, setAssignment] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!assignmentId || !accessToken) return;
    setLoading(true);
    setError(null);
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

  const handleClose = async () => {
    if (!assignment) return;
    setClosing(true);
    try {
      await assignmentsWorkflowService.closeAssignment(
        assignment.id,
        assignment.version,
        accessToken || undefined,
      );
      await loadData();
    } catch {
      // Handled
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#FFD64A] border-t-[#14110F]" />
        <p className="mt-4 text-xs font-bold text-[#6F675E] uppercase tracking-wider">
          Loading assignment management cockpit...
        </p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] py-16 px-4 text-center">
        <div className="max-w-md mx-auto rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-8 shadow-2xs">
          <AlertTriangle className="h-10 w-10 text-[#C98A16] mx-auto mb-3" />
          <h2 className="text-xl font-black font-heading text-[#14110F]">Assignment Not Found</h2>
          <Link href="/assignments/my">
            <button className="mt-4 rounded-full bg-[#14110F] px-5 py-2 text-xs font-bold text-[#FFFFFF]">
              Back to My Assignments
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const statusVariant = getAssignmentStatusBadgeVariant(assignment.status);

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] antialiased py-8 px-4 sm:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Top Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/assignments/my"
            className="flex items-center gap-1.5 text-xs font-bold text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Assignments
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD64A] bg-[#FFD64A]/20 px-3.5 py-1 text-xs font-bold text-[#875A00]">
            <Sparkles className="h-3.5 w-3.5 text-[#875A00]" />
            Google Stitch G07 · Operational Management Cockpit
          </div>
        </div>

        {/* Cockpit Card */}
        <div className="rounded-[28px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}
                >
                  {statusVariant.label}
                </span>
                <span className="text-xs text-[#A39A8F]">Version: v{assignment.version}</span>
              </div>

              <h1 className="font-heading font-black text-2xl sm:text-3xl text-[#14110F]">
                {assignment.title}
              </h1>

              <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-[#6F675E]">
                <span>
                  Budget:{' '}
                  <strong className="text-[#14110F]">
                    {formatMinorUnitsToCurrency(assignment.budgetMin, assignment.currency)}
                    {assignment.budgetType === 'RANGE' &&
                      ` - ${formatMinorUnitsToCurrency(assignment.budgetMax, assignment.currency)}`}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Deadline:{' '}
                  <strong className="text-[#14110F]">
                    {new Date(assignment.deadline).toLocaleDateString('en-IN')}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link href={`/assignments/${assignment.id}/applications`}>
                <button className="flex items-center gap-2 rounded-full bg-[#FFD64A] px-5 py-2.5 text-xs font-bold text-[#14110F] hover:bg-[#F5CB35] shadow-2xs">
                  <Users className="h-4 w-4" />
                  Review Applicants ({applications.length})
                </button>
              </Link>
              <Link href={`/assignments/${assignment.id}`}>
                <button className="flex items-center gap-1.5 rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-4 py-2.5 text-xs font-bold text-[#14110F] hover:bg-[#F2ECE1]">
                  <Eye className="h-4 w-4 text-[#6F675E]" />
                  Public View
                </button>
              </Link>
              {assignment.status === 'PUBLISHED' && (
                <button
                  onClick={handleClose}
                  disabled={closing}
                  className="rounded-full border border-[#E7E0D5] bg-[#FAF6EF] px-4 py-2.5 text-xs font-bold text-[#A02842] hover:bg-[#FFB6C8]/20 transition-all"
                >
                  {closing ? 'Closing...' : 'Close Assignment'}
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-[#FFB6C8] bg-[#FFB6C8]/15 p-4 text-xs font-bold text-[#A02842]">
            {error}
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
              Total Applications
            </span>
            <div className="font-heading font-black text-3xl text-[#14110F] mt-1">
              {applications.length}
            </div>
            <p className="text-[11px] text-[#6F675E] mt-1">
              Proposals received from verified talent
            </p>
          </div>

          <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
              Shortlisted Candidates
            </span>
            <div className="font-heading font-black text-3xl text-[#4F3690] mt-1">
              {applications.filter((a) => a.status === 'SHORTLISTED').length}
            </div>
            <p className="text-[11px] text-[#6F675E] mt-1">Flagged for final hiring decision</p>
          </div>

          <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
              Hired Collaborator
            </span>
            <div className="font-heading font-black text-3xl text-[#2E9E6B] mt-1">
              {applications.filter((a) => a.status === 'ACCEPTED').length > 0 ? '1' : '0'}
            </div>
            <p className="text-[11px] text-[#6F675E] mt-1">Active milestone contract created</p>
          </div>
        </div>
      </div>
    </div>
  );
}
