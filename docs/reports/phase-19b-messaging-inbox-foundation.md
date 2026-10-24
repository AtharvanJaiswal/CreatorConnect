# CreatorConnect — Phase 19B: Module I Messaging Implementation

## Milestone 1: Inbox Foundation — Repository Safety, Contract Verification, and Split-Pane Inbox

> **Execution Date**: October 23, 2026  
> **Repository Root**: `F:/CreatorConnect`  
> **Git Branch**: `dev`  
> **HEAD Commit**: `a30507fe3d7a7441d0629c2f35b8c8605c32f7e2` (Unchanged — 0 commits, 0 pushes, 0 branch switches)  
> **Milestone Status**: **MILESTONE 1 COMPLETE — STOPPED FOR APPROVAL**

---

## 1. Repository Safety Baseline & Working Tree Status

Before and throughout this milestone, all repository safety rules were strictly enforced. Zero destructive operations, zero database mutations, and zero credential disclosures occurred.

### Working Tree Verification

| Property                               | Value                                                                                                                                                                                                                           | Notes                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Repository Root**                    | `F:\CreatorConnect`                                                                                                                                                                                                             | Verified via `git rev-parse --show-toplevel`       |
| **Active Branch**                      | `dev`                                                                                                                                                                                                                           | Up to date with `origin/dev`                       |
| **Initial HEAD SHA**                   | `a30507fe3d7a7441d0629c2f35b8c8605c32f7e2`                                                                                                                                                                                      | Verified clean against remote                      |
| **Ending HEAD SHA**                    | `a30507fe3d7a7441d0629c2f35b8c8605c32f7e2`                                                                                                                                                                                      | Unchanged                                          |
| **Pre-existing Tracked Modifications** | 5 files (`apps/api/src/routes/health.spec.ts`, `apps/api/src/routes/health.ts`, `apps/web-shell/package.json`, `package.json`, `pnpm-lock.yaml`)                                                                                | Intact and preserved from Phase 18 audit           |
| **Milestone 1 Tracked Modifications**  | 1 file: `apps/web-shell/src/components/header.tsx`                                                                                                                                                                              | Added `/messages` route link to top navigation bar |
| **Milestone 1 Created Files**          | 7 files: `apps/web-shell/src/app/messages/page.tsx`, `apps/web-shell/src/components/messaging/*` (5 files), `apps/web-shell/src/lib/messaging-workflow-service.ts`, `apps/web-shell/src/lib/messaging-workflow-service.spec.ts` | Isolated, typed, formatted                         |
| **Untracked Evidence & Reports**       | `docs/reports/evidence/phase-18/`, `docs/reports/evidence/phase-19a/`, Phase 18 & 19A reports                                                                                                                                   | Preserved without modification                     |

---

## 2. Changes Made in Milestone 1

| File Path                                                                                                                                                                  | Nature of Change | Purpose / Description                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/web-shell/src/lib/messaging-workflow-service.ts`](file:///f:/CreatorConnect/apps/web-shell/src/lib/messaging-workflow-service.ts)                                   | **Created**      | Client-side API workflow service consuming verified endpoints: `listConversations()`, `getConversation()`, `createDirectConversation()`, and `markConversationRead()`. Includes helpers `formatConversationTime()` and `getPeerParticipantId()`.                                      |
| [`apps/web-shell/src/lib/messaging-workflow-service.spec.ts`](file:///f:/CreatorConnect/apps/web-shell/src/lib/messaging-workflow-service.spec.ts)                         | **Created**      | Unit test suite covering all workflow service methods, authorization header injection, error bubbling, time formatting, and peer resolution (9 tests, 100% pass).                                                                                                                     |
| [`apps/web-shell/src/components/messaging/conversation-card.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/components/messaging/conversation-card.tsx)                 | **Created**      | Component rendering individual conversation card in inbox list: avatar with verified badge, title/peer display name, last updated timestamp, linked brief/assignment chip, sequence status, unread count pill, and keyboard accessibility.                                            |
| [`apps/web-shell/src/components/messaging/conversation-preview-pane.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/components/messaging/conversation-preview-pane.tsx) | **Created**      | Right-pane component: renders thread overview header, participant dossier, sequence counter, linked context badge, "Mark as Read" action, "Open Chat" action (`/messages/[id]`), and security/anti-enumeration footer. Shows a neutral empty prompt when no conversation is selected. |
| [`apps/web-shell/src/components/messaging/inbox-loading-skeleton.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/components/messaging/inbox-loading-skeleton.tsx)       | **Created**      | Pulse-animated skeleton matching Stitch I01_inbox `state-loading` with accessible `aria-busy="true"`.                                                                                                                                                                                 |
| [`apps/web-shell/src/components/messaging/inbox-empty-state.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/components/messaging/inbox-empty-state.tsx)                 | **Created**      | Zero-state view matching Stitch I01_inbox `state-empty`: circular message icon, serif heading, descriptive onboarding text, and CTAs to Discovery and Assignments.                                                                                                                    |
| [`apps/web-shell/src/components/messaging/inbox-error-state.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/components/messaging/inbox-error-state.tsx)                 | **Created**      | Error view matching Stitch I01_inbox `state-error`: alert badge, clear recovery copy, and animated "Retry Connection" action.                                                                                                                                                         |
| [`apps/web-shell/src/components/messaging/messaging-inbox.spec.ts`](file:///f:/CreatorConnect/apps/web-shell/src/components/messaging/messaging-inbox.spec.ts)             | **Created**      | Component unit test suite verifying DOM markup, accessible attributes, selection highlighting, and zero/error states (9 tests, 100% pass).                                                                                                                                            |
| [`apps/web-shell/src/app/messages/page.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/app/messages/page.tsx)                                                           | **Created**      | Primary Next.js page implementing the Stitch I01 split-pane architecture (`lg:grid-cols-12`). Integrates search filtering, tab switching (`All Chats` / `Unread` / `Requests`), offline banner detection, and full lifecycle state handling.                                          |
| [`apps/web-shell/src/components/header.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/components/header.tsx)                                                           | **Modified**     | Added `{ href: '/messages', label: 'Messages', icon: MessageSquare }` to main navigation menu.                                                                                                                                                                                        |

---

## 3. Stitch Design Compliance & Visual Tokens

The implementation faithfully adheres to Google Stitch project `2099946051330856584`, screen **I01 Messages & Conversations Hub (Desktop 1440x900)** and its associated state canvases:

- **Split-Pane Layout**:
  - **Left Pane** (`lg:col-span-5 xl:col-span-4`): Searchable conversation list with search input (`bg-[#FAF6EF]`, rounded-full), filter tabs (`All Chats`, `Unread`, `Requests`), and card stack with 12px rounded avatars.
  - **Right Pane** (`lg:col-span-7 xl:col-span-8`): Dedicated stage presenting active thread context when a conversation is selected, or the Stitch empty prompt when unselected.
- **Color Palette & Design Tokens**:
  - Warm cream/ivory background: `bg-[#FAF6EF]`
  - White surface cards: `bg-white` with `border-[#E7E0D5]`
  - Yellow primary action accent: `bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F]`
  - Editorial headline typography: `font-serif` (Newsreader)
  - UI control typography: `font-sans font-bold` (Archivo Narrow)
- **Responsive Behavior**:
  - On mobile viewports (`<1024px`), the layout stacks gracefully into a single-column directory.
  - On desktop viewports (`>=1024px`), the 12-column split-pane is active, allowing continuous thread selection and context inspection without full-page reloads.

---

## 4. Contract Verification & Integration Path

The inbox foundation consumes genuine, verified backend endpoints without hardcoded mock data in production code:

1. **`GET /api/v1/conversations`**:
   - **Request**: Query parameters `limit` (max 50) and `cursor` (opaque base64 string).
   - **Response**: `ListConversationsResponse` containing `items: DirectConversationResponse[]`, `nextCursor`, and `hasMore`.
   - **Fields Consumed**: `id`, `type`, `title`, `assignmentId`, `applicationId`, `currentSequence`, `unreadCount`, `updatedAt`, `participants: [{ id, userId, role, lastReadSequence }]`.
2. **`POST /api/v1/conversations/:id/read`**:
   - **Request**: Body `{ sequence: string }`.
   - **Response**: `MarkReadResponse` confirming updated `lastReadSequence` on `ConversationParticipant`.
   - **Behavior**: Integrated into "Mark as Read" action in `ConversationPreviewPane`, decrementing local unread counts upon completion.

---

## 5. Decision Record: MessageRequest vs. Invitation

Section 6 of the prompt mandated an evidence-based comparison between the existing `Invitation` model and the desired Stitch `MessageRequest` behavior:

### Comparative Analysis Matrix

| Dimension                 | Existing `Invitation` Domain (`apps/api/src/modules/collaboration`)                               | Desired `MessageRequest` Domain (Stitch I02 / I03)                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Core Entity Semantics** | A formal commercial hiring proposal to work on an active, budgeted `Project`.                     | A communication gate for inbound peer-to-peer messaging from unknown users.                                             |
| **Prerequisites**         | Requires a pre-existing `Project` record owned by the inviter (`project.clientId === inviterId`). | No project required. Any registered creator or brand can initiate an inquiry.                                           |
| **Actors**                | `inviterId` (Client) -> `inviteeId` (Creator/Talent). Role-asymmetric.                            | `senderId` -> `recipientId`. Symmetric peer-to-peer interaction.                                                        |
| **Read Receipt Privacy**  | Senders and clients can track invitation status transitions in real time.                         | **Privacy Gate**: Senders must NOT know whether a message request was read until accepted.                              |
| **Acceptance Outcome**    | Transitions invitation status to `ACCEPTED` and notifies the client; no conversation is created.  | Atomically provisions a new `Conversation` and two `ConversationParticipant`s, moving initial message to active stream. |
| **Decline & Block**       | Transitions invitation status to `DECLINED`. Does not create a bidirectional user block.          | Stitch I03 provides Decline (DLG-60) and Decline & Block (DLG-61), which must trigger `POST /api/v1/blocks`.            |
| **Expiry Semantics**      | 7 days default, calculated against `expiresAt`.                                                   | 7 days auto-expiry, archiving request without notifying the sender.                                                     |

### Architectural Recommendation

> **Verdict: DO NOT conflate `MessageRequest` with `Invitation`.**  
> Forcing peer-to-peer message requests through `Invitation` would introduce artificial dummy project requirements, violate role symmetry, and compromise read-receipt privacy guarantees.

#### Proposed Dedicated `MessageRequest` Domain Specification (for Phase 19C/Future Approval):

1. **Database Model** (`packages/database/prisma/schema.prisma`):
   ```prisma
   enum MessageRequestStatus {
     PENDING
     ACCEPTED
     DECLINED
     EXPIRED
   }

   model MessageRequest {
     id             String               @id @db.Uuid
     senderId       String               @map("sender_id") @db.Uuid
     recipientId    String               @map("recipient_id") @db.Uuid
     initialMessage String               @map("initial_message") @db.Text
     assignmentId   String?              @map("assignment_id") @db.Uuid
     status         MessageRequestStatus @default(PENDING)
     expiresAt      DateTime             @map("expires_at")
     respondedAt    DateTime?            @map("responded_at")
     createdAt      DateTime             @default(now()) @map("created_at")
     updatedAt      DateTime             @updatedAt @map("updated_at")

     sender    User        @relation("SentRequests", fields: [senderId], references: [id], onDelete: Cascade)
     recipient User        @relation("ReceivedRequests", fields: [recipientId], references: [id], onDelete: Cascade)
     assignment Assignment? @relation(fields: [assignmentId], references: [id], onDelete: SetNull)

     @@index([recipientId, status, expiresAt])
     @@unique([senderId, recipientId, status]) // Prevents spamming duplicate pending requests
     @@map("message_requests")
   }
   ```
2. **State Machine & Legal Transitions**:
   - `PENDING` -> `ACCEPTED`: Atomically calls `tx.conversation.create()` with both participants, creates message #1, and updates request to `ACCEPTED`.
   - `PENDING` -> `DECLINED`: Updates request to `DECLINED` silently (sender is not alerted).
   - `PENDING` -> `DECLINED_AND_BLOCKED`: Updates request to `DECLINED` and inserts a `UserBlock` record.
   - `PENDING` -> `EXPIRED`: Query filter `status == 'PENDING' && expiresAt < now()` automatically excludes expired requests.
3. **Endpoints**:
   - `POST /api/v1/message-requests`: Create inbound request (rate-limited, anti-spam).
   - `GET /api/v1/message-requests/inbound`: Paginated queue for recipient (`I02`).
   - `GET /api/v1/message-requests/:id`: Detailed view for recipient (`I03`).
   - `POST /api/v1/message-requests/:id/accept`: Acceptance transaction.
   - `POST /api/v1/message-requests/:id/decline`: Silent decline.

---

## 6. Support Chat Status: Explicitly Deferred

Per Section 7 instructions:

- **Status**: **EXPLICITLY DEFERRED**.
- **Reasoning**: Stitch I07 references `#SUP-` tickets and Module N support dossier. The current repository provides formal project disputes (`apps/api/src/modules/disputes/`), which are contractually restricted to escrow freezes and deliverables on active projects. Project disputes cannot and should not be repurposed as customer support chat.
- **Future Integration Point**: Milestone 5 or when Module N (Support & Admin Cockpit) ticketing service is formally introduced.

---

## 7. Verification & Test Results

All quality and verification checks passed cleanly with zero regressions:

| Test / Check Suite           | Target Package              | Command                                                                                         | Result                                                |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Unit Tests (Messaging)**   | `@creatorconnect/web-shell` | `pnpm --filter @creatorconnect/web-shell test src/lib/messaging-workflow-service.spec.ts`       | **PASS** (9/9 tests passed in 490ms)                  |
| **Unit Tests (Components)**  | `@creatorconnect/web-shell` | `pnpm --filter @creatorconnect/web-shell test src/components/messaging/messaging-inbox.spec.ts` | **PASS** (9/9 tests passed in 38ms)                   |
| **All Web Shell Tests**      | `@creatorconnect/web-shell` | `pnpm --filter @creatorconnect/web-shell test`                                                  | **PASS** (11/11 files, 134/134 tests passed)          |
| **TypeScript Typecheck**     | `@creatorconnect/web-shell` | `pnpm --filter @creatorconnect/web-shell typecheck`                                             | **PASS** (0 errors, `tsc --noEmit` exit 0)            |
| **Full Monorepo Typecheck**  | All 13 workspace packages   | `pnpm typecheck` (turbo)                                                                        | **PASS** (20/20 tasks successful)                     |
| **Code Formatting**          | Monorepo root               | `pnpm format:check`                                                                             | **PASS** (100% matched files use Prettier style)      |
| **Code Linting**             | All workspace packages      | `pnpm lint` (turbo)                                                                             | **PASS** (8/8 tasks successful)                       |
| **Next.js Production Build** | `@creatorconnect/web-shell` | `pnpm --filter @creatorconnect/web-shell build`                                                 | **PASS** (`/messages` prerendered cleanly at 7.77 kB) |

---

## 8. Milestone 1 Completion & Approval Checkpoint

### Summary of What Was Implemented

1. Reusable, typed `MessagingWorkflowService` with error handling and date/peer helpers.
2. Split-pane `/messages` inbox matching Stitch I01 desktop 1440x900 specification.
3. Loading skeleton (`I01_inbox`), empty state (`I01_inbox`), error/retry state (`I01_inbox`), and offline status banner.
4. Top navigation menu integration in `Header`.
5. Comprehensive unit test suites (18 new tests, 100% pass).
6. Evidence-based `MessageRequest` vs `Invitation` decision record with Prisma schema proposal.

### Quality Confirmation

- **Tests Passed**: 134/134 web-shell unit tests.
- **Typecheck**: 20/20 turbo tasks clean.
- **Production Build**: Clean static generation of `/messages`.
- **Git State**: 0 commits, 0 pushes, 0 branch switches, zero unrelated file modifications.

### Proposed Next Milestone (Milestone 2)

- **Scope**: Implement **I04 Chat Stream** (`/messages/[id]`), including real-time Socket.IO integration (`useRealtimeChat` hook), message composer with client idempotency, message bubble styling (timestamps, read states, edit badges), 15-minute message edit window, and soft-deletion dialog.
- **Decision Required**: Approval to proceed to Milestone 2, and review of the proposed `MessageRequest` specification for future backend extension.

---

_Stopped as instructed. Awaiting explicit user approval before proceeding to Milestone 2._
