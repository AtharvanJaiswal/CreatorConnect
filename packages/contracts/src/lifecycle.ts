import { Type, type Static } from '@sinclair/typebox';

// ==============================================================================
// 1. Account Lifecycle States & Enums
// ==============================================================================

export const AccountLifecycleStateSchema = Type.Union([
  Type.Literal('ACTIVE'),
  Type.Literal('SUSPENDED'),
  Type.Literal('DEACTIVATED'),
]);
export type AccountLifecycleState = Static<typeof AccountLifecycleStateSchema>;

export const UserSelfDeactivateRequestSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
  confirmation: Type.Literal(true),
});
export type UserSelfDeactivateRequest = Static<typeof UserSelfDeactivateRequestSchema>;

export const UserSelfReactivateRequestSchema = Type.Object({
  confirmation: Type.Literal(true),
});
export type UserSelfReactivateRequest = Static<typeof UserSelfReactivateRequestSchema>;

export const AdminUpdateUserStatusRequestSchema = Type.Object({
  status: AccountLifecycleStateSchema,
  reason: Type.String({ minLength: 3, maxLength: 500 }),
});
export type AdminUpdateUserStatusRequest = Static<typeof AdminUpdateUserStatusRequestSchema>;

// ==============================================================================
// 2. Legal Hold Enums & Schemas
// ==============================================================================

export const LegalHoldReasonSchema = Type.Union([
  Type.Literal('ACTIVE_DISPUTE'),
  Type.Literal('FINANCIAL_AUDIT'),
  Type.Literal('LAW_ENFORCEMENT_REQUEST'),
  Type.Literal('TRUST_SAFETY_INVESTIGATION'),
  Type.Literal('TAX_INSPECTION'),
]);
export type LegalHoldReason = Static<typeof LegalHoldReasonSchema>;

export const LegalHoldStatusSchema = Type.Union([Type.Literal('ACTIVE'), Type.Literal('RELEASED')]);
export type LegalHoldStatus = Static<typeof LegalHoldStatusSchema>;

export const CreateLegalHoldRequestSchema = Type.Object({
  reason: LegalHoldReasonSchema,
  caseReference: Type.String({ minLength: 1, maxLength: 128 }),
  notes: Type.String({ minLength: 1, maxLength: 2000 }),
});
export type CreateLegalHoldRequest = Static<typeof CreateLegalHoldRequestSchema>;

export const ReleaseLegalHoldRequestSchema = Type.Object({
  releaseNotes: Type.String({ minLength: 1, maxLength: 2000 }),
});
export type ReleaseLegalHoldRequest = Static<typeof ReleaseLegalHoldRequestSchema>;

export const LegalHoldResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  reason: LegalHoldReasonSchema,
  caseReference: Type.String(),
  status: LegalHoldStatusSchema,
  notes: Type.String(),
  releaseNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  appliedById: Type.String({ format: 'uuid' }),
  releasedById: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  appliedAt: Type.String({ format: 'date-time' }),
  releasedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
});
export type LegalHoldResponse = Static<typeof LegalHoldResponseSchema>;

// ==============================================================================
// 3. Privacy Request Enums & Schemas (DSAR / Right to Erasure)
// ==============================================================================

export const PrivacyRequestTypeSchema = Type.Union([
  Type.Literal('ACCOUNT_DELETION'),
  Type.Literal('DATA_EXPORT'),
  Type.Literal('RECTIFICATION'),
]);
export type PrivacyRequestType = Static<typeof PrivacyRequestTypeSchema>;

export const PrivacyRequestStatusSchema = Type.Union([
  Type.Literal('PENDING_CONFIRMATION'),
  Type.Literal('COOLING_OFF'),
  Type.Literal('PROCESSING'),
  Type.Literal('COMPLETED'),
  Type.Literal('CANCELLED'),
  Type.Literal('REJECTED_LEGAL_HOLD'),
]);
export type PrivacyRequestStatus = Static<typeof PrivacyRequestStatusSchema>;

export const ErasureWorkflowStageSchema = Type.Union([
  Type.Literal('DATABASE_PSEUDONYMIZATION_PENDING'),
  Type.Literal('DATABASE_PSEUDONYMIZATION_COMPLETED'),
  Type.Literal('MEDIA_PURGE_PENDING'),
  Type.Literal('MEDIA_PURGE_COMPLETED'),
  Type.Literal('SUPABASE_IDENTITY_PURGE_PENDING'),
  Type.Literal('SUPABASE_IDENTITY_PURGE_COMPLETED'),
  Type.Literal('FINAL_VERIFICATION_PENDING'),
  Type.Literal('ERASURE_COMPLETED'),
  Type.Literal('MANUAL_REVIEW_REQUIRED'),
]);
export type ErasureWorkflowStage = Static<typeof ErasureWorkflowStageSchema>;

export const CreateErasureRequestSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
});
export type CreateErasureRequest = Static<typeof CreateErasureRequestSchema>;

export const ConfirmErasureRequestSchema = Type.Object({
  confirmationCode: Type.String({ minLength: 8, maxLength: 64 }),
});
export type ConfirmErasureRequest = Static<typeof ConfirmErasureRequestSchema>;

export const CancelErasureRequestSchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 500 }),
});
export type CancelErasureRequest = Static<typeof CancelErasureRequestSchema>;

export const PrivacyRequestResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  requestType: PrivacyRequestTypeSchema,
  status: PrivacyRequestStatusSchema,
  currentStage: ErasureWorkflowStageSchema,
  confirmedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  coolingOffEndsAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  scheduledPurgeAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  completedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  rejectionReason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  certificateToken: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
export type PrivacyRequestResponse = Static<typeof PrivacyRequestResponseSchema>;

export const PrivacyReceiptResponseSchema = Type.Object({
  certificateToken: Type.String(),
  requestId: Type.String({ format: 'uuid' }),
  actionTaken: Type.String(),
  recordsProcessed: Type.Integer({ minimum: 0 }),
  mediaFilesPurged: Type.Integer({ minimum: 0 }),
  completedAt: Type.String({ format: 'date-time' }),
  verificationSig: Type.String(),
});
export type PrivacyReceiptResponse = Static<typeof PrivacyReceiptResponseSchema>;

export const VerifyPrivacyReceiptRequestSchema = Type.Object({
  certificateToken: Type.String({ minLength: 10, maxLength: 128 }),
});
export type VerifyPrivacyReceiptRequest = Static<typeof VerifyPrivacyReceiptRequestSchema>;

// ==============================================================================
// 4. Transactional Outbox Event Schemas
// ==============================================================================

export const UserLifecycleTransitionedV1PayloadSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  previousStatus: AccountLifecycleStateSchema,
  newStatus: AccountLifecycleStateSchema,
  transitionedById: Type.String({ format: 'uuid' }),
  reason: Type.String(),
  timestamp: Type.String({ format: 'date-time' }),
});
export type UserLifecycleTransitionedV1Payload = Static<
  typeof UserLifecycleTransitionedV1PayloadSchema
>;

export const UserErasureRequestedV1PayloadSchema = Type.Object({
  requestId: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  requestType: PrivacyRequestTypeSchema,
  coolingOffEndsAt: Type.String({ format: 'date-time' }),
  timestamp: Type.String({ format: 'date-time' }),
});
export type UserErasureRequestedV1Payload = Static<typeof UserErasureRequestedV1PayloadSchema>;

export const UserErasureConfirmedV1PayloadSchema = Type.Object({
  requestId: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  confirmedAt: Type.String({ format: 'date-time' }),
});
export type UserErasureConfirmedV1Payload = Static<typeof UserErasureConfirmedV1PayloadSchema>;

export const UserErasureStageCompletedV1PayloadSchema = Type.Object({
  requestId: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  stage: ErasureWorkflowStageSchema,
  completedAt: Type.String({ format: 'date-time' }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type UserErasureStageCompletedV1Payload = Static<
  typeof UserErasureStageCompletedV1PayloadSchema
>;

export const UserErasureCompletedV1PayloadSchema = Type.Object({
  requestId: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  certificateTokenHash: Type.String(),
  completedAt: Type.String({ format: 'date-time' }),
});
export type UserErasureCompletedV1Payload = Static<typeof UserErasureCompletedV1PayloadSchema>;

export const UserLegalHoldAppliedV1PayloadSchema = Type.Object({
  holdId: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  reason: LegalHoldReasonSchema,
  caseReference: Type.String(),
  appliedById: Type.String({ format: 'uuid' }),
  appliedAt: Type.String({ format: 'date-time' }),
});
export type UserLegalHoldAppliedV1Payload = Static<typeof UserLegalHoldAppliedV1PayloadSchema>;

export const UserLegalHoldReleasedV1PayloadSchema = Type.Object({
  holdId: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  releasedById: Type.String({ format: 'uuid' }),
  releasedAt: Type.String({ format: 'date-time' }),
  releaseNotes: Type.String(),
});
export type UserLegalHoldReleasedV1Payload = Static<typeof UserLegalHoldReleasedV1PayloadSchema>;
