import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
} from '@creatorconnect/validation';

export const ProjectStatusSchema = Type.Union([
  Type.Literal('IN_PROGRESS'),
  Type.Literal('SUBMITTED'),
  Type.Literal('REVISION_REQUESTED'),
  Type.Literal('APPROVED'),
  Type.Literal('COMPLETED'),
  Type.Literal('CANCELLED'),
  Type.Literal('DISPUTED'),
]);
export type ProjectStatus = Static<typeof ProjectStatusSchema>;

export const DeliverableStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('SUBMITTED'),
  Type.Literal('IN_REVIEW'),
  Type.Literal('APPROVED'),
  Type.Literal('REVISION_REQUESTED'),
]);
export type DeliverableStatus = Static<typeof DeliverableStatusSchema>;

export const ProjectDeliverableResponseSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  amount: MinorUnitsSchema,
  dueDate: Type.Union([IsoDateTimeSchema, Type.Null()]),
  status: DeliverableStatusSchema,
  version: Type.Integer(),
  submittedAssetId: Type.Union([UuidSchema, Type.Null()]),
  submissionNotes: Type.Union([Type.String(), Type.Null()]),
  revisionNotes: Type.Union([Type.String(), Type.Null()]),
  submittedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  approvedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ProjectDeliverableResponse = Static<typeof ProjectDeliverableResponseSchema>;

export const ProjectResponseSchema = Type.Object({
  id: UuidSchema,
  assignmentId: UuidSchema,
  applicationId: UuidSchema,
  clientId: UuidSchema,
  talentId: UuidSchema,
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  totalAmount: MinorUnitsSchema,
  currency: CurrencyCodeSchema,
  status: ProjectStatusSchema,
  version: Type.Integer(),
  startedAt: IsoDateTimeSchema,
  completedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  cancelledAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  deliverables: Type.Optional(Type.Array(ProjectDeliverableResponseSchema)),
});
export type ProjectResponse = Static<typeof ProjectResponseSchema>;

export const SubmitDeliverableInputSchema = Type.Object({
  submittedAssetId: Type.Optional(UuidSchema),
  submissionNotes: Type.Optional(Type.String({ maxLength: 5000 })),
});
export type SubmitDeliverableInput = Static<typeof SubmitDeliverableInputSchema>;

export const ReviewDeliverableInputSchema = Type.Object({
  action: Type.Union([Type.Literal('APPROVE'), Type.Literal('REQUEST_REVISION')]),
  notes: Type.Optional(Type.String({ maxLength: 5000 })),
});
export type ReviewDeliverableInput = Static<typeof ReviewDeliverableInputSchema>;

export const CreateProjectDeliverableInputSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 150 }),
  description: Type.Optional(Type.String({ maxLength: 5000 })),
  amount: Type.Integer({ minimum: 1 }),
  dueDate: Type.Optional(IsoDateTimeSchema),
});
export type CreateProjectDeliverableInput = Static<typeof CreateProjectDeliverableInputSchema>;

export const CreateProjectInputSchema = Type.Object({
  assignmentId: UuidSchema,
  applicationId: UuidSchema,
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String({ maxLength: 10000 })),
  totalAmount: Type.Integer({ minimum: 1 }),
  currency: Type.Optional(CurrencyCodeSchema),
  deliverables: Type.Optional(Type.Array(CreateProjectDeliverableInputSchema, { minItems: 1 })),
});
export type CreateProjectInput = Static<typeof CreateProjectInputSchema>;
