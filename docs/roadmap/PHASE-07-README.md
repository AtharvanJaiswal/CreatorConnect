# Phase 7 — Assignments / Campaigns + Applications

## Objective
Build the core marketplace campaign brief builder for brands and proposal application engine for creators and production talent.

## Scope
- Prisma schemas: `campaigns`, `campaign_requirements`, `campaign_attachments`, `applications`, `application_status_history`.
- Campaign creation and editing with milestone breakdowns and budget bounds.
- Proposal submission with custom quotes, portfolio attachments, and status state machine (PENDING, SHORTLISTED, REJECTED, HIRED).
- Playwright tests: TC-09, TC-10, TC-11.

## Prerequisites
- Phase 6 completed.

## Architecture Changes
- Application status state machine enforced strictly by backend domain services.

## Backend Services
- `apps/api`: Campaign and Application domain modules.

## Frontend / Microfrontend Changes
- `apps/app-brand`: Multi-step campaign brief creator and applicant review kanban board.
- `apps/app-pro` & `apps/app-creator`: Proposal submission drawer and application status tracker.

## Database Changes
- Migration: `0004_add_campaigns_and_applications.sql`.

## API Changes
- `POST /api/v1/campaigns`
- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/{id}`
- `PATCH /api/v1/campaigns/{id}`
- `POST /api/v1/campaigns/{id}/apply`
- `GET /api/v1/campaigns/{id}/applications`
- `PATCH /api/v1/applications/{id}/status`

## Events
- Outbox events: `CampaignCreated`, `ApplicationSubmitted`, `CandidateShortlisted`.

## Background Jobs
- None (Event consumers dispatched in Phase 10).

## Security
- Tenancy guard: Brands can only view and manage their own campaigns and applicants.
- Anti-spam: Rate limits on proposal submissions (max 10 proposals per hour per user).

## Testing
- Unit tests for application state machine validation (e.g. cannot shortlist an already rejected applicant).
- Testcontainers integration tests for campaign creation and querying.

## Playwright
- Playwright TC-09 (Campaign Creation), TC-10 (Proposal Submission), TC-11 (Shortlisting).

## CI/CD
- Contract tests verify campaign request/response schemas.

## Observability
- Application submission counter metric (`applications_submitted_total`).

## Documentation Changes
- Update `BACKEND.md` campaigns and applications endpoints.

## Dependencies / Libraries Added
- None.

## Files Created
- `apps/api/src/modules/campaigns/*`, `apps/api/src/modules/applications/*`.

## Files Modified
- `BACKEND.md`.

## Files Removed
- None.

## Migration Required
- `0004_add_campaigns_and_applications.sql`.

## Breaking Changes
- None.

## Client Impact
### Web
Brands can post campaigns and hire talent. Talent can browse gigs and apply.
### Android
Full campaign browsing and application flow.
### iOS
Full campaign browsing and application flow.
### Admin
Campaign moderation review enabled.

## Definition of Done
- [ ] Brands can create structured briefs with milestones.
- [ ] Talent can submit proposals with custom quotes.
- [ ] Status transitions enforce valid state changes.
- [ ] Playwright TC-09, TC-10, and TC-11 pass in CI.

## Exit Criteria
- Complete proposal lifecycle executed in staging environment without error.

## Known Risks
- Concurrent status update collisions (mitigated by optimistic concurrency `version` check).

## Rollback Strategy
- Revert migration and redeploy previous container revision.

## Completion Status
**NOT STARTED**
