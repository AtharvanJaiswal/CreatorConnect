/**
 * CreatorConnect — Phase 7: Milestone & Deliverable Workflow Service
 * Encapsulates client-side domain rules, permission guards, submission validation,
 * attachment scanning verification, and API transport with idempotency.
 */

import type {
  ProjectResponse,
  ProjectDeliverableResponse,
  DeliverableSubmissionResponse,
  DeliverableAttachmentResponse,
  DeliverableStatus,
  SubmitDeliverableInput,
  ReviewDeliverableInput,
  CreateProjectDeliverableInput,
  UpdateProjectDeliverableInput,
} from '@creatorconnect/contracts';
import { generateUuidV7 } from '@creatorconnect/utils';

export type AttachmentScanStatus =
  'UPLOADING' | 'PENDING_SCAN' | 'ACTIVE' | 'REJECTED_INVALID' | 'QUARANTINED';

export interface DeliverableAttachmentItem {
  assetId: string;
  filename: string;
  byteSize: number;
  mimeType: string;
  status: AttachmentScanStatus;
  downloadUrl?: string | null;
  error?: string;
}

export interface SubmissionFormData {
  submissionNotes: string;
  attachments: DeliverableAttachmentItem[];
}

export interface ReviewFormData {
  action: 'APPROVE' | 'REQUEST_REVISION';
  notes?: string;
}

export interface EscrowReleaseState {
  balance: number;
  currency: string;
  isReleasing: boolean;
  released: boolean;
  error: string | null;
}

/**
 * Validates whether the creator actor is permitted to submit a deliverable.
 * Only PENDING and REVISION_REQUESTED states allow new submissions.
 */
export function canCreatorSubmit(status: DeliverableStatus): boolean {
  return status === 'PENDING' || status === 'REVISION_REQUESTED';
}

/**
 * Validates whether the client actor is permitted to review a deliverable.
 * Only SUBMITTED states allow client review.
 */
export function canClientReview(status: DeliverableStatus): boolean {
  return status === 'SUBMITTED';
}

/**
 * Validates whether milestone parameters can be edited.
 * Once a milestone is APPROVED, edits are locked.
 */
export function canEditMilestone(status: DeliverableStatus): boolean {
  return status !== 'APPROVED';
}

/**
 * Evaluates whether escrow can be released for a project.
 * All deliverables must be approved and a positive escrow balance must exist.
 */
export function canReleaseEscrow(
  deliverables: ProjectDeliverableResponse[],
  escrowBalance: number,
): boolean {
  if (!deliverables || deliverables.length === 0) return false;
  const allApproved = deliverables.every((d) => d.status === 'APPROVED');
  return allApproved && escrowBalance > 0;
}

/**
 * Validates deliverable submission form data.
 * Enforces attachment safety: submissions with pending scan or rejected files are blocked.
 */
export function validateSubmission(data: SubmissionFormData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.submissionNotes || data.submissionNotes.trim().length < 5) {
    errors.push('Submission description must be at least 5 characters long.');
  }

  if (data.attachments && data.attachments.length > 0) {
    const hasPendingScan = data.attachments.some(
      (a) => a.status === 'PENDING_SCAN' || a.status === 'UPLOADING',
    );
    if (hasPendingScan) {
      errors.push('One or more attachments are still undergoing security and malware scanning.');
    }

    const hasRejected = data.attachments.some(
      (a) => a.status === 'REJECTED_INVALID' || a.status === 'QUARANTINED',
    );
    if (hasRejected) {
      errors.push(
        'One or more attachments were rejected by security scanning and cannot be submitted.',
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates client review form data.
 * Revision requests strictly require meaningful feedback (minimum 10 characters).
 */
export function validateReview(data: ReviewFormData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (data.action === 'REQUEST_REVISION') {
    if (!data.notes || data.notes.trim().length < 10) {
      errors.push('Detailed revision feedback is required (at least 10 characters).');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates an idempotency key for network retries and duplicate click protection.
 */
export function generateIdempotencyKey(): string {
  return generateUuidV7();
}

/**
 * Extracts standard RFC 7807 error messages from API responses.
 */
export async function parseApiError(res: Response, fallbackMessage: string): Promise<string> {
  try {
    const json = await res.json();
    return json.detail || json.title || json.message || fallbackMessage;
  } catch {
    return `${fallbackMessage} (${res.status} ${res.statusText})`;
  }
}

/**
 * Uploads a file via CreatorConnect's 3-step media service:
 * 1. Request presigned upload URL
 * 2. Upload binary payload to S3/R2
 * 3. Confirm upload and enqueue virus/mime scan
 */
export async function uploadDeliverableAttachment(
  file: File,
  token?: string | null,
): Promise<DeliverableAttachmentItem> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Request presigned upload URL
  const urlRes = await fetch('/api/v1/media/upload-url', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      purpose: 'DELIVERABLE',
    }),
  });

  if (!urlRes.ok) {
    const errorMsg = await parseApiError(urlRes, 'Failed to obtain secure upload URL.');
    throw new Error(errorMsg);
  }

  const { uploadUrl, assetId } = await urlRes.json();

  // 2. Direct binary PUT to storage
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error('Direct storage upload failed.');
  }

  // 3. Confirm upload byte verification
  const confirmRes = await fetch('/api/v1/media/upload-confirm', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      assetId,
      uploadedSizeBytes: file.size,
    }),
  });

  if (!confirmRes.ok) {
    const errorMsg = await parseApiError(confirmRes, 'Failed to confirm file upload.');
    throw new Error(errorMsg);
  }

  const asset = await confirmRes.json();

  return {
    assetId: asset.id,
    filename: asset.originalName || file.name,
    byteSize: asset.byteSize || file.size,
    mimeType: asset.mimeType || file.type,
    status: (asset.status as AttachmentScanStatus) || 'ACTIVE',
  };
}

/**
 * API Transport: Fetch Project Details
 */
export async function fetchProjectDetails(
  projectId: string,
  token?: string | null,
): Promise<ProjectResponse> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}`, { headers });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Could not load project details.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Fetch Project Milestones
 */
export async function fetchProjectMilestones(
  projectId: string,
  token?: string | null,
): Promise<ProjectDeliverableResponse[]> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/milestones`, { headers });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Could not load project milestones.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Fetch Deliverable Submission History
 */
export async function fetchDeliverableSubmissions(
  projectId: string,
  deliverableId: string,
  token?: string | null,
): Promise<DeliverableSubmissionResponse[]> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `/api/v1/projects/${projectId}/deliverables/${deliverableId}/submissions`,
    { headers },
  );
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Could not load submission history.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Fetch Deliverable Attachment Metadata and Download URL
 */
export async function fetchDeliverableAttachment(
  projectId: string,
  deliverableId: string,
  assetId: string,
  token?: string | null,
): Promise<DeliverableAttachmentResponse> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `/api/v1/projects/${projectId}/deliverables/${deliverableId}/attachments/${assetId}`,
    { headers },
  );
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Could not retrieve authorized attachment.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Submit Deliverable (Creator Action)
 */
export async function submitDeliverable(
  projectId: string,
  deliverableId: string,
  input: SubmitDeliverableInput,
  token?: string | null,
): Promise<ProjectDeliverableResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/deliverables/${deliverableId}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Deliverable submission failed.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Review Deliverable (Client Action)
 */
export async function reviewDeliverable(
  projectId: string,
  deliverableId: string,
  input: ReviewDeliverableInput,
  token?: string | null,
): Promise<ProjectDeliverableResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/deliverables/${deliverableId}/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Deliverable review failed.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Fetch Escrow Balance
 */
export async function fetchEscrowBalance(
  projectId: string,
  token?: string | null,
): Promise<{ balance: number; currency: string }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/payments/projects/${projectId}/escrow/balance`, { headers });
  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Could not retrieve escrow balance.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Release Escrow (Client / Admin Action)
 */
export async function releaseEscrow(
  projectId: string,
  token?: string | null,
): Promise<{ releasedAmount: number; currency: string }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/payments/projects/${projectId}/escrow/release`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Escrow release failed.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Create Milestone
 */
export async function createMilestone(
  projectId: string,
  input: CreateProjectDeliverableInput,
  token?: string | null,
): Promise<ProjectDeliverableResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/milestones`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to create milestone.');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * API Transport: Update Milestone
 */
export async function updateMilestone(
  projectId: string,
  deliverableId: string,
  input: UpdateProjectDeliverableInput,
  token?: string | null,
): Promise<ProjectDeliverableResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/projects/${projectId}/milestones/${deliverableId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res, 'Failed to update milestone.');
    throw new Error(errorMsg);
  }
  return res.json();
}
