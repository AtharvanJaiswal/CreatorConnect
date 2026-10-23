import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema } from '@creatorconnect/validation';
import { AssignmentResponseSchema } from './assignments.js';
import { CreatorProfileResponseSchema } from './profiles.js';

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

export const SearchCreatorsQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 200 })),
  categoryId: Type.Optional(UuidSchema),
  skillId: Type.Optional(UuidSchema),
  locationCountry: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
  locationCity: Type.Optional(Type.String({ maxLength: 100 })),
  isRemote: Type.Optional(Type.Boolean()),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type SearchCreatorsQuery = Static<typeof SearchCreatorsQuerySchema>;

export const SearchCreatorsResponseSchema = Type.Object({
  items: Type.Array(CreatorProfileResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
});
export type SearchCreatorsResponse = Static<typeof SearchCreatorsResponseSchema>;

// ==============================================================================
// Module D — Home, Discovery, Search & Public Profiles Contracts
// ==============================================================================

export const ModuleDProfileCardSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  name: Type.String(),
  handle: Type.String(),
  role: Type.String(),
  avatarUrl: Type.Optional(Type.String()),
  category: Type.String(),
  city: Type.String(),
  state: Type.Optional(Type.String()),
  rating: Type.Number(),
  reviewCount: Type.Integer(),
  startingRate: Type.Integer(),
  rateRange: Type.String(),
  deliverableTags: Type.Array(Type.String()),
  followersCount: Type.Integer(),
  followersFormatted: Type.String(),
  isVerified: Type.Boolean(),
  isOnline: Type.Boolean(),
  matchReason: Type.Optional(Type.String()),
  bioSnippet: Type.Optional(Type.String()),
  portfolioThumbnails: Type.Optional(Type.Array(Type.String())),
});
export type ModuleDProfileCard = Static<typeof ModuleDProfileCardSchema>;

export const DiscoverQuerySchema = Type.Object({
  role: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  includeNearby: Type.Optional(Type.Boolean()),
  minFollowers: Type.Optional(Type.Integer({ minimum: 0 })),
  maxFollowers: Type.Optional(Type.Integer({ minimum: 0 })),
  minRate: Type.Optional(Type.Integer({ minimum: 0 })),
  maxRate: Type.Optional(Type.Integer({ minimum: 0 })),
  verifiedOnly: Type.Optional(Type.Boolean()),
  availableNow: Type.Optional(Type.Boolean()),
  hasPortfolio: Type.Optional(Type.Boolean()),
  minRating: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
  sort: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.String({ maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type DiscoverQuery = Static<typeof DiscoverQuerySchema>;

export const DiscoverResponseSchema = Type.Object({
  items: Type.Array(ModuleDProfileCardSchema),
  totalCount: Type.Integer(),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
});
export type DiscoverResponse = Static<typeof DiscoverResponseSchema>;

export const AutocompleteQuerySchema = Type.Object({
  q: Type.String({ minLength: 1, maxLength: 100 }),
});
export type AutocompleteQuery = Static<typeof AutocompleteQuerySchema>;

export const AutocompleteResponseSchema = Type.Object({
  niches: Type.Array(Type.String()),
  skills: Type.Array(Type.String()),
  locations: Type.Array(Type.String()),
  profiles: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      handle: Type.String(),
      role: Type.String(),
      avatarUrl: Type.Optional(Type.String()),
    }),
  ),
});
export type AutocompleteResponse = Static<typeof AutocompleteResponseSchema>;

export const RecommendationsResponseSchema = Type.Object({
  items: Type.Array(ModuleDProfileCardSchema),
});
export type RecommendationsResponse = Static<typeof RecommendationsResponseSchema>;

export const HomeDashboardResponseSchema = Type.Object({
  role: Type.String(),
  completionPercentage: Type.Integer({ minimum: 0, maximum: 100 }),
  greeting: Type.String(),
  stats: Type.Record(Type.String(), Type.Any()),
  alert: Type.Optional(
    Type.Object({
      id: Type.String(),
      title: Type.String(),
      message: Type.String(),
      cta: Type.String(),
      link: Type.String(),
    }),
  ),
  recommendations: Type.Array(ModuleDProfileCardSchema),
  opportunities: Type.Optional(Type.Array(Type.Any())),
  campaignPipeline: Type.Optional(Type.Array(Type.Any())),
  featuredCreators: Type.Optional(Type.Array(ModuleDProfileCardSchema)),
});
export type HomeDashboardResponse = Static<typeof HomeDashboardResponseSchema>;

export const PublicProfileResponseSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  name: Type.String(),
  handle: Type.String(),
  role: Type.String(),
  avatarUrl: Type.Optional(Type.String()),
  coverUrl: Type.Optional(Type.String()),
  isVerified: Type.Boolean(),
  city: Type.String(),
  state: Type.Optional(Type.String()),
  bio: Type.String(),
  followersCount: Type.Integer(),
  followersFormatted: Type.String(),
  rating: Type.Number(),
  reviewCount: Type.Integer(),
  collabsCompleted: Type.Integer(),
  ratePerDeliverable: Type.String(),
  deliverableTags: Type.Array(Type.String()),
  socialLinks: Type.Array(
    Type.Object({
      platform: Type.String(),
      handle: Type.String(),
      followersFormatted: Type.String(),
      url: Type.String(),
    }),
  ),
  portfolioItems: Type.Array(
    Type.Object({
      id: Type.String(),
      title: Type.String(),
      description: Type.String(),
      mediaUrl: Type.String(),
      mediaType: Type.String(),
      likesCount: Type.Integer(),
    }),
  ),
  latestReview: Type.Optional(
    Type.Object({
      reviewerName: Type.String(),
      reviewerCompany: Type.String(),
      rating: Type.Number(),
      comment: Type.String(),
      date: Type.String(),
    }),
  ),
  activeBriefs: Type.Optional(
    Type.Array(
      Type.Object({
        id: Type.String(),
        title: Type.String(),
        category: Type.String(),
        budgetFormatted: Type.String(),
        deadlineText: Type.String(),
      }),
    ),
  ),
});
export type PublicProfileResponse = Static<typeof PublicProfileResponseSchema>;

export const ConnectionRequestInputSchema = Type.Object({
  targetUserId: Type.String(),
  note: Type.Optional(Type.String({ maxLength: 500 })),
});
export type ConnectionRequestInput = Static<typeof ConnectionRequestInputSchema>;

export const ConnectionRequestResponseSchema = Type.Object({
  success: Type.Boolean(),
  connectionId: Type.String(),
  remainingQuota: Type.Integer(),
});
export type ConnectionRequestResponse = Static<typeof ConnectionRequestResponseSchema>;

export const BlockUserInputSchema = Type.Object({
  targetUserId: Type.String(),
  reason: Type.Optional(Type.String({ maxLength: 255 })),
});
export type BlockUserInput = Static<typeof BlockUserInputSchema>;
