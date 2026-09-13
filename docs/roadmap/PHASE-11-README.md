# Phase 11 — Payments + Subscriptions

## Objective

Implement Razorpay escrow capture, authoritative webhook signature verification, double-entry accounting ledger, milestone payouts, and platform SaaS subscriptions.

## Scope

- Prisma schemas: `subscriptions`, `subscription_plans`, `payments`, `payment_orders`, `payment_attempts`, `payment_events`, `refunds`, `payouts`, `ledger_entries`.
- Razorpay Provider Adapter implementing the `PaymentProvider` interface port.
- Authoritative webhook consumer with raw-body HMAC-SHA256 signature verification.
- Double-entry accounting ledger guaranteeing zero loss and mathematical balance.
- Milestone escrow release and creator payout disbursement.
- Playwright tests: TC-17 (Payment & Escrow Lock) and TC-18 (Refund & Cancellation).

## Prerequisites

- Phase 10 completed.
- Razorpay Sandbox / Test credentials configured.

## Architecture Changes

- Financial domain locked behind `PaymentProvider` abstraction adhering to ADR-011.
- Client applications strictly prohibited from marking payments as successful.

## Backend Services

- `apps/api`: Payment order initialization, webhook receiver, ledger queries.
- `apps/worker`: Payout processing and financial reconciliation jobs.

## Frontend / Microfrontend Changes

- `apps/app-brand`: Escrow checkout drawer with Razorpay Checkout.js modal integration.
- `apps/app-creator`: Earnings wallet, withdrawal setup, and transaction history view.

## Database Changes

- Migration: `0008_add_payments_and_ledger.sql` (Enforces append-only rules on ledger entries).

## API Changes

- `POST /api/v1/payments/create-order`
- `POST /api/v1/payments/webhook`
- `GET /api/v1/payments/ledger`
- `POST /api/v1/payments/payout-request`

## Events

- Outbox events: `EscrowFunded`, `EscrowReleased`, `PayoutProcessed`, `PaymentRefunded`.

## Background Jobs

- BullMQ queue `payout-processing`: Executes automated disbursements to creator bank accounts.

## Security

- Raw-body cryptographic HMAC-SHA256 signature verification using constant-time comparison.
- Webhook replay protection: Duplicate `event_id` records ignored via unique DB constraint.
- Strict Tier 2 rate limiting (10 req/min) on payment order creation.

## Testing

- Unit tests verifying double-entry balance math (Debits == Credits).
- Integration tests simulating Razorpay webhook payloads with genuine and forged HMAC signatures.

## Playwright

- Playwright TC-17 (Escrow Payment) and TC-18 (Refund) passing in CI.

## CI/CD

- Testcontainers integration test executes simulated payment reconciliation run.

## Observability

- Payment conversion rate gauge (`payment_success_rate`) and Sentry alerts on webhook failures.

## Documentation Changes

- Update `BACKEND.md` payments and ledger endpoints.

## Dependencies / Libraries Added

- `razorpay`, `crypto`.

## Files Created

- `apps/api/src/modules/payments/*`, `apps/worker/src/processors/payout.processor.ts`.

## Files Modified

- `BACKEND.md`.

## Files Removed

- None.

## Migration Required

- `0008_add_payments_and_ledger.sql`.

## Breaking Changes

- None.

## Client Impact

### Web

Brands can securely fund escrow; creators can track earnings and request payouts.

### Android

Razorpay Mobile SDK integration.

### iOS

Razorpay Mobile SDK integration.

### Admin

Financial audit view and escrow unlock overrides.

## Definition of Done

- [ ] Escrow funds locked only upon verified webhook delivery.
- [ ] Ledger mathematically balances to zero across all transactions.
- [ ] Webhook replay attempts return 200 OK without double-crediting accounts.
- [ ] Playwright TC-17 and TC-18 pass cleanly in CI.

## Exit Criteria

- Complete escrow-to-payout financial lifecycle executed with 100% ledger audit compliance.

## Known Risks

- Bank transfer gateway delays during creator payouts (mitigated by asynchronous status polling).

## Rollback Strategy

- Revert migration and disable payment order generation.

## Completion Status

**NOT STARTED**
