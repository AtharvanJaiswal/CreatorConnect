# Phase 10 — Notifications + Background Jobs

## Objective
Deploy the dedicated BullMQ Worker Tier (`apps/worker`), implement the Transactional Outbox event relay daemon, and build the multi-channel notification engine (FCM push + Resend email).

## Scope
- Prisma schemas: `notifications`, `notification_preferences`, `device_tokens`, `notification_deliveries`, `outbox_events`.
- Deploy `apps/worker` supervisor managing BullMQ worker queues.
- Outbox event poller daemon routing domain events to BullMQ queues.
- Multi-channel notification dispatcher honoring user preferences and quiet hours.
- Playwright test: TC-16 (In-app and push notifications).

## Prerequisites
- Phase 9 completed.
- Firebase Service Account and Resend API keys configured.

## Architecture Changes
- Asynchronous BullMQ worker tier operational adhering to ADR-001, ADR-008, and ADR-012.

## Backend Services
- `apps/worker`: BullMQ worker consumers for FCM, email, and outbox relay.
- `apps/api`: Outbox event writer and user device token registration endpoints.

## Frontend / Microfrontend Changes
- In-app notification center bell with unread badge counter and real-time dropdown.
- User notification preference settings page.

## Database Changes
- Migration: `0007_add_notifications_and_outbox.sql`.

## API Changes
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{id}/read`
- `POST /api/v1/users/device-token`
- `GET/PATCH /api/v1/users/me/notification-preferences`

## Events
- Outbox event consumers: `CampaignCreated`, `ApplicationSubmitted`, `DeliverableSubmitted`, `DeliverableApproved`.

## Background Jobs
- BullMQ queues: `outbox-relay`, `notifications-fcm`, `notifications-email`.

## Security
- Sanitized notification payloads (zero private PII or financial details in push banners).
- Automated device token cleanup on FCM invalidation errors.

## Testing
- Unit tests for user quiet hours and channel preference filters.
- Integration tests for outbox polling and BullMQ job idempotency.

## Playwright
- Playwright TC-16 (notification badge updates and delivery verification).

## CI/CD
- Dedicated Docker build and deployment for `apps/worker` container tier.

## Observability
- Queue backlog depth gauge (`queue_job_waiting_count`) and failure counter (`queue_job_failed_total`).

## Documentation Changes
- Update `BACKEND.md` background jobs, events, and notification endpoints.

## Dependencies / Libraries Added
- `bullmq`, `firebase-admin`, `resend`, `@react-email/components`.

## Files Created
- `apps/worker/src/processors/*`, `apps/api/src/modules/notifications/*`, `packages/emails/*`.

## Files Modified
- `BACKEND.md`.

## Files Removed
- None.

## Migration Required
- `0007_add_notifications_and_outbox.sql`.

## Breaking Changes
- None.

## Client Impact
### Web
Live notification dropdown with instant unread updates.
### Android
Native FCM push notifications received.
### iOS
Native APNs push notifications received via FCM.
### Admin
System notification broadcast capability.

## Definition of Done
- [ ] Outbox daemon polls and dispatches events to BullMQ with zero event loss.
- [ ] FCM push notifications successfully delivered to registered mobile tokens.
- [ ] Responsive transactional emails sent via Resend.
- [ ] Playwright TC-16 passes in CI.

## Exit Criteria
- Submitting a milestone deliverable automatically dispatches push alerts and emails within 2 seconds.

## Known Risks
- FCM rate limiting during marketing blasts (mitigated by BullMQ worker rate-limiting concurrency).

## Rollback Strategy
- Revert migration and disable notification queues.

## Completion Status
**NOT STARTED**
