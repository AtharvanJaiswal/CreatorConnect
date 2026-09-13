# ADR-016: Enforcing Library-First Development & Prohibiting Reinvention

## Status

Approved

## Context

Engineering teams often suffer from "Not Invented Here" (NIH) syndrome, writing custom implementations for queue systems, UI primitives, authentication wrappers, validators, date helpers, and file processors. These bespoke solutions lack edge-case hardening, comprehensive test coverage, security audits, and long-term documentation, resulting in technical debt and production bugs.

## Decision

Mandate **Library-First Development** as an uncompromisable architectural policy across CreatorConnect:

1. **Rule**: Before writing custom code for an infrastructure or utility problem, developers must evaluate whether a mature, battle-tested library solves it (e.g., BullMQ for queues, TypeBox/Zod for validation, Radix UI for accessible primitives, date-fns for dates, Sharp for images, FFmpeg for video).
2. **Evaluation Framework**: A dependency must pass the 7-Point Vetting Checklist (maturity > 100k weekly downloads, active commits < 6 months, permissive MIT/Apache license, first-class TypeScript types, clean security audit, justified bundle weight).
3. **Prevention of Duplication**: The project strictly prohibits having competing libraries for the same responsibility (e.g., no Axios alongside Fetch; no Drizzle alongside Prisma; no Moment alongside date-fns).

## Alternatives Evaluated

- **Zero-Dependency Approach**: Rejected because writing custom cryptography, accessible UI modals, and distributed queue managers from scratch consumes hundreds of engineering hours and introduces critical security flaws.
- **Unrestricted Package Installation**: Rejected because unvetted npm packages cause dependency bloat, bundle size explosion, and severe supply-chain attack vectors.

## Consequences

- **Positive**: Engineers focus 100% of effort on unique creator economy business value; software reliability is inherited from world-class open-source projects; onboarding velocity is maximized.
- **Negative**: Requires rigorous PR review to enforce the 7-point checklist and ensure developers do not install trivial packages for 5 lines of stable code.

## Security Impact

Leverages audited open-source code while automated Trivy and Dependabot scanners immediately flag known vulnerabilities.

## Performance Impact

Prevents duplicate bundles and unoptimized custom algorithms from degrading runtime performance.

## Migration Implications

Dependencies are wrapped behind ports and adapters where appropriate, ensuring they can be replaced if a library becomes deprecated.
