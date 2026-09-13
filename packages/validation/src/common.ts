import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema } from './formats.js';

/**
 * Reusable parameter and query schemas.
 */

export const IdParamSchema = Type.Object({
  id: UuidSchema,
});
export type IdParam = Static<typeof IdParamSchema>;

export const CursorPaginationQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  cursor: Type.Optional(Type.String({ description: 'Opaque base64 cursor pointer' })),
  direction: Type.Optional(
    Type.Union([Type.Literal('next'), Type.Literal('prev')], { default: 'next' }),
  ),
});
export type CursorPaginationQuery = Static<typeof CursorPaginationQuerySchema>;

export const PaginationMetaSchema = Type.Object({
  hasMore: Type.Boolean(),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  limit: Type.Integer(),
});
export type PaginationMeta = Static<typeof PaginationMetaSchema>;
