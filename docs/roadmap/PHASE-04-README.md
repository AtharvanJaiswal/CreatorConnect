# Phase 4 — Identity + Authentication + Authorization

## Objective
Implement end-to-end authentication with Supabase Auth, PostgreSQL user provisioning, Fastify JWT verification plugins, and backend-owned multi-tier RBAC guards.

## Scope
- Prisma schema setup: `users`, `roles`, `user_roles`, `audit_logs`.
- Supabase Auth integration: Web client login, mobile token exchange, session refresh.
- Fastify JWT verification plugin verifying tokens against Supabase JWKS.
- Backend RBAC middleware and CASL rule engine in `@creatorconnect/auth`.
- Playwright tests for TC-01 (Registration) and TC-02 (Login & Session Refresh).

## Prerequisites
- Phase 3 completed.
- Supabase project credentials configured.

## Architecture Changes
- Identity layer fully operational adhering to ADR-006 and ADR-007.

## Backend Services
- `apps/api`: Implement `/api/v1/auth/sync`, `/api/v1/users/me`, and RBAC guards.

## Frontend / Microfrontend Changes
- Implement authentication UI in `apps/web-shell`: `/login`, `/register`, `/reset-password`.
- Integrate `<AuthProvider>` into all Next.js applications.

## Database Changes
- Initial Prisma migration applying `users`, `roles`, `user_roles`, and `audit_logs` tables.

## API Changes
- `POST /api/v1/auth/sync`: Syncs Supabase identity to PostgreSQL.
- `GET /api/v1/users/me`: Returns profile and active RBAC roles.
- `PATCH /api/v1/users/me`: Updates contact details.

## Events
- Outbox event: `UserRegistered`.

## Background Jobs
- None.

## Security
- JWKS public key caching (24h) with automated rotation handling.
- Tier 1 rate limiting (5 req/min) on auth endpoints via Redis.
- Zero credentials or tokens logged in Pino.

## Testing
- Unit tests for CASL permission rules.
- Testcontainers integration tests verifying user creation and role assignments.

## Playwright
- Playwright E2E tests for TC-01 and TC-02 passing across Chromium, Firefox, WebKit.

## CI/CD
- Prisma migration validation and rehearsal running in CI pipeline.

## Observability
- Auth failure metrics and brute-force attempt alerts wired to Sentry.

## Documentation Changes
- Update `BACKEND.md` endpoints status from PLANNED to STABLE for Auth & Users.

## Dependencies / Libraries Added
- `@supabase/supabase-js`, `@fastify/jwt`, `jose`, `@casl/ability`.

## Files Created
- `packages/auth/*`, `apps/api/src/modules/auth/*`, `apps/api/src/modules/users/*`.

## Files Modified
- `BACKEND.md`.

## Files Removed
- None.

## Migration Required
- `0001_init_identity_and_users.sql`

## Breaking Changes
- None.

## Client Impact
### Web
Enables real login, session persistence, and role-based route protection.
### Android
Enables token exchange and authentication against backend.
### iOS
Enables token exchange and authentication against backend.
### Admin
Enables operational login with `ADMIN` role requirement.

## Definition of Done
- [ ] Users can register and log in via Supabase Auth across Web and Mobile.
- [ ] Backend verifies JWT signatures locally in < 1ms via cached JWKS.
- [ ] Non-authenticated requests return RFC 7807 401 Unauthorized.
- [ ] Role-protected endpoints return RFC 7807 403 Forbidden.
- [ ] Playwright TC-01 and TC-02 pass cleanly in CI.

## Exit Criteria
- Both Web and Mobile clients can authenticate and retrieve their user context.

## Known Risks
- Supabase token clock skew (mitigated by setting 60s leeway on JWT verification).

## Rollback Strategy
- Revert migration and redeploy previous container revision.

## Completion Status
**NOT STARTED**
