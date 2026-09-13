# Phase 1 — Development Environment + Monorepo Scaffolding

## Objective

Initialize the production-grade pnpm / Turborepo workspace, root configurations, developer toolchains, containerized local services (PostgreSQL, Redis, MinIO), and shared configuration packages.

## Scope

- Root `package.json`, `pnpm-workspace.yaml`, and `turbo.json`.
- Local Docker Compose stack with PostgreSQL 16, Redis 7, and MinIO.
- Base TypeScript configs, ESLint rules, and Prettier formatting in `packages/config`.
- Shared utility primitives in `packages/utils`.
- Git hooks via Husky and commit linting.

## Prerequisites

- Phase 0 Architecture approved.
- Node.js 20+ LTS, pnpm 9+, and Docker Desktop installed on developer workstations.

## Architecture Changes

- Monorepo folder hierarchy established adhering to ADR-001 and ADR-002.

## Backend Services

- Scaffold `apps/api` (Fastify root entry point).
- Scaffold `apps/realtime` (Socket.IO entry point).
- Scaffold `apps/worker` (BullMQ worker supervisor).

## Frontend / Microfrontend Changes

- Scaffold `apps/web-shell` baseline Next.js structure.

## Database Changes

- None (Prisma initialized in Phase 4; Phase 1 establishes Postgres Docker container only).

## API Changes

- None.

## Events

- None.

## Background Jobs

- None.

## Security

- Gitleaks pre-commit hook installed to block accidental secret commits.
- Strict `.gitignore` established.

## Testing

- Setup root `vitest.workspace.ts` to execute unit tests across monorepo packages.

## Playwright

- Scaffold root `playwright.config.ts` and test directories.

## CI/CD

- Implement `.github/workflows/pr-validation.yml` (typecheck, lint, formatting).

## Observability

- Setup shared Pino logger configuration package.

## Documentation Changes

- Update root `README.md` and `BACKEND.md` with verified local setup instructions.

## Dependencies / Libraries Added

- `turbo`, `pnpm`, `typescript`, `eslint`, `prettier`, `husky`, `lint-staged`, `pino`, `vitest`, `@playwright/test`.

## Files Created

- `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml`, `packages/config/*`, `packages/utils/*`.

## Files Modified

- `BACKEND.md`, `README.md`.

## Files Removed

- None.

## Migration Required

- None.

## Breaking Changes

- None.

## Client Impact

### Web

Enables running `pnpm dev` to launch local web shell.

### Android

Provides local Docker Compose backend target (`http://10.0.2.2:3000`).

### iOS

Provides local Docker Compose backend target (`http://localhost:3000`).

### Admin

Package workspace initialized.

## Definition of Done

- [ ] `pnpm install` installs cleanly with zero warnings.
- [ ] `docker compose up -d` launches Postgres, Redis, and MinIO with healthy status.
- [ ] `pnpm build` executes Turbo build pipeline cleanly across all packages.
- [ ] `pnpm test` executes Vitest across workspace.
- [ ] CI workflow runs green on initial pull request.

## Exit Criteria

- Developers can clone the repository and run `docker compose up` + `pnpm dev` in under 3 minutes.

## Known Risks

- Docker port collisions on developer machines (mitigated by environment variable overrides).

## Rollback Strategy

- Reset branch to Phase 0 commit.

## Completion Status

**NOT STARTED**
