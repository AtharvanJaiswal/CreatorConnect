# Phase 3 — Infrastructure + DevOps Foundation

## Objective
Establish the automated cloud infrastructure, container registries, staging deployment targets, and comprehensive CI/CD pipeline.

## Scope
- Multi-stage Dockerfiles for `apps/api`, `apps/realtime`, and `apps/worker`.
- GitHub Actions CI/CD workflows: PR scanning, Docker build, and Staging deployment.
- Provisioning staging AWS ECS Fargate cluster, Aurora PostgreSQL, and ElastiCache Redis.
- Setting up Cloudflare DNS, Edge routing, and Cloudflare R2 staging buckets.

## Prerequisites
- Phase 1 and Phase 2 completed.
- AWS and Cloudflare production-grade accounts configured.

## Architecture Changes
- Edge routing rules configured for Next.js multi-zones and API endpoints.

## Backend Services
- Automated containerization and deployment of `apps/api` to Staging.

## Frontend / Microfrontend Changes
- Cloudflare Pages / Vercel preview deployment pipeline configured.

## Database Changes
- Aurora PostgreSQL staging database provisioned with Multi-AZ.

## API Changes
- None.

## Events
- None.

## Background Jobs
- BullMQ staging worker container deployment verified.

## Security
- Trivy container scanner integrated into GitHub Actions; fails on High/Critical CVEs.
- CodeQL and Semgrep SAST pipelines enabled.

## Testing
- Automated container health check smoke testing in CI.

## Playwright
- Playwright staging execution pipeline configured with headless Chromium.

## CI/CD
- Full deployment pipeline `.github/workflows/deploy-staging.yml` active.

## Observability
- OpenTelemetry collectors and CloudWatch / Datadog dashboards provisioned.

## Documentation Changes
- Update `docs/deployment/environments.md` and `docs/deployment/cicd.md`.

## Dependencies / Libraries Added
- `@aws-sdk/*`, Docker buildx tools.

## Files Created
- `.github/workflows/deploy-staging.yml`, `infrastructure/terraform/*` or CloudFormation scripts.

## Files Modified
- `BACKEND.md`.

## Files Removed
- None.

## Migration Required
- None.

## Breaking Changes
- None.

## Client Impact
### Web
Live staging preview environments available on PRs.
### Android
Staging API endpoint active (`https://staging-api.creatorconnect.com`).
### iOS
Staging API endpoint active.
### Admin
Staging Admin portal active (`https://staging-admin.creatorconnect.com`).

## Definition of Done
- [ ] Docker images build cleanly under Distroless base images.
- [ ] Staging ECS services pass health checks.
- [ ] Trivy vulnerability scan passes with zero High/Critical findings.
- [ ] PR pipeline completes in under 8 minutes.

## Exit Criteria
- Staging environment fully accessible and accepting health check requests.

## Known Risks
- Cloud IAM permission misconfigurations (mitigated by least-privilege policies).

## Rollback Strategy
- Automated ECS task revision rollback.

## Completion Status
**NOT STARTED**
