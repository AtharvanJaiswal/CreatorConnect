import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema } from '@creatorconnect/validation';

/**
 * Role Types supported across CreatorConnect.
 */
export const RoleTypeSchema = Type.Union([
  Type.Literal('CREATOR'),
  Type.Literal('PROFESSIONAL'),
  Type.Literal('BRAND'),
  Type.Literal('PODCASTER'),
  Type.Literal('ADMIN'),
]);
export type RoleType = Static<typeof RoleTypeSchema>;

/**
 * Self-selectable roles for initial onboarding.
 * Notice: ADMIN is strictly prohibited from this schema.
 */
export const SelfSelectableRoleSchema = Type.Union([
  Type.Literal('CREATOR'),
  Type.Literal('PROFESSIONAL'),
  Type.Literal('BRAND'),
  Type.Literal('PODCASTER'),
]);
export type SelfSelectableRole = Static<typeof SelfSelectableRoleSchema>;

/**
 * Authoritative user status lifecycle.
 */
export const UserStatusSchema = Type.Union([
  Type.Literal('ACTIVE'),
  Type.Literal('SUSPENDED'),
  Type.Literal('DEACTIVATED'),
]);
export type UserStatus = Static<typeof UserStatusSchema>;

/**
 * User Identity synchronization request.
 */
export const SyncUserRequestSchema = Type.Object({
  preferredRole: Type.Optional(
    Type.String({ description: 'Requested persona role on initial onboarding' }),
  ),
});
export type SyncUserRequest = Static<typeof SyncUserRequestSchema>;

/**
 * Role DTO representation.
 */
export const RoleResponseSchema = Type.Object({
  id: UuidSchema,
  name: RoleTypeSchema,
  description: Type.Union([Type.String(), Type.Null()]),
});
export type RoleResponse = Static<typeof RoleResponseSchema>;

/**
 * Canonical User response DTO.
 */
export const UserResponseSchema = Type.Object({
  id: UuidSchema,
  supabaseAuthId: Type.String(),
  email: Type.String({ format: 'email' }),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
  status: UserStatusSchema,
  roles: Type.Array(RoleTypeSchema),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type UserResponse = Static<typeof UserResponseSchema>;

/**
 * Response for POST /api/v1/auth/sync
 */
export const SyncUserResponseSchema = Type.Object({
  user: UserResponseSchema,
  isNewUser: Type.Boolean(),
});
export type SyncUserResponse = Static<typeof SyncUserResponseSchema>;
