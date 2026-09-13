import { Type, type Static } from '@sinclair/typebox';
import { UserStatusSchema } from './auth.js';

/**
 * Profile update request schema for PATCH /api/v1/users/me
 */
export const UpdateProfileRequestSchema = Type.Object({
  firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  avatarUrl: Type.Optional(Type.String({ format: 'uri', maxLength: 512 })),
});
export type UpdateProfileRequest = Static<typeof UpdateProfileRequestSchema>;

/**
 * Admin status mutation request for PATCH /api/v1/admin/users/:id/status
 */
export const UpdateUserStatusRequestSchema = Type.Object({
  status: UserStatusSchema,
});
export type UpdateUserStatusRequest = Static<typeof UpdateUserStatusRequestSchema>;
