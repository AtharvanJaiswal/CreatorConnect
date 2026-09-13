# ADR-014: Continuous Integration & Deployment with GitHub Actions

## Status
Approved

## Context
CreatorConnect requires a secure, automated CI/CD pipeline capable of validating monorepo changes, executing contract tests, running security scanners, building hardened Docker images, and orchestrating zero-downtime blue/green deployments.

## Decision
Adopt **GitHub Actions** as the primary CI/CD automation engine:
1. **Pull Request Workflow**: Triggered on all PRs targeting `main`:
   - Monorepo dependency caching (`actions/cache` for pnpm store).
   - Parallel execution of `tsc --noEmit`, ESLint, Prettier.
   - Vitest unit and Testcontainers integration tests.
   - OpenAPI schema diff validation.
   - Security auditing via Gitleaks, Semgrep, and Trivy.
2. **Deployment Workflows**:
   - Merge to `main` automatically deploys to the Staging cluster and triggers the full 21-journey Playwright E2E suite.
   - Promotion to Production requires explicit manual review from designated release managers, followed by blue/green container traffic switching.

## Alternatives Evaluated
- **GitLab CI / CircleCI**: Evaluated. Rejected to avoid hosting and managing a fragmented toolchain outside the primary code repository and to leverage GitHub Environments and native GitHub Secret Management.
- **Jenkins**: Rejected due to high operational burden, manual server maintenance, and security patch overhead.

## Consequences
- **Positive**: Native integration with GitHub PR checks, branch protection, and CODEOWNERS; reusable composite actions across monorepo packages; managed runner infrastructure.
- **Negative**: Concurrency limits on standard free tiers (mitigated by self-hosted runners or GitHub Enterprise plan).

## Security Impact
Enforces OpenID Connect (OIDC) authentication with AWS/Cloudflare, eliminating long-lived AWS IAM secret access keys from repository secrets.

## Performance Impact
Pnpm cache and Docker layer caching reduce PR pipeline execution times from 20 minutes to < 6 minutes.

## Migration Implications
Workflows use standard shell commands and Docker builds, making future migration to any OIDC-compliant CI engine trivial.
