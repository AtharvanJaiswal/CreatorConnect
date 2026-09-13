# Phase 12 — Reviews + Referrals + Moderation + Admin

## Objective

Implement double-blind review revelations, referral growth attribution, trust & safety reporting, and the operational Web Admin cockpit (`apps/app-admin`).

## Scope

- Prisma schemas: `reviews`, `referrals`, `referral_rewards`, `reports`, `disputes`, `admin_actions`.
- Double-blind review mechanism (hidden until both parties review or 14 days elapse).
- Operational Admin Dashboard: KYC verification queue, dispute arbitration, account bans.
- Tamper-proof admin audit logging with required justification notes.
- Playwright tests: TC-19 (Double-Blind Review), TC-20 (Moderation), TC-21 (Account Suspension).

## Prerequisites

- Phase 11 completed.

## Architecture Changes

- Admin operational governance isolated to dedicated subdomain (`admin.creatorconnect.com`).

## Backend Services

- `apps/api`: Reviews, Moderation, and Admin domain modules.

## Frontend / Microfrontend Changes

- `apps/app-admin`: Complete operational portal for operations, trust & safety, and finance.
- Review submission modals and referral invite link centers across user apps.

## Database Changes

- Migration: `0009_add_reviews_referrals_admin.sql`.

## API Changes

- `POST /api/v1/projects/{id}/reviews`
- `GET /api/v1/reviews/user/{userId}`
- `POST /api/v1/reports`
- `GET /api/v1/admin/verification-queue`
- `POST /api/v1/admin/verification/{id}/decision`
- `POST /api/v1/admin/disputes/{id}/arbitrate`
- `POST /api/v1/admin/users/{id}/suspend`

## Events

- Outbox events: `ReviewCreated`, `ReviewRevealed`, `DisputeOpened`, `AccountSuspended`.

## Background Jobs

- BullMQ cron job: Reveals pending reviews after 14-day window lapses.

## Security

- Strict Tier 2 rate limiting and mandatory MFA for all `ADMIN` accounts.
- Administrative overrides require a non-empty `reason` string and emit immutable `admin_actions` logs.

## Testing

- Unit tests verifying double-blind visibility rules (`is_revealed = false` until condition met).
- Integration tests for admin dispute arbitration and escrow unlock.

## Playwright

- Playwright TC-19, TC-20, and TC-21 passing across browsers.

## CI/CD

- Isolated build and deployment pipeline for `apps/app-admin`.

## Observability

- Security audit alerts triggered on account suspensions or manual escrow interventions.

## Documentation Changes

- Update `BACKEND.md` admin, review, and moderation endpoints.

## Dependencies / Libraries Added

- None.

## Files Created

- `apps/admin/*`, `apps/api/src/modules/admin/*`, `apps/api/src/modules/reviews/*`.

## Files Modified

- `BACKEND.md`.

## Files Removed

- None.

## Migration Required

- `0009_add_reviews_referrals_admin.sql`.

## Breaking Changes

- None.

## Client Impact

### Web

Users can submit honest reviews without fear of immediate retaliation.

### Android

Review submission and referral link sharing.

### iOS

Review submission and referral link sharing.

### Admin

Dedicated operational cockpit operational.

## Definition of Done

- [ ] Reviews remain 100% invisible until both parties submit or 14-day cron triggers.
- [ ] Admin can review KYC proofs and approve/reject trust badges.
- [ ] Account suspensions instantly terminate active sessions and block API access.
- [ ] Playwright TC-19, TC-20, and TC-21 pass cleanly in CI.

## Exit Criteria

- Complete administrative governance loop executed in staging environment.

## Known Risks

- Malicious dispute filings to delay talent payouts (mitigated by admin dispute resolution SLAs).

## Rollback Strategy

- Revert migration and redeploy previous container revision.

## Completion Status

**NOT STARTED**
