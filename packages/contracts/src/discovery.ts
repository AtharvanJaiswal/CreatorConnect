import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
} from '@creatorconnect/validation';
import { AssignmentResponseSchema } from './assignments.js';
import { ProfileVisibilitySchema } from './profiles.js';

// ==============================================================================
// Assignments Search
// ==============================================================================

export const SearchAssignmentsQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200 })),
  categoryId: Type.Optional(UuidSchema),
  budgetMin: Type.Optional(Type.Integer({ minimum: 0 })),
  budgetMax: Type.Optional(Type.Integer({ minimum: 0 })),
  isRemote: Type.Optional(Type.Boolean()),
  location: Type.Optional(Type.String({ maxLength: 100 })),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type SearchAssignmentsQuery = Static<typeof SearchAssignmentsQuerySchema>;

export const SearchAssignmentsResponseSchema = Type.Object({
  items: Type.Array(AssignmentResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
});
export type SearchAssignmentsResponse = Static<typeof SearchAssignmentsResponseSchema>;

// ==============================================================================
// Creator Match Explanation & Discovered Creator Profile
// ==============================================================================

export const MatchExplanationResponseSchema = Type.Object({
  type: Type.Union([
    Type.Literal('skill'),
    Type.Literal('category'),
    Type.Literal('budget'),
    Type.Literal('rating'),
    Type.Literal('experience'),
    Type.Literal('verification'),
    Type.Literal('availability'),
  ]),
  summary: Type.String(),
  detail: Type.Optional(Type.String()),
  contributionPercent: Type.Optional(Type.Integer()),
});
export type MatchExplanationResponse = Static<typeof MatchExplanationResponseSchema>;

export const DiscoveredCreatorResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  displayName: Type.String(),
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
  tagline: Type.Union([Type.String(), Type.Null()]),
  bio: Type.Union([Type.String(), Type.Null()]),
  locationCountry: Type.Union([Type.String(), Type.Null()]),
  locationCity: Type.Union([Type.String(), Type.Null()]),
  isRemote: Type.Boolean(),
  startingRate: Type.Union([MinorUnitsSchema, Type.Null()]),
  currency: CurrencyCodeSchema,
  visibility: ProfileVisibilitySchema,
  isVerified: Type.Boolean(),
  isAvailable: Type.Boolean(),
  completionScore: Type.Integer({ minimum: 0, maximum: 100 }),
  averageRating: Type.Union([Type.Number(), Type.Null()]),
  eligibleReviewCount: Type.Integer({ minimum: 0 }),
  completedProjectsCount: Type.Integer({ minimum: 0 }),
  categories: Type.Array(
    Type.Object({
      id: UuidSchema,
      slug: Type.String(),
      name: Type.String(),
    }),
  ),
  skills: Type.Array(
    Type.Object({
      id: UuidSchema,
      slug: Type.String(),
      name: Type.String(),
      proficiency: Type.Optional(Type.String()),
    }),
  ),
  matchScore: Type.Number(),
  matchPercentage: Type.Integer({ minimum: 0, maximum: 100 }),
  matchExplanations: Type.Array(MatchExplanationResponseSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type DiscoveredCreatorResponse = Static<typeof DiscoveredCreatorResponseSchema>;

// ==============================================================================
// Creators Search & Discovery Query / Response
// ==============================================================================

export const SearchCreatorsQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200 })),
  categoryId: Type.Optional(UuidSchema),
  skillId: Type.Optional(UuidSchema),
  skillIds: Type.Optional(Type.Array(UuidSchema, { maxItems: 20 })),
  locationCountry: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
  locationCity: Type.Optional(Type.String({ maxLength: 100 })),
  isRemote: Type.Optional(Type.Boolean()),
  rateMin: Type.Optional(Type.Integer({ minimum: 0 })),
  rateMax: Type.Optional(Type.Integer({ minimum: 0 })),
  minRating: Type.Optional(Type.Number({ minimum: 1, maximum: 5 })),
  minCompletedProjects: Type.Optional(Type.Integer({ minimum: 0 })),
  isVerified: Type.Optional(Type.Boolean()),
  isAvailable: Type.Optional(Type.Boolean()),
  sortBy: Type.Optional(
    Type.Union([
      Type.Literal('relevance'),
      Type.Literal('rating'),
      Type.Literal('completedProjects'),
      Type.Literal('rateAsc'),
      Type.Literal('rateDesc'),
      Type.Literal('newest'),
    ]),
  ),
  sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  matchProjectId: Type.Optional(UuidSchema),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type SearchCreatorsQuery = Static<typeof SearchCreatorsQuerySchema>;

export const SearchCreatorsResponseSchema = Type.Object({
  items: Type.Array(DiscoveredCreatorResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
  totalMatches: Type.Optional(Type.Integer()),
  matchProjectContext: Type.Optional(
    Type.Object({
      id: UuidSchema,
      title: Type.String(),
    }),
  ),
});
export type SearchCreatorsResponse = Static<typeof SearchCreatorsResponseSchema>;
