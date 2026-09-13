# CreatorConnect — Playwright End-to-End Testing Strategy

## 1. Mandate & Scope

Playwright is the mandatory E2E testing framework for CreatorConnect. All critical user flows across the multi-sided marketplace must have deterministic, resilient, automated test coverage running in CI before any code can be deployed to production.

Tests run against dedicated ephemeral test environments seeded with synthetic fixtures. **Testing against production data or third-party live payment gateways is strictly prohibited.**

---

## 2. The 21 Critical Customer Journeys

The Playwright test suite implements end-to-end tests for the following 21 canonical user journeys:

| Journey ID | Critical Customer Journey | User Persona | Verification Criteria |
| :--- | :--- | :--- | :--- |
| **TC-01** | **Registration** | Creator / Brand | User registers with email/password; Supabase session created; user row provisioned in DB. |
| **TC-02** | **Login & Session Refresh** | All Personas | User logs in; receives session cookies; verifies automatic token refresh on expiry. |
| **TC-03** | **Profile Creation** | Creator / Pro | Multi-step onboarding: bio, rates, specialties, and avatar configured and saved. |
| **TC-04** | **Profile Editing** | Creator / Brand | User updates rate cards and contact links; verifies immediate optimistic update. |
| **TC-05** | **Verification Submission** | Creator | Creator submits official ID / social handles for trust badge; status transitions to `SUBMITTED`. |
| **TC-06** | **Portfolio Upload** | Production Pro | Uploads video reel via presigned R2 URL; verifies thumbnail rendering and metadata display. |
| **TC-07** | **Creator Discovery** | Brand / Agency | Navigates creator directory; verifies card grid rendering, category chips, and badges. |
| **TC-08** | **Search & Filtering** | Brand / Podcaster | Filters by "Video Editor", budget "< 50k", and location; validates FTS query results. |
| **TC-09** | **Campaign Creation** | Brand Manager | Creates a structured campaign brief with milestones and budget; campaign status becomes `OPEN`. |
| **TC-10** | **Application Submission** | Production Pro | Talent submits proposal with custom quote and portfolio link; application recorded in DB. |
| **TC-11** | **Candidate Shortlisting** | Brand Manager | Brand reviews proposal queue; clicks "Shortlist"; verifies candidate status update. |
| **TC-12** | **Hiring & Contract Offer** | Brand Manager | Brand issues formal contract offer with locked milestones; freelancer receives contract offer. |
| **TC-13** | **Project Creation** | System / Both | Freelancer accepts offer; contract transitions to `ACTIVE_PROJECT`; workspace provisioned. |
| **TC-14** | **Deliverable Submission** | Production Pro | Pro uploads final video deliverable; milestone status updates to `IN_REVIEW`. |
| **TC-15** | **Realtime Messaging** | Client & Talent | Two browser contexts exchange real-time messages, typing indicators, and attachments over WebSocket. |
| **TC-16** | **Notifications** | All Personas | In-app notification bell updates unread count when deliverable submitted or message received. |
| **TC-17** | **Payment & Escrow Lock** | Brand Manager | Mock Razorpay payment modal completes; webhook triggers escrow lock and ledger entry. |
| **TC-18** | **Refund & Cancellation** | Brand / Admin | Mutual contract cancellation triggers escrow release refund back to brand account. |
| **TC-19** | **Double-Blind Review** | Client & Talent | Both parties submit ratings; reviews remain hidden until second party submits, then reveal. |
| **TC-20** | **Content Moderation** | Admin / Moderator | User flags spam post; admin dashboard displays report; admin applies moderation warning. |
| **TC-21** | **Account Suspension** | Admin | Admin suspends malicious account; active sessions terminated; access blocked at API gateway. |

---

## 3. Test Fixtures, Factories & Seed Data Isolation

To prevent test flakiness and data collisions during parallel execution:

```typescript
// packages/testing/src/fixtures/marketplace.fixture.ts
import { test as base } from '@playwright/test';
import { UserFactory, CampaignFactory } from '../factories';

export const test = base.extend<{
  creatorUser: TestUser;
  brandUser: TestUser;
  activeCampaign: TestCampaign;
}>({
  creatorUser: async ({}, use) => {
    const user = await UserFactory.create({ role: 'CREATOR' });
    await use(user);
    await UserFactory.cleanup(user.id);
  },
  brandUser: async ({}, use) => {
    const user = await UserFactory.create({ role: 'BRAND' });
    await use(user);
    await UserFactory.cleanup(user.id);
  },
  activeCampaign: async ({ brandUser }, use) => {
    const campaign = await CampaignFactory.create({ ownerId: brandUser.id });
    await use(campaign);
    await CampaignFactory.cleanup(campaign.id);
  }
});
```

### Key Isolation Principles:
1. **Isolated Database Per Worker**: In CI, parallel workers run against dedicated database schemas or isolated ephemeral Testcontainers.
2. **Deterministic Data Factories**: Data is generated dynamically with unique UUIDs (`UserFactory.create()`), never relying on hardcoded records.
3. **Mock Third-Party Providers**: Supabase Auth tokens are generated locally with a test JWT private key; Razorpay webhooks are simulated via direct HTTP POST requests with authentic HMAC signatures.

---

## 4. CI Execution, Debugging & Artifacts

- **Parallel Execution**: Tests execute across 4 parallel workers in GitHub Actions.
- **Flakiness Safeguards**: Automatic retry limit = 1 on CI; retry = 0 on local development.
- **Trace Retention**:
  - `trace: 'on-first-retry'` captures DOM snapshots, console logs, and network waterfalls.
  - Full-resolution video recorded automatically for failing test executions.
  - Screenshots captured on all test failures and uploaded as GitHub Actions run artifacts.
