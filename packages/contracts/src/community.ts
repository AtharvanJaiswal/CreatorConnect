import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, IsoDateTimeSchema } from '@creatorconnect/validation';

// ==============================================================================
// Enums & Literals
// ==============================================================================

export const CommunityPostTypeSchema = Type.Union([
  Type.Literal('ANNOUNCEMENT'),
  Type.Literal('OPPORTUNITY'),
  Type.Literal('DISCUSSION'),
  Type.Literal('EVENT'),
  Type.Literal('QUESTION'),
]);
export type CommunityPostType = Static<typeof CommunityPostTypeSchema>;

export const CommunityPostStatusSchema = Type.Union([
  Type.Literal('ACTIVE'),
  Type.Literal('HIDDEN'),
  Type.Literal('DELETED'),
]);
export type CommunityPostStatus = Static<typeof CommunityPostStatusSchema>;

export const CommunityEventStatusSchema = Type.Union([
  Type.Literal('UPCOMING'),
  Type.Literal('ONGOING'),
  Type.Literal('COMPLETED'),
  Type.Literal('CANCELLED'),
]);
export type CommunityEventStatus = Static<typeof CommunityEventStatusSchema>;

export const EventRsvpStatusSchema = Type.Union([
  Type.Literal('CONFIRMED'),
  Type.Literal('CANCELLED'),
]);
export type EventRsvpStatus = Static<typeof EventRsvpStatusSchema>;

// ==============================================================================
// Author Summary
// ==============================================================================

export const CommunityAuthorSummarySchema = Type.Object({
  id: UuidSchema,
  name: Type.String(),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
  role: Type.Union([Type.String(), Type.Null()]),
  isVerified: Type.Boolean(),
  initials: Type.String(),
});
export type CommunityAuthorSummary = Static<typeof CommunityAuthorSummarySchema>;

// ==============================================================================
// Posts
// ==============================================================================

export const CreateCommunityPostInputSchema = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 200 }),
  body: Type.String({ minLength: 10, maxLength: 10000 }),
  type: Type.Optional(CommunityPostTypeSchema),
  city: Type.Optional(Type.String({ minLength: 2, maxLength: 50 })),
  tags: Type.Optional(Type.Array(Type.String({ maxLength: 30 }), { maxItems: 10 })),
  linkedAssignmentId: Type.Optional(UuidSchema),
  linkedEventId: Type.Optional(UuidSchema),
});
export type CreateCommunityPostInput = Static<typeof CreateCommunityPostInputSchema>;

export const CommunityPostItemSchema = Type.Object({
  id: UuidSchema,
  authorId: UuidSchema,
  author: CommunityAuthorSummarySchema,
  type: CommunityPostTypeSchema,
  title: Type.String(),
  body: Type.String(),
  city: Type.String(),
  tags: Type.Array(Type.String()),
  isPinned: Type.Boolean(),
  status: CommunityPostStatusSchema,
  linkedAssignmentId: Type.Union([UuidSchema, Type.Null()]),
  linkedAssignment: Type.Union([
    Type.Object({
      id: UuidSchema,
      title: Type.String(),
      budgetMin: Type.Integer(),
      budgetMax: Type.Integer(),
      currency: Type.String(),
    }),
    Type.Null(),
  ]),
  linkedEventId: Type.Union([UuidSchema, Type.Null()]),
  linkedEvent: Type.Union([
    Type.Object({
      id: UuidSchema,
      title: Type.String(),
      venue: Type.String(),
      eventDate: IsoDateTimeSchema,
      rsvpCount: Type.Integer(),
    }),
    Type.Null(),
  ]),
  applaudsCount: Type.Integer(),
  hasApplauded: Type.Boolean(),
  commentsCount: Type.Integer(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CommunityPostItem = Static<typeof CommunityPostItemSchema>;

export const CommunityPostListResponseSchema = Type.Object({
  items: Type.Array(CommunityPostItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  total: Type.Integer(),
});
export type CommunityPostListResponse = Static<typeof CommunityPostListResponseSchema>;

// ==============================================================================
// Comments
// ==============================================================================

export const CreateCommunityCommentInputSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 2000 }),
});
export type CreateCommunityCommentInput = Static<typeof CreateCommunityCommentInputSchema>;

export const CommunityCommentItemSchema = Type.Object({
  id: UuidSchema,
  postId: UuidSchema,
  authorId: UuidSchema,
  author: CommunityAuthorSummarySchema,
  content: Type.String(),
  applaudsCount: Type.Integer(),
  createdAt: IsoDateTimeSchema,
});
export type CommunityCommentItem = Static<typeof CommunityCommentItemSchema>;

export const CommunityCommentListResponseSchema = Type.Object({
  items: Type.Array(CommunityCommentItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  total: Type.Integer(),
});
export type CommunityCommentListResponse = Static<typeof CommunityCommentListResponseSchema>;

// ==============================================================================
// Events & RSVPs
// ==============================================================================

export const CreateCommunityEventInputSchema = Type.Object({
  title: Type.String({ minLength: 3, maxLength: 200 }),
  description: Type.String({ minLength: 10, maxLength: 10000 }),
  city: Type.String({ minLength: 2, maxLength: 50 }),
  venue: Type.String({ minLength: 3, maxLength: 255 }),
  eventDate: IsoDateTimeSchema,
  endDate: Type.Optional(IsoDateTimeSchema),
  capacity: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
  isOfficial: Type.Optional(Type.Boolean()),
});
export type CreateCommunityEventInput = Static<typeof CreateCommunityEventInputSchema>;

export const CommunityEventItemSchema = Type.Object({
  id: UuidSchema,
  organizerId: UuidSchema,
  organizer: CommunityAuthorSummarySchema,
  title: Type.String(),
  description: Type.String(),
  city: Type.String(),
  venue: Type.String(),
  eventDate: IsoDateTimeSchema,
  endDate: Type.Union([IsoDateTimeSchema, Type.Null()]),
  isOfficial: Type.Boolean(),
  capacity: Type.Union([Type.Integer(), Type.Null()]),
  rsvpCount: Type.Integer(),
  isRsvpd: Type.Boolean(),
  status: CommunityEventStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type CommunityEventItem = Static<typeof CommunityEventItemSchema>;

export const CommunityEventListResponseSchema = Type.Object({
  items: Type.Array(CommunityEventItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  total: Type.Integer(),
});
export type CommunityEventListResponse = Static<typeof CommunityEventListResponseSchema>;

export const RsvpEventInputSchema = Type.Object({
  status: Type.Optional(EventRsvpStatusSchema),
});
export type RsvpEventInput = Static<typeof RsvpEventInputSchema>;

export const EventRsvpResponseSchema = Type.Object({
  eventId: UuidSchema,
  userId: UuidSchema,
  status: EventRsvpStatusSchema,
  rsvpCount: Type.Integer(),
});
export type EventRsvpResponse = Static<typeof EventRsvpResponseSchema>;

// ==============================================================================
// Hub Follows
// ==============================================================================

export const FollowHubInputSchema = Type.Object({
  city: Type.String({ minLength: 2, maxLength: 50 }),
});
export type FollowHubInput = Static<typeof FollowHubInputSchema>;

export const HubFollowResponseSchema = Type.Object({
  city: Type.String(),
  isFollowing: Type.Boolean(),
  totalFollowers: Type.Integer(),
});
export type HubFollowResponse = Static<typeof HubFollowResponseSchema>;

export const UserFollowedHubsResponseSchema = Type.Object({
  cities: Type.Array(Type.String()),
});
export type UserFollowedHubsResponse = Static<typeof UserFollowedHubsResponseSchema>;

// ==============================================================================
// Moderation
// ==============================================================================

export const ModerateCommunityPostInputSchema = Type.Object({
  action: Type.Union([Type.Literal('HIDE'), Type.Literal('UNHIDE'), Type.Literal('DELETE')]),
  reason: Type.String({ minLength: 3, maxLength: 500 }),
});
export type ModerateCommunityPostInput = Static<typeof ModerateCommunityPostInputSchema>;
