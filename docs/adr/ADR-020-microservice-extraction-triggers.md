# ADR-020: Microservice Extraction Strategy & Trigger Criteria

## Status

Approved

## Context

While CreatorConnect launches with a Modular Monolith Core alongside specialist Realtime and Worker tiers, long-term platform growth may eventually require physically extracting specific domains into standalone microservices. Extracting services without clear, data-driven triggers leads to organizational chaos and accidental complexity.

## Decision

Establish an **Objective, Metrics-Driven Extraction Framework** that defines the precise triggers, prerequisites, and steps for physically extracting a logical domain from the Modular Monolith into a standalone microservice:

### 1. Concrete Extraction Triggers (Must satisfy at least ONE):

1. **Targeted Scale Asymmetry**: A single domain experiences traffic volume > 10x higher than the rest of the marketplace, exhausting the shared database connection pool or CPU capacity (e.g., Creator Profile Views reaching > 50M requests/month).
2. **Independent Deployment Frequency**: A domain requires multiple production deployments per day by a dedicated cross-functional engineering team, causing deployment bottlenecks on the core repo.
3. **Severe Failure Isolation / Regulatory Boundary**: Enterprise compliance mandates that financial ledger data or identity secrets reside in a physically segregated VPC/database with isolated IAM access.
4. **Distinct Compute / Hardware Profiles**: A domain requires GPU-accelerated computing (e.g., AI video generation or computer vision safety scanning) incompatible with standard API container definitions.

### 2. Mandatory Extraction Prerequisites:

- Domain must already adhere to Clean Architecture (`domain`, `application/ports`, `infrastructure`).
- Domain must share zero database tables with other modules (queries must be isolated via repository ports).
- All cross-domain operations must be asynchronous via Outbox events or encapsulated in explicit facade APIs.

### 3. Extraction Sequence:

1. Fork domain repository module into a new container project.
2. Direct traffic via Cloudflare Edge path-routing to the new service endpoint.
3. Migrate the domain database tables to a dedicated PostgreSQL database schema/instance.
4. Replace internal module calls with typed HTTP/gRPC client calls.

## Alternatives Evaluated

- **Arbitrary Service Extraction Based on Team Org Chart**: Rejected because Conway's law without architectural rigor creates distributed microservices before domain data boundaries are stable.
- **Never Extract (Monolith Forever)**: Rejected because monolithic scaling hits physical database connection and container resource limits at high enterprise scale.

## Consequences

- **Positive**: Clean evolutionary architecture; eliminates premature distributed complexity while providing an unambiguous roadmap for physical scaling.
- **Negative**: Requires ongoing architectural governance to prevent domain boundaries from eroding before extraction.

## Security Impact

Enables zero-trust network policies and isolated IAM credentials for extracted high-security domains.

## Performance Impact

Prevents noisy-neighbor domains from exhausting shared database resources.

## Migration Implications

Following the Clean Architecture guidelines established in Phase 0 ensures that extraction is a mechanical refactor rather than a ground-up rewrite.
