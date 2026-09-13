# Phase 2 — Design System + Microfrontend Foundation

## Objective

Build the unified visual design system, accessible UI component library, and multi-zone layout shells for all microfrontend domains.

## Scope

- `@creatorconnect/design-system`: Tailwind CSS configuration, typography, color tokens, dark mode.
- `@creatorconnect/ui`: Radix UI primitives and shadcn/ui components (buttons, dialogs, form controls, tables, toasts).
- Setup Storybook for visual documentation and Chromatic visual regression testing.
- Base application shells for `app-creator`, `app-pro`, `app-brand`, and `app-admin`.

## Prerequisites

- Phase 1 completed and verified.

## Architecture Changes

- Microfrontend component tree standard locked. Zero ad-hoc styling allowed in apps.

## Backend Services

- None.

## Frontend / Microfrontend Changes

- Scaffolding of multi-zone Next.js apps with shared navigation and headers.

## Database Changes

- None.

## API Changes

- None.

## Events

- None.

## Background Jobs

- None.

## Security

- Content Security Policy (CSP) headers configured in Next.js middleware.

## Testing

- Storybook component unit tests with `@storybook/test`.
- Accessibility testing via `axe-core`.

## Playwright

- Visual snapshot tests for primitive UI components.

## CI/CD

- Storybook automated build and Chromatic visual diffing workflow in GitHub Actions.

## Observability

- Frontend Sentry SDK initialized in Next.js apps.

## Documentation Changes

- Update `docs/architecture/microfrontends.md` with component inventory.

## Dependencies / Libraries Added

- `tailwindcss`, `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `storybook`.

## Files Created

- `packages/design-system/*`, `packages/ui/*`, `apps/web-shell/src/components/*`.

## Files Modified

- `pnpm-workspace.yaml`, `BACKEND.md`.

## Files Removed

- None.

## Migration Required

- None.

## Breaking Changes

- None.

## Client Impact

### Web

Delivers production UI primitives and theme switching to all web apps.

### Android

N/A.

### iOS

N/A.

### Admin

Adopts the unified design system.

## Definition of Done

- [x] Unified visual design system (`@creatorconnect/design-system`) with tokens and Tailwind preset.
- [x] Accessible UI component library (`@creatorconnect/ui`) based on Radix UI primitives and CVA.
- [x] Multi-zone microfrontend layout shells for `/creator`, `/pro`, `/brand`, and `/admin`.
- [x] Defense-in-depth Content Security Policy (CSP) and OWASP headers in Next.js middleware.
- [x] Full unit, smoke, and Playwright cross-browser regression test suite passing cleanly.

## Exit Criteria

- Production-grade design tokens and UI library verified across all microfrontends.

## Known Risks

- CSS specificity collisions across microfrontends (mitigated by Tailwind preset and scoped utilities).

## Rollback Strategy

- Revert Phase 2 PRs.

## Phase 2.1 Follow-Up Tasks

- [ ] `TASK-P2.1-VITEST-MIGRATION`: Evaluate monorepo upgrade from Vitest 2.1.9 to Vitest 3.x/4.x patched LTS (reference: `docs/architecture/toolchain-reconciliation.md`).

## Completion Status

**COMPLETED**
