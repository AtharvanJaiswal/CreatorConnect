/**
 * CreatorConnect — Phase 9: Verified Reviews, Rating Algorithms & Creator Reputation Service
 * Frontend domain rules, permission guards, mathematical helpers, input validation, and API transports.
 */

import type {
  ReviewResponse,
  ReviewReportResponse,
  ReviewModerationAuditResponse,
  ReputationSummaryResponse,
  CreateReviewBody,
  UpdateReviewBody,
  ReportReviewBody,
  ModerateReviewBody,
  PublicReviewsQuery,
  ModerationQueueQuery,
  PendingReviewProject,
} from '@creatorconnect/contracts';
import {
  formatRating as utilsFormatRating,
  calculateStarPercentages as utilsCalculateStarPercentages,
} from '@creatorconnect/utils';

export const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Checks whether an actor is eligible to submit a review on a project.
 * Requirements:
 * 1. Project must be strictly COMPLETED.
 * 2. Actor must be an authorized participant (client or talent).
 * 3. No active dispute freezing project finality.
 * 4. Actor must not have already submitted a review for this project.
 */
export function canSubmitReview(
  projectStatus: string,
  hasActiveDispute: boolean,
  existingReview: ReviewResponse | null,
  isParticipant: boolean,
): boolean {
  if (!isParticipant) return false;
  if (projectStatus !== 'COMPLETED') return false;
  if (hasActiveDispute) return false;
  if (existingReview !== null) return false;
  return true;
}

/**
 * Checks whether the author can edit an existing review.
 * Requirements:
 * 1. Actor must be the original reviewer.
 * 2. Review must not be in a moderated terminal status (HIDDEN or REMOVED).
 * 3. Submission must be within the 48-hour edit window.
 */
export function canEditReview(
  review: ReviewResponse,
  currentUserId: string,
): { canEdit: boolean; reason?: string } {
  if (review.reviewerId !== currentUserId) {
    return { canEdit: false, reason: 'You can only edit your own reviews.' };
  }
  if (review.status === 'HIDDEN' || review.status === 'REMOVED') {
    return {
      canEdit: false,
      reason: `Review is ${review.status.toLowerCase()} by moderation and cannot be edited.`,
    };
  }

  const ageMs = Date.now() - new Date(review.createdAt).getTime();
  if (ageMs > EDIT_WINDOW_MS) {
    return {
      canEdit: false,
      reason: 'The 48-hour edit window has expired. Reviews cannot be edited after 48 hours.',
    };
  }

  return { canEdit: true };
}

/**
 * Checks whether an actor can report a review.
 * Requirements:
 * 1. Review must not already be REMOVED.
 * 2. Author cannot report their own review.
 */
export function canReportReview(review: ReviewResponse, currentUserId: string): boolean {
  if (review.status === 'REMOVED') return false;
  if (review.reviewerId === currentUserId) return false;
  return true;
}

/**
 * Checks whether an admin is authorized to moderate a review.
 * Requirements:
 * 1. Must have ADMIN role.
 * 2. Anti-Conflict-of-Interest Guard: Admin cannot arbitrate reviews in which they are a participant (reviewer or reviewee).
 */
export function canModerateReview(
  review: { reviewerId: string; revieweeId: string },
  currentUserId: string,
  isAdmin: boolean,
): boolean {
  if (!isAdmin) return false;
  if (review.reviewerId === currentUserId || review.revieweeId === currentUserId) {
    return false;
  }
  return true;
}

/**
 * Checks whether a timestamp is within the 48-hour edit window.
 */
export function isWithin48Hours(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs <= EDIT_WINDOW_MS && ageMs >= 0;
}

/**
 * Formats a rating score consistently for presentation.
 * Returns formatted single decimal place string (e.g. "4.8") or "Unrated" for null.
 */
export const formatRating = utilsFormatRating;

/**
 * Computes star distribution percentages summing to ~100%.
 */
export function calculateStarPercentages(
  distribution: Record<number, number>,
  totalReviews: number,
): Record<number, number> {
  return utilsCalculateStarPercentages(distribution as any, totalReviews, true);
}

/**
 * Validates review creation input.
 */
export function validateReviewSubmission(input: CreateReviewBody): ValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    errors.push('Overall rating must be an integer between 1 and 5.');
  }

  if (!input.feedback || input.feedback.trim().length < 10) {
    errors.push('Feedback must be at least 10 characters long.');
  } else if (input.feedback.length > 2000) {
    errors.push('Feedback must not exceed 2000 characters.');
  }

  const categoryFields = ['communicationRating', 'qualityRating', 'adherenceRating'] as const;
  for (const cat of categoryFields) {
    const val = input[cat];
    if (val !== undefined && val !== null) {
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        errors.push(`${cat} must be an integer between 1 and 5.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates review update input.
 */
export function validateReviewUpdate(input: UpdateReviewBody): ValidationResult {
  const errors: string[] = [];

  if (input.rating !== undefined) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      errors.push('Overall rating must be an integer between 1 and 5.');
    }
  }

  if (input.feedback !== undefined) {
    if (input.feedback.trim().length < 10) {
      errors.push('Feedback must be at least 10 characters long.');
    } else if (input.feedback.length > 2000) {
      errors.push('Feedback must not exceed 2000 characters.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates report submission input.
 */
export function validateReviewReport(input: ReportReviewBody): ValidationResult {
  const errors: string[] = [];
  const validReasons = [
    'SPAM',
    'HARASSMENT',
    'DEFAMATION',
    'INAPPROPRIATE_CONTENT',
    'CONFLICT_OF_INTEREST',
    'OTHER',
  ];

  if (!validReasons.includes(input.reason)) {
    errors.push('Please select a valid report reason.');
  }

  if (!input.details || input.details.trim().length < 10) {
    errors.push('Report details must be at least 10 characters long.');
  } else if (input.details.length > 1000) {
    errors.push('Report details must not exceed 1000 characters.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates admin review moderation input.
 */
export function validateReviewModeration(input: ModerateReviewBody): ValidationResult {
  const errors: string[] = [];
  const validActions = ['FLAG', 'HIDE', 'REMOVE', 'RESTORE'];

  if (!validActions.includes(input.action)) {
    errors.push('Action must be one of FLAG, HIDE, REMOVE, or RESTORE.');
  }

  if (!input.reason || input.reason.trim().length < 5) {
    errors.push('Moderation reason must be at least 5 characters long.');
  } else if (input.reason.length > 500) {
    errors.push('Moderation reason must not exceed 500 characters.');
  }

  if (input.internalNotes && input.internalNotes.length > 1000) {
    errors.push('Internal notes must not exceed 1000 characters.');
  }

  return { valid: errors.length === 0, errors };
}

// ==============================================================================
// API Transports
// ==============================================================================

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || data.message || `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

export async function submitProjectReview(
  projectId: string,
  input: CreateReviewBody,
  token?: string | null,
): Promise<ReviewResponse> {
  const validation = validateReviewSubmission(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function updateReview(
  reviewId: string,
  input: UpdateReviewBody,
  token?: string | null,
): Promise<ReviewResponse> {
  const validation = validateReviewUpdate(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const res = await fetch(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function fetchProjectReviews(
  projectId: string,
  token?: string | null,
): Promise<ReviewResponse[]> {
  const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/reviews`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function fetchReviewById(
  reviewId: string,
  token?: string | null,
): Promise<ReviewResponse> {
  const res = await fetch(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function fetchUserReputation(
  userId: string,
  token?: string | null,
): Promise<ReputationSummaryResponse> {
  const res = await fetch(`/api/v1/users/${encodeURIComponent(userId)}/reputation`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function fetchUserReviews(
  userId: string,
  query?: PublicReviewsQuery,
  token?: string | null,
): Promise<{ items: ReviewResponse[]; nextCursor: string | null }> {
  const searchParams = new URLSearchParams();
  if (query?.limit) searchParams.set('limit', String(query.limit));
  if (query?.cursor) searchParams.set('cursor', query.cursor);
  if (query?.minRating) searchParams.set('minRating', String(query.minRating));

  const qs = searchParams.toString();
  const url = `/api/v1/users/${encodeURIComponent(userId)}/reviews${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function reportReview(
  reviewId: string,
  input: ReportReviewBody,
  token?: string | null,
): Promise<ReviewReportResponse> {
  const validation = validateReviewReport(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const res = await fetch(`/api/v1/reviews/${encodeURIComponent(reviewId)}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function moderateReview(
  reviewId: string,
  input: ModerateReviewBody,
  token?: string | null,
): Promise<{ review: ReviewResponse; audit: ReviewModerationAuditResponse }> {
  const validation = validateReviewModeration(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const res = await fetch(`/api/v1/reviews/${encodeURIComponent(reviewId)}/moderate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function fetchModerationQueue(
  query?: ModerationQueueQuery,
  token?: string | null,
): Promise<{ items: any[]; nextCursor: string | null }> {
  const searchParams = new URLSearchParams();
  if (query?.limit) searchParams.set('limit', String(query.limit));
  if (query?.cursor) searchParams.set('cursor', query.cursor);
  if (query?.status) searchParams.set('status', query.status);

  const qs = searchParams.toString();
  const url = `/api/v1/reviews/moderation-queue${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function fetchPendingReviews(token?: string | null): Promise<PendingReviewProject[]> {
  const res = await fetch('/api/v1/reviews/pending', {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errorMsg = await parseApiError(res);
    throw new Error(errorMsg);
  }

  return res.json();
}
