'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
  AlertTriangle,
  Edit3,
  ShieldAlert,
  Scale,
  Ban,
  FileWarning,
  Lock,
  Star,
  Sparkles,
  MessageSquare,
  Flag,
} from 'lucide-react';
import type {
  ProjectResponse,
  ProjectDeliverableResponse,
  DeliverableStatus,
  DisputeResponse,
  ProjectCancellationResponse,
  ReviewResponse,
} from '@creatorconnect/contracts';
import { useAuth } from '../../../providers/auth-provider';
import {
  fetchProjectDetails,
  fetchProjectMilestones,
  fetchEscrowBalance,
  canCreatorSubmit,
  canClientReview,
  canEditMilestone,
  canReleaseEscrow,
} from '../../../lib/milestone-workflow-service';
import {
  listDisputes,
  listCancellations,
  canOpenDispute,
  canRequestCancellation,
  type UserProjectRole,
} from '../../../lib/disputes-workflow-service';
import {
  fetchProjectReviews,
  canSubmitReview,
  canEditReview,
  canReportReview,
} from '../../../lib/reviews-workflow-service';
import { MilestoneSubmissionDialog } from '../../../components/milestones/milestone-submission-dialog';
import { MilestoneReviewDialog } from '../../../components/milestones/milestone-review-dialog';
import { SubmissionHistoryDialog } from '../../../components/milestones/submission-history-dialog';
import { EscrowReleaseDialog } from '../../../components/milestones/escrow-release-dialog';
import { MilestoneCreateEditDialog } from '../../../components/milestones/milestone-create-edit-dialog';
import { DisputeOpenDialog } from '../../../components/disputes/dispute-open-dialog';
import { DisputeDetailsDialog } from '../../../components/disputes/dispute-details-dialog';
import { DisputeResolveDialog } from '../../../components/disputes/dispute-resolve-dialog';
import {
  CancellationDialog,
  type CancellationDialogMode,
} from '../../../components/disputes/cancellation-dialog';
import { ReviewSubmissionDialog } from '../../../components/reviews/review-submission-dialog';
import { ReviewReportDialog } from '../../../components/reviews/review-report-dialog';

export default function ProjectMilestonesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const { user, accessToken, isLoading: authLoading } = useAuth();

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [milestones, setMilestones] = useState<ProjectDeliverableResponse[]>([]);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [submittingMilestone, setSubmittingMilestone] = useState<ProjectDeliverableResponse | null>(
    null,
  );
  const [reviewingMilestone, setReviewingMilestone] = useState<ProjectDeliverableResponse | null>(
    null,
  );
  const [historyMilestone, setHistoryMilestone] = useState<ProjectDeliverableResponse | null>(null);
  const [isEscrowDialogOpen, setIsEscrowDialogOpen] = useState(false);
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectDeliverableResponse | null>(null);

  // Dispute & Cancellation States
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [cancellations, setCancellations] = useState<ProjectCancellationResponse[]>([]);
  const [isDisputeOpenDialogOpen, setIsDisputeOpenDialogOpen] = useState(false);
  const [selectedDisputeDetails, setSelectedDisputeDetails] = useState<DisputeResponse | null>(
    null,
  );
  const [selectedDisputeResolve, setSelectedDisputeResolve] = useState<DisputeResponse | null>(
    null,
  );
  const [cancellationDialogMode, setCancellationDialogMode] =
    useState<CancellationDialogMode | null>(null);

  // Review & Reputation States
  const [projectReviews, setProjectReviews] = useState<ReviewResponse[]>([]);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [editingProjectReview, setEditingProjectReview] = useState<ReviewResponse | null>(null);
  const [reportingProjectReview, setReportingProjectReview] = useState<ReviewResponse | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId || !accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const [projData, milestonesData, disputesData, cancellationsData] = await Promise.all([
        fetchProjectDetails(projectId, accessToken),
        fetchProjectMilestones(projectId, accessToken),
        listDisputes({ projectId }, accessToken).catch(() => [] as DisputeResponse[]),
        listCancellations(projectId, accessToken).catch(() => [] as ProjectCancellationResponse[]),
      ]);

      setProject(projData);
      setMilestones(milestonesData);
      setDisputes(disputesData);
      setCancellations(cancellationsData);

      // Fetch escrow balance non-blocking
      try {
        const escrow = await fetchEscrowBalance(projectId, accessToken);
        setEscrowBalance(escrow.balance);
      } catch {
        setEscrowBalance(0);
      }

      // Fetch reviews if completed
      if (projData.status === 'COMPLETED') {
        try {
          const revs = await fetchProjectReviews(projectId, accessToken);
          setProjectReviews(revs);
        } catch {
          setProjectReviews([]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  }, [projectId, accessToken]);

  useEffect(() => {
    if (!authLoading && accessToken) {
      loadData();
    }
  }, [authLoading, accessToken, loadData]);

  // Authorization Derivations
  const isClient = Boolean(user && project && user.id === project.clientId);
  const isTalent = Boolean(user && project && user.id === project.talentId);
  const isAdmin = Boolean(user && user.roles && user.roles.includes('ADMIN'));
  const isParticipant = isClient || isTalent || isAdmin;
  const userRole: UserProjectRole = isAdmin
    ? 'admin'
    : isClient
      ? 'client'
      : isTalent
        ? 'creator'
        : 'viewer';

  // Active Dispute & Cancellation evaluation
  const activeDispute =
    disputes.find(
      (d) =>
        d.status === 'OPEN' || d.status === 'UNDER_REVIEW' || d.status === 'EVIDENCE_REQUESTED',
    ) || null;
  const isDisputed = Boolean(activeDispute || project?.status === 'DISPUTED');

  const pendingCancellation = cancellations.find((c) => c.status === 'PENDING') || null;

  const allApproved = milestones.length > 0 && milestones.every((m) => m.status === 'APPROVED');
  const escrowReleasable =
    !isDisputed && canReleaseEscrow(milestones, escrowBalance) && (isClient || isAdmin);

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: DeliverableStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4EA] border border-[#B6E09B] text-[#2E9E6B] text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved</span>
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3FE] border border-[#A6CCF7] text-[#1B66C9] text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Submitted for Review</span>
          </span>
        );
      case 'REVISION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF6D9] border border-[#FFD64A] text-[#C98A16] text-[11px] font-bold">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Revision Requested</span>
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9DDFF] border border-[#C9B6F7] text-[#210F47] text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>In Client Review</span>
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[#6F675E] text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Submission</span>
          </span>
        );
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-[#E7E0D5]/50 animate-pulse rounded-xl" />
          <div className="h-44 bg-white border border-[#E7E0D5] rounded-[28px] animate-pulse p-8 shadow-sm" />
          <div className="space-y-4">
            <div className="h-32 bg-white border border-[#E7E0D5] rounded-2xl animate-pulse" />
            <div className="h-32 bg-white border border-[#E7E0D5] rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#FAF6EF] py-16 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-[#E7E0D5] rounded-[28px] p-8 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FCE8E6] text-[#D8483C] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-[#14110F]">
            Project Unavailable
          </h2>
          <p className="text-sm text-[#6F675E]">{error || 'Project not found or access denied.'}</p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/creator"
              className="px-5 py-2.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] text-xs font-bold text-[#14110F] hover:bg-[#F5ECE8]"
            >
              Back to Studio
            </Link>
            <button
              onClick={loadData}
              className="px-5 py-2.5 rounded-xl bg-[#FFD64A] text-[#14110F] text-xs font-bold hover:bg-[#F5CB35]"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EF] py-8 sm:py-12 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-white border border-[#E7E0D5] text-[#6F675E] hover:text-[#14110F] hover:bg-[#FAF6EF] transition-all"
              aria-label="Refresh project data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Dispute Banner */}
        {activeDispute && (
          <div className="relative bg-[#FDE8E8] border border-[#C93B2B]/30 rounded-[24px] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#C93B2B]/20 flex items-center justify-center text-[#C93B2B] shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#C93B2B] text-white text-[10px] font-bold uppercase tracking-wider">
                    Dispute: {activeDispute.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-[#8A2419]">
                    Reason: {activeDispute.reason.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#14110F] mt-1">
                  An active dispute is currently halting milestone transitions and freezing escrow
                  disbursements.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedDisputeDetails(activeDispute)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#C93B2B]/30 text-xs font-bold text-[#14110F] hover:bg-[#FAF6EF] shadow-sm transition-all"
              >
                <FileWarning className="w-3.5 h-3.5 text-[#C93B2B]" />
                <span>Evidence Locker & History</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setSelectedDisputeResolve(activeDispute)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14110F] text-white hover:bg-[#2C2724] text-xs font-bold shadow-sm transition-all"
                >
                  <Scale className="w-3.5 h-3.5 text-[#FFD64A]" />
                  <span>Arbitrate Ruling</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pending Mutual Cancellation Banner */}
        {pendingCancellation && (
          <div className="relative bg-[#FFF8E7] border border-[#F2C93D]/40 rounded-[24px] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#F2C93D]/30 flex items-center justify-center text-[#B88700] shrink-0 mt-0.5">
                <FileWarning className="w-5 h-5" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-[#B88700] text-white text-[10px] font-bold uppercase tracking-wider">
                  Cancellation Pending
                </span>
                <p className="text-sm font-semibold text-[#14110F] mt-1">
                  {pendingCancellation.requestedById === user?.id
                    ? 'You requested mutual project cancellation. Awaiting response.'
                    : 'The counterparty requested mutual project cancellation.'}
                </p>
                <p className="text-xs text-[#6F675E] mt-0.5 italic">
                  &ldquo;{pendingCancellation.reason}&rdquo;
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingCancellation.requestedById === user?.id || isAdmin ? (
                <button
                  onClick={() => setCancellationDialogMode('WITHDRAW')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#E7E0D5] text-xs font-bold text-[#C93B2B] hover:bg-[#FAF6EF] shadow-sm transition-all"
                >
                  <span>Withdraw Request</span>
                </button>
              ) : null}
              {pendingCancellation.requestedById !== user?.id || isAdmin ? (
                <button
                  onClick={() => setCancellationDialogMode('DECIDE')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14110F] text-white hover:bg-[#2C2724] text-xs font-bold shadow-sm transition-all"
                >
                  <span>Review & Decide</span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* Project Header Card */}
        <div className="relative bg-white border border-[#E7E0D5] rounded-[28px] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-[#E7E0D5]/70 pb-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-[#14110F] text-[#FAF6EF] text-[10px] font-bold uppercase tracking-wider">
                  Project #{project.id.slice(0, 8)}
                </span>
                <span className="px-3 py-0.5 rounded-full bg-[#E9DDFF] text-[#210F47] text-[10px] font-bold uppercase tracking-wider">
                  Status: {project.status}
                </span>
                {isClient && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFF6D9] text-[#735C00] text-[10px] font-bold">
                    Role: Client
                  </span>
                )}
                {isTalent && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EBF3FE] text-[#1B66C9] text-[10px] font-bold">
                    Role: Creator / Talent
                  </span>
                )}
              </div>

              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#14110F] tracking-tight">
                {project.title}
              </h1>

              {project.description && (
                <p className="text-sm text-[#6F675E] max-w-2xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            {/* Escrow Balance Widget */}
            <div className="shrink-0 p-4 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5] min-w-[220px]">
              <div className="flex items-center justify-between text-xs font-semibold text-[#6F675E] mb-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2E9E6B]" />
                  <span>Escrow Holding</span>
                </span>
                <span className="text-[10px] font-mono text-[#A39A8F]">INR</span>
              </div>
              <div className="text-2xl font-heading font-black text-[#14110F]">
                {formatCurrency(escrowBalance, project.currency)}
              </div>
              <div className="text-[11px] text-[#A39A8F] mt-1">
                Total Budget: {formatCurrency(project.totalAmount, project.currency)}
              </div>

              {escrowReleasable && (
                <button
                  onClick={() => setIsEscrowDialogOpen(true)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E9E6B] text-white hover:bg-[#25855A] text-xs font-bold shadow-sm transition-all animate-pulse"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Authorize Escrow Release</span>
                </button>
              )}

              {isDisputed && (
                <div className="mt-3 p-2.5 rounded-xl bg-[#FDE8E8] border border-[#C93B2B]/20 flex items-center justify-center gap-2 text-xs font-bold text-[#C93B2B]">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Escrow Frozen by Dispute</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div className="flex items-center gap-6 text-xs text-[#6F675E]">
              <div>
                <span className="font-bold text-[#14110F]">{milestones.length}</span>{' '}
                {milestones.length === 1 ? 'Milestone' : 'Milestones'}
              </div>
              <div>
                <span className="font-bold text-[#14110F]">
                  {milestones.filter((m) => m.status === 'APPROVED').length}
                </span>{' '}
                Approved
              </div>
              {allApproved && (
                <span className="text-[#2E9E6B] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All Deliverables Complete</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canOpenDispute(project.status, userRole, Boolean(activeDispute)) && (
                <button
                  onClick={() => setIsDisputeOpenDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF6EF] hover:bg-[#FDE8E8] border border-[#E7E0D5] hover:border-[#C93B2B]/30 text-[#C93B2B] text-xs font-bold transition-all shadow-sm"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Raise Dispute</span>
                </button>
              )}

              {canRequestCancellation(
                project.status,
                userRole,
                Boolean(pendingCancellation),
                Boolean(activeDispute),
              ) && (
                <button
                  onClick={() => setCancellationDialogMode('REQUEST')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-[#6F675E] hover:text-[#14110F] text-xs font-bold transition-all shadow-sm"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Project</span>
                </button>
              )}

              {isParticipant && project.status !== 'COMPLETED' && !isDisputed && (
                <button
                  onClick={() => {
                    setEditingMilestone(null);
                    setIsCreateMilestoneOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] text-xs font-bold transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Milestone</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Milestones & Deliverables Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-extrabold text-xl text-[#14110F] tracking-tight">
              Milestone Deliverables & Approval Pipeline
            </h2>
            <span className="text-xs text-[#6F675E]">Phase 6 Vertical Slice Verified</span>
          </div>

          {milestones.length === 0 ? (
            <div className="bg-white border border-[#E7E0D5] rounded-[28px] p-12 text-center shadow-sm space-y-3">
              <FileCheck className="w-10 h-10 text-[#A39A8F] mx-auto" />
              <h3 className="font-heading font-bold text-lg text-[#14110F]">
                No Milestones Defined Yet
              </h3>
              <p className="text-xs text-[#6F675E] max-w-sm mx-auto">
                Break the project into deliverables with deadlines and allocated escrow amounts.
              </p>
              {isParticipant && (
                <button
                  onClick={() => setIsCreateMilestoneOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] text-xs font-bold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Milestone</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {milestones.map((milestone, index) => {
                const canSubmit = (isTalent || isAdmin) && canCreatorSubmit(milestone.status);
                const canReview = (isClient || isAdmin) && canClientReview(milestone.status);
                const canEdit = isParticipant && canEditMilestone(milestone.status);

                return (
                  <div
                    key={milestone.id}
                    className="bg-white border border-[#E7E0D5] rounded-2xl p-5 sm:p-6 shadow-sm hover:border-[#14110F]/20 transition-all space-y-4"
                  >
                    {/* Top Row: Milestone Info & Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#A39A8F] uppercase tracking-wider">
                            Milestone {index + 1} • v{milestone.version}
                          </span>
                        </div>
                        <h3 className="font-heading font-extrabold text-lg text-[#14110F]">
                          {milestone.title}
                        </h3>
                      </div>

                      <div className="shrink-0">{getStatusBadge(milestone.status)}</div>
                    </div>

                    {/* Description */}
                    {milestone.description && (
                      <p className="text-xs text-[#6F675E] leading-relaxed">
                        {milestone.description}
                      </p>
                    )}

                    {/* Revision Feedback Banner */}
                    {milestone.status === 'REVISION_REQUESTED' && milestone.revisionNotes && (
                      <div className="p-3.5 rounded-xl bg-[#FFF6D9] border border-[#FFD64A]/60 text-xs text-[#735C00] space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Client Revision Request Notes:</span>
                        </div>
                        <p className="italic">{milestone.revisionNotes}</p>
                      </div>
                    )}

                    {/* Metadata & Actions Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#E7E0D5]/70">
                      <div className="flex items-center gap-5 text-xs text-[#6F675E]">
                        <span className="font-bold text-[#14110F]">
                          {formatCurrency(milestone.amount, project.currency)}
                        </span>
                        {milestone.dueDate && (
                          <span className="flex items-center gap-1 text-[#A39A8F]">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Due {new Date(milestone.dueDate).toLocaleDateString()}</span>
                          </span>
                        )}
                      </div>

                      {/* Contextual Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* History Button (always accessible) */}
                        <button
                          onClick={() => setHistoryMilestone(milestone)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] hover:bg-[#F5ECE8] text-xs font-bold text-[#14110F] transition-colors"
                        >
                          <History className="w-3.5 h-3.5 text-[#6F675E]" />
                          <span>View History</span>
                        </button>

                        {/* Edit Button */}
                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditingMilestone(milestone);
                              setIsCreateMilestoneOpen(true);
                            }}
                            className="p-1.5 rounded-xl text-[#6F675E] hover:text-[#14110F] hover:bg-[#FAF6EF] transition-colors"
                            aria-label="Edit milestone parameters"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Creator Submit Action */}
                        {canSubmit && (
                          <button
                            onClick={() => setSubmittingMilestone(milestone)}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#FFD64A] text-[#14110F] hover:bg-[#F5CB35] text-xs font-bold shadow-sm transition-all"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>
                              {milestone.status === 'REVISION_REQUESTED'
                                ? 'Submit Revision'
                                : 'Submit Deliverable'}
                            </span>
                          </button>
                        )}

                        {/* Client Review Action */}
                        {canReview && (
                          <button
                            onClick={() => setReviewingMilestone(milestone)}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#14110F] text-[#FAF6EF] hover:bg-[#29231E] text-xs font-bold shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#FFD64A]" />
                            <span>Review Submission</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Post-Completion Reviews & Reputation Section */}
        {project.status === 'COMPLETED' && (
          <div className="space-y-4 pt-6 border-t border-[#E7E0D5]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] text-[11px] font-semibold uppercase tracking-wider text-[#6F675E]">
                  <Sparkles className="w-3 h-3 text-[#FFD64A]" />
                  <span>Verified Project Reputation</span>
                </div>
                <h2 className="font-heading font-extrabold text-xl text-[#14110F] tracking-tight mt-1">
                  Project Reviews & Collaboration Feedback
                </h2>
                <p className="text-xs text-[#6F675E]">
                  Post-completion reviews contributing directly to public creator and client
                  reputation scores.
                </p>
              </div>

              {/* Action: Leave a Review if eligible */}
              {(() => {
                const myReview = user
                  ? projectReviews.find((r) => r.reviewerId === user.id) || null
                  : null;
                const hasActiveDispute = disputes.some((d) =>
                  ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED'].includes(d.status),
                );
                const canSubmit = user
                  ? canSubmitReview(project.status, hasActiveDispute, myReview, isParticipant)
                  : false;

                if (canSubmit) {
                  return (
                    <button
                      onClick={() => setIsReviewDialogOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#14110F] text-white hover:bg-[#2C2724] text-xs font-semibold shadow-sm transition-all"
                    >
                      <Star className="w-4 h-4 text-[#FFD64A]" />
                      <span>Leave a Review</span>
                    </button>
                  );
                }

                if (myReview && user) {
                  const editCheck = canEditReview(myReview, user.id);
                  if (editCheck.canEdit) {
                    return (
                      <button
                        onClick={() => setEditingProjectReview(myReview)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-xs font-semibold text-[#14110F] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit My Review (48h active)</span>
                      </button>
                    );
                  }
                }

                return null;
              })()}
            </div>

            {projectReviews.length === 0 ? (
              <div className="bg-white border border-[#E7E0D5] rounded-3xl p-8 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-[#8F877D] mx-auto" />
                <p className="font-semibold text-sm text-[#14110F]">No Reviews Submitted Yet</p>
                <p className="text-xs text-[#6F675E] max-w-md mx-auto">
                  This project has completed successfully. Participants can submit their verified
                  review to establish reputation scores.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectReviews.map((rev) => {
                  const reviewer = (rev as any).reviewer;
                  const reviewerName = reviewer
                    ? `${reviewer.firstName || ''} ${reviewer.lastName || ''}`.trim() ||
                      'Collaborator'
                    : 'Collaborator';

                  const canEdit = user ? canEditReview(rev, user.id).canEdit : false;
                  const canReport = user ? canReportReview(rev, user.id) : false;

                  return (
                    <div
                      key={rev.id}
                      className="bg-white rounded-3xl border border-[#E7E0D5] p-5 space-y-3 shadow-sm hover:border-[#8F877D] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#14110F]">
                            {reviewerName}
                          </span>
                          <span className="text-[10px] text-[#8F877D]">
                            • {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                          {rev.editCount > 0 && (
                            <span className="text-[10px] text-[#8F877D] italic">(edited)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[#FFD64A]">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= rev.rating ? 'fill-[#FFD64A] text-[#FFD64A]' : 'text-[#E7E0D5]'
                              }`}
                            />
                          ))}
                          <span className="font-bold text-xs text-[#14110F] ml-1">
                            {rev.rating}.0
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#14110F] leading-relaxed line-clamp-4 whitespace-pre-line">
                        {rev.feedback}
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E0D5]/60">
                        {canEdit && (
                          <button
                            onClick={() => setEditingProjectReview(rev)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FAF6EF] hover:bg-[#E7E0D5]/50 border border-[#E7E0D5] text-[10px] font-semibold text-[#14110F] transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canReport && (
                          <button
                            onClick={() => setReportingProjectReview(rev)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-[#FEECEB] text-[10px] font-semibold text-[#8F877D] hover:text-[#C93B2B] transition-colors"
                          >
                            <Flag className="w-3 h-3" />
                            <span>Report</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Dialogs */}
      {submittingMilestone && (
        <MilestoneSubmissionDialog
          isOpen={Boolean(submittingMilestone)}
          onClose={() => setSubmittingMilestone(null)}
          onSuccess={loadData}
          projectId={project.id}
          milestone={submittingMilestone}
          accessToken={accessToken}
        />
      )}

      {reviewingMilestone && (
        <MilestoneReviewDialog
          isOpen={Boolean(reviewingMilestone)}
          onClose={() => setReviewingMilestone(null)}
          onSuccess={loadData}
          projectId={project.id}
          milestone={reviewingMilestone}
          accessToken={accessToken}
        />
      )}

      {historyMilestone && (
        <SubmissionHistoryDialog
          isOpen={Boolean(historyMilestone)}
          onClose={() => setHistoryMilestone(null)}
          projectId={project.id}
          milestone={historyMilestone}
          accessToken={accessToken}
        />
      )}

      {isEscrowDialogOpen && (
        <EscrowReleaseDialog
          isOpen={isEscrowDialogOpen}
          onClose={() => setIsEscrowDialogOpen(false)}
          onSuccess={() => {
            loadData();
          }}
          projectId={project.id}
          projectTitle={project.title}
          escrowBalance={escrowBalance}
          currency={project.currency}
          accessToken={accessToken}
        />
      )}

      {isCreateMilestoneOpen && (
        <MilestoneCreateEditDialog
          isOpen={isCreateMilestoneOpen}
          onClose={() => {
            setIsCreateMilestoneOpen(false);
            setEditingMilestone(null);
          }}
          onSuccess={loadData}
          projectId={project.id}
          milestoneToEdit={editingMilestone}
          currency={project.currency}
          accessToken={accessToken}
        />
      )}

      {/* Dispute Dialogs */}
      {isDisputeOpenDialogOpen && (
        <DisputeOpenDialog
          isOpen={isDisputeOpenDialogOpen}
          onClose={() => setIsDisputeOpenDialogOpen(false)}
          onSuccess={() => {
            loadData();
          }}
          projectId={project.id}
          projectTitle={project.title}
          accessToken={accessToken}
        />
      )}

      {selectedDisputeDetails && (
        <DisputeDetailsDialog
          isOpen={Boolean(selectedDisputeDetails)}
          onClose={() => setSelectedDisputeDetails(null)}
          disputeId={selectedDisputeDetails.id}
          projectTitle={project.title}
          userRole={userRole}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          accessToken={accessToken}
          onOpenResolve={(disp) => setSelectedDisputeResolve(disp)}
        />
      )}

      {selectedDisputeResolve && (
        <DisputeResolveDialog
          isOpen={Boolean(selectedDisputeResolve)}
          onClose={() => setSelectedDisputeResolve(null)}
          onSuccess={() => {
            loadData();
          }}
          dispute={selectedDisputeResolve}
          projectTitle={project.title}
          escrowBalance={escrowBalance}
          currency={project.currency}
          accessToken={accessToken}
        />
      )}

      {/* Cancellation Dialog */}
      {cancellationDialogMode && (
        <CancellationDialog
          isOpen={Boolean(cancellationDialogMode)}
          onClose={() => setCancellationDialogMode(null)}
          onSuccess={() => {
            loadData();
          }}
          projectId={project.id}
          projectTitle={project.title}
          mode={cancellationDialogMode}
          pendingCancellation={pendingCancellation}
          accessToken={accessToken}
        />
      )}

      {/* Review Submission & Edit Dialog */}
      {(isReviewDialogOpen || editingProjectReview) && (
        <ReviewSubmissionDialog
          isOpen={isReviewDialogOpen || Boolean(editingProjectReview)}
          onClose={() => {
            setIsReviewDialogOpen(false);
            setEditingProjectReview(null);
          }}
          onSuccess={() => {
            setIsReviewDialogOpen(false);
            setEditingProjectReview(null);
            loadData();
          }}
          projectId={project.id}
          projectTitle={project.title}
          recipientName={isClient ? 'Creator' : 'Client'}
          existingReview={editingProjectReview}
          accessToken={accessToken}
        />
      )}

      {/* Review Report Dialog */}
      {reportingProjectReview && (
        <ReviewReportDialog
          isOpen={Boolean(reportingProjectReview)}
          onClose={() => setReportingProjectReview(null)}
          onSuccess={() => {
            setReportingProjectReview(null);
            loadData();
          }}
          reviewId={reportingProjectReview.id}
          reviewerName={
            (reportingProjectReview as any).reviewer
              ? `${(reportingProjectReview as any).reviewer.firstName || ''} ${(reportingProjectReview as any).reviewer.lastName || ''}`.trim()
              : undefined
          }
          accessToken={accessToken}
        />
      )}
    </div>
  );
}
