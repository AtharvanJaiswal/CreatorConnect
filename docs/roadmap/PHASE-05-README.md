# Phase 5 — Profiles + Portfolio

## Objective

Build multi-persona profile engines (Creators, Production Pros, Brands, Podcasters) and Cloudflare R2 direct media upload architecture with background Sharp/FFmpeg processing.

## Scope

- Prisma schemas: `creator_profiles`, `professional_profiles`, `brand_profiles`, `podcaster_profiles`, `portfolio_items`, `portfolio_media`, `skills`, `categories`, `user_skills`.
- Presigned URL direct upload pipeline (`POST /api/v1/media/upload-session` and `upload-confirm`).
- Background BullMQ worker for image optimization (Sharp) and video thumbnail/metadata extraction (FFmpeg).
- Playwright tests: TC-03, TC-04, TC-05, TC-06.

## Prerequisites

- Phase 4 completed.
- Cloudflare R2 bucket credentials provisioned.

## Architecture Changes

- Direct-to-storage upload pipeline operational adhering to ADR-010.

## Backend Services

- `apps/api`: Profile CRUD routes and presigned URL generator.
- `apps/worker`: BullMQ `media-processing` worker active with Sharp and FFmpeg.

## Frontend / Microfrontend Changes

- `apps/app-creator`: Profile onboarding, rate card builder, portfolio showcase.
- `apps/app-pro`: Freelancer equipment inventory and video reel uploader.
- `apps/app-brand`: Brand company verification submission form.

## Database Changes

- Migration: `0002_add_profiles_and_portfolio.sql`.

## API Changes

- `GET/PUT /api/v1/profiles/creator/me`
- `GET/PUT /api/v1/profiles/pro/me`
- `POST /api/v1/media/upload-session`
- `POST /api/v1/media/upload-confirm`
- `POST /api/v1/portfolio/items`

## Events

- Outbox event: `ProfileSubmittedForVerification`, `PortfolioItemAdded`.

## Background Jobs

- BullMQ queue `media-processing`: Transcodes images, generates video preview thumbnails.

## Security

- Strict MIME and size validation before presigned URL generation.
- ClamAV antivirus scan on quarantined uploads.
- Private R2 buckets for unverified assets.

## Testing

- Integration tests for profile persistence and media status state transitions.
- Unit tests for Sharp resizing and aspect ratio calculations.

## Playwright

- Playwright TC-03 (Profile Creation), TC-04 (Editing), TC-05 (Verification), TC-06 (Portfolio Upload).

## CI/CD

- FFmpeg and Sharp dependencies installed in worker container build.

## Observability

- Media processing latency histogram metric (`media_processing_duration_seconds`).

## Documentation Changes

- Update `BACKEND.md` profiles and media endpoints.

## Dependencies / Libraries Added

- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `sharp`, `fluent-ffmpeg`.

## Files Created

- `apps/api/src/modules/profiles/*`, `apps/api/src/modules/media/*`, `apps/worker/src/processors/media.processor.ts`.

## Files Modified

- `BACKEND.md`.

## Files Removed

- None.

## Migration Required

- `0002_add_profiles_and_portfolio.sql`.

## Breaking Changes

- None.

## Client Impact

### Web

Users can build rich profiles and upload multi-gigabyte video portfolios with live progress bars.

### Android

Native upload using presigned PUT URLs.

### iOS

Native upload using presigned PUT URLs.

### Admin

Verification queue receives new submissions.

## Definition of Done

- [ ] Users can create and edit profiles across all 4 persona types.
- [ ] Direct R2 uploads work seamlessly without routing binary data through Fastify.
- [ ] Worker generates 300x300 and 800x800 WebP thumbnails automatically.
- [ ] Playwright TC-03, TC-04, TC-05, and TC-06 pass in CI.

## Exit Criteria

- Production professionals can upload 4K video reels and have thumbnails rendered in under 60 seconds.

## Known Risks

- FFmpeg worker memory exhaustion on massive video files (mitigated by worker container memory limits and timeouts).

## Rollback Strategy

- Revert migration and disable media worker queue.

## Completion Status

**NOT STARTED**
