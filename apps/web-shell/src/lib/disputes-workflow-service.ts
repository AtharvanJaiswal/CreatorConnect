/**
 * CreatorConnect — Phase 8: Disputes, Cancellations & Refund Workflow Service
 * Client-side domain rules, role permissions, input validation, and API transport.
 */

import type {
  DisputeResponse,
  DisputeEvidenceResponse,
  DisputeStatus,
  ProjectCancellationResponse,
  RefundResponse,
  OpenDisputeInput,
  AddDisputeEvidenceInput,
  UpdateDisputeStatusInput,
  ResolveDisputeInput,
  RequestCancellationInput,
  DecideCancellationInput,
} from '@creatorconnect/contracts';

export type UserProjectRole = 'client' | 'creator' | 'admin' | 'viewer';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Checks whether an actor can open a dispute.
 * Requirements:
 * - Must be client, creator, or admin.
 * - Project must not be in a terminal state (CANCELLED).
 * - There must be no currently open/active dispute on the project.
 */
export function canOpenDispute(
  projectStatus: string,
  userRole: UserProjectRole,
  hasActiveDispute: boolean,
): boolean {
  if (userRole === 'viewer') return false;
  if (projectStatus === 'CANCELLED') return false;
  if (hasActiveDispute) return false;
  return true;
}

/**
 * Checks whether an actor can request project cancellation.
 * Requirements:
 * - Must be client, creator, or admin.
 * - Project must not already be CANCELLED or COMPLETED.
 * - No pending cancellation request already exists.
 * - No active dispute is currently freezing the project.
 */
export function canRequestCancellation(
  projectStatus: string,
  userRole: UserProjectRole,
  hasPendingCancellation: boolean,
  hasActiveDispute: boolean,
): boolean {
  if (userRole === 'viewer') return false;
  if (projectStatus === 'CANCELLED' || projectStatus === 'COMPLETED') return false;
  if (hasPendingCancellation) return false;
  if (hasActiveDispute) return false;
  return true;
}

/**
 * Checks whether an actor can decide on a pending cancellation request.
 * Mutual consent rule: The requester CANNOT decide their own request; only the counterparty or ADMIN can decide.
 */
export function canDecideCancellation(
  cancellation: ProjectCancellationResponse,
  currentUserId: string,
  isAdmin: boolean,
): boolean {
  if (cancellation.status !== 'PENDING') return false;
  if (isAdmin) return true;
  return cancellation.requestedById !== currentUserId;
}

/**
 * Checks whether an actor can withdraw their pending cancellation request.
 * Only the original requester (or an ADMIN) can withdraw while still PENDING.
 */
export function canWithdrawCancellation(
  cancellation: ProjectCancellationResponse,
  currentUserId: string,
  isAdmin: boolean,
): boolean {
  if (cancellation.status !== 'PENDING') return false;
  return isAdmin || cancellation.requestedById === currentUserId;
}

/**
 * Checks whether an actor can resolve a dispute.
 * Strict authority: Only ADMIN users may resolve disputes.
 * Dispute must be in an actionable state (OPEN, UNDER_REVIEW, EVIDENCE_REQUESTED).
 */
export function canResolveDispute(status: DisputeStatus, isAdmin: boolean): boolean {
  if (!isAdmin) return false;
  return status === 'OPEN' || status === 'UNDER_REVIEW' || status === 'EVIDENCE_REQUESTED';
}

/**
 * Checks whether an actor can submit evidence to an active dispute.
 * Allowed while dispute is not terminal (not RESOLVED or CLOSED).
 */
export function canAddEvidence(status: DisputeStatus, userRole: UserProjectRole): boolean {
  if (userRole === 'viewer') return false;
  return status === 'OPEN' || status === 'UNDER_REVIEW' || status === 'EVIDENCE_REQUESTED';
}

/**
 * Validates open dispute input data.
 */
export function validateOpenDispute(data: {
  reason?: string | undefined;
  description: string;
}): ValidationResult {
  const errors: string[] = [];
  if (!data.reason) {
    errors.push('A valid dispute reason category is required.');
  }
  if (!data.description || data.description.trim().length < 10) {
    errors.push('Dispute explanation must be at least 10 characters long.');
  }
  if (data.description && data.description.length > 5000) {
    errors.push('Dispute explanation must not exceed 5,000 characters.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates dispute evidence submission.
 */
export function validateAddEvidence(data: {
  title: string;
  description?: string | undefined;
}): ValidationResult {
  const errors: string[] = [];
  if (!data.title || data.title.trim().length === 0) {
    errors.push('Evidence title is required.');
  }
  if (data.title && data.title.length > 150) {
    errors.push('Evidence title must not exceed 150 characters.');
  }
  if (data.description && data.description.length > 5000) {
    errors.push('Evidence description must not exceed 5,000 characters.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates cancellation request input.
 */
export function validateCancellationRequest(data: { reason: string }): ValidationResult {
  const errors: string[] = [];
  if (!data.reason || data.reason.trim().length < 5) {
    errors.push('Cancellation reason must be at least 5 characters long.');
  }
  if (data.reason && data.reason.length > 5000) {
    errors.push('Cancellation reason must not exceed 5,000 characters.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates administrative dispute resolution.
 */
export function validateResolveDispute(data: {
  resolution?: string | undefined;
  resolutionReason: string;
  refundAmount?: number | undefined;
  escrowBalance?: number | undefined;
}): ValidationResult {
  const errors: string[] = [];
  if (data.resolution !== 'RESOLVED_FOR_CLIENT' && data.resolution !== 'RESOLVED_FOR_CREATOR') {
    errors.push('Resolution decision must be either RESOLVED_FOR_CLIENT or RESOLVED_FOR_CREATOR.');
  }
  if (!data.resolutionReason || data.resolutionReason.trim().length < 5) {
    errors.push('A formal resolution reason (minimum 5 characters) is required.');
  }
  if (data.resolutionReason && data.resolutionReason.length > 5000) {
    errors.push('Resolution reason must not exceed 5,000 characters.');
  }
  if (data.refundAmount !== undefined && data.refundAmount !== null) {
    if (data.refundAmount < 0) {
      errors.push('Refund amount cannot be negative.');
    }
    if (
      data.escrowBalance !== undefined &&
      data.escrowBalance !== null &&
      data.refundAmount > data.escrowBalance
    ) {
      errors.push(
        `Refund amount (${data.refundAmount}) cannot exceed escrow balance (${data.escrowBalance}).`,
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Helper to parse ProblemDetails or standard JSON errors safely.
 */
export async function parseApiError(res: Response, fallbackMessage: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.detail) return String(data.detail);
    if (data?.title) return String(data.title);
    if (data?.message) return String(data.message);
    if (data?.error) return String(data.error);
  } catch {
    // Ignore JSON parse failure and return fallback
  }
  return `${fallbackMessage} (HTTP ${res.status})`;
}

// ==============================================================================
// API Transport Functions
// ==============================================================================

/**
 * API: Open a Dispute
 */
export async function openDispute(
  input: OpenDisputeInput,
  token?: string | null,
): Promise<DisputeResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/v1/disputes', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to open dispute.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: List Disputes
 */
export async function listDisputes(
  query?: { projectId?: string; status?: DisputeStatus },
  token?: string | null,
): Promise<DisputeResponse[]> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const params = new URLSearchParams();
  if (query?.projectId) params.set('projectId', query.projectId);
  if (query?.status) params.set('status', query.status);

  const url = `/api/v1/disputes${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to list disputes.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Get Dispute Details (with evidence & history)
 */
export async function getDispute(
  disputeId: string,
  token?: string | null,
): Promise<DisputeResponse> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/disputes/${disputeId}`, { headers });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to load dispute details.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Add Dispute Evidence
 */
export async function addDisputeEvidence(
  disputeId: string,
  input: AddDisputeEvidenceInput,
  token?: string | null,
): Promise<DisputeEvidenceResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/disputes/${disputeId}/evidence`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to upload dispute evidence.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Update Dispute Lifecycle Status (Admin only)
 */
export async function updateDisputeStatus(
  disputeId: string,
  input: UpdateDisputeStatusInput,
  token?: string | null,
): Promise<DisputeResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/disputes/${disputeId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to update dispute status.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Resolve Dispute (Admin only)
 */
export async function resolveDispute(
  disputeId: string,
  input: ResolveDisputeInput,
  token?: string | null,
): Promise<DisputeResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/disputes/${disputeId}/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to resolve dispute.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Close Dispute (Admin only)
 */
export async function closeDispute(
  disputeId: string,
  token?: string | null,
): Promise<DisputeResponse> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/disputes/${disputeId}/close`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to close dispute.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Request Mutual Project Cancellation
 */
export async function requestCancellation(
  projectId: string,
  input: RequestCancellationInput,
  token?: string | null,
): Promise<ProjectCancellationResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/cancellations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to request cancellation.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: List Project Cancellations
 */
export async function listCancellations(
  projectId: string,
  token?: string | null,
): Promise<ProjectCancellationResponse[]> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/cancellations`, { headers });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to load project cancellation history.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Decide Cancellation (Approve/Reject)
 */
export async function decideCancellation(
  projectId: string,
  cancellationId: string,
  input: DecideCancellationInput,
  token?: string | null,
): Promise<ProjectCancellationResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/cancellations/${cancellationId}/decide`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to decide on cancellation request.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Withdraw Cancellation
 */
export async function withdrawCancellation(
  projectId: string,
  cancellationId: string,
  token?: string | null,
): Promise<ProjectCancellationResponse> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `/api/v1/projects/${projectId}/cancellations/${cancellationId}/withdraw`,
    {
      method: 'POST',
      headers,
    },
  );

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to withdraw cancellation request.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API: Fetch Refunds for a Payment Intent
 */
export async function fetchPaymentRefunds(
  paymentIntentId: string,
  token?: string | null,
): Promise<RefundResponse[]> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/payments/intents/${paymentIntentId}/refunds`, { headers });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to retrieve payment refund history.');
    throw new Error(errorMsg);
  }
  return res.json();
}
