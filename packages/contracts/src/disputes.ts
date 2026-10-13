import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
} from '@creatorconnect/validation';
import { PaymentProviderSchema } from './payments.js';

export const DisputeStatusSchema = Type.Union([
  Type.Literal('OPEN'),
  Type.Literal('UNDER_REVIEW'),
  Type.Literal('EVIDENCE_REQUESTED'),
  Type.Literal('RESOLVED_FOR_CLIENT'),
  Type.Literal('RESOLVED_FOR_CREATOR'),
  Type.Literal('CLOSED'),
]);
export type DisputeStatus = Static<typeof DisputeStatusSchema>;

export const DisputeReasonSchema = Type.Union([
  Type.Literal('DELIVERABLE_POOR_QUALITY'),
  Type.Literal('MISSED_DEADLINE'),
  Type.Literal('UNRESPONSIVE_PARTY'),
  Type.Literal('SCOPE_MISMATCH'),
  Type.Literal('UNAUTHORIZED_WORK'),
  Type.Literal('OTHER'),
]);
export type DisputeReason = Static<typeof DisputeReasonSchema>;

export const CancellationStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('APPROVED'),
  Type.Literal('REJECTED'),
  Type.Literal('WITHDRAWN'),
]);
export type CancellationStatus = Static<typeof CancellationStatusSchema>;

export const RefundStatusSchema = Type.Union([
  Type.Literal('REQUESTED'),
  Type.Literal('PENDING'),
  Type.Literal('PROCESSING'),
  Type.Literal('SUCCEEDED'),
  Type.Literal('FAILED'),
  Type.Literal('RECONCILIATION_REQUIRED'),
]);
export type RefundStatus = Static<typeof RefundStatusSchema>;

export const RefundReasonSchema = Type.Union([
  Type.Literal('PROJECT_CANCELLED'),
  Type.Literal('DISPUTE_RESOLUTION'),
  Type.Literal('CLIENT_REQUESTED'),
  Type.Literal('ADMIN_ADJUSTMENT'),
  Type.Literal('DUPLICATE_PAYMENT'),
]);
export type RefundReason = Static<typeof RefundReasonSchema>;

export const DisputeEvidenceResponseSchema = Type.Object({
  id: UuidSchema,
  disputeId: UuidSchema,
  uploadedById: UuidSchema,
  mediaAssetId: Type.Union([UuidSchema, Type.Null()]),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  createdAt: IsoDateTimeSchema,
});
export type DisputeEvidenceResponse = Static<typeof DisputeEvidenceResponseSchema>;

export const DisputeStatusHistoryResponseSchema = Type.Object({
  id: UuidSchema,
  disputeId: UuidSchema,
  fromStatus: DisputeStatusSchema,
  toStatus: DisputeStatusSchema,
  actorId: UuidSchema,
  reason: Type.Union([Type.String(), Type.Null()]),
  createdAt: IsoDateTimeSchema,
});
export type DisputeStatusHistoryResponse = Static<typeof DisputeStatusHistoryResponseSchema>;

export const DisputeResponseSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  deliverableId: Type.Union([UuidSchema, Type.Null()]),
  openedById: UuidSchema,
  reason: DisputeReasonSchema,
  description: Type.String(),
  status: DisputeStatusSchema,
  deadline: Type.Union([IsoDateTimeSchema, Type.Null()]),
  resolvedById: Type.Union([UuidSchema, Type.Null()]),
  resolutionReason: Type.Union([Type.String(), Type.Null()]),
  resolutionNotes: Type.Union([Type.String(), Type.Null()]),
  resolvedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  closedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  version: Type.Integer(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  evidence: Type.Optional(Type.Array(DisputeEvidenceResponseSchema)),
  history: Type.Optional(Type.Array(DisputeStatusHistoryResponseSchema)),
});
export type DisputeResponse = Static<typeof DisputeResponseSchema>;

export const OpenDisputeInputSchema = Type.Object({
  projectId: UuidSchema,
  deliverableId: Type.Optional(UuidSchema),
  reason: DisputeReasonSchema,
  description: Type.String({ minLength: 10, maxLength: 5000 }),
  evidenceMediaAssetIds: Type.Optional(Type.Array(UuidSchema)),
});
export type OpenDisputeInput = Static<typeof OpenDisputeInputSchema>;

export const AddDisputeEvidenceInputSchema = Type.Object({
  mediaAssetId: Type.Optional(UuidSchema),
  title: Type.String({ minLength: 1, maxLength: 150 }),
  description: Type.Optional(Type.String({ maxLength: 5000 })),
});
export type AddDisputeEvidenceInput = Static<typeof AddDisputeEvidenceInputSchema>;

export const UpdateDisputeStatusInputSchema = Type.Object({
  status: DisputeStatusSchema,
  notes: Type.Optional(Type.String({ maxLength: 5000 })),
  evidenceDeadline: Type.Optional(IsoDateTimeSchema),
});
export type UpdateDisputeStatusInput = Static<typeof UpdateDisputeStatusInputSchema>;

export const ResolveDisputeInputSchema = Type.Object({
  resolution: Type.Union([
    Type.Literal('RESOLVED_FOR_CLIENT'),
    Type.Literal('RESOLVED_FOR_CREATOR'),
  ]),
  resolutionReason: Type.String({ minLength: 5, maxLength: 5000 }),
  resolutionNotes: Type.Optional(Type.String({ maxLength: 5000 })),
  refundAmount: Type.Optional(MinorUnitsSchema),
});
export type ResolveDisputeInput = Static<typeof ResolveDisputeInputSchema>;

export const ProjectCancellationResponseSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  requestedById: UuidSchema,
  reason: Type.String(),
  status: CancellationStatusSchema,
  decidedById: Type.Union([UuidSchema, Type.Null()]),
  decisionReason: Type.Union([Type.String(), Type.Null()]),
  decidedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ProjectCancellationResponse = Static<typeof ProjectCancellationResponseSchema>;

export const RequestCancellationInputSchema = Type.Object({
  reason: Type.String({ minLength: 5, maxLength: 5000 }),
});
export type RequestCancellationInput = Static<typeof RequestCancellationInputSchema>;

export const DecideCancellationInputSchema = Type.Object({
  action: Type.Union([Type.Literal('APPROVE'), Type.Literal('REJECT')]),
  decisionReason: Type.Optional(Type.String({ maxLength: 5000 })),
});
export type DecideCancellationInput = Static<typeof DecideCancellationInputSchema>;

export const RefundResponseSchema = Type.Object({
  id: UuidSchema,
  paymentIntentId: UuidSchema,
  projectId: UuidSchema,
  disputeId: Type.Union([UuidSchema, Type.Null()]),
  cancellationId: Type.Union([UuidSchema, Type.Null()]),
  refundedById: UuidSchema,
  amount: MinorUnitsSchema,
  currency: CurrencyCodeSchema,
  reason: RefundReasonSchema,
  status: RefundStatusSchema,
  provider: PaymentProviderSchema,
  providerRefundId: Type.Union([Type.String(), Type.Null()]),
  idempotencyKey: Type.Union([Type.String(), Type.Null()]),
  errorMessage: Type.Union([Type.String(), Type.Null()]),
  processedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type RefundResponse = Static<typeof RefundResponseSchema>;

export const CreateRefundInputSchema = Type.Object({
  amount: MinorUnitsSchema,
  reason: RefundReasonSchema,
  idempotencyKey: Type.Optional(Type.String({ minLength: 8, maxLength: 128 })),
  notes: Type.Optional(Type.String({ maxLength: 5000 })),
});
export type CreateRefundInput = Static<typeof CreateRefundInputSchema>;
