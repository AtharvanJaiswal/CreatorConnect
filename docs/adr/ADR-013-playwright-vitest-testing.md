# ADR-013: Automated Testing Framework Standardization: Vitest and Playwright

## Status

Approved

## Context

A mission-critical multi-sided marketplace handling financial contracts and creator careers requires absolute testing rigor. Disjointed testing tooling across frontend and backend causes configuration friction, slow test execution in CI, and unmaintained test suites.

## Decision

Standardize on **Vitest** for Unit and Integration testing and **Playwright** for End-to-End browser automation across the entire monorepo:

1. **Vitest**:
   - Executes Unit tests for pure domain logic, value objects, and utility functions in sub-second speeds.
   - Executes Integration tests paired with **Testcontainers** (spinning up real PostgreSQL and Redis containers) for repository and transactional testing.
   - Shares the same Vite AST transformation configuration across all monorepo packages.
2. **Playwright**:
   - Exercises the **21 Critical Customer Journeys** across Chromium, Firefox, and WebKit.
   - Enforces automatic retries, network interception, visual assertions, and automatic trace/video capture on CI failure.

## Alternatives Evaluated

- **Jest**: Evaluated. Rejected due to poor ESM compatibility, slow startup times compared to Vitest (Vitest is 4x faster via Vite HMR engine), and fragmented configuration across TypeScript monorepos.
- **Cypress**: Evaluated for E2E. Rejected due to lack of multi-tab and multi-context testing (critical for testing dual-sided chat between Creator and Brand), slow execution, and brittle iframe handling compared to Playwright.

## Consequences

- **Positive**: Ultra-fast test execution in local development and CI; single testing syntax across frontend and backend; robust multi-user browser testing for chat and contract interactions.
- **Negative**: Testcontainers requires Docker to be running locally for integration test passes.

## Security Impact

Enables automated security regression testing (e.g., verifying that modifying user IDs in requests returns 403 Forbidden).

## Performance Impact

Vitest's multi-threaded worker pools execute thousands of unit tests in under 15 seconds.

## Migration Implications

None. Vitest is 100% API-compatible with Jest assertions (`expect`, `describe`, `it`, `vi.fn()`), easing developer onboarding.
