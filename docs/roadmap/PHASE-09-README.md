# Phase 9 — Messaging + Community

## Objective

Deploy the dedicated Realtime Gateway (`apps/realtime` with Socket.IO + Redis adapter) and build real-time direct chat and community discussion forums.

## Scope

- Prisma schemas: `conversations`, `conversation_members`, `messages`, `message_attachments`, `communities`, `community_posts`, `comments`.
- Deploy `apps/realtime` as a physically isolated Fastify + Socket.IO container service on port 3001.
- Redis Pub/Sub backplane for multi-node message broadcasting.
- Direct messaging UI with typing indicators, presence, and unread counters.
- Playwright test: TC-15 (Realtime Messaging across dual browser contexts).

## Prerequisites

- Phase 8 completed.
- Redis 7 cluster active.

## Architecture Changes

- Realtime Gateway deployed as a standalone physical microservice adhering to ADR-001 and ADR-009.

## Backend Services

- `apps/realtime`: Socket.IO server handling WebSocket handshakes, rooms, and chat messaging.
- `apps/api`: REST routes for conversation history and community forum threads.

## Frontend / Microfrontend Changes

- Persistent chat drawer across microfrontends with real-time message stream and unread badge.
- Community discussion forum in `apps/web-shell`.

## Database Changes

- Migration: `0006_add_messaging_and_community.sql`.

## API Changes

- `GET /api/v1/conversations`
- `GET /api/v1/conversations/{id}/messages`
- `POST /api/v1/conversations/{id}/messages`
- `GET /api/v1/communities`
- `POST /api/v1/communities/{id}/posts`

## Events

- Socket events: `message:send`, `message:new`, `typing:start`, `typing:stop`, `presence:update`.

## Background Jobs

- None.

## Security

- Room access control: Sockets can only join `conversation:{id}` if verified as active member in DB.
- File attachment sanitization and presigned upload flow.

## Testing

- Integration tests verifying multi-socket message routing across Redis pub/sub.
- Unit tests for conversation membership authorization.

## Playwright

- Playwright TC-15 (dual-browser context testing real-time chat between Creator and Brand).

## CI/CD

- Dedicated Docker build and deployment for `apps/realtime` service.

## Observability

- WebSocket connection gauge (`websocket_active_connections`) and message latency histogram.

## Documentation Changes

- Update `BACKEND.md` Socket.IO event catalog and conversation endpoints.

## Dependencies / Libraries Added

- `socket.io`, `@socket.io/redis-adapter`, `socket.io-client`.

## Files Created

- `apps/realtime/src/*`, `apps/api/src/modules/messaging/*`, `apps/api/src/modules/community/*`.

## Files Modified

- `BACKEND.md`.

## Files Removed

- None.

## Migration Required

- `0006_add_messaging_and_community.sql`.

## Breaking Changes

- None.

## Client Impact

### Web

Live messaging drawer with presence and unread counts.

### Android

Socket.IO mobile client integration.

### iOS

Socket.IO mobile client integration.

### Admin

Ability to view conversation audit logs during disputes.

## Definition of Done

- [ ] Realtime Gateway scales across multiple nodes via Redis adapter.
- [ ] Sub-80ms message delivery latency achieved.
- [ ] Reconnection with buffered message sync verified.
- [ ] Playwright TC-15 passes in CI.

## Exit Criteria

- Two separate browser sessions exchange messages and typing indicators in real time without lag.

## Known Risks

- Socket connection leaks during network drops (mitigated by aggressive heartbeat timeouts).

## Rollback Strategy

- Revert migration and redeploy previous container revisions.

## Completion Status

**NOT STARTED**
