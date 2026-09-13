# ADR-007: Backend-Owned Multi-Tier RBAC & Resource Authorization

## Status
Approved

## Context
While Supabase Auth verifies *who* the user is, it must not dictate *what* business operations the user can perform across CreatorConnect. Placing complex business authorization, brand agency tenancy, project participant checks, and escrow permissions into JWT claims creates bloated tokens, causes stale permission bugs, and violates separation of concerns.

## Decision
Implement a **Backend-Owned Multi-Tier Authorization Engine**:
1. **Separation of Concerns**: Identity is extracted from the JWT `sub` claim; authorization roles and permissions are evaluated exclusively by the backend Fastify middleware.
2. **Three Tiers of Authorization**:
   - **Tier 1: Global RBAC**: Verifies system-level role (`CREATOR`, `BRAND`, `PRO`, `ADMIN`).
   - **Tier 2: Brand / Organization Scoping**: Verifies user membership within a specific corporate brand entity.
   - **Tier 3: Resource Ownership & Project Participation**: Verifies that the authenticated user is a direct party to the contract, conversation, or deliverable being accessed.
3. **Engine**: Implement domain-level authorization guards leveraging **CASL** for declarative in-memory attribute evaluation (`can('read', 'ProjectDeliverable', { clientId: user.id })`).

## Alternatives Evaluated
- **Embedding All Permissions into Supabase JWT App Metadata**: Rejected because JWT claims become stale when permissions change mid-session, and token sizes exceed HTTP header limits.
- **OpenFGA / Oso / Permit.io**: Evaluated. Rejected as premature enterprise overengineering that introduces an external network dependency for every authorization check.

## Consequences
- **Positive**: Instant revocation of access rights; zero stale permission windows; fine-grained access control on sensitive financial and project resources; clean testability.
- **Negative**: Requires a lightweight database/Redis cache lookup to fetch active user roles on initial request (mitigated by a 5-minute Redis session cache).

## Security Impact
Completely eliminates Insecure Direct Object Reference (IDOR) and privilege escalation vulnerabilities across project deliverables and chat streams.

## Performance Impact
User roles and project member IDs are cached in Redis with a 300-second TTL, resulting in sub-millisecond authorization evaluations.

## Migration Implications
None. CASL rules live in `@creatorconnect/auth` and can be evaluated on both backend services and frontend UI component visibility guards.
