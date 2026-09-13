# Phase 15 — Scaling + AI Features

## Objective
Introduce post-launch evolutionary scale enhancements, vector embeddings for AI-assisted semantic talent matching (`pgvector`), automated brief generation, and microservice extraction if triggered by scale metrics.

## Scope
- Integration of `pgvector` extension for semantic matching on creator portfolios and campaign briefs.
- AI-assisted proposal drafting and brief extraction tools for creators and brands.
- Evaluation of microservice extraction triggers (ADR-020) for Profiles or Search domains.
- Implementation of dedicated OpenSearch cluster if PostgreSQL catalog exceeds 500,000 records.

## Prerequisites
- Phase 14 completed with stable live production operations for minimum 60 days.

## Architecture Changes
- Introduction of `AIMatcher` implementing the `MatchingProvider` interface port (ADR-019).
- Optional physical extraction of isolated microservices based on ADR-020 triggers.

## Backend Services
- AI vector embedding generation worker and semantic search endpoints.

## Frontend / Microfrontend Changes
- "AI Match Assistant" widgets in brand campaign builder and creator discovery.

## Database Changes
- Migration: `0010_add_pgvector_embeddings.sql`.

## API Changes
- `POST /api/v1/matching/ai-recommendations`
- `POST /api/v1/ai/generate-brief`

## Events
- Outbox event: `ProfileEmbeddingUpdated`.

## Background Jobs
- BullMQ queue `vector-indexing`: Generates embeddings via OpenAI / Gemini API and updates vector columns.

## Security
- AI safety guards: Prompt sanitization, prevention of private contract leaks to LLM context.

## Testing
- Evaluation benchmarks for semantic match accuracy vs. deterministic baseline.

## Playwright
- Playwright tests for AI matching recommendation UI.

## CI/CD
- Vector indexing regression testing in CI.

## Observability
- AI provider latency and cost tracking metrics.

## Documentation Changes
- Update `BACKEND.md` and ADRs to reflect AI matcher and any extracted microservices.

## Dependencies / Libraries Added
- `pgvector`, `@google/genai` or official LLM SDK.

## Files Created
- `apps/api/src/modules/matching/ai-matcher.provider.ts`.

## Files Modified
- `BACKEND.md`.

## Files Removed
- None.

## Migration Required
- `0010_add_pgvector_embeddings.sql`.

## Breaking Changes
- None.

## Client Impact
### Web
Intelligent recommendations and natural language search.
### Android
Semantic discovery and AI proposal assistant.
### iOS
Semantic discovery and AI proposal assistant.
### Admin
AI moderation insights.

## Definition of Done
- [ ] Semantic vector search enhances conversion rates without degrading p95 search latency.
- [ ] Core marketplace remains 100% operational even if external AI provider encounters downtime.
- [ ] Microservice extractions (if triggered) execute cleanly without breaking existing client APIs.

## Exit Criteria
- Demonstrable improvement in talent-campaign match conversion rates verified by business analytics.

## Known Risks
- LLM API downtime or latency spikes (mitigated by fallback to rule-based matching).

## Rollback Strategy
- Feature toggle disabling AI matcher; fallback to deterministic rule-based matcher.

## Completion Status
**NOT STARTED**
