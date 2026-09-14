import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, IsoDateTimeSchema } from '@creatorconnect/validation';

export const MediaTypeSchema = Type.Union([
  Type.Literal('IMAGE'),
  Type.Literal('VIDEO'),
  Type.Literal('AUDIO'),
  Type.Literal('DOCUMENT'),
]);
export type MediaType = Static<typeof MediaTypeSchema>;

export const MediaAssetStatusSchema = Type.Union([
  Type.Literal('QUARANTINED'),
  Type.Literal('PENDING_SCAN'),
  Type.Literal('ACTIVE'),
  Type.Literal('REJECTED_INVALID'),
  Type.Literal('DELETED'),
]);
export type MediaAssetStatus = Static<typeof MediaAssetStatusSchema>;

export const RequestUploadUrlInputSchema = Type.Object({
  originalName: Type.String({ minLength: 1, maxLength: 255 }),
  mimeType: Type.String({ minLength: 3, maxLength: 100 }),
  byteSize: Type.Integer({ minimum: 1, maximum: 524288000 }), // 500MB max
  mediaType: MediaTypeSchema,
});
export type RequestUploadUrlInput = Static<typeof RequestUploadUrlInputSchema>;

export const RequestUploadUrlResponseSchema = Type.Object({
  assetId: UuidSchema,
  uploadUrl: Type.String(),
  storageKey: Type.String(),
  expiresAt: IsoDateTimeSchema,
});
export type RequestUploadUrlResponse = Static<typeof RequestUploadUrlResponseSchema>;

export const ConfirmUploadInputSchema = Type.Object({
  assetId: UuidSchema,
});
export type ConfirmUploadInput = Static<typeof ConfirmUploadInputSchema>;

export const MediaAssetResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  storageKey: Type.String(),
  thumbnailKey: Type.Union([Type.String(), Type.Null()]),
  previewKey: Type.Union([Type.String(), Type.Null()]),
  originalName: Type.String(),
  mimeType: Type.String(),
  byteSize: Type.Integer(),
  mediaType: MediaTypeSchema,
  status: MediaAssetStatusSchema,
  width: Type.Union([Type.Integer(), Type.Null()]),
  height: Type.Union([Type.Integer(), Type.Null()]),
  durationSec: Type.Union([Type.Integer(), Type.Null()]),
  url: Type.Union([Type.String(), Type.Null()]),
  thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
  previewUrl: Type.Union([Type.String(), Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type MediaAssetResponse = Static<typeof MediaAssetResponseSchema>;
