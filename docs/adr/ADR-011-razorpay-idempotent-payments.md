# ADR-011: Razorpay Integration with Provider Abstraction & Double-Entry Ledger

## Status
Approved

## Context
Escrow funding, milestone payouts, and subscription billing are mission-critical. Payment failures, double-charges, or unverified client callbacks can destroy creator trust and cause direct financial loss. The platform requires a payment provider with strong domestic and international payment support (Cards, UPI, NetBanking, Escrow Routes) while strictly insulating core marketplace logic from proprietary vendor lock-in.

## Decision
Adopt **Razorpay** as the primary payment gateway, encapsulated behind a strict **Payment Provider Abstraction Port**:
1. **Port & Adapter Pattern**:
   ```typescript
   export interface PaymentProvider {
     createOrder(params: CreateOrderParams): Promise<PaymentOrderResult>;
     verifyWebhookSignature(payload: string, signature: string): boolean;
     processPayout(params: PayoutParams): Promise<PayoutResult>;
     initiateRefund(params: RefundParams): Promise<RefundResult>;
   }
   ```
2. **Asynchronous Webhook Fulfillment**: Never mark an escrow order as funded based on the frontend client redirect. Escrow is locked **only upon cryptographically verifying the Razorpay webhook signature (HMAC-SHA256)** on raw request buffers.
3. **Double-Entry Financial Ledger**: Every payment event atomically records matching debit and credit entries in `ledger_entries` within a database transaction.
4. **Idempotency**: All webhook events log the unique `razorpay_payment_id` with a database unique constraint, ignoring duplicate deliveries.

## Alternatives Evaluated
- **Stripe**: Evaluated as a global standard. Deferred for initial launch due to Razorpay's native UPI, e-mandate, and Indian banking routing optimization. The `PaymentProvider` interface ensures Stripe can be plugged in for international expansion with zero business logic changes.
- **Direct Client SDK Callback Trust**: Rejected as a critical security vulnerability that allows attackers to fake payment confirmations.

## Consequences
- **Positive**: Zero risk of double-charging; 100% auditable financial trail; clean abstraction enables multi-gateway routing in the future.
- **Negative**: Requires handling out-of-order webhook delivery and maintaining local ledger reconciliation jobs.

## Security Impact
Raw webhook signatures are verified using constant-time cryptographic comparisons (`crypto.timingSafeEqual`), preventing timing attacks and replay attacks.

## Performance Impact
Webhook processing executes in < 30ms, recording an outbox event that asynchronously notifies connected users via WebSocket.

## Migration Implications
Adding secondary payment processors (e.g., Stripe, Cashfree) in Phase 11 requires only implementing the `PaymentProvider` interface and registering it in the dependency container.
