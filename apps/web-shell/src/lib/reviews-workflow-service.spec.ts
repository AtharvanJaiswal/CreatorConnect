import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  canSubmitReview,
  canEditReview,
  canReportReview,
  canModerateReview,
  isWithin48Hours,
  formatRating,
  calculateStarPercentages,
  validateReviewSubmission,
  validateReviewUpdate,
  validateReviewReport,
  validateReviewModeration,
  submitProjectReview,
  updateReview,
  fetchUserReputation,
  fetchPendingReviews,
  reportReview,
  moderateReview,
  EDIT_WINDOW_MS,
} from './reviews-workflow-service';
import type { ReviewResponse } from '@creatorconnect/contracts';

describe('Phase 9: Reviews Workflow Service Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Permission & Invariant Guards', () => {
    it('enforces canSubmitReview invariants', () => {
      // Eligible: completed, no dispute, no existing review, is participant
      expect(canSubmitReview('COMPLETED', false, null, true)).toBe(true);

      // Ineligible: not participant
      expect(canSubmitReview('COMPLETED', false, null, false)).toBe(false);

      // Ineligible: project not completed
      expect(canSubmitReview('IN_PROGRESS', false, null, true)).toBe(false);
      expect(canSubmitReview('CANCELLED', false, null, true)).toBe(false);

      // Ineligible: active dispute freezing project
      expect(canSubmitReview('COMPLETED', true, null, true)).toBe(false);

      // Ineligible: already reviewed
      const mockReview: ReviewResponse = {
        id: 'rev-1',
        projectId: 'proj-1',
        reviewerId: 'user-1',
        revieweeId: 'user-2',
        rating: 5,
        feedback: 'Great work done on this project.',
        status: 'PUBLISHED',
        editCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(canSubmitReview('COMPLETED', false, mockReview, true)).toBe(false);
    });

    it('enforces canEditReview 48-hour window and author ownership', () => {
      const recentDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const expiredDate = new Date(Date.now() - (EDIT_WINDOW_MS + 3600000)).toISOString(); // 49 hours ago

      const authorReview: ReviewResponse = {
        id: 'rev-1',
        projectId: 'proj-1',
        reviewerId: 'author-1',
        revieweeId: 'recipient-1',
        rating: 5,
        feedback: 'Initial great feedback.',
        status: 'PUBLISHED',
        editCount: 0,
        createdAt: recentDate,
        updatedAt: recentDate,
      };

      // Allowed: author within 48h
      expect(canEditReview(authorReview, 'author-1').canEdit).toBe(true);

      // Denied: non-author
      const nonAuthorCheck = canEditReview(authorReview, 'different-user');
      expect(nonAuthorCheck.canEdit).toBe(false);
      expect(nonAuthorCheck.reason).toContain('only edit your own reviews');

      // Denied: expired 48h window
      const expiredReview: ReviewResponse = {
        ...authorReview,
        createdAt: expiredDate,
      };
      const expiredCheck = canEditReview(expiredReview, 'author-1');
      expect(expiredCheck.canEdit).toBe(false);
      expect(expiredCheck.reason).toContain('48-hour edit window has expired');

      // Denied: moderated reviews (HIDDEN / REMOVED)
      const hiddenReview: ReviewResponse = {
        ...authorReview,
        status: 'HIDDEN',
      };
      const hiddenCheck = canEditReview(hiddenReview, 'author-1');
      expect(hiddenCheck.canEdit).toBe(false);
      expect(hiddenCheck.reason).toContain('moderation');
    });

    it('enforces canReportReview invariants', () => {
      const mockReview: ReviewResponse = {
        id: 'rev-1',
        projectId: 'proj-1',
        reviewerId: 'author-1',
        revieweeId: 'recipient-1',
        rating: 4,
        feedback: 'Feedback text for review report testing.',
        status: 'PUBLISHED',
        editCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Counterparty can report
      expect(canReportReview(mockReview, 'recipient-1')).toBe(true);

      // Third party can report
      expect(canReportReview(mockReview, 'third-party-user')).toBe(true);

      // Author CANNOT report their own review
      expect(canReportReview(mockReview, 'author-1')).toBe(false);

      // Cannot report already REMOVED reviews
      expect(canReportReview({ ...mockReview, status: 'REMOVED' }, 'recipient-1')).toBe(false);
    });

    it('enforces canModerateReview and Anti-Conflict-of-Interest Guard', () => {
      const reviewParticipants = {
        reviewerId: 'client-user',
        revieweeId: 'talent-user',
      };

      // Allowed for neutral admin
      expect(canModerateReview(reviewParticipants, 'neutral-admin-id', true)).toBe(true);

      // Denied for non-admin
      expect(canModerateReview(reviewParticipants, 'neutral-user-id', false)).toBe(false);

      // Denied for admin who was the reviewer (Conflict of Interest)
      expect(canModerateReview(reviewParticipants, 'client-user', true)).toBe(false);

      // Denied for admin who was the reviewee (Conflict of Interest)
      expect(canModerateReview(reviewParticipants, 'talent-user', true)).toBe(false);
    });

    it('correctly calculates isWithin48Hours', () => {
      const now = new Date().toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

      expect(isWithin48Hours(now)).toBe(true);
      expect(isWithin48Hours(oneDayAgo)).toBe(true);
      expect(isWithin48Hours(threeDaysAgo)).toBe(false);
    });
  });

  describe('Presentation & Mathematical Helpers', () => {
    it('formats rating values properly', () => {
      expect(formatRating(4.8333)).toBe('4.8');
      expect(formatRating(5)).toBe('5.0');
      expect(formatRating(null)).toBe('Unrated');
      expect(formatRating(undefined)).toBe('Unrated');
    });

    it('calculates star distribution percentages accurately', () => {
      const distribution = { 1: 0, 2: 1, 3: 1, 4: 3, 5: 5 };
      const percentages = calculateStarPercentages(distribution, 10);

      expect(percentages[5]).toBe(50);
      expect(percentages[4]).toBe(30);
      expect(percentages[3]).toBe(10);
      expect(percentages[2]).toBe(10);
      expect(percentages[1]).toBe(0);

      // Empty set
      expect(calculateStarPercentages(distribution, 0)).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    });
  });

  describe('Input Validation', () => {
    it('validates review submission inputs', () => {
      expect(
        validateReviewSubmission({
          rating: 5,
          feedback: 'Valid feedback text exceeding 10 characters.',
        }).valid,
      ).toBe(true);

      // Invalid rating
      expect(
        validateReviewSubmission({
          rating: 6,
          feedback: 'Valid feedback text exceeding 10 characters.',
        }).valid,
      ).toBe(false);

      // Short feedback
      expect(
        validateReviewSubmission({
          rating: 4,
          feedback: 'Too short',
        }).valid,
      ).toBe(false);
    });

    it('validates review update inputs', () => {
      expect(
        validateReviewUpdate({
          rating: 4,
          feedback: 'Updated valid feedback text.',
        }).valid,
      ).toBe(true);

      expect(
        validateReviewUpdate({
          feedback: 'Short',
        }).valid,
      ).toBe(false);
    });

    it('validates review report inputs', () => {
      expect(
        validateReviewReport({
          reason: 'SPAM',
          details: 'This review contains advertising links.',
        }).valid,
      ).toBe(true);

      expect(
        validateReviewReport({
          reason: 'INVALID_REASON' as any,
          details: 'Some text',
        }).valid,
      ).toBe(false);
    });

    it('validates review moderation inputs', () => {
      expect(
        validateReviewModeration({
          action: 'HIDE',
          reason: 'Review violates platform guidelines regarding profanity.',
        }).valid,
      ).toBe(true);

      expect(
        validateReviewModeration({
          action: 'INVALID' as any,
          reason: 'Short',
        }).valid,
      ).toBe(false);
    });
  });

  describe('API Transports', () => {
    it('submits review successfully via POST', async () => {
      const mockResult = { id: 'rev-1', rating: 5 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await submitProjectReview(
        'proj-1',
        { rating: 5, feedback: 'Excellent milestone delivery.' },
        'jwt-token',
      );

      expect(res).toEqual(mockResult);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/projects/proj-1/reviews',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
        }),
      );
    });

    it('updates review successfully via PATCH', async () => {
      const mockResult = { id: 'rev-1', rating: 4 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await updateReview('rev-1', { rating: 4 }, 'jwt-token');
      expect(res).toEqual(mockResult);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/reviews/rev-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('fetches user reputation successfully via GET', async () => {
      const mockReputation = { totalReviews: 5, averageRating: 4.8 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockReputation,
      });

      const res = await fetchUserReputation('user-1');
      expect(res).toEqual(mockReputation);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/user-1/reputation',
        expect.anything(),
      );
    });

    it('reports review successfully via POST', async () => {
      const mockReport = { id: 'rep-1', reason: 'SPAM' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockReport,
      });

      const res = await reportReview(
        'rev-1',
        { reason: 'SPAM', details: 'Promotional spam content in review.' },
        'jwt-token',
      );
      expect(res).toEqual(mockReport);
    });

    it('moderates review successfully via POST', async () => {
      const mockOutcome = { review: { id: 'rev-1', status: 'HIDDEN' }, audit: { id: 'aud-1' } };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOutcome,
      });

      const res = await moderateReview(
        'rev-1',
        { action: 'HIDE', reason: 'Verified platform harassment policy violation.' },
        'admin-token',
      );
      expect(res).toEqual(mockOutcome);
    });

    it('handles API error responses cleanly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          detail: 'REVIEW_ALREADY_EXISTS: You have already reviewed this project.',
        }),
      });

      await expect(
        submitProjectReview(
          'proj-1',
          { rating: 5, feedback: 'Second attempt review feedback.' },
          'jwt-token',
        ),
      ).rejects.toThrow('REVIEW_ALREADY_EXISTS');
    });

    it('fetches pending reviews for current user via GET /api/v1/reviews/pending', async () => {
      const mockPending = [
        {
          projectId: 'proj-1',
          projectTitle: 'Completed Commercial Brief',
          completedAt: new Date().toISOString(),
          counterparty: {
            id: 'user-2',
            name: 'Alex Talent',
            avatarUrl: null,
            role: 'CREATOR',
          },
        },
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPending,
      });

      const res = await fetchPendingReviews('jwt-token');
      expect(res).toEqual(mockPending);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/reviews/pending',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token',
          }),
        }),
      );
    });
  });
});
