'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge, Button, Input, Textarea } from '@creatorconnect/ui';
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
} from 'lucide-react';

export default function AssignmentDetailPage() {
  const params = useParams();
  const assignmentId = params?.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Proposal form state
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedRate, setProposedRate] = useState('');
  const [durationDays, setDurationDays] = useState('7');

  useEffect(() => {
    async function loadAssignment() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/assignments/${assignmentId}`);
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
  }, [assignmentId]);

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/assignments/${assignmentId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverLetter,
          proposedRate: proposedRate ? parseInt(proposedRate, 10) : undefined,
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
      <div className="container max-w-4xl py-16 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Loading assignment brief...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="container max-w-4xl py-16 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-warning mx-auto" />
        <h2 className="text-xl font-bold font-heading">Assignment Brief Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The brief you are looking for may have been closed or removed.
        </p>
        <Link href="/discovery">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Discovery</span>
          </Button>
        </Link>
      </div>
    );
  }

  const isExpired = new Date(assignment.deadline).getTime() < Date.now();

  return (
    <div className="container max-w-5xl px-4 sm:px-8 py-10 space-y-8">
      {/* Back button */}
      <Link href="/discovery">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Briefs</span>
        </Button>
      </Link>

      {/* Brief Header */}
      <div className="space-y-4 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{assignment.status}</Badge>
          {isExpired ? (
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" />
              <span>Deadline Expired</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              <span>Deadline: {new Date(assignment.deadline).toLocaleDateString()}</span>
            </Badge>
          )}
        </div>

        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
          {assignment.title}
        </h1>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>
            Brand Client: <strong>{assignment.brand?.companyName || 'Enterprise Partner'}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Scope & Deliverables */}
        <div className="lg:col-span-2 space-y-6">
          <Card glass className="p-6 space-y-4">
            <h3 className="font-heading font-bold text-lg">Project Description</h3>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {assignment.description}
            </p>
          </Card>

          {assignment.requirements && assignment.requirements.length > 0 && (
            <Card glass className="p-6 space-y-4">
              <h3 className="font-heading font-bold text-lg">Deliverables & Requirements</h3>
              <div className="space-y-2.5">
                {assignment.requirements.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-2.5 text-sm p-3 rounded-lg bg-muted/40 border border-border/40"
                  >
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{r.title}</div>
                      {r.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                      )}
                    </div>
                    {r.isMandatory && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-primary border-primary/30"
                      >
                        Mandatory
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Apply Proposal Card */}
        <div className="space-y-6">
          <Card glass className="p-6 space-y-6 border-primary/20">
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Budget Allocation
              </div>
              <div className="text-2xl font-extrabold font-heading mt-1">
                ₹{assignment.budgetMin?.toLocaleString('en-IN') || '0'} - ₹
                {assignment.budgetMax?.toLocaleString('en-IN') || 'Flexible'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Secured via CreatorConnect Milestone Escrow
              </div>
            </div>

            {success ? (
              <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                <h4 className="font-bold text-sm text-foreground">Proposal Submitted!</h4>
                <p className="text-xs text-muted-foreground">
                  The brand will review your proposal under transactional row-lock protection.
                </p>
              </div>
            ) : isExpired ? (
              <div className="p-4 rounded-xl bg-muted/60 border border-border text-center space-y-2">
                <Lock className="h-6 w-6 text-muted-foreground mx-auto" />
                <div className="font-semibold text-sm">Brief is Closed</div>
                <p className="text-xs text-muted-foreground">
                  No further proposals are accepted for this assignment.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitProposal} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Cover Letter / Creative Pitch *
                  </label>
                  <Textarea
                    required
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Describe your approach, equipment, past relevant experience..."
                    rows={4}
                    className="text-xs resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Proposed Rate (INR)
                  </label>
                  <Input
                    type="number"
                    value={proposedRate}
                    onChange={(e) => setProposedRate(e.target.value)}
                    placeholder="e.g. 25000"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Estimated Turnaround (Days)
                  </label>
                  <Input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    placeholder="e.g. 7"
                    className="text-xs"
                  />
                </div>

                {error && (
                  <div className="text-xs font-medium text-destructive p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !coverLetter.trim()}
                  className="w-full gap-2 shadow-sm font-semibold"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>Submit Proposal</span>
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
