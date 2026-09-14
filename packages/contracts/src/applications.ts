import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
} from '@creatorconnect/validation';

export const ApplicationStatusSchema = Type.Union([
  Type.Literal('SUBMITTED'),
  Type.Literal('UNDER_REVIEW'),
  Type.Literal('SHORTLISTED'),
  Type.Literal('ACCEPTED'),
  Type.Literal('REJECTED'),
  Type.Literal('WITHDRAWN'),
]);
export type ApplicationStatus = Static<typeof ApplicationStatusSchema>;

export const CreateApplicationInputSchema = Type.Object({
  coverLetter: Type.String({ minLength: 1, maxLength: 10000 }),
  proposedRate: Type.Integer({ minimum: 1, maximum: 1000000000 }),
  currency: Type.Optional(CurrencyCodeSchema),
  durationDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 730 })),
});
export type CreateApplicationInput = Static<typeof CreateApplicationInputSchema>;

export const UpdateApplicationStatusInputSchema = Type.Object({
  status: Type.Union([
    Type.Literal('UNDER_REVIEW'),
    Type.Literal('SHORTLISTED'),
    Type.Literal('REJECTED'),
  ]),
  reason: Type.Optional(Type.String({ maxLength: 255 })),
});
export type UpdateApplicationStatusInput = Static<typeof UpdateApplicationStatusInputSchema>;

export const AcceptApplicationInputSchema = Type.Object({
  expectedVersion: Type.Integer({ minimum: 1 }),
  expectedApplicationVersion: Type.Integer({ minimum: 1 }),
});
export type AcceptApplicationInput = Static<typeof AcceptApplicationInputSchema>;

export const ApplicationStatusHistoryResponseSchema = Type.Object({
  id: UuidSchema,
  applicationId: UuidSchema,
  fromStatus: ApplicationStatusSchema,
  toStatus: ApplicationStatusSchema,
  actorId: UuidSchema,
  reason: Type.Union([Type.String(), Type.Null()]),
  createdAt: IsoDateTimeSchema,
});
export type ApplicationStatusHistoryResponse = Static<
  typeof ApplicationStatusHistoryResponseSchema
>;

export const ApplicationResponseSchema = Type.Object({
  id: UuidSchema,
  assignmentId: UuidSchema,
  applicantId: UuidSchema,
  coverLetter: Type.String(),
  proposedRate: MinorUnitsSchema,
  currency: CurrencyCodeSchema,
  durationDays: Type.Union([Type.Integer(), Type.Null()]),
  status: ApplicationStatusSchema,
  version: Type.Integer(),
  history: Type.Array(ApplicationStatusHistoryResponseSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ApplicationResponse = Static<typeof ApplicationResponseSchema>;
