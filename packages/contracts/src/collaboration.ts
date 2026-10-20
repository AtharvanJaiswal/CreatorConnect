import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
} from '@creatorconnect/validation';

// ==============================================================================
// Saved Creators
// ==============================================================================

export const SaveCreatorInputSchema = Type.Object({
  creatorId: UuidSchema,
});
export type SaveCreatorInput = Static<typeof SaveCreatorInputSchema>;

export const SavedCreatorItemSchema = Type.Object({
  id: UuidSchema,
  clientId: UuidSchema,
  creatorId: UuidSchema,
  createdAt: IsoDateTimeSchema,
  creator: Type.Object({
    id: UuidSchema,
    displayName: Type.String(),
    avatarUrl: Type.Union([Type.String(), Type.Null()]),
    creatorProfile: Type.Union([
      Type.Object({
        id: UuidSchema,
        tagline: Type.Union([Type.String(), Type.Null()]),
        startingRate: Type.Union([Type.Integer(), Type.Null()]),
        currency: Type.String(),
        isVerified: Type.Boolean(),
        locationCity: Type.Union([Type.String(), Type.Null()]),
        locationCountry: Type.Union([Type.String(), Type.Null()]),
      }),
      Type.Null(),
    ]),
  }),
});
export type SavedCreatorItem = Static<typeof SavedCreatorItemSchema>;

export const SavedCreatorListResponseSchema = Type.Object({
  items: Type.Array(SavedCreatorItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  total: Type.Integer(),
});
export type SavedCreatorListResponse = Static<typeof SavedCreatorListResponseSchema>;

export const CheckSavedStatusResponseSchema = Type.Object({
  isSaved: Type.Boolean(),
});
export type CheckSavedStatusResponse = Static<typeof CheckSavedStatusResponseSchema>;

// ==============================================================================
// Shortlists
// ==============================================================================

export const CreateShortlistInputSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
  projectId: Type.Optional(UuidSchema),
});
export type CreateShortlistInput = Static<typeof CreateShortlistInputSchema>;

export const UpdateShortlistInputSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
  projectId: Type.Optional(Type.Union([UuidSchema, Type.Null()])),
});
export type UpdateShortlistInput = Static<typeof UpdateShortlistInputSchema>;

export const AddShortlistMemberInputSchema = Type.Object({
  creatorId: UuidSchema,
  note: Type.Optional(Type.String({ maxLength: 1000 })),
});
export type AddShortlistMemberInput = Static<typeof AddShortlistMemberInputSchema>;

export const ShortlistMemberItemSchema = Type.Object({
  id: UuidSchema,
  shortlistId: UuidSchema,
  creatorId: UuidSchema,
  note: Type.Union([Type.String(), Type.Null()]),
  createdAt: IsoDateTimeSchema,
  creator: Type.Object({
    id: UuidSchema,
    displayName: Type.String(),
    avatarUrl: Type.Union([Type.String(), Type.Null()]),
    creatorProfile: Type.Union([
      Type.Object({
        id: UuidSchema,
        tagline: Type.Union([Type.String(), Type.Null()]),
        startingRate: Type.Union([Type.Integer(), Type.Null()]),
        currency: Type.String(),
        isVerified: Type.Boolean(),
      }),
      Type.Null(),
    ]),
  }),
});
export type ShortlistMemberItem = Static<typeof ShortlistMemberItemSchema>;

export const ShortlistResponseSchema = Type.Object({
  id: UuidSchema,
  ownerId: UuidSchema,
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  projectId: Type.Union([UuidSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  memberCount: Type.Integer(),
  project: Type.Optional(
    Type.Union([
      Type.Object({
        id: UuidSchema,
        title: Type.String(),
        status: Type.String(),
      }),
      Type.Null(),
    ]),
  ),
  members: Type.Optional(Type.Array(ShortlistMemberItemSchema)),
});
export type ShortlistResponse = Static<typeof ShortlistResponseSchema>;

export const ShortlistListResponseSchema = Type.Object({
  items: Type.Array(ShortlistResponseSchema),
  total: Type.Integer(),
});
export type ShortlistListResponse = Static<typeof ShortlistListResponseSchema>;

// ==============================================================================
// Hiring Invitations
// ==============================================================================

export const InvitationStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('ACCEPTED'),
  Type.Literal('DECLINED'),
  Type.Literal('WITHDRAWN'),
  Type.Literal('EXPIRED'),
]);
export type InvitationStatus = Static<typeof InvitationStatusSchema>;

export const CreateInvitationInputSchema = Type.Object({
  projectId: UuidSchema,
  creatorId: UuidSchema,
  shortlistId: Type.Optional(UuidSchema),
  message: Type.String({ minLength: 1, maxLength: 2000 }),
  expiresInDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 30, default: 7 })),
});
export type CreateInvitationInput = Static<typeof CreateInvitationInputSchema>;

export const InvitationResponseSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  inviterId: UuidSchema,
  inviteeId: UuidSchema,
  shortlistId: Type.Union([UuidSchema, Type.Null()]),
  status: InvitationStatusSchema,
  message: Type.String(),
  expiresAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  respondedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  project: Type.Object({
    id: UuidSchema,
    title: Type.String(),
    totalAmount: MinorUnitsSchema,
    currency: CurrencyCodeSchema,
    status: Type.String(),
  }),
  inviter: Type.Object({
    id: UuidSchema,
    displayName: Type.String(),
    avatarUrl: Type.Union([Type.String(), Type.Null()]),
  }),
  invitee: Type.Object({
    id: UuidSchema,
    displayName: Type.String(),
    avatarUrl: Type.Union([Type.String(), Type.Null()]),
  }),
});
export type InvitationResponse = Static<typeof InvitationResponseSchema>;

export const InvitationListResponseSchema = Type.Object({
  items: Type.Array(InvitationResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  total: Type.Integer(),
});
export type InvitationListResponse = Static<typeof InvitationListResponseSchema>;
