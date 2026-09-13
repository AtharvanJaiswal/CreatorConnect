# Phase 8 — Projects + Deliverables + Hiring

## Objective
Implement contract creation, milestone deliverables, revision cycles, and deliverable review workflows connecting hiring clients and production talent.

## Scope
- Prisma schemas: `projects`, `project_deliverables`, `deliverable_revisions`.
- Hiring workflow converting shortlisted applications into binding contracts.
- Milestone submission, asset upload, revision requests, and sign-offs.
- Playwright tests: TC-12 (Hiring), TC-13 (Project Workspace), TC-14 (Deliverable Submission).

## Prerequisites
- Phase 7 completed.

## Architecture Changes
- Project milestone lifecycle enforced with transactional database integrity.

## Backend Services
- `apps/api`: Projects and Deliverables domain modules.

## Frontend / Microfrontend Changes
- `apps/app-brand` & `apps/app-pro`: Shared project collaboration workspace, milestone progress tracker, and deliverable review viewer.

## Database Changes
- Migration: `0005_add_projects_and_deliverables.sql`.

## API Changes
- `POST /api/v1/projects/hire`
- `GET /api/v1/projects/{id}`
- `POST /api/v1/projects/{id}/milestones/{milestoneId}/submit`
- `POST /api/v1/projects/{id}/milestones/{milestoneId}/approve`
- `POST /api/v1/projects/{id}/milestones/{milestoneId}/request-revision`

## Events
- Outbox events: `ProjectHired`, `DeliverableSubmitted`, `DeliverableApproved`, `RevisionRequested`.

## Background Jobs
- None (Escrow settlement triggered in Phase 11).

## Security
- Resource ownership guard: Only the hiring client and assigned talent can access project deliverables.
- Watermarked preview asset generation for draft review assets.

## Testing
- Unit tests for milestone transition logic (cannot approve an unsubmitted milestone).
- Integration tests for atomic hiring transaction.

## Playwright
- Playwright TC-12, TC-13, and TC-14 passing across browsers.

## CI/CD
- Contract tests verify project deliverable schemas.

## Observability
- Milestone completion duration metrics.

## Documentation Changes
- Update `BACKEND.md` projects and deliverables endpoints.

## Dependencies / Libraries Added
- None.

## Files Created
- `apps/api/src/modules/projects/*`, `apps/api/src/modules/deliverables/*`.

## Files Modified
- `BACKEND.md`.

## Files Removed
- None.

## Migration Required
- `0005_add_projects_and_deliverables.sql`.

## Breaking Changes
- None.

## Client Impact
### Web
Enables full contract workspace and deliverable review pipeline.
### Android
Milestone tracking and deliverable review.
### iOS
Milestone tracking and deliverable review.
### Admin
Dispute arbitration hooks into project deliverable logs.

## Definition of Done
- [ ] Contract creation locks milestone amounts and deadlines.
- [ ] Deliverable submissions upload assets to R2 and transition milestone states.
- [ ] Revision requests capture feedback and increment revision counters.
- [ ] Playwright TC-12, TC-13, and TC-14 pass in CI.

## Exit Criteria
- Complete project lifecycle from hiring to deliverable sign-off successfully executed in staging.

## Known Risks
- Scope dispute during revision requests (mitigated by contractual revision limits).

## Rollback Strategy
- Revert migration and redeploy previous container revision.

## Completion Status
**NOT STARTED**
