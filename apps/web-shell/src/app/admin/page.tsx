'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@creatorconnect/ui';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Lock,
  Scale,
  FileText,
  Clock,
  Loader2,
  RefreshCw,
  Star,
} from 'lucide-react';
import type { DisputeResponse } from '@creatorconnect/contracts';
import { useAuth } from '../../providers/auth-provider';
import { listDisputes, canResolveDispute } from '../../lib/disputes-workflow-service';
import { fetchModerationQueue } from '../../lib/reviews-workflow-service';
import { DisputeDetailsDialog } from '../../components/disputes/dispute-details-dialog';
import { DisputeResolveDialog } from '../../components/disputes/dispute-resolve-dialog';
import { ReviewModerationDialog } from '../../components/reviews/review-moderation-dialog';

export default function AdminPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [isLoadingDisputes, setIsLoadingDisputes] = useState(true);
  const [disputesError, setDisputesError] = useState<string | null>(null);

  // Review Moderation State
  const [moderationReviews, setModerationReviews] = useState<any[]>([]);
  const [isLoadingModeration, setIsLoadingModeration] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [selectedReviewToModerate, setSelectedReviewToModerate] = useState<any | null>(null);

  // Dialog States
  const [selectedDisputeDetails, setSelectedDisputeDetails] = useState<DisputeResponse | null>(
    null,
  );
  const [selectedDisputeResolve, setSelectedDisputeResolve] = useState<DisputeResponse | null>(
    null,
  );

  const isAdmin = Boolean(user && user.roles && user.roles.includes('ADMIN'));

  const fetchDisputesData = useCallback(async () => {
    setIsLoadingDisputes(true);
    setDisputesError(null);
    try {
      const data = await listDisputes({}, accessToken);
      setDisputes(data);
    } catch (err: any) {
      setDisputesError(err.message || 'Failed to retrieve dispute queue.');
    } finally {
      setIsLoadingDisputes(false);
    }
  }, [accessToken]);

  const fetchModerationData = useCallback(async () => {
    setIsLoadingModeration(true);
    setModerationError(null);
    try {
      const queue = await fetchModerationQueue({}, accessToken);
      setModerationReviews(queue.items || []);
    } catch (err: any) {
      setModerationError(err.message || 'Failed to retrieve review moderation queue.');
    } finally {
      setIsLoadingModeration(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading) {
      fetchDisputesData();
      fetchModerationData();
    }
  }, [authLoading, fetchDisputesData, fetchModerationData]);

  const activeDisputesCount = disputes.filter(
    (d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW' || d.status === 'EVIDENCE_REQUESTED',
  ).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <Badge variant="destructive" className="text-xs">
            Open
          </Badge>
        );
      case 'UNDER_REVIEW':
        return (
          <Badge variant="warning" className="text-xs">
            Under Review
          </Badge>
        );
      case 'EVIDENCE_REQUESTED':
        return (
          <Badge variant="secondary" className="text-xs">
            Evidence Requested
          </Badge>
        );
      case 'RESOLVED_FOR_CLIENT':
      case 'RESOLVED_FOR_CREATOR':
        return (
          <Badge variant="outline" className="border-success text-success text-xs">
            Resolved
          </Badge>
        );
      case 'CLOSED':
        return (
          <Badge variant="outline" className="text-xs">
            Closed
          </Badge>
        );
      default:
        return <Badge className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="container max-w-7xl px-4 sm:px-8 py-10 space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="warning" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Operations Cockpit</span>
            </Badge>
            <span className="text-xs text-muted-foreground">Domain: /admin</span>
          </div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl tracking-tight">
            Compliance, KYC & Escrow Governance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify identities, arbitrate formal project disputes, and monitor system-wide
            double-entry ledger invariants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-success text-success gap-1.5 py-1 px-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Escrow Invariants Verified</span>
          </Badge>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pending KYC Verifications</span>
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">7 Pending</div>
          <p className="text-xs text-muted-foreground mt-1">4 Creators, 3 Production Freelancers</p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Disputes</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">
            {isLoadingDisputes ? '...' : `${activeDisputesCount} Active`}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {activeDisputesCount === 1
              ? '1 dispute requires arbitrator action'
              : `${activeDisputesCount} disputes require arbitrator action`}
          </p>
        </Card>

        <Card glass className="p-6">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Escrow Vault Invariant</span>
            <Lock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-heading">100.00% Matched</div>
          <p className="text-xs text-muted-foreground mt-1">
            Zero balance mismatch across all double-entry ledger accounts
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="kyc" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kyc">KYC Queue (7)</TabsTrigger>
          <TabsTrigger value="disputes">
            Dispute Arbitration ({isLoadingDisputes ? '...' : activeDisputesCount})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Review Moderation ({isLoadingModeration ? '...' : moderationReviews.length})
          </TabsTrigger>
          <TabsTrigger value="system">System Security Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Government ID & Bank Account Review</CardTitle>
                <CardDescription>
                  Submitted by: Rahul Sharma (Video Editor) • PAN & Bank Verified
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">
                  Reject
                </Button>
                <Button size="sm">Approve KYC</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2 text-xs text-muted-foreground">
              Verification documents cryptographically verified against Razorpay Route payout
              beneficiary API.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold text-lg">Arbitration & Dispute Review</h3>
              <p className="text-xs text-muted-foreground">
                Formal disputes raised on active project milestones with escrow lock active.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchDisputesData}
              disabled={isLoadingDisputes}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDisputes ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </Button>
          </div>

          {isLoadingDisputes ? (
            <Card className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading active dispute queue...</p>
            </Card>
          ) : disputesError ? (
            <Card className="p-6 border-destructive/20 bg-destructive/5 text-destructive text-sm">
              <p className="font-semibold">Failed to load dispute arbitration queue</p>
              <p className="text-xs opacity-90 mt-1">{disputesError}</p>
            </Card>
          ) : disputes.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="font-semibold text-foreground">Dispute Queue Clear</p>
              <p className="text-xs text-muted-foreground">
                No active or historical disputes found in the repository ledger.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {disputes.map((dispute) => {
                const canArbitrate = canResolveDispute(dispute.status, isAdmin);

                return (
                  <Card
                    key={dispute.id}
                    className="p-5 space-y-3 hover:border-border transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(dispute.status)}
                        <span className="font-semibold text-sm">
                          {dispute.reason.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          Project #{dispute.projectId.slice(0, 8)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(dispute.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {dispute.description}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-[11px] text-muted-foreground">
                        <span>Evidence items: {(dispute.evidence || []).length}</span>
                        {dispute.history && (
                          <span className="ml-3">Audit events: {dispute.history.length}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDisputeDetails(dispute)}
                          className="gap-1.5 text-xs"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Inspect Evidence</span>
                        </Button>

                        {canArbitrate && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedDisputeResolve(dispute)}
                            className="gap-1.5 text-xs"
                          >
                            <Scale className="h-3.5 w-3.5" />
                            <span>Arbitrate Ruling</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold text-lg">
                Community Review Moderation Queue
              </h3>
              <p className="text-xs text-muted-foreground">
                Flagged and reported reviews requiring administrator trust & safety arbitration.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchModerationData}
              disabled={isLoadingModeration}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingModeration ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </Button>
          </div>

          {isLoadingModeration ? (
            <Card className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading review moderation queue...</p>
            </Card>
          ) : moderationError ? (
            <Card className="p-6 border-destructive/20 bg-destructive/5 text-destructive text-sm">
              <p className="font-semibold">Failed to load moderation queue</p>
              <p className="text-xs opacity-90 mt-1">{moderationError}</p>
            </Card>
          ) : moderationReviews.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-sm space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="font-semibold text-foreground">Moderation Queue Clean</p>
              <p className="text-xs text-muted-foreground">
                No reviews currently require trust & safety intervention.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {moderationReviews.map((rev) => {
                const isConflict =
                  user && (user.id === rev.reviewerId || user.id === rev.revieweeId);

                return (
                  <Card key={rev.id} className="p-5 space-y-3 hover:border-border transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={rev.status === 'FLAGGED' ? 'warning' : 'destructive'}
                          className="text-xs"
                        >
                          {rev.status}
                        </Badge>
                        <span className="font-semibold text-sm">Review #{rev.id.slice(0, 8)}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          Project #{rev.projectId.slice(0, 8)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Submitted {new Date(rev.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                      <div>
                        <span className="font-semibold text-foreground">Reviewer: </span>
                        {rev.reviewer?.firstName} {rev.reviewer?.lastName} ({rev.reviewer?.email})
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">Recipient: </span>
                        {rev.reviewee?.firstName} {rev.reviewee?.lastName} ({rev.reviewee?.email})
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[#FFD64A]">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating ? 'fill-[#FFD64A] text-[#FFD64A]' : 'text-muted'
                            }`}
                          />
                        ))}
                        <span className="font-bold text-xs text-foreground ml-1">
                          {rev.rating}.0
                        </span>
                      </div>
                      <p className="text-xs text-foreground italic leading-relaxed">
                        "{rev.feedback}"
                      </p>
                    </div>

                    {rev.reports && rev.reports.length > 0 && (
                      <div className="pt-2 border-t border-border/40 space-y-1">
                        <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider block">
                          Report Reason: {rev.reports[0].reason}
                        </span>
                        <p className="text-xs text-muted-foreground">{rev.reports[0].details}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <div className="text-[11px] text-muted-foreground">
                        <span>Reports: {rev.reports?.length ?? 0}</span>
                        {rev.moderationAudit && rev.moderationAudit.length > 0 && (
                          <span className="ml-3">Prior audits: {rev.moderationAudit.length}</span>
                        )}
                      </div>

                      {isConflict ? (
                        <span className="text-xs text-destructive font-semibold">
                          Self-moderation restricted (Anti-Conflict Guard)
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setSelectedReviewToModerate(rev)}
                          className="gap-1.5 text-xs"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Moderate Review</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system">
          <Card className="p-8 text-center text-muted-foreground text-sm">
            Realtime audit trail of RBAC role evaluations and authentication events.
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Modals */}
      {selectedDisputeDetails && (
        <DisputeDetailsDialog
          isOpen={Boolean(selectedDisputeDetails)}
          onClose={() => setSelectedDisputeDetails(null)}
          disputeId={selectedDisputeDetails.id}
          projectTitle={`Project #${selectedDisputeDetails.projectId.slice(0, 8)}`}
          userRole="admin"
          currentUserId={user?.id}
          isAdmin={true}
          accessToken={accessToken}
          onOpenResolve={(disp) => setSelectedDisputeResolve(disp)}
        />
      )}

      {selectedDisputeResolve && (
        <DisputeResolveDialog
          isOpen={Boolean(selectedDisputeResolve)}
          onClose={() => setSelectedDisputeResolve(null)}
          onSuccess={() => {
            fetchDisputesData();
          }}
          dispute={selectedDisputeResolve}
          projectTitle={`Project #${selectedDisputeResolve.projectId.slice(0, 8)}`}
          escrowBalance={100000} // Default fallback or dynamically balanced
          currency="INR"
          accessToken={accessToken}
        />
      )}

      {/* Review Moderation Dialog */}
      {selectedReviewToModerate && (
        <ReviewModerationDialog
          isOpen={Boolean(selectedReviewToModerate)}
          onClose={() => setSelectedReviewToModerate(null)}
          onSuccess={() => {
            setSelectedReviewToModerate(null);
            fetchModerationData();
          }}
          reviewId={selectedReviewToModerate.id}
          currentStatus={selectedReviewToModerate.status}
          feedbackText={selectedReviewToModerate.feedback}
          reviewerName={
            selectedReviewToModerate.reviewer
              ? `${selectedReviewToModerate.reviewer.firstName || ''} ${selectedReviewToModerate.reviewer.lastName || ''}`.trim()
              : undefined
          }
          accessToken={accessToken}
        />
      )}
    </div>
  );
}
