# ADR-004: PostgreSQL 16 with Prisma ORM for Persistence

## Status
Approved

## Context
CreatorConnect demands relational data integrity, atomic transactional consistency for escrow contracts and financial ledgers, robust full-text indexing, and type-safe schema migrations.

## Decision
Select **PostgreSQL 16** as the primary relational database and **Prisma ORM** as the unified data access and migration engine.

## Alternatives Evaluated
- **MongoDB / NoSQL**: Rejected because escrow contracts, double-entry ledgers, and multi-sided application states require ACID transaction guarantees and strict foreign key integrity.
- **Drizzle ORM**: Evaluated as a lightweight SQL query builder. Rejected because Prisma provides a superior, battle-tested declarative migration engine (`prisma migrate`), unified schema documentation, and robust relationship modeling that aligns better with rapid enterprise domain modeling.
- **TypeORM**: Rejected due to active maintainer instability, complex inheritance bugs, and poor TypeScript type inference.

## Consequences
- **Positive**:
  - Declarative schema definition in `schema.prisma` acts as an authoritative database catalog.
  - Automatic generation of end-to-end type-safe database queries.
  - Seamless support for PostgreSQL features: `uuidv7` default generation, GIN indices, and raw SQL queries when complex aggregations are required.
  - Transaction API (`prisma.$transaction`) guarantees atomic updates across project states and outbox events.
- **Negative**: Prisma engine binary adds ~30MB to container size (mitigated by multi-stage Docker builds); complex deep-nested queries require explicit field selection to avoid query plan inefficiency.

## Security Impact
Prisma automatically parameterizes all queries, preventing SQL injection vulnerabilities.

## Performance Impact
PostgreSQL connection pooling managed via PgBouncer or AWS RDS Proxy; read-heavy profile searches offloaded to GIN-indexed `tsvector` columns.

## Migration Implications
Migrations are version-controlled in Git, tested in CI via Testcontainers, and executed automatically during deployment pipelines.
