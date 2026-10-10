# CreatorConnect — Phase 5 Library Audit & Architectural Decisions

## 1. Library-First Governance (ADR-016)

In strict adherence to Platform ADR-016 (Library-First Governance):

> "A mature, maintained library implementation is preferred over writing ~10+ lines of custom infrastructure code, unless dependency bloat, security, performance, or architectural constraints justify custom implementation."

No custom cryptographic routines, WebSocket adapters, queue supervisors, or image parsers are written from scratch.

---

## 2. Library Evaluation Matrix

| Domain / Requirement           | Candidate Library / Package     | Version Evaluated | Decision                   | Architectural Rationale                                                                                                                           |
| :----------------------------- | :------------------------------ | :---------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Realtime Engine**            | `socket.io`                     | `^4.7.5`          | **ADOPT (Existing)**       | Official WebSocket standard for Node.js; handles reconnects, heartbeat fallbacks, binary payloads, and room management out of the box.            |
| **Distributed Socket Adapter** | `@socket.io/redis-adapter`      | `^8.3.0`          | **ADOPT (Existing)**       | Official adapter maintained by Socket.IO team; high-throughput pub/sub across multi-node clusters; zero custom code required.                     |
| **Redis Client**               | `ioredis`                       | `^5.4.1`          | **ADOPT (Existing)**       | High-performance, mature Redis driver supporting pipelining, transactions, clustering, and auto-reconnects.                                       |
| **Asynchronous Job Queues**    | `bullmq`                        | `^5.8.6`          | **ADOPT (Existing)**       | Built on Redis streams; supports parent/child flows, delayed jobs, exponential backoff with jitter, and dead-letter handling.                     |
| **JWT & Cryptography**         | `jose`                          | `^5.9.6`          | **ADOPT (Existing)**       | RFC 7519 compliant; supports remote JWKS key rotation, ES256/RS256 validation; zero external native dependencies.                                 |
| **Schema Validation**          | `@sinclair/typebox`             | `^0.33.7`         | **ADOPT (Existing)**       | Generates JSON Schema and TypeScript static types from single source; 10x faster than Zod/Yup; native integration with Fastify.                   |
| **UUID Generation**            | `uuidv7`                        | `^1.0.1`          | **ADOPT (Existing)**       | RFC 9562 time-sortable monotonic UUIDv7 generator. Eliminates B-tree index fragmentation in PostgreSQL.                                           |
| **Object Storage SDK**         | `@aws-sdk/client-s3`            | `^3.1132.0`       | **ADOPT (Existing)**       | AWS SDK v3 modular client for Cloudflare R2 and MinIO S3 API; robust presigned URL generation.                                                    |
| **Image Manipulation**         | `sharp`                         | `^0.35.4`         | **ADOPT (Existing)**       | High-speed libvips native wrapper for generating WebP thumbnails and sanitizing EXIF metadata.                                                    |
| **PDF Inspection**             | `pdf-lib`                       | `^1.17.1`         | **ADOPT (Existing)**       | Pure JavaScript PDF parser/builder; parses PDF structure and enforces page count limits without native poppler bloat.                             |
| **File Type Detection**        | `file-type`                     | `^22.1.0`         | **ADOPT (Existing)**       | Reads binary magic bytes to prevent file extension spoofing attacks.                                                                              |
| **Antivirus Gateway Client**   | Native Node.js `net` TCP Client | Native `node:net` | **ADOPT (Custom Adapter)** | Uses standard ClamAV `zINSTREAM` protocol over TCP socket. Eliminates bulky external wrappers (like `clamscan`) that require local disk binaries. |
| **Structured Logging**         | `pino`                          | `^9.4.0`          | **ADOPT (Existing)**       | Lowest overhead JSON logger in the Node.js ecosystem; native Fastify integration.                                                                 |
| **Unit / Integration Testing** | `vitest`                        | `^2.1.1`          | **ADOPT (Existing)**       | Native ESM test runner; shares TypeScript config with Turbo; 5x faster than Jest.                                                                 |
| **End-to-End Testing**         | `@playwright/test`              | `^1.46.0`         | **ADOPT (Existing)**       | Multi-tab, multi-user isolated browser context automation with real WebSockets and network mocking.                                               |

---

## 3. Rejected Dependencies & Rationale

1. **`socket.io-redis` (Legacy)**: Rejected; deprecated by author in favor of `@socket.io/redis-adapter`.
2. **`node-clam` / `clamscan` (NPM)**: Rejected; requires host-level `clamscan` binary installed on Node.js container or complex local file paths. Phase 5 uses a lightweight TCP stream adapter connecting to a dedicated ClamAV daemon container over port 3310.
3. **`zod`**: Rejected; while popular, `@sinclair/typebox` is already standardized across all `@creatorconnect/*` packages and provides direct JSON Schema compilation for OpenAPI 3.1 without runtime transformation overhead.
4. **`ws` (Raw WebSockets)**: Rejected for application level; raw `ws` lacks out-of-the-box room abstractions, auto-reconnect semantics, packet buffering, and distributed Redis pub/sub adapters.
