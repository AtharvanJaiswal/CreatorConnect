import { generateUuidV7 } from '@creatorconnect/utils';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ProjectNotReviewableError,
  ReviewAlreadyExistsError,
  ReviewNotFoundError,
  ReviewEditWindowExpiredError,
  ReviewAlreadyModeratedError,
  ReviewReportAlreadyExistsError,
  SelfReviewNotAllowedError,
  SelfModerationNotAllowedError,
  NotProjectParticipantError,
} from '../../errors/app-error.js';
import type {
  CreateReviewBody,
  UpdateReviewBody,
  ReportReviewBody,
  ModerateReviewBody,
  PublicReviewsQuery,
  ModerationQueueQuery,
  ReviewStatus,
} from '@creatorconnect/contracts';
import { ReviewsRepository } from './reviews.repository.js';
import { ReputationService } from './reputation.service.js';

export class ReviewsService {
  constructor(
    private repo = new ReviewsRepository(),
    private reputationService = new ReputationService(),
  ) {}

  /**
   * 48-hour editing window allowed for reviewers after creation.
   */
  private static readonly EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

  async createReview(callerUserId: string, projectId: string, input: CreateReviewBody) {
    const project = await this.repo.findProjectById(projectId);
    if (!project) {
      throw new NotFoundError(`Project with id '${projectId}' not found.`);
    }

    // 1. Eligibility Check: Project must be in COMPLETED status
    if (project.status !== 'COMPLETED') {
      throw new ProjectNotReviewableError(
        `Project is in '${project.status}' status. Only COMPLETED projects can receive reviews.`,
      );
    }

    // 2. Eligibility Check: Cannot review if there is an active, unresolved dispute
    const activeDispute = project.disputes?.find((d) =>
      ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED'].includes(d.status),
    );
    if (activeDispute) {
      throw new ProjectNotReviewableError(
        'Project cannot be reviewed while an active dispute is open and unresolved.',
      );
    }

    // 3. Authorization Check: Caller must be a project participant
    let revieweeId: string;
    if (callerUserId === project.clientId) {
      revieweeId = project.talentId;
    } else if (callerUserId === project.talentId) {
      revieweeId = project.clientId;
    } else {
      throw new NotProjectParticipantError(
        'Only project participants (client or talent) are authorized to submit a review.',
      );
    }

    // 4. Anti-Self-Review Guard
    if (callerUserId === revieweeId) {
      throw new SelfReviewNotAllowedError('You cannot submit a review for yourself.');
    }

    // 5. Uniqueness Guard: Only one review per (projectId, reviewerId)
    const existing = await this.repo.findByProjectAndReviewer(projectId, callerUserId);
    if (existing) {
      throw new ReviewAlreadyExistsError(
        'You have already submitted a review for this project. Use edit within 48 hours to make changes.',
      );
    }

    const reviewId = generateUuidV7();

    try {
      const review = await this.repo.createReview(
        {
          id: reviewId,
          projectId,
          reviewerId: callerUserId,
          revieweeId,
          rating: input.rating,
          communicationRating: input.communicationRating ?? null,
          qualityRating: input.qualityRating ?? null,
          adherenceRating: input.adherenceRating ?? null,
          feedback: input.feedback,
          status: 'PUBLISHED',
        },
        {
          reviewId,
          projectId,
          reviewerId: callerUserId,
          revieweeId,
          rating: input.rating,
        },
      );

      return review;
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint failed')) {
        throw new ReviewAlreadyExistsError(
          'You have already submitted a review for this project. Use edit within 48 hours to make changes.',
        );
      }
      throw err;
    }
  }

  async updateReview(callerUserId: string, reviewId: string, input: UpdateReviewBody) {
    const review = await this.repo.findById(reviewId);
    if (!review) {
      throw new ReviewNotFoundError(`Review with id '${reviewId}' not found.`);
    }

    // 1. Authorization: Only reviewer can update
    if (review.reviewerId !== callerUserId) {
      throw new ForbiddenError('You can only edit your own reviews.');
    }

    // 2. Moderation Guard: Moderated/removed reviews cannot be edited
    if (review.status === 'HIDDEN' || review.status === 'REMOVED') {
      throw new ReviewAlreadyModeratedError(
        `Review is in '${review.status}' status and cannot be edited.`,
      );
    }

    // 3. Time Window Guard: 48-hour limit
    const ageMs = Date.now() - new Date(review.createdAt).getTime();
    if (ageMs > ReviewsService.EDIT_WINDOW_MS) {
      throw new ReviewEditWindowExpiredError(
        'The 48-hour edit window has expired. Reviews cannot be modified after this period.',
      );
    }

    const updated = await this.repo.updateReview(
      reviewId,
      {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.communicationRating !== undefined
          ? { communicationRating: input.communicationRating }
          : {}),
        ...(input.qualityRating !== undefined ? { qualityRating: input.qualityRating } : {}),
        ...(input.adherenceRating !== undefined ? { adherenceRating: input.adherenceRating } : {}),
        ...(input.feedback !== undefined ? { feedback: input.feedback } : {}),
      },
      {
        reviewId,
        reviewerId: callerUserId,
        revieweeId: review.revieweeId,
        editCount: review.editCount + 1,
      },
    );

    return updated;
  }

  async getReview(reviewId: string, callerUserId?: string, isAdmin = false) {
    const review = await this.repo.findById(reviewId);
    if (!review) {
      throw new ReviewNotFoundError(`Review with id '${reviewId}' not found.`);
    }

    // Private moderation filter
    if (['HIDDEN', 'REMOVED'].includes(review.status)) {
      const isParticipant =
        callerUserId === review.reviewerId || callerUserId === review.revieweeId;
      if (!isAdmin && !isParticipant) {
        throw new ReviewNotFoundError(`Review with id '${reviewId}' not found.`);
      }
    }

    return review;
  }

  async listProjectReviews(projectId: string, callerUserId?: string, isAdmin = false) {
    const project = await this.repo.findProjectById(projectId);
    if (!project) {
      throw new NotFoundError(`Project with id '${projectId}' not found.`);
    }

    const reviews = await this.repo.listProjectReviews(projectId);

    // Filter hidden/removed reviews from third-parties
    return reviews.filter((r) => {
      if (['PUBLISHED', 'FLAGGED'].includes(r.status)) return true;
      if (isAdmin) return true;
      return callerUserId === r.reviewerId || callerUserId === r.revieweeId;
    });
  }

  async listUserReviews(userId: string, query: PublicReviewsQuery) {
    return this.repo.listPublicReviewsForUser(userId, query);
  }

  async getUserReputation(userId: string) {
    return this.reputationService.getReputationSummary(userId);
  }

  async reportReview(callerUserId: string, reviewId: string, input: ReportReviewBody) {
    const review = await this.repo.findById(reviewId);
    if (!review) {
      throw new ReviewNotFoundError(`Review with id '${reviewId}' not found.`);
    }

    if (review.status === 'REMOVED') {
      throw new BadRequestError('Cannot report a review that has already been removed.');
    }

    // Check duplicate report by the same user
    const existing = await this.repo.findReport(reviewId, callerUserId);
    if (existing) {
      throw new ReviewReportAlreadyExistsError(
        'You have already submitted a report for this review.',
      );
    }

    const reportId = generateUuidV7();
    const shouldFlag = review.status === 'PUBLISHED';

    try {
      const report = await this.repo.createReport(
        {
          id: reportId,
          reviewId,
          reporterId: callerUserId,
          reason: input.reason,
          details: input.details,
        },
        shouldFlag,
        {
          reportId,
          reviewId,
          reporterId: callerUserId,
          reason: input.reason,
        },
      );

      return report;
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint failed')) {
        throw new ReviewReportAlreadyExistsError(
          'You have already submitted a report for this review.',
        );
      }
      throw err;
    }
  }

  async moderateReview(adminUserId: string, reviewId: string, input: ModerateReviewBody) {
    const review = await this.repo.findById(reviewId);
    if (!review) {
      throw new ReviewNotFoundError(`Review with id '${reviewId}' not found.`);
    }

    // Anti-Conflict-of-Interest Guard: Admin cannot moderate their own review or reviews about them
    if (adminUserId === review.reviewerId || adminUserId === review.revieweeId) {
      throw new SelfModerationNotAllowedError(
        'Administrators cannot arbitrate or moderate reviews in which they are a participant.',
      );
    }

    let toStatus: ReviewStatus;
    switch (input.action) {
      case 'HIDE':
        toStatus = 'HIDDEN';
        break;
      case 'REMOVE':
        toStatus = 'REMOVED';
        break;
      case 'RESTORE':
        toStatus = 'PUBLISHED';
        break;
      case 'FLAG':
        toStatus = 'FLAGGED';
        break;
      default:
        throw new BadRequestError(`Invalid moderation action: '${input.action}'.`);
    }

    const auditId = generateUuidV7();

    const result = await this.repo.moderateReview(
      reviewId,
      {
        id: auditId,
        moderatorId: adminUserId,
        actionType: input.action,
        fromStatus: review.status as ReviewStatus,
        toStatus,
        reason: input.reason,
        internalNotes: input.internalNotes ?? null,
      },
      {
        reviewId,
        moderatorId: adminUserId,
        actionType: input.action,
        fromStatus: review.status,
        toStatus,
        reason: input.reason,
      },
    );

    return result;
  }

  async listModerationQueue(_adminUserId: string, query: ModerationQueueQuery) {
    return this.repo.listModerationQueue(query);
  }

  async getPendingReviews(userId: string) {
    return this.repo.findPendingReviewsForUser(userId);
  }
}
