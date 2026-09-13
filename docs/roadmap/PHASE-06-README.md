# Phase 6 — Discovery + Search + Matching

## Objective

Implement high-performance talent discovery using PostgreSQL Full-Text Search (`tsvector`), fuzzy keyword matching (`pg_trgm`), and the explainable rule-based candidate matching engine.

## Scope

- GIN full-text search indexing on creator and pro profiles.
- Discovery API endpoints with cursor-based pagination and multi-facet filtering.
- Explainable rule-based candidate matching engine (`MatchingProvider`).
- Playwright tests: TC-07 (Discovery) and TC-08 (Search & Filtering).

## Prerequisites

- Phase 5 completed.

## Architecture Changes

- Search and Matching provider abstractions operational adhering to ADR-018 and ADR-019.

## Backend Services

- `apps/api`: Search and matching route handlers with TypeBox query parameter schemas.

## Frontend / Microfrontend Changes

- `apps/web-shell` and `apps/app-brand`: Creator discovery directory, search bar, filter drawers, and score badges.

## Database Changes

- Migration: `0003_add_fts_and_trgm_indices.sql` (Enables `pg_trgm` extension and creates GIN indices on `tsvector` columns).

## API Changes

- `GET /api/v1/discovery/creators`
- `GET /api/v1/discovery/professionals`
- `POST /api/v1/matching/recommendations`

## Events

- None.

## Background Jobs

- None (PostgreSQL generated columns update FTS vectors synchronously on profile updates).

## Security

- Sanitization of full-text search query strings to prevent SQL injection or syntax crashes.
- Tier 3 rate limiting on search endpoints (30 req/min).

## Testing

- Integration tests verifying FTS query precision, recall, and trigram fuzzy matching.
- Unit tests verifying rule-based scoring dimensions (Skill, Budget, Genre, Rating).

## Playwright

- Playwright TC-07 and TC-08 passing across browsers.

## CI/CD

- Testcontainers PostgreSQL instance verifies extension compilation (`pg_trgm`).

## Observability

- Search latency histogram metric (`search_query_duration_seconds`).

## Documentation Changes

- Update `BACKEND.md` discovery and matching endpoints.

## Dependencies / Libraries Added

- None (leveraging native PostgreSQL extensions).

## Files Created

- `apps/api/src/modules/search/*`, `apps/api/src/modules/matching/*`.

## Files Modified

- `BACKEND.md`.

## Files Removed

- None.

## Migration Required

- `0003_add_fts_and_trgm_indices.sql`.

## Breaking Changes

- None.

## Client Impact

### Web

Brands can filter creators by category, budget range, and verified skills.

### Android

Fast search with cursor pagination.

### iOS

Fast search with cursor pagination.

### Admin

Ability to inspect matching scores.

## Definition of Done

- [ ] Sub-50ms search query response times over 50,000 synthetic profile records.
- [ ] Match score calculations return deterministic 0-100 scores with transparent reason codes.
- [ ] Playwright TC-07 and TC-08 pass in CI.

## Exit Criteria

- Brands can search for "DaVinci Resolve video editor" and receive accurately ranked results.

## Known Risks

- GIN index rebuild overhead on bulk updates (mitigated by asynchronous batch profile indexing if volume grows).

## Rollback Strategy

- Revert migration and drop GIN indices.

## Completion Status

**NOT STARTED**
