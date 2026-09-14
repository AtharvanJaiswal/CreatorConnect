import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
} from '@creatorconnect/validation';

export const BudgetTypeSchema = Type.Union([
  Type.Literal('FIXED'),
  Type.Literal('RANGE'),
  Type.Literal('HOURLY'),
]);
export type BudgetType = Static<typeof BudgetTypeSchema>;

export const AssignmentStatusSchema = Type.Union([
  Type.Literal('DRAFT'),
  Type.Literal('PUBLISHED'),
  Type.Literal('IN_PROGRESS'),
  Type.Literal('COMPLETED'),
  Type.Literal('CLOSED'),
]);
export type AssignmentStatus = Static<typeof AssignmentStatusSchema>;

export const CreateAssignmentRequirementSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 150 }),
  isMandatory: Type.Optional(Type.Boolean({ default: true })),
});
export type CreateAssignmentRequirement = Static<typeof CreateAssignmentRequirementSchema>;

export const CreateAssignmentInputSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.String({ minLength: 1, maxLength: 10000 }),
  categoryId: Type.Optional(UuidSchema),
  budgetType: Type.Optional(BudgetTypeSchema),
  budgetMin: Type.Integer({ minimum: 0, maximum: 1000000000 }),
  budgetMax: Type.Integer({ minimum: 0, maximum: 1000000000 }),
  currency: Type.Optional(CurrencyCodeSchema),
  deadline: IsoDateTimeSchema,
  isRemote: Type.Optional(Type.Boolean({ default: true })),
  location: Type.Optional(Type.String({ maxLength: 150 })),
  requirements: Type.Optional(Type.Array(CreateAssignmentRequirementSchema, { maxItems: 20 })),
});
export type CreateAssignmentInput = Static<typeof CreateAssignmentInputSchema>;

export const UpdateAssignmentInputSchema = Type.Object({
  version: Type.Integer({ minimum: 1 }),
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  description: Type.Optional(Type.String({ minLength: 1, maxLength: 10000 })),
  categoryId: Type.Optional(Type.Union([UuidSchema, Type.Null()])),
  budgetType: Type.Optional(BudgetTypeSchema),
  budgetMin: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000000000 })),
  budgetMax: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000000000 })),
  currency: Type.Optional(CurrencyCodeSchema),
  deadline: Type.Optional(IsoDateTimeSchema),
  isRemote: Type.Optional(Type.Boolean()),
  location: Type.Optional(Type.Union([Type.String({ maxLength: 150 }), Type.Null()])),
  requirements: Type.Optional(Type.Array(CreateAssignmentRequirementSchema, { maxItems: 20 })),
});
export type UpdateAssignmentInput = Static<typeof UpdateAssignmentInputSchema>;

export const AssignmentRequirementResponseSchema = Type.Object({
  id: UuidSchema,
  title: Type.String(),
  isMandatory: Type.Boolean(),
  createdAt: IsoDateTimeSchema,
});
export type AssignmentRequirementResponse = Static<typeof AssignmentRequirementResponseSchema>;

export const AssignmentResponseSchema = Type.Object({
  id: UuidSchema,
  brandId: UuidSchema,
  categoryId: Type.Union([UuidSchema, Type.Null()]),
  title: Type.String(),
  description: Type.String(),
  budgetType: BudgetTypeSchema,
  budgetMin: MinorUnitsSchema,
  budgetMax: MinorUnitsSchema,
  currency: CurrencyCodeSchema,
  deadline: IsoDateTimeSchema,
  isRemote: Type.Boolean(),
  location: Type.Union([Type.String(), Type.Null()]),
  status: AssignmentStatusSchema,
  version: Type.Integer(),
  requirements: Type.Array(AssignmentRequirementResponseSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type AssignmentResponse = Static<typeof AssignmentResponseSchema>;
