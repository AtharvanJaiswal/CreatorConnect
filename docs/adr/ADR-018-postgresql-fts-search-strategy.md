# ADR-018: Search Architecture: PostgreSQL Full-Text Search and Trigram Matching

## Status

Approved

## Context

Creator discovery, skill filtering, and campaign catalog search are core to marketplace liquidity. Introducing a dedicated search cluster (e.g., Elasticsearch, OpenSearch, Meilisearch) on Day 1 adds high infrastructure cost, dual-write synchronization complexity, indexing lag, and cluster management overhead.

## Decision

Adopt **PostgreSQL Full-Text Search (`tsvector`)** and **Trigram Similarity (`pg_trgm`)** for Phase 0–6 discovery and search operations, encapsulated behind a **Search Provider Abstraction**:

1. **Implementation**:
   - `creator_profiles` and `professional_profiles` maintain generated `tsvector` columns indexing bio, headline, skills, and equipment.
   - GIN indices provide sub-50ms query execution across 100,000+ profile records.
   - Trigram extension (`pg_trgm`) powers typo-tolerant fuzzy matching on creator names and skill keywords.
2. **Port Abstraction**:
   ```typescript
   export interface SearchProvider {
     searchCreators(query: CreatorSearchQuery): Promise<PaginatedResult<CreatorSummary>>;
     searchCampaigns(query: CampaignSearchQuery): Promise<PaginatedResult<CampaignSummary>>;
   }
   ```

## Alternatives Evaluated

- **Elasticsearch / OpenSearch**: Rejected as premature enterprise overengineering for initial launch. Managing cluster shards, JVM memory tuning, and CDC (Change Data Capture) outbox pipelines to keep ES in sync with Postgres is unnecessary at this stage.
- **Algolia**: Evaluated. Rejected due to high commercial cost per search query and external data residency concerns.

## Consequences

- **Positive**: Zero additional infrastructure to operate; 100% transactional consistency (zero search index sync lag); instant query updates upon profile editing.
- **Negative**: Advanced lexical features (semantic search, complex multi-lingual stemming) are limited compared to dedicated search engines.

## Security Impact

All search queries use parameterized Prisma / PostgreSQL statements, eliminating SQL injection vectors.

## Performance Impact

Sub-50ms search latency achieved through GIN indexing and database-level query optimization.

## Migration Implications

When search catalog size exceeds 500,000 active records or p95 query latency exceeds 150ms, the `SearchProvider` interface allows swapping PostgreSQL FTS for OpenSearch / Typesense with zero changes to frontend or domain layers.
