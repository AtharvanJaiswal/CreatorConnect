import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
  HttpsUrlSchema,
} from '@creatorconnect/validation';

export const ProfileVisibilitySchema = Type.Union([
  Type.Literal('PUBLIC'),
  Type.Literal('UNLISTED'),
  Type.Literal('PRIVATE'),
]);
export type ProfileVisibility = Static<typeof ProfileVisibilitySchema>;

export const SkillProficiencySchema = Type.Union([
  Type.Literal('BEGINNER'),
  Type.Literal('INTERMEDIATE'),
  Type.Literal('ADVANCED'),
  Type.Literal('EXPERT'),
]);
export type SkillProficiency = Static<typeof SkillProficiencySchema>;

export const SocialLinkItemSchema = Type.Object({
  platform: Type.String({ minLength: 1, maxLength: 50 }),
  url: HttpsUrlSchema,
});
export type SocialLinkItem = Static<typeof SocialLinkItemSchema>;

// ==============================================================================
// Creator Profile
// ==============================================================================

export const UpdateCreatorProfileInputSchema = Type.Object({
  tagline: Type.Optional(Type.String({ maxLength: 160 })),
  bio: Type.Optional(Type.String({ maxLength: 5000 })),
  locationCountry: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
  locationCity: Type.Optional(Type.String({ maxLength: 100 })),
  isRemote: Type.Optional(Type.Boolean()),
  startingRate: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000000000 })),
  currency: Type.Optional(CurrencyCodeSchema),
  visibility: Type.Optional(ProfileVisibilitySchema),
  socialLinks: Type.Optional(Type.Array(SocialLinkItemSchema, { maxItems: 20 })),
  categoryIds: Type.Optional(Type.Array(UuidSchema, { maxItems: 10 })),
});
export type UpdateCreatorProfileInput = Static<typeof UpdateCreatorProfileInputSchema>;

export const CreatorProfileResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  tagline: Type.Union([Type.String(), Type.Null()]),
  bio: Type.Union([Type.String(), Type.Null()]),
  locationCountry: Type.Union([Type.String(), Type.Null()]),
  locationCity: Type.Union([Type.String(), Type.Null()]),
  isRemote: Type.Boolean(),
  startingRate: Type.Union([MinorUnitsSchema, Type.Null()]),
  currency: CurrencyCodeSchema,
  visibility: ProfileVisibilitySchema,
  isVerified: Type.Boolean(),
  socialLinks: Type.Union([Type.Array(SocialLinkItemSchema), Type.Null()]),
  completionScore: Type.Integer({ minimum: 0, maximum: 100 }),
  categories: Type.Array(
    Type.Object({
      id: UuidSchema,
      slug: Type.String(),
      name: Type.String(),
    }),
  ),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CreatorProfileResponse = Static<typeof CreatorProfileResponseSchema>;

// ==============================================================================
// Professional Profile
// ==============================================================================

export const UpdateProfessionalProfileInputSchema = Type.Object({
  headline: Type.Optional(Type.String({ maxLength: 160 })),
  bio: Type.Optional(Type.String({ maxLength: 5000 })),
  yearsExperience: Type.Optional(Type.Integer({ minimum: 0, maximum: 70 })),
  dayRate: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000000000 })),
  currency: Type.Optional(CurrencyCodeSchema),
  isAvailable: Type.Optional(Type.Boolean()),
  visibility: Type.Optional(ProfileVisibilitySchema),
  locationCountry: Type.Optional(Type.String({ minLength: 2, maxLength: 2 })),
  locationCity: Type.Optional(Type.String({ maxLength: 100 })),
  equipmentList: Type.Optional(Type.Array(Type.String({ maxLength: 100 }), { maxItems: 50 })),
});
export type UpdateProfessionalProfileInput = Static<typeof UpdateProfessionalProfileInputSchema>;

export const ProfessionalProfileResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  headline: Type.Union([Type.String(), Type.Null()]),
  bio: Type.Union([Type.String(), Type.Null()]),
  yearsExperience: Type.Union([Type.Integer(), Type.Null()]),
  dayRate: Type.Union([MinorUnitsSchema, Type.Null()]),
  currency: CurrencyCodeSchema,
  isAvailable: Type.Boolean(),
  visibility: ProfileVisibilitySchema,
  locationCountry: Type.Union([Type.String(), Type.Null()]),
  locationCity: Type.Union([Type.String(), Type.Null()]),
  equipmentList: Type.Array(Type.String()),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ProfessionalProfileResponse = Static<typeof ProfessionalProfileResponseSchema>;

// ==============================================================================
// Brand Profile
// ==============================================================================

export const UpdateBrandProfileInputSchema = Type.Object({
  companyName: Type.String({ minLength: 1, maxLength: 150 }),
  industry: Type.Optional(Type.String({ maxLength: 100 })),
  websiteUrl: Type.Optional(HttpsUrlSchema),
  companySize: Type.Optional(Type.String({ maxLength: 32 })),
  bio: Type.Optional(Type.String({ maxLength: 5000 })),
  visibility: Type.Optional(ProfileVisibilitySchema),
});
export type UpdateBrandProfileInput = Static<typeof UpdateBrandProfileInputSchema>;

export const BrandProfileResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  companyName: Type.String(),
  industry: Type.Union([Type.String(), Type.Null()]),
  websiteUrl: Type.Union([Type.String(), Type.Null()]),
  companySize: Type.Union([Type.String(), Type.Null()]),
  bio: Type.Union([Type.String(), Type.Null()]),
  isVerified: Type.Boolean(),
  visibility: ProfileVisibilitySchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type BrandProfileResponse = Static<typeof BrandProfileResponseSchema>;

// ==============================================================================
// Podcaster Profile
// ==============================================================================

export const UpdatePodcasterProfileInputSchema = Type.Object({
  podcastName: Type.String({ minLength: 1, maxLength: 150 }),
  description: Type.Optional(Type.String({ maxLength: 5000 })),
  rssFeedUrl: Type.Optional(HttpsUrlSchema),
  guestGuidelines: Type.Optional(Type.String({ maxLength: 5000 })),
  visibility: Type.Optional(ProfileVisibilitySchema),
});
export type UpdatePodcasterProfileInput = Static<typeof UpdatePodcasterProfileInputSchema>;

export const PodcasterProfileResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  podcastName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  rssFeedUrl: Type.Union([Type.String(), Type.Null()]),
  guestGuidelines: Type.Union([Type.String(), Type.Null()]),
  visibility: ProfileVisibilitySchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type PodcasterProfileResponse = Static<typeof PodcasterProfileResponseSchema>;

// ==============================================================================
// User Skills & Taxonomy
// ==============================================================================

export const UserSkillItemInputSchema = Type.Object({
  skillId: UuidSchema,
  proficiency: Type.Optional(SkillProficiencySchema),
});
export type UserSkillItemInput = Static<typeof UserSkillItemInputSchema>;

export const UpdateUserSkillsInputSchema = Type.Object({
  skills: Type.Array(UserSkillItemInputSchema, { maxItems: 30 }),
});
export type UpdateUserSkillsInput = Static<typeof UpdateUserSkillsInputSchema>;

export const UserSkillResponseSchema = Type.Object({
  id: UuidSchema,
  skillId: UuidSchema,
  name: Type.String(),
  slug: Type.String(),
  proficiency: SkillProficiencySchema,
  createdAt: IsoDateTimeSchema,
});
export type UserSkillResponse = Static<typeof UserSkillResponseSchema>;

export const CategoryResponseSchema = Type.Object({
  id: UuidSchema,
  slug: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  isActive: Type.Boolean(),
  createdAt: IsoDateTimeSchema,
});
export type CategoryResponse = Static<typeof CategoryResponseSchema>;

export const SkillResponseSchema = Type.Object({
  id: UuidSchema,
  slug: Type.String(),
  name: Type.String(),
  isActive: Type.Boolean(),
  createdAt: IsoDateTimeSchema,
});
export type SkillResponse = Static<typeof SkillResponseSchema>;
