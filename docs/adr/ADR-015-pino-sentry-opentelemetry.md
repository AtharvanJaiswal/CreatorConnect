# ADR-015: Unified Observability Stack: Pino, Sentry, and OpenTelemetry

## Status

Approved

## Context

Diagnosing distributed failures across asynchronous BullMQ workers, WebSocket chat servers, and Fastify REST endpoints requires unified structured logging, error tracking, and performance metrics without degrading application throughput.

## Decision

Adopt a **Unified Observability Architecture**:

1. **Structured Logging**: **Pino** across all backend services and workers. Logs emitted strictly as newline-delimited JSON with automatic PII redaction and `requestId` / `correlationId` injection.
2. **Error & Exception Monitoring**: **Sentry** across frontend Next.js apps, Fastify backend, and BullMQ workers. Captures unhandled exceptions with full stack traces, release tags, and user context.
3. **Metrics & Traces**: Standardize on **OpenTelemetry (OTel)** instrumentation conventions, exposing standard Prometheus-compatible `/metrics` endpoints for scrape consumption by Grafana / Datadog.

## Alternatives Evaluated

- **Winston / Morgan**: Rejected because Winston is 5x slower than Pino and generates significant garbage collection overhead under high concurrent HTTP loads.
- **Complex Full Distributed Tracing Mesh (Jaeger / Zipkin)**: Deferred as premature enterprise overengineering for Phase 0–12. Standardizing on OpenTelemetry SDK ensures that distributed tracing collectors can be enabled simply by configuring an OTLP exporter without application code changes.

## Consequences

- **Positive**: Blazing fast logging; instant alerts on production exceptions; end-to-end request traceability across async queue boundaries.
- **Negative**: Developers must remember to pass the `logger` instance or correlation context to background jobs.

## Security Impact

Automatic redaction rules built into the Pino logger configuration scrub passwords, authorization headers, credit cards, and bank account numbers from all output streams.

## Performance Impact

Pino operates asynchronously with minimal event loop blocking, maintaining high Fastify throughput.

## Migration Implications

Using OpenTelemetry standards prevents vendor lock-in, allowing seamless switching between AWS CloudWatch, Datadog, New Relic, or self-hosted Grafana Loki/Prometheus.
