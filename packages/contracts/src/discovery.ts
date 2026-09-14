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
