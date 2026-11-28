# CreatorConnect — Phase 4.3.1 Realtime Failure Analysis & Isolation Report

**Scope:** `@creatorconnect/realtime` (`apps/realtime/src/cluster-integration.spec.ts`) & `@creatorconnect/worker` (`apps/worker`)  
**Repository / Branch:** `F:\CreatorConnect` (`dev`)  
**Status:** **RESOLVED** _(Root cause reproduced, fixed via deterministic Turbo task serialization, and verified 41/41 + 112/112 across repeated runs)_

---

## 1. Executive Summary

During Phase 4.3 validation, `pnpm.cmd --filter @creatorconnect/realtime exec vitest run` reported `38 passed / 3 failed (41)` with 3 failures in `apps/realtime/src/cluster-integration.spec.ts`, attributing the contention to the local Docker `creatorconnect-worker` container.

Phase 4.3.1 independently investigated, inspected the running container artifact, reproduced the exact failure signature under controlled runs, and established the true root cause:

1. **Docker Image Skew Disproved Direct Docker Outbox Contention:** Inspecting `/app/apps/worker/dist/main.js` inside the running `creatorconnect-worker` Docker container confirmed it was built from an earlier revision (`WorkerSupervisor` + `CleanupScheduler` only) and does **not** run `OutboxProcessor` or `RealtimeBridge`. Four consecutive isolated runs of `@creatorconnect/realtime` with `creatorconnect-worker` UP passed **`41/41` (`100%`)**.
2. **True Root Cause — Concurrent Shared-Database Outbox Contention (`worker#test` vs `realtime#test`):** In `turbo.json`, `test` tasks previously declared only `dependsOn: ["^build"]`. Because `@creatorconnect/worker` and `@creatorconnect/realtime` share no `package.json` workspace dependency, `turbo run test` (or parallel test invocation) executed `apps/worker/src/outbox/outbox-processor.spec.ts` concurrently with `apps/realtime/src/cluster-integration.spec.ts` against the **same** PostgreSQL `creatorconnect_dev` `outbox_events` table (`localhost:5433`):
   - `apps/worker/src/outbox/outbox-processor.spec.ts` (`lines 60-61, 65-66`) executes global table clears (`prisma.processedEvent.deleteMany({})` and `prisma.outboxEvent.deleteMany({})`) in `beforeEach` and `afterAll`, and runs `MockEventDispatcher` with `OutboxRepository.claimBatch()` (`FOR UPDATE SKIP LOCKED`), claiming or deleting live `PENDING` outbox rows inserted by `cluster-integration.spec.ts` before its spawned `apps/worker/dist/main.js` child process can dispatch them to Redis.
   - Similarly, 4 messaging specs inside `@creatorconnect/api` (`messaging-e2e-journey.spec.ts:144`, `messaging.spec.ts:198`, `messaging.repository.spec.ts:71`, `conversation-authorization.service.spec.ts:221`) also invoke global `prisma.outboxEvent.deleteMany({})`.

---

## 2. Controlled Reproduction & Comparative Matrix

### Failure Signature Reproduced (`Run 3 Before Fix` — Concurrent `@creatorconnect/worker` + `@creatorconnect/realtime`)

Executing `pnpm.cmd --filter @creatorconnect/worker exec vitest run` simultaneously with `pnpm.cmd --filter @creatorconnect/realtime exec vitest run` reproduced the **exact** Phase 4.3 failure signature:

- **Result:** `3 failed | 38 passed (41)` (`cluster-integration.spec.ts`: `3/7` failed)
  1. `broadcasts message-created event from background worker to clients across multiple realtime nodes` — timed out at `15026ms` (`15000ms` limit) because the outbox `message.created.v1` event was cleared/claimed by concurrent `outbox-processor.spec.ts`.
  2. `evicts active sockets across independent realtime instances when a block is created, enforcing fail-closed security` — timed out at `15016ms` (`15000ms` limit).
  3. `safely treats a delayed block event as a no-op when block was already unblocked in PostgreSQL` — failed at [`apps/realtime/src/cluster-integration.spec.ts#L539`](file:///f:/CreatorConnect/apps/realtime/src/cluster-integration.spec.ts#L539) (`AssertionError: expected false to be true` checking `eventProcessed`).

### Post-Fix Comparative Run Matrix

| Run Type                                          | Execution Command / Environment                                                                                | Docker `creatorconnect-worker` State |      Worker Result      |            Realtime Result            | Outcome                                        |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------- | :----------------------------------: | :---------------------: | :-----------------------------------: | :--------------------------------------------- |
| **Before-Fix Concurrent (`Run 3`)**               | Parallel background jobs (`@creatorconnect/worker` + `@creatorconnect/realtime` on shared DB/Redis)            |           Up (`old image`)           |   `12/12` (`112/112`)   | **`3/4` files (`38/41`, `3` failed)** | Reproduced exact Phase 4.3 failure             |
| **Isolated Run (`Run 1`)**                        | `pnpm.cmd --filter @creatorconnect/realtime exec vitest run` (4 consecutive runs: 1 suite + 3 cluster repeats) |           Up (`old image`)           |            —            |       **`4/4` files (`41/41`)**       | **100% PASS** across all 4 runs (`2.9s–11.7s`) |
| **Turbo Intended Integration (`Run 2` Post-Fix)** | `pnpm.cmd exec turbo run test --filter=@creatorconnect/worker --filter=@creatorconnect/realtime --force`       |           Up (`old image`)           | **`12/12` (`112/112`)** |       **`4/4` files (`41/41`)**       | **100% PASS (`8/8` Turbo tasks)**              |

---

## 3. Remediation Implemented & Operational Controls

### Configuration Remediation ([`turbo.json`](file:///f:/CreatorConnect/turbo.json))

Added an explicit package-level test ordering constraint for `@creatorconnect/realtime#test`:

```json
"@creatorconnect/realtime#test": {
  "dependsOn": ["^build", "@creatorconnect/worker#build", "@creatorconnect/worker#test"],
  "inputs": ["$TURBO_DEFAULT$"]
}
```

- **Why Both Dependencies Matter:**
  1. [`cluster-integration.spec.ts#L61`](file:///f:/CreatorConnect/apps/realtime/src/cluster-integration.spec.ts#L61) directly spawns `apps/worker/dist/main.js`, so `@creatorconnect/realtime#test` functionally depends on `@creatorconnect/worker#build`.
  2. Depending on `@creatorconnect/worker#test` guarantees Turborepo never runs `outbox-processor.spec.ts` concurrently with `cluster-integration.spec.ts`.

### Residual Environmental Boundary

- If a developer rebuilds the Docker `creatorconnect-worker` container with the newer `OutboxProcessor`-enabled `dist/main.js` and leaves it running against `creatorconnect_dev` without matching Redis emitter credentials or isolated test DBs, an active external `OutboxProcessor` would again compete for `PENDING` rows in `outbox_events`. Similarly, running `@creatorconnect/api` messaging specs in parallel with `@creatorconnect/realtime` on the same PostgreSQL database triggers global `outboxEvent.deleteMany({})` wipes. Sequential execution (`pnpm run test` / `vitest --fileParallelism=false --maxWorkers=1`) or isolated ephemeral DB schemas prevent this contention in CI.
