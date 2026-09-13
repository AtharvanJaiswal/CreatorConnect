# ADR-003: Adoption of Fastify as the Core HTTP Framework

## Status
Approved

## Context
The backend API requires an enterprise Node.js HTTP framework that delivers high throughput, first-class TypeScript integration, native JSON Schema validation, low overhead, and an extensible plugin architecture.

## Decision
Adopt **Fastify** as the primary backend HTTP framework for the Core Modular API and the Realtime Gateway.

## Alternatives Evaluated
- **Express.js**: Rejected due to unmaintained legacy architecture, lack of native async/await error handling, absence of built-in schema compilation, and significantly higher overhead (3x slower than Fastify).
- **NestJS**: Evaluated as an enterprise option. Rejected because it introduces excessive object-oriented abstraction layers (decorators, reflection, metadata, complex module wrappers) that conflict with the project's KISS principle and add unnecessary startup/compilation overhead.
- **Koa**: Rejected due to small plugin ecosystem and lack of built-in schema-based serialization.

## Consequences
- **Positive**:
  - Extremely high throughput (> 50,000 req/sec benchmark baseline).
  - Native schema compilation via `fast-json-stringify` and TypeBox, dramatically accelerating JSON serialization.
  - Built-in encapsulation model via Fastify plugins, making domain boundary isolation natural.
  - Native OpenAPI 3.1 specification generation via `@fastify/swagger`.
- **Negative**: Smaller ecosystem of off-the-shelf tutorials compared to Express, though all modern libraries provide official Fastify adapters.

## Security Impact
Fastify provides built-in prototype pollution prevention, native request payload size limits, and tight integration with `@fastify/helmet` and `@fastify/rate-limit`.

## Performance Impact
Sub-millisecond framework routing overhead and zero GC pressure during JSON serialization.

## Migration Implications
None. Fastify routes and plugins wrap standard Node.js request/reply lifecycles, and domain services remain completely decoupled from Fastify primitives.
