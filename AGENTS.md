# CreatorConnect Workspace Rules & Policies

## CRITICAL MANDATE: Backend Code is STRICTLY PROTECTED (Read-Only)

All backend code, infrastructure, and database schemas in this repository are **frozen and strictly read-only**.
AI agents, pair programmers, and automated tooling **MUST NOT** modify, delete, refactor, or rewrite any backend files or schemas under any circumstances.

### Protected (Read-Only) Directories and Files

The following paths are strictly read-only:

- `apps/api/**` (Fastify REST API & domain modules)
- `apps/realtime/**` (Socket.IO realtime gateway & handlers)
- `apps/worker/**` (BullMQ workers, outbox relays, scanners, transcoding)
- `packages/database/**` (Prisma schema, migrations, database clients & repositories)
- `packages/contracts/**` (TypeBox API contracts and OpenAPI schemas)
- `packages/auth/**` (Supabase JWT verification, CASL rules, RBAC)
- `packages/validation/**` (TypeBox validators and RFC 7807 error models)
- `packages/testing/**` (Backend test suites, fixtures, readiness verifiers)
- `supabase_full_schema.sql` (Authoritative database schema)
- `docker-compose.yml` (Backend containerized infrastructure)
- `BACKEND.md` (Authoritative backend architecture manual)

### Prohibited Actions

1. **No Code Edits**: Do NOT use `write_to_file`, `replace_file_content`, `multi_replace_file_content`, or shell commands to alter, create, or delete files in any protected backend paths.
2. **No Database/Schema Mutations**: Do NOT execute Prisma migrations (`prisma migrate`, `db push`), alter SQL tables, or mutate database models.
3. **No Contract Alterations**: Backend contracts and routes are authoritative; client applications must consume them as defined without modifying the backend.

### Permitted Scope of Work

Reading backend files (`view_file`, `grep_search`) for API reference, data shapes, and endpoint documentation is permitted. Active modifications are restricted to:

- `apps/web-shell/**` (Next.js web application frontend)
- `apps/app/**` (Flutter cross-platform client app)
- `packages/ui/**` (UI component library)
- `packages/design-system/**` (Design tokens and styles)
- Client-side tests and documentation
