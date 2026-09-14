import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, IsoDateTimeSchema, HttpsUrlSchema } from '@creatorconnect/validation';
import { ProfileVisibilitySchema } from './profiles.js';
import { MediaAssetResponseSchema } from './media.js';

export const CreatePortfolioItemInputSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 160 }),
  description: Type.Optional(Type.String({ maxLength: 5000 })),
  externalUrl: Type.Optional(HttpsUrlSchema),
  displayOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  visibility: Type.Optional(ProfileVisibilitySchema),
  tags: Type.Optional(Type.Array(Type.String({ maxLength: 50 }), { maxItems: 20 })),
});
export type CreatePortfolioItemInput = Static<typeof CreatePortfolioItemInputSchema>;

export const UpdatePortfolioItemInputSchema = Type.Partial(CreatePortfolioItemInputSchema);
export type UpdatePortfolioItemInput = Static<typeof UpdatePortfolioItemInputSchema>;

export const AttachPortfolioMediaInputSchema = Type.Object({
  mediaAssetId: UuidSchema,
  displayOrder: Type.Optional(Type.Integer({ minimum: 0 })),
  caption: Type.Optional(Type.String({ maxLength: 255 })),
});
export type AttachPortfolioMediaInput = Static<typeof AttachPortfolioMediaInputSchema>;

export const ReorderPortfolioMediaInputSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      id: UuidSchema,
      displayOrder: Type.Integer({ minimum: 0 }),
    }),
    { minItems: 1, maxItems: 50 },
  ),
});
export type ReorderPortfolioMediaInput = Static<typeof ReorderPortfolioMediaInputSchema>;

export const PortfolioMediaResponseSchema = Type.Object({
  id: UuidSchema,
  mediaAssetId: UuidSchema,
  displayOrder: Type.Integer(),
  caption: Type.Union([Type.String(), Type.Null()]),
  mediaAsset: MediaAssetResponseSchema,
  createdAt: IsoDateTimeSchema,
});
export type PortfolioMediaResponse = Static<typeof PortfolioMediaResponseSchema>;

export const PortfolioItemResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  externalUrl: Type.Union([Type.String(), Type.Null()]),
  displayOrder: Type.Integer(),
  visibility: ProfileVisibilitySchema,
  tags: Type.Array(Type.String()),
  media: Type.Array(PortfolioMediaResponseSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type PortfolioItemResponse = Static<typeof PortfolioItemResponseSchema>;
