'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge, Button } from '@creatorconnect/ui';
import {
  Users,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';

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

  const [assignment, setAssignment] = useState<any>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setConflictError(null);
    try {
      const [assignRes, appsRes] = await Promise.all([
        fetch(`/api/v1/assignments/${assignmentId}`),
        fetch(`/api/v1/assignments/${assignmentId}/applications`),
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
    if (assignmentId) {
      loadData();
    }
  }, [assignmentId]);

  const handleStatusTransition = async (
    applicationId: string,
    targetStatus: 'SHORTLISTED' | 'REJECTED',
  ) => {
    setActionInProgressId(applicationId);
    setConflictError(null);

    try {
      const res = await fetch(`/api/v1/applications/${applicationId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          reason: targetStatus === 'SHORTLISTED' ? 'QUALIFIED_CANDIDATE' : 'NOT_SELECTED',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
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
      const res = await fetch(`/api/v1/assignments/${assignmentId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const err = await res.json();
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
    <div className="container max-w-6xl px-4 sm:px-8 py-10 space-y-8">
      {/* Top breadcrumb */}
      <Link href={`/assignments/${assignmentId}`}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Brief</span>
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="default" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Brand Review Cockpit</span>
            </Badge>
            <span className="text-xs text-muted-foreground">Version: v{assignment?.version}</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
            Review Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Brief: <strong>{assignment?.title}</strong> ({applications.length} proposals received)
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Refresh List</span>}
        </Button>
      </div>

      {/* Concurrency Conflict Banner */}
      {conflictError && (
        <Card
          glass
          className="p-4 border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-3"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-medium">
            <div className="font-bold">Concurrency / Optimistic Lock Notice</div>
            <div className="text-xs mt-0.5 opacity-90">{conflictError}</div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Sync Latest Data
          </Button>
        </Card>
      )}

      {/* Applications List */}
      <div className="space-y-4">
        {loading && applications.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            Loading applicant submissions...
          </div>
        )}

        {!loading && applications.length === 0 && (
          <Card glass className="p-12 text-center space-y-3">
            <Users className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="font-heading font-bold text-lg">No proposals yet</h3>
            <p className="text-xs text-muted-foreground">
              Proposals submitted by creators and production freelancers will appear here.
            </p>
          </Card>
        )}

        {applications.map((app) => (
          <Card
            key={app.id}
            glass
            className={`p-6 transition-all ${
              app.status === 'ACCEPTED'
                ? 'border-success/60 bg-success/5 shadow-md shadow-success/10'
                : app.status === 'REJECTED' || app.status === 'WITHDRAWN'
                  ? 'opacity-60 border-border/40'
                  : 'hover:border-primary/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <Badge
                    variant={
                      app.status === 'ACCEPTED'
                        ? 'default'
                        : app.status === 'SHORTLISTED'
                          ? 'secondary'
                          : app.status === 'REJECTED' || app.status === 'WITHDRAWN'
                            ? 'destructive'
                            : 'outline'
                    }
                    className="text-xs font-semibold"
                  >
                    {app.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Applied {new Date(app.createdAt).toLocaleDateString()} (v{app.version})
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Creative Pitch / Proposal
                  </div>
                  <p className="text-sm text-foreground/90 mt-1 leading-relaxed whitespace-pre-line">
                    {app.coverLetter}
                  </p>
                </div>

                <div className="flex items-center gap-6 pt-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Proposed Rate: </span>
                    <span className="font-bold text-foreground">
                      {app.proposedRate
                        ? `₹${app.proposedRate.toLocaleString('en-IN')}`
                        : 'Included in brief'}
                    </span>
                  </div>
                  {app.durationDays && (
                    <div>
                      <span className="text-muted-foreground">Turnaround: </span>
                      <span className="font-bold text-foreground">{app.durationDays} days</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                {app.status === 'SUBMITTED' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusTransition(app.id, 'SHORTLISTED')}
                      disabled={actionInProgressId === app.id}
                      className="gap-1 text-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>Shortlist</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStatusTransition(app.id, 'REJECTED')}
                      disabled={actionInProgressId === app.id}
                      className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Decline</span>
                    </Button>
                  </div>
                )}

                {app.status === 'SHORTLISTED' && assignment?.status === 'PUBLISHED' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAtomicAccept(app)}
                      disabled={actionInProgressId === app.id}
                      className="gap-1.5 text-xs shadow-sm font-semibold bg-success hover:bg-success/90 text-success-foreground"
                    >
                      {actionInProgressId === app.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span>Accept & Hire</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStatusTransition(app.id, 'REJECTED')}
                      disabled={actionInProgressId === app.id}
                      className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Decline</span>
                    </Button>
                  </div>
                )}

                {app.status === 'ACCEPTED' && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Hired & Escrow Triggered</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
