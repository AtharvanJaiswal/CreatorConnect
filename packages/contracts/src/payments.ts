import { Type, type Static } from '@sinclair/typebox';
import {
  UuidSchema,
  IsoDateTimeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
} from '@creatorconnect/validation';

export const PaymentStatusSchema = Type.Union([
  Type.Literal('REQUIRES_PAYMENT_METHOD'),
  Type.Literal('REQUIRES_CONFIRMATION'),
  Type.Literal('PROCESSING'),
  Type.Literal('SUCCEEDED'),
  Type.Literal('REQUIRES_CAPTURE'),
  Type.Literal('FAILED'),
  Type.Literal('CANCELLED'),
  Type.Literal('REFUNDED'),
  Type.Literal('PARTIALLY_REFUNDED'),
  Type.Literal('DISPUTED'),
]);
export type PaymentStatus = Static<typeof PaymentStatusSchema>;

export const PaymentProviderSchema = Type.Union([
  Type.Literal('RAZORPAY'),
  Type.Literal('STRIPE'),
  Type.Literal('SANDBOX_MOCK'),
]);
export type PaymentProvider = Static<typeof PaymentProviderSchema>;

export const LedgerAccountTypeSchema = Type.Union([
  Type.Literal('ASSET'),
  Type.Literal('LIABILITY'),
  Type.Literal('EQUITY'),
  Type.Literal('REVENUE'),
  Type.Literal('EXPENSE'),
]);
export type LedgerAccountType = Static<typeof LedgerAccountTypeSchema>;

export const LedgerEntryDirectionSchema = Type.Union([
  Type.Literal('DEBIT'),
  Type.Literal('CREDIT'),
]);
export type LedgerEntryDirection = Static<typeof LedgerEntryDirectionSchema>;

export const CreatePaymentIntentInputSchema = Type.Object({
  projectId: UuidSchema,
  deliverableId: Type.Optional(UuidSchema),
  amount: MinorUnitsSchema,
  currency: Type.Optional(CurrencyCodeSchema),
  provider: Type.Optional(PaymentProviderSchema),
  idempotencyKey: Type.Optional(Type.String({ minLength: 8, maxLength: 128 })),
});
export type CreatePaymentIntentInput = Static<typeof CreatePaymentIntentInputSchema>;

export const ConfirmPaymentIntentInputSchema = Type.Object({
  providerPaymentId: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
});
export type ConfirmPaymentIntentInput = Static<typeof ConfirmPaymentIntentInputSchema>;

export const PaymentIntentResponseSchema = Type.Object({
  id: UuidSchema,
  projectId: UuidSchema,
  deliverableId: Type.Union([UuidSchema, Type.Null()]),
  clientId: UuidSchema,
  amount: MinorUnitsSchema,
  currency: CurrencyCodeSchema,
  platformFee: MinorUnitsSchema,
  status: PaymentStatusSchema,
  provider: PaymentProviderSchema,
  providerOrderId: Type.Union([Type.String(), Type.Null()]),
  providerPaymentId: Type.Union([Type.String(), Type.Null()]),
  idempotencyKey: Type.Union([Type.String(), Type.Null()]),
  clientSecret: Type.Union([Type.String(), Type.Null()]),
  errorMessage: Type.Union([Type.String(), Type.Null()]),
  version: Type.Integer(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type PaymentIntentResponse = Static<typeof PaymentIntentResponseSchema>;

export const LedgerEntryResponseSchema = Type.Object({
  id: UuidSchema,
  transactionId: UuidSchema,
  accountId: UuidSchema,
  direction: LedgerEntryDirectionSchema,
  amount: MinorUnitsSchema,
  currency: CurrencyCodeSchema,
  createdAt: IsoDateTimeSchema,
});
export type LedgerEntryResponse = Static<typeof LedgerEntryResponseSchema>;

export const LedgerTransactionResponseSchema = Type.Object({
  id: UuidSchema,
  paymentIntentId: Type.Union([UuidSchema, Type.Null()]),
  type: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  postedAt: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
  entries: Type.Array(LedgerEntryResponseSchema),
});
export type LedgerTransactionResponse = Static<typeof LedgerTransactionResponseSchema>;

export const LedgerAccountResponseSchema = Type.Object({
  id: UuidSchema,
  code: Type.String(),
  name: Type.String(),
  type: LedgerAccountTypeSchema,
  currency: CurrencyCodeSchema,
  userId: Type.Union([UuidSchema, Type.Null()]),
  projectId: Type.Union([UuidSchema, Type.Null()]),
  balance: Type.String(),
  isActive: Type.Boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type LedgerAccountResponse = Static<typeof LedgerAccountResponseSchema>;

export const WebhookIngestResponseSchema = Type.Object({
  received: Type.Boolean(),
  eventId: Type.String(),
  status: Type.String(),
});
export type WebhookIngestResponse = Static<typeof WebhookIngestResponseSchema>;
