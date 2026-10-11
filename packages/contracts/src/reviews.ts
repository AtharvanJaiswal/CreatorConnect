import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, IsoDateTimeSchema } from '@creatorconnect/validation';

export const ReviewStatusSchema = Type.Union([
  Type.Literal('PUBLISHED'),
  Type.Literal('FLAGGED'),
  Type.Literal('HIDDEN'),
  Type.Literal('REMOVED'),
]);
export type ReviewStatus = Static<typeof ReviewStatusSchema>;

export const ReviewReportReasonSchema = Type.Union([
  Type.Literal('SPAM'),
  Type.Literal('HARASSMENT'),
  Type.Literal('DEFAMATION'),
  Type.Literal('INAPPROPRIATE_CONTENT'),
  Type.Literal('CONFLICT_OF_INTEREST'),
  Type.Literal('OTHER'),
]);
export type ReviewReportReason = Static<typeof ReviewReportReasonSchema>;

export const ReviewReportStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('INVESTIGATING'),
  Type.Literal('RESOLVED'),
  Type.Literal('DISMISSED'),
]);
export type ReviewReportStatus = Static<typeof ReviewReportStatusSchema>;

export const ReviewModerationActionTypeSchema = Type.Union([
  Type.Literal('FLAG'),
  Type.Literal('HIDE'),
  Type.Literal('REMOVE'),
  Type.Literal('RESTORE'),
]);
export type ReviewModerationActionType = Static<typeof ReviewModerationActionTypeSchema>;

export const ReviewResponseSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  reviewerId: UuidSchema,
  revieweeId: UuidSchema,
  rating: Type.Integer({ minimum: 1, maximum: 5 }),
  communicationRating: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1, maximum: 5 }), Type.Null()]),
  ),
  qualityRating: Type.Optional(Type.Union([Type.Integer({ minimum: 1, maximum: 5 }), Type.Null()])),
  adherenceRating: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1, maximum: 5 }), Type.Null()]),
  ),
  feedback: Type.String(),
  status: ReviewStatusSchema,
  editCount: Type.Integer({ minimum: 0 }),
  editedAt: Type.Optional(Type.Union([IsoDateTimeSchema, Type.Null()])),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ReviewResponse = Static<typeof ReviewResponseSchema>;

export const CreateReviewBodySchema = Type.Object({
  rating: Type.Integer({ minimum: 1, maximum: 5 }),
  communicationRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  qualityRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  adherenceRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  feedback: Type.String({ minLength: 10, maxLength: 2000 }),
});
export type CreateReviewBody = Static<typeof CreateReviewBodySchema>;

export const UpdateReviewBodySchema = Type.Object({
  rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  communicationRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  qualityRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  adherenceRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  feedback: Type.Optional(Type.String({ minLength: 10, maxLength: 2000 })),
});
export type UpdateReviewBody = Static<typeof UpdateReviewBodySchema>;

export const ReportReviewBodySchema = Type.Object({
  reason: ReviewReportReasonSchema,
  details: Type.String({ minLength: 10, maxLength: 1000 }),
});
export type ReportReviewBody = Static<typeof ReportReviewBodySchema>;

export const ReviewReportResponseSchema = Type.Object({
  id: UuidSchema,
  reviewId: UuidSchema,
  reporterId: UuidSchema,
  reason: ReviewReportReasonSchema,
  details: Type.String(),
  status: ReviewReportStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ReviewReportResponse = Static<typeof ReviewReportResponseSchema>;

export const ModerateReviewBodySchema = Type.Object({
  action: ReviewModerationActionTypeSchema,
  reason: Type.String({ minLength: 5, maxLength: 500 }),
  internalNotes: Type.Optional(Type.String({ maxLength: 1000 })),
});
export type ModerateReviewBody = Static<typeof ModerateReviewBodySchema>;

export const ReviewModerationAuditResponseSchema = Type.Object({
  id: UuidSchema,
  reviewId: UuidSchema,
  moderatorId: UuidSchema,
  actionType: ReviewModerationActionTypeSchema,
  fromStatus: ReviewStatusSchema,
  toStatus: ReviewStatusSchema,
  reason: Type.String(),
  internalNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: IsoDateTimeSchema,
});
export type ReviewModerationAuditResponse = Static<typeof ReviewModerationAuditResponseSchema>;

export const RatingDistributionSchema = Type.Object({
  1: Type.Integer({ minimum: 0 }),
  2: Type.Integer({ minimum: 0 }),
  3: Type.Integer({ minimum: 0 }),
  4: Type.Integer({ minimum: 0 }),
  5: Type.Integer({ minimum: 0 }),
});
export type RatingDistribution = Static<typeof RatingDistributionSchema>;

export const CategoryAveragesSchema = Type.Object({
  communication: Type.Union([Type.Number(), Type.Null()]),
  quality: Type.Union([Type.Number(), Type.Null()]),
  adherence: Type.Union([Type.Number(), Type.Null()]),
});
export type CategoryAverages = Static<typeof CategoryAveragesSchema>;

export const ReputationSummaryResponseSchema = Type.Object({
  userId: UuidSchema,
  totalReviews: Type.Integer({ minimum: 0 }),
  averageRating: Type.Union([Type.Number(), Type.Null()]),
  bayesianScore: Type.Union([Type.Number(), Type.Null()]),
  ratingDistribution: RatingDistributionSchema,
  categoryAverages: CategoryAveragesSchema,
});
export type ReputationSummaryResponse = Static<typeof ReputationSummaryResponseSchema>;

export const PublicReviewsQuerySchema = Type.Object({
  cursor: Type.Optional(UuidSchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  minRating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
});
export type PublicReviewsQuery = Static<typeof PublicReviewsQuerySchema>;

export const ModerationQueueQuerySchema = Type.Object({
  cursor: Type.Optional(UuidSchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  status: Type.Optional(ReviewStatusSchema),
});
export type ModerationQueueQuery = Static<typeof ModerationQueueQuerySchema>;

export const ProjectReviewParamsSchema = Type.Object({
  id: UuidSchema,
});
export type ProjectReviewParams = Static<typeof ProjectReviewParamsSchema>;

export const ReviewIdParamsSchema = Type.Object({
  id: UuidSchema,
});
export type ReviewIdParams = Static<typeof ReviewIdParamsSchema>;

export const UserReviewParamsSchema = Type.Object({
  userId: UuidSchema,
});
export type UserReviewParams = Static<typeof UserReviewParamsSchema>;
