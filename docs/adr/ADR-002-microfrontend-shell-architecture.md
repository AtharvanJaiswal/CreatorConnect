# ADR-002: Multi-Zone Domain Microfrontends with Shared Monorepo Packages

## Status
Approved

## Context
CreatorConnect serves five distinct personas (Creators, Production Professionals, Brands, Podcasters, and Administrators). If all workflows are coupled into a single massive Next.js application, bundle sizes balloon, build times degrade, and deployments become high-risk monolithic events. Conversely, runtime Module Federation introduces browser-level dependency mismatch risks, version skew, and complex client-side orchestration.

## Decision
Implement a **Multi-Zone Next.js Microfrontend Architecture** hosted within a Turborepo / pnpm monorepo:
1. **Domain Applications (`apps/`)**:
   - `web-shell`: Public discovery, landing pages, marketing, authentication entrance.
   - `app-creator`: Creator workspace, job board, crew hiring, earnings.
   - `app-pro`: Production freelancer dashboard, deliverables, portfolio management.
   - `app-brand`: Brand campaign builder, candidate shortlisting, escrow funding.
   - `app-admin`: Operations, KYC verification, dispute arbitration, financial reconciliation.
2. **Compile-Time Shared Packages (`packages/`)**:
   - `@creatorconnect/ui` (shadcn/ui + Radix UI primitives)
   - `@creatorconnect/design-system` (Tailwind tokens, typography, CSS vars)
   - `@creatorconnect/api-client` (Generated TanStack Query hooks)
   - `@creatorconnect/contracts` (TypeScript DTOs from OpenAPI)
   - `@creatorconnect/auth` (Supabase Auth session provider)
3. **Routing**: Managed at Cloudflare Edge via path rewrites (`/creator/*`, `/pro/*`, `/brand/*`) and DNS subdomain for `admin.creatorconnect.com`.

## Alternatives Evaluated
- **Single Monolithic Next.js App**: Rejected due to bundle bloat and inability to deploy brand features independently of creator features.
- **Runtime Module Federation (Webpack / Vite)**: Rejected due to fragile runtime script loading, SSR complexity, and brittle shared React version management.

## Consequences
- **Positive**: Independent CI/CD deployment per domain app; shared design tokens and UI components guarantee visual consistency; isolated blast radius; fast build times.
- **Negative**: Client navigation between different domains (e.g., from Shell to Brand App) causes a lightweight full-page reload rather than a purely client-side soft transition.

## Security Impact
The Admin application is physically hosted on an isolated subdomain (`admin.creatorconnect.com`) behind dedicated edge access policies and IP restrictions.

## Performance Impact
Substantially smaller JavaScript bundles per persona (each app only loads its relevant route bundle), achieving > 90 Google Lighthouse performance scores.

## Migration Implications
New persona apps (e.g., dedicated Agency portal) can be scaffolded as a new Next.js app in `apps/` consuming existing shared packages with zero modifications to existing domain apps.
