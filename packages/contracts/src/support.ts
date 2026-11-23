import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, IsoDateTimeSchema } from '@creatorconnect/validation';

// ==============================================================================
// Enums
// ==============================================================================

export const SupportTicketCategorySchema = Type.Union([
  Type.Literal('ESCROW_RECONCILIATION'),
  Type.Literal('PAYMENT_DISPUTE'),
  Type.Literal('CONTRACT_VALIDATION'),
  Type.Literal('ACCOUNT_ACCESS'),
  Type.Literal('TRUST_SAFETY'),
  Type.Literal('OTHER'),
]);
export type SupportTicketCategory = Static<typeof SupportTicketCategorySchema>;

export const SupportTicketPrioritySchema = Type.Union([
  Type.Literal('LOW'),
  Type.Literal('NORMAL'),
  Type.Literal('HIGH'),
  Type.Literal('URGENT'),
]);
export type SupportTicketPriority = Static<typeof SupportTicketPrioritySchema>;

export const SupportTicketStatusSchema = Type.Union([
  Type.Literal('OPEN'),
  Type.Literal('IN_PROGRESS'),
  Type.Literal('WAITING_FOR_CUSTOMER'),
  Type.Literal('RESOLVED'),
  Type.Literal('CLOSED'),
]);
export type SupportTicketStatus = Static<typeof SupportTicketStatusSchema>;

export const SupportMessageAuthorRoleSchema = Type.Union([
  Type.Literal('CUSTOMER'),
  Type.Literal('STAFF'),
  Type.Literal('SYSTEM'),
]);
export type SupportMessageAuthorRole = Static<typeof SupportMessageAuthorRoleSchema>;

// ==============================================================================
// Ticket Payloads & Responses
// ==============================================================================

export const CreateSupportTicketInputSchema = Type.Object({
  category: SupportTicketCategorySchema,
  priority: Type.Optional(SupportTicketPrioritySchema),
  subject: Type.String({ minLength: 5, maxLength: 200 }),
  description: Type.String({ minLength: 5, maxLength: 5000 }),
  linkedAssignmentId: Type.Optional(UuidSchema),
  linkedProjectId: Type.Optional(UuidSchema),
  escrowAmount: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type CreateSupportTicketInput = Static<typeof CreateSupportTicketInputSchema>;

export const SupportUserSummarySchema = Type.Object({
  id: UuidSchema,
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  email: Type.Optional(Type.String()),
  avatarUrl: Type.Union([Type.String(), Type.Null()]),
});
export type SupportUserSummary = Static<typeof SupportUserSummarySchema>;

export const SupportTicketResponseSchema = Type.Object({
  id: UuidSchema,
  ticketNumber: Type.String(),
  requesterId: UuidSchema,
  assignedToId: Type.Union([UuidSchema, Type.Null()]),
  category: SupportTicketCategorySchema,
  priority: SupportTicketPrioritySchema,
  status: SupportTicketStatusSchema,
  subject: Type.String(),
  description: Type.String(),
  linkedAssignmentId: Type.Union([UuidSchema, Type.Null()]),
  linkedProjectId: Type.Union([UuidSchema, Type.Null()]),
  escrowAmount: Type.Union([Type.Integer(), Type.Null()]),
  resolutionSummary: Type.Union([Type.String(), Type.Null()]),
  version: Type.Integer(),
  resolvedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  closedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  requester: Type.Optional(SupportUserSummarySchema),
  assignedTo: Type.Optional(Type.Union([SupportUserSummarySchema, Type.Null()])),
});
export type SupportTicketResponse = Static<typeof SupportTicketResponseSchema>;

export const SupportTicketListResponseSchema = Type.Object({
  items: Type.Array(SupportTicketResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
  totalCount: Type.Optional(Type.Integer()),
});
export type SupportTicketListResponse = Static<typeof SupportTicketListResponseSchema>;

// ==============================================================================
// Messages
// ==============================================================================

export const CreateSupportMessageInputSchema = Type.Object({
  body: Type.String({ minLength: 1, maxLength: 5000 }),
  mediaAssetId: Type.Optional(UuidSchema),
  attachmentName: Type.Optional(Type.String({ maxLength: 255 })),
  attachmentSize: Type.Optional(Type.String({ maxLength: 64 })),
  attachmentType: Type.Optional(Type.String({ maxLength: 64 })),
});
export type CreateSupportMessageInput = Static<typeof CreateSupportMessageInputSchema>;

export const CreateSupportInternalNoteInputSchema = Type.Object({
  body: Type.String({ minLength: 1, maxLength: 5000 }),
});
export type CreateSupportInternalNoteInput = Static<typeof CreateSupportInternalNoteInputSchema>;

export const SupportTicketMessageResponseSchema = Type.Object({
  id: UuidSchema,
  ticketId: UuidSchema,
  authorId: UuidSchema,
  authorRole: SupportMessageAuthorRoleSchema,
  body: Type.String(),
  isInternal: Type.Boolean(),
  mediaAssetId: Type.Union([UuidSchema, Type.Null()]),
  attachmentName: Type.Union([Type.String(), Type.Null()]),
  attachmentSize: Type.Union([Type.String(), Type.Null()]),
  attachmentType: Type.Union([Type.String(), Type.Null()]),
  createdAt: IsoDateTimeSchema,
  author: Type.Optional(
    Type.Object({
      id: UuidSchema,
      firstName: Type.Union([Type.String(), Type.Null()]),
      lastName: Type.Union([Type.String(), Type.Null()]),
      avatarUrl: Type.Union([Type.String(), Type.Null()]),
      role: Type.Optional(Type.String()),
    }),
  ),
});
export type SupportTicketMessageResponse = Static<typeof SupportTicketMessageResponseSchema>;

export const SupportTicketMessageListResponseSchema = Type.Object({
  items: Type.Array(SupportTicketMessageResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
});
export type SupportTicketMessageListResponse = Static<
  typeof SupportTicketMessageListResponseSchema
>;

// ==============================================================================
// Status Transitions & Operations
// ==============================================================================

export const UpdateSupportTicketStatusInputSchema = Type.Object({
  status: SupportTicketStatusSchema,
  resolutionSummary: Type.Optional(Type.String({ maxLength: 2000 })),
  expectedVersion: Type.Optional(Type.Integer()),
});
export type UpdateSupportTicketStatusInput = Static<typeof UpdateSupportTicketStatusInputSchema>;

export const AssignSupportTicketInputSchema = Type.Object({
  assignedToId: Type.Union([UuidSchema, Type.Null()]),
});
export type AssignSupportTicketInput = Static<typeof AssignSupportTicketInputSchema>;

export const CustomerSupportTicketQuerySchema = Type.Object({
  status: Type.Optional(SupportTicketStatusSchema),
  category: Type.Optional(SupportTicketCategorySchema),
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
});
export type CustomerSupportTicketQuery = Static<typeof CustomerSupportTicketQuerySchema>;

export const StaffSupportTicketQuerySchema = Type.Object({
  status: Type.Optional(SupportTicketStatusSchema),
  priority: Type.Optional(SupportTicketPrioritySchema),
  category: Type.Optional(SupportTicketCategorySchema),
  assignedToId: Type.Optional(Type.Union([UuidSchema, Type.Literal('unassigned')])),
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
});
export type StaffSupportTicketQuery = Static<typeof StaffSupportTicketQuerySchema>;

export const SupportTicketAuditResponseSchema = Type.Object({
  id: UuidSchema,
  ticketId: UuidSchema,
  actorId: UuidSchema,
  action: Type.String(),
  fromStatus: Type.Union([SupportTicketStatusSchema, Type.Null()]),
  toStatus: Type.Union([SupportTicketStatusSchema, Type.Null()]),
  metadata: Type.Optional(Type.Any()),
  createdAt: IsoDateTimeSchema,
});
export type SupportTicketAuditResponse = Static<typeof SupportTicketAuditResponseSchema>;

// ==============================================================================
// Outbox Domain Event Payload Schemas
// ==============================================================================

export const SupportTicketCreatedV1PayloadSchema = Type.Object({
  ticketId: UuidSchema,
  ticketNumber: Type.String({ minLength: 3, maxLength: 32 }),
  requesterId: UuidSchema,
  category: SupportTicketCategorySchema,
  priority: SupportTicketPrioritySchema,
  subject: Type.String({ minLength: 1, maxLength: 200 }),
});
export type SupportTicketCreatedV1Payload = Static<typeof SupportTicketCreatedV1PayloadSchema>;

export const SupportTicketAssignedV1PayloadSchema = Type.Object({
  ticketId: UuidSchema,
  previousAssigneeId: Type.Union([UuidSchema, Type.Null()]),
  assignedToId: Type.Union([UuidSchema, Type.Null()]),
});
export type SupportTicketAssignedV1Payload = Static<typeof SupportTicketAssignedV1PayloadSchema>;

export const SupportTicketMessageCreatedV1PayloadSchema = Type.Object({
  ticketId: UuidSchema,
  messageId: UuidSchema,
  authorId: UuidSchema,
  authorRole: SupportMessageAuthorRoleSchema,
  isInternal: Type.Literal(false),
});
export type SupportTicketMessageCreatedV1Payload = Static<
  typeof SupportTicketMessageCreatedV1PayloadSchema
>;

export const SupportTicketInternalNoteCreatedV1PayloadSchema = Type.Object({
  ticketId: UuidSchema,
  messageId: UuidSchema,
  authorId: UuidSchema,
  authorRole: SupportMessageAuthorRoleSchema,
  isInternal: Type.Literal(true),
});
export type SupportTicketInternalNoteCreatedV1Payload = Static<
  typeof SupportTicketInternalNoteCreatedV1PayloadSchema
>;

export const SupportTicketStatusChangedV1PayloadSchema = Type.Object({
  ticketId: UuidSchema,
  previousStatus: SupportTicketStatusSchema,
  newStatus: SupportTicketStatusSchema,
  resolutionSummary: Type.Union([Type.String(), Type.Null()]),
  actorId: UuidSchema,
});
export type SupportTicketStatusChangedV1Payload = Static<
  typeof SupportTicketStatusChangedV1PayloadSchema
>;

export const SupportTicketResolvedV1PayloadSchema = Type.Object({
  ticketId: UuidSchema,
  previousStatus: SupportTicketStatusSchema,
  newStatus: Type.Literal('RESOLVED'),
  resolutionSummary: Type.Union([Type.String(), Type.Null()]),
  actorId: UuidSchema,
});
export type SupportTicketResolvedV1Payload = Static<typeof SupportTicketResolvedV1PayloadSchema>;
