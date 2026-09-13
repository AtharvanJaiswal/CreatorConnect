# Phase 1 Final Toolchain Reconciliation & Architecture Governance

## Status

Approved & Reconciled (Phase 1 Baseline)

---

## 1. Toolchain Inventory & Reconciliation

Following the independent toolchain research and evaluation, this document defines the authoritative toolchain state for CreatorConnect at the conclusion of Phase 1.

### 1.1 What is Already Implemented

| Capability                     | Canonical Tool                                                                                         | Configuration & Scope                                                                                          |
| :----------------------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Package Manager**            | `pnpm@9.15.4`                                                                                          | Strict workspace protocol, isolated node_modules, `pnpm install --frozen-lockfile` enforced in CI.             |
| **Monorepo Orchestration**     | Turborepo (`turbo@^2.1.2`)                                                                             | Pipelines for `build`, `lint`, `typecheck`, `test`, `dev`, and `clean`.                                        |
| **Language & Typings**         | TypeScript `5.5.4`                                                                                     | Strict mode across all packages (`noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`). |
| **Code Formatting**            | Prettier `3.3.3`                                                                                       | Checked via `pnpm format:check`, enforced across `.ts`, `.tsx`, `.js`, `.json`, `.md`, `.yml`.                 |
| **Linting**                    | ESLint (`@creatorconnect/eslint-config`)                                                               | Enforces import ordering, React rules, and TypeScript best practices across all packages.                      |
| **Git Hooks**                  | Husky `9.1.7` + lint-staged `17.5.1`                                                                   | `.husky/pre-commit` hook automatically runs Prettier on staged files.                                          |
| **Unit & Integration Testing** | Vitest `2.1.9`                                                                                         | 10 test suites across workspaces, executed strictly headless via `pnpm test:unit` (`vitest run`).              |
| **End-to-End Testing**         | Playwright `@playwright/test@^1.46.0`                                                                  | Cross-browser smoke tests across Chromium, Firefox, WebKit (`pnpm test:e2e`).                                  |
| **Secret Scanning**            | Gitleaks `gitleaks/gitleaks-action@v2`                                                                 | Scans all commits and PRs in CI for leaked secrets and API keys.                                               |
| **Runtimes & Core Engines**    | Fastify `4.29.1`, Next.js `15.5.25`, Prisma `5.18.0`, Socket.IO `4.7.5`, BullMQ `5.8.7`, Pino `9.3.2`. | Pinned and audited. Next.js upgraded to 15.5.25; Undici pinned to 6.28.1.                                      |

---

## 2. Evaluation of Tier A Candidate Tools

### 2.1 CodeQL — **ADDED NOW (CI Workflow)**

- **Category:** Static Analysis / Semantic Code Analysis (SAST)
- **Implementation:** Native GitHub Actions workflow [`.github/workflows/codeql.yml`](file:///.github/workflows/codeql.yml).
- **Dependency Impact:** **0 npm packages**, 0 bundle impact, 0 local node_modules footprint.
- **Security Benefit:** Semantic taint tracking and vulnerability detection (SQLi, XSS, Path Traversal, Insecure Deserialization) officially supported and maintained by GitHub.
- **CI Impact:** Runs asynchronously on PRs to `dev`/`main` and weekly schedules; non-blocking to local development velocity.

### 2.2 Semgrep — **ADDED NOW (CI Workflow)**

- **Category:** SAST / OWASP Top 10 Security Rules
- **Implementation:** Added to [`.github/workflows/pr-validation.yml`](file:///.github/workflows/pr-validation.yml) using `semgrep/semgrep-action@v1`.
- **Dependency Impact:** **0 npm packages**, 0 bundle impact.
- **Security Benefit:** Scans codebase against curated community rule packs (`p/security-audit`, `p/owasp-top-ten`).
- **CI Impact:** Executes in a pre-built container in ~30 seconds without impacting developer installation time.

### 2.3 Knip — **DEFERRED (Toolchain Incompatibility on Windows Environments)**

- **Category:** Dead code, unused export, and unused dependency analysis
- **Evaluation Findings:** Testing `knip` revealed a runtime dependency on native `@oxc-parser` binaries. On Windows development machines with Application Control / WDAC policies, native `.node` bindings (`@oxc-parser+binding-win32-x64-msvc`) are blocked.
- **Architectural Decision:** To preserve deterministic cross-platform parity between Windows developers and Linux CI runners without platform-specific build failures, `knip` is **DEFERRED** to Phase 2/3 when unified Docker-based dev containers or WebAssembly-only bindings mature.
- **Current Mitigations:** TypeScript strict compiler flags (`noUnusedLocals: true`, `noUnusedParameters: true`) and monorepo workspace references already prevent unused parameters and broken imports.

### 2.4 dependency-cruiser — **DEFERRED (Phase 2 Architectural Domain Extraction)**

- **Category:** Dependency rule and architectural boundary enforcement
- **Evaluation Findings:** `dependency-cruiser` introduces a heavy transitive dependency footprint (>10MB). In Phase 1 foundation, package boundaries are already strictly enforced via TypeScript project references (`composite: true`, explicit workspace references in `tsconfig.json`) and isolated package boundaries.
- **Architectural Decision:** **DEFERRED** to Phase 2, when domain microservices and microfrontends start introducing complex intra-service boundary rules.

---

## 3. What Should NOT Be Added (Prohibited / Overlapping Tools)

Per ADR-016 (Library-First & Anti-Duplication Governance), the following tools are explicitly **PROHIBITED** or rejected from Phase 1:

| Prohibited / Rejected Tool | Reason for Exclusion                                                                    | Canonical Approved Replacement          |
| :------------------------- | :-------------------------------------------------------------------------------------- | :-------------------------------------- |
| **SonarQube**              | Heavyweight self-hosted Java/Docker infrastructure; high maintenance overhead.          | **CodeQL + ESLint**                     |
| **Snyk full suite**        | Commercial licensing, duplicate vulnerability scanner overlapping existing tools.       | **`pnpm audit` + CodeQL + Gitleaks**    |
| **Datadog / New Relic**    | Premature commercial APM; Phase 1 does not require multi-tenant telemetry vendors.      | **Pino + Sentry** (Phase 0/14 baseline) |
| **Cypress / WebdriverIO**  | Violates ADR-013 prohibition against duplicate browser automation runners.              | **Playwright**                          |
| **Locust**                 | Load and stress testing framework; deferred to Phase 13 (Load & Resilience).            | **Phase 13 Scope**                      |
| **Duplicate Browser MCPs** | Unmaintained or duplicate browser-use/puppeteer wrappers create supply chain confusion. | **Microsoft Playwright MCP**            |

---

## 4. Model Context Protocol (MCP) Governance

### 4.1 Strict Prohibition on Archived Reference Servers

- **Prohibited:** The legacy Anthropic MCP reference servers (`mcp/git`, `mcp/github`, `mcp/postgres`, `mcp/redis`, `mcp/sentry`) are officially **archived and unmaintained**. Installing them in CreatorConnect is strictly forbidden due to unpatched supply-chain vulnerabilities.

### 4.2 Browser MCP Candidate: Microsoft Playwright MCP

- **Canonical Candidate:** Microsoft Playwright MCP (`@playwright/mcp`) is designated as the official browser automation MCP candidate for Antigravity integration because it is actively maintained by Microsoft and aligns with our existing Playwright testing stack.
- **Phase 1 Status:** **NOT INSTALLED PREMATURELY**. In Phase 1, automated browser smoke tests are handled directly by `pnpm test:e2e` via Playwright CLI. Playwright MCP will be evaluated and configured in Phase 2 if interactive browser sessions are required.

### 4.3 10 Non-Negotiable MCP Security Principles

When any MCP server is configured in CreatorConnect, it must strictly adhere to the following 10 security constraints:

1. **Zero Production Credentials:** Never pass production API keys, database connection strings, or administrative tokens to an MCP configuration.
2. **Zero Production DB Write Access:** MCP servers must have strictly read-only access to localized ephemeral development databases (e.g. Testcontainers or local Docker Compose).
3. **Zero Payment API Access:** Razorpay or Stripe secret keys must never be exposed or accessible to MCP servers.
4. **Zero Production Deployment Access:** MCP servers must have no IAM roles or credentials capable of deploying or modifying production infrastructure.
5. **Zero Production Secret Access:** All environment secrets must be mocked or redacted.
6. **Restricted Filesystem Access:** MCP file servers must be sandboxed strictly to the workspace directory (`f:\CreatorConnect`), with explicit denials for `.env*` secrets and system directories.
7. **No Unrestricted Shell Access:** Do not expose raw, unconstrained shell execution MCP servers. Use structured, vetted task commands.
8. **Local stdio Transport:** Prefer local process communication (`stdio`) over exposed network-listening daemon ports (`sse`).
9. **Sandboxed Browser Automation:** Browser automation must run in isolated browser profiles with ephemeral sessions, disposable cookies, and sandboxed storage.
10. **Pinned Versions:** All MCP packages must be explicitly pinned to exact semantic versions—never use `@latest`.

---

## 5. Vitest Advisory Deferral & Phase 2.1 Roadmap Task

### 5.1 Status & Exposure Analysis

- **Current Version:** Vitest `2.1.9`
- **Advisories:** `GHSA-5xrq-8626-4rwp` (Arbitrary file read in Vitest UI server), `GHSA-82fw-gwwq-j7x9` (Mocker redirect path traversal).
- **Actual Codebase Exposure:** **ZERO**.
  - CreatorConnect does **NOT** install `@vitest/ui`.
  - CreatorConnect scripts **NEVER** execute `vitest --ui`.
  - CI and local execution run exclusively via `vitest run` in headless CLI mode.
  - No Vitest UI port or API server is ever opened or exposed.
  - Test suites do not use redirect mocker paths.

### 5.2 Phase 2.1 Migration Task

- **Task Identifier:** `TASK-P2.1-VITEST-MIGRATION`
- **Objective:** Evaluate upgrading the monorepo workspace from Vitest 2.1.9 to Vitest 3.x/4.x LTS.
- **Prerequisites:** Full compatibility check of `@vitest/coverage-v8`, `@creatorconnect/testing`, and Vite config across all 10 packages.
- **Risk Classification:** Dev-toolchain only; zero production runtime blast radius.
