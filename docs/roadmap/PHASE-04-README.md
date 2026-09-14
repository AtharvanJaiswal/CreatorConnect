# Phase 4 — Core Business Domains & Discovery (COMPLETED)

## Objective

Build and release the first major CreatorConnect business-domain capabilities on top of the Phase 3 identity foundation, covering multi-persona profiles, portfolio showcase with presigned S3/R2 media, background media processing worker, brand-owned assignments, concurrency-safe application submission and atomic hiring, and hybrid PostgreSQL FTS + trigram fuzzy discovery.

## Scope & Implemented Domains

1. **Database & Migrations**:
   - 15 relational models and 7 enums in PostgreSQL 16 via Prisma.
   - Migration `0002_profiles_portfolio_assignments_applications` with non-negative money `CHECK` constraints, generated `tsvector` columns, GIN indexes, `pg_trgm` extension, and trigram GIN indexes.
   - Forward-only, additive schema preserving existing users and audit logs.
2. **Profiles**:
   - `CreatorProfile`, `ProfessionalProfile`, `BrandProfile`, `PodcasterProfile`.
   - Taxonomy `Category` and `Skill` catalog with `SkillProficiency` enum (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`).
   - Profile visibility control (`PUBLIC`, `UNLISTED`, `PRIVATE`) and HTTPS external URL validation.
   - Strict role-gated ownership and CASL subject policies.
3. **Portfolio**:
   - Portfolio item CRUD with display ordering.
   - Media attachment validation allowing strictly `ACTIVE` media assets.
   - `(portfolioItemId, mediaAssetId)` uniqueness constraint and deterministic ordering.
4. **Media Pipeline & Background Worker**:
   - Presigned S3/R2 upload URLs with server-authoritative quarantine keys (`quarantine/{userId}/{assetId}.ext`).
   - S3 `HeadObject` byte validation CAS (`QUARANTINED` → `PENDING_SCAN`).
   - BullMQ asynchronous worker (`apps/worker`) validating magic bytes with `file-type`.
   - Sharp image processing generating 256x256 WebP thumbnails and 640x360 16:9 WebP card previews.
   - PDF document validation with `pdf-lib`.
   - Idempotent promotion to `ACTIVE` with source quarantine cleanup.
   - Quarantine cleanup and stale `PENDING_SCAN` reconciliation schedulers.
5. **Assignments**:
   - Strictly Brand-owned assignments (`brandId: String @db.Uuid`).
   - Lifecycle: `DRAFT` → `PUBLISHED` → `IN_PROGRESS` → `COMPLETED` / `CLOSED`.
   - Optimistic concurrency control (`version`).
   - Structured deliverables requirements and soft deletion (`deletedAt`).
6. **Applications & Atomic Hiring**:
   - Proposal submission under real database row lock (`SELECT ... FOR UPDATE`) checking active deadlines.
   - Duplicate proposal prevention with `409 Conflict`.
   - Atomic acceptance algorithm executing conditional update on assignment (`id + PUBLISHED + expectedVersion`), conditional update on application (`id + assignmentId + SHORTLISTED + expectedApplicationVersion`), and non-overwriting competitor auto-rejection (`where: id + assignmentId + observedStatus + observedVersion`, inserting `POSITION_FILLED` history strictly when update `count === 1`).
   - Guaranteed rollback on any invariant collision.
7. **Discovery**:
   - PostgreSQL Full-Text Search (`tsvector`) combined with `pg_trgm` `%` fuzzy matching (similarity threshold 0.3).
   - Deterministic 3-field keyset cursor tuple `(computedRank, createdAt, id)` for stable pagination.
   - Fully parameterized raw SQL queries.
8. **Frontend Web Shell Consoles**:
   - `/discovery`: Search input, filter tabs, keyset pagination.
   - `/assignments/[id]`: Brief details, deliverables checklist, deadline countdown, proposal submission form.
   - `/assignments/[id]/applications`: Brand candidate review cockpit, shortlisting, atomic accept & hire action.
   - `/profiles/me`: Multi-persona profile management, visibility settings, presigned media uploader.
   - `/professional`: Canonical alias for production talent console.

## Testing & Verification

- 100% test pass rate across all 14 API suites (62 tests), worker unit tests (5 tests), auth tests (8 tests), validation tests (3 tests), and Playwright E2E suites (15 tests).
- Verified concurrency races:
  - Two concurrent acceptances produce exactly one winner (status `ACCEPTED`, version 2) while racing caller receives 409 conflict and rolls back cleanly.
  - Concurrently withdrawing competitor remains `WITHDRAWN` and is never overwritten by `POSITION_FILLED` rejection.
  - Concurrent duplicate proposal submission is rejected with 409 conflict.
  - Expired deadline submission is rejected with `ASSIGNMENT_DEADLINE_EXPIRED` (400).
