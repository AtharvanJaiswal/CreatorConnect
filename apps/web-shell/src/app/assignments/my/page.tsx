'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  PlusCircle,
  ArrowRight,
  Users,
  Calendar,
  Sparkles,
  FolderOpen,
} from 'lucide-react';
import {
  assignmentsWorkflowService,
  formatMinorUnitsToCurrency,
  getAssignmentStatusBadgeVariant,
  getApplicationStatusBadgeVariant,
} from '../../../lib/assignments-workflow-service';
import { useAuth } from '../../../providers/auth-provider';
import type { AssignmentResponse, ApplicationResponse } from '@creatorconnect/contracts';

export default function MyAssignmentsPage() {
  const { accessToken } = useAuth();

  const [activeTab, setActiveTab] = useState<'POSTED' | 'APPLICATIONS'>('POSTED');
  const [postedAssignments, setPostedAssignments] = useState<AssignmentResponse[]>([]);
  const [myApplications, setMyApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (accessToken) {
        const [postedRes, appsRes] = await Promise.allSettled([
          assignmentsWorkflowService.getBrandAssignments(accessToken),
          assignmentsWorkflowService.getMyApplications(accessToken),
        ]);

        if (postedRes.status === 'fulfilled') {
          setPostedAssignments(postedRes.value);
        }
        if (appsRes.status === 'fulfilled') {
          setMyApplications(appsRes.value);
        }
      } else {
        // Fallback demo or unauthenticated view
        setPostedAssignments([]);
        setMyApplications([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load user assignments.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] antialiased py-8 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD64A] bg-[#FFD64A]/20 px-3.5 py-1 text-xs font-bold text-[#875A00] uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5 text-[#875A00]" />
              Google Stitch G04 · Assignment Operations Cockpit
            </div>
            <h1 className="font-heading font-black text-3xl sm:text-4xl text-[#14110F]">
              My Assignments &{' '}
              <span className="font-serif italic font-normal text-[#6F675E]">Briefs</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6F675E]">
              Track your posted briefs, proposal reviews, and incoming hiring applications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/assignments">
              <button className="rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-5 py-2.5 text-xs font-bold text-[#14110F] hover:bg-[#F2ECE1] transition-all shadow-2xs">
                Browse Marketplace
              </button>
            </Link>
            <Link href="/assignments/create">
              <button className="flex items-center gap-2 rounded-full bg-[#FFD64A] px-5 py-2.5 text-xs font-bold text-[#14110F] hover:bg-[#F5CB35] transition-all shadow-2xs">
                <PlusCircle className="h-4 w-4" />
                Post New Brief
              </button>
            </Link>
          </div>
        </div>

        {/* Status Bar Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
              Active Posted Briefs
            </span>
            <div className="font-heading font-black text-2xl text-[#14110F] mt-1">
              {postedAssignments.filter((a) => a.status === 'PUBLISHED').length}
            </div>
            <span className="text-[11px] text-[#6F675E]">Open for incoming applications</span>
          </div>

          <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
              My Active Proposals
            </span>
            <div className="font-heading font-black text-2xl text-[#875A00] mt-1">
              {myApplications.length}
            </div>
            <span className="text-[11px] text-[#6F675E]">Submitted proposals in review</span>
          </div>

          <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
              Draft Briefs
            </span>
            <div className="font-heading font-black text-2xl text-[#6F675E] mt-1">
              {postedAssignments.filter((a) => a.status === 'DRAFT').length}
            </div>
            <span className="text-[11px] text-[#6F675E]">Unpublished assignments</span>
          </div>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex items-center gap-2 border-b border-[#E7E0D5] pb-3 mb-6">
          <button
            onClick={() => setActiveTab('POSTED')}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
              activeTab === 'POSTED'
                ? 'bg-[#14110F] text-[#FFFFFF] shadow-2xs'
                : 'bg-[#FFFFFF] text-[#6F675E] border border-[#E7E0D5] hover:bg-[#F2ECE1] hover:text-[#14110F]'
            }`}
          >
            Posted Assignments ({postedAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('APPLICATIONS')}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
              activeTab === 'APPLICATIONS'
                ? 'bg-[#14110F] text-[#FFFFFF] shadow-2xs'
                : 'bg-[#FFFFFF] text-[#6F675E] border border-[#E7E0D5] hover:bg-[#F2ECE1] hover:text-[#14110F]'
            }`}
          >
            My Submitted Proposals ({myApplications.length})
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 rounded-2xl border border-[#FFB6C8] bg-[#FFB6C8]/15 p-4 text-xs font-bold text-[#A02842]">
            {error}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-[#FFFFFF] rounded-[24px] border border-[#E7E0D5]">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#FFD64A] border-t-[#14110F]" />
            <p className="mt-4 text-xs font-bold text-[#6F675E] uppercase tracking-wider">
              Loading your dashboard records...
            </p>
          </div>
        )}

        {/* ========================================================
             TAB 1: POSTED ASSIGNMENTS (BRAND VIEW)
             ======================================================== */}
        {!loading && activeTab === 'POSTED' && (
          <div className="space-y-4">
            {postedAssignments.length === 0 ? (
              <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-12 text-center shadow-2xs">
                <FolderOpen className="mx-auto h-12 w-12 text-[#A39A8F]" />
                <h3 className="mt-4 font-heading font-black text-lg text-[#14110F]">
                  You have not posted any assignments yet
                </h3>
                <p className="mt-1 text-xs text-[#6F675E] max-w-sm mx-auto">
                  Create your first structured brief to receive verified proposals from elite
                  talent.
                </p>
                <Link href="/assignments/create">
                  <button className="mt-4 rounded-full bg-[#FFD64A] px-5 py-2 text-xs font-bold text-[#14110F] hover:bg-[#F5CB35] shadow-2xs">
                    Create New Brief
                  </button>
                </Link>
              </div>
            ) : (
              postedAssignments.map((asn) => {
                const statusVariant = getAssignmentStatusBadgeVariant(asn.status);
                return (
                  <div
                    key={asn.id}
                    className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}
                        >
                          {statusVariant.label}
                        </span>
                        <span className="text-[11px] text-[#A39A8F] flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created: {new Date(asn.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      <Link href={`/assignments/${asn.id}`}>
                        <h3 className="font-heading font-black text-lg text-[#14110F] hover:text-[#875A00] transition-colors">
                          {asn.title}
                        </h3>
                      </Link>

                      <p className="mt-1 text-xs text-[#6F675E] line-clamp-1">{asn.description}</p>

                      <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-[#6F675E]">
                        <span>
                          Budget:{' '}
                          <strong className="text-[#14110F]">
                            {formatMinorUnitsToCurrency(asn.budgetMin, asn.currency)}
                            {asn.budgetType === 'RANGE' &&
                              ` - ${formatMinorUnitsToCurrency(asn.budgetMax, asn.currency)}`}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Deadline:{' '}
                          <strong className="text-[#14110F]">
                            {new Date(asn.deadline).toLocaleDateString('en-IN')}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Link href={`/assignments/${asn.id}/applications`}>
                        <button className="flex items-center gap-1.5 rounded-full border border-[#E7E0D5] bg-[#FAF6EF] px-4 py-2 text-xs font-bold text-[#14110F] hover:bg-[#F2ECE1]">
                          <Users className="h-3.5 w-3.5 text-[#875A00]" />
                          Review Applicants
                        </button>
                      </Link>
                      <Link href={`/assignments/${asn.id}`}>
                        <button className="rounded-full bg-[#14110F] px-4 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#2C2724]">
                          View Public Page
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================
             TAB 2: SUBMITTED PROPOSALS (CREATOR VIEW)
             ======================================================== */}
        {!loading && activeTab === 'APPLICATIONS' && (
          <div className="space-y-4">
            {myApplications.length === 0 ? (
              <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-12 text-center shadow-2xs">
                <Briefcase className="mx-auto h-12 w-12 text-[#A39A8F]" />
                <h3 className="mt-4 font-heading font-black text-lg text-[#14110F]">
                  No submitted proposals found
                </h3>
                <p className="mt-1 text-xs text-[#6F675E] max-w-sm mx-auto">
                  Browse open briefs in the marketplace and submit structured proposals to begin
                  collaboration.
                </p>
                <Link href="/assignments">
                  <button className="mt-4 rounded-full bg-[#FFD64A] px-5 py-2 text-xs font-bold text-[#14110F] hover:bg-[#F5CB35] shadow-2xs">
                    Browse Marketplace
                  </button>
                </Link>
              </div>
            ) : (
              myApplications.map((app) => {
                const statusVariant = getApplicationStatusBadgeVariant(app.status);
                return (
                  <div
                    key={app.id}
                    className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}
                        >
                          {statusVariant.label}
                        </span>
                        <span className="text-[11px] text-[#A39A8F]">
                          Submitted: {new Date(app.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      <h3 className="font-heading font-black text-lg text-[#14110F]">
                        Proposal for Assignment{' '}
                        <code className="font-mono text-xs text-[#6F675E]">
                          #{app.assignmentId.slice(0, 8)}
                        </code>
                      </h3>

                      <p className="mt-1 text-xs text-[#6F675E] line-clamp-2">{app.coverLetter}</p>

                      <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-[#6F675E]">
                        {app.proposedRate !== null && (
                          <span>
                            Proposed Quote:{' '}
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

                    <div className="shrink-0">
                      <Link href={`/assignments/${app.assignmentId}`}>
                        <button className="flex items-center gap-1.5 rounded-full bg-[#14110F] px-4 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#2C2724]">
                          View Brief
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
