# CreatorConnect Phase 4.1 — Known Limitations & Architectural Disclosure

**Document Reference:** `docs/frontend/PHASE_4_1_KNOWN_LIMITATIONS.md`  
**Milestone:** Phase 4.1 Admin Integration Gap Closure & Release-Grade Verification  
**Auditor:** Principal Software Architect & Application Security Engineer  
**Date:** November 2026  
**Status:** COMPLETE & HONEST ARCHITECTURAL DISCLOSURE

---

## 1. Executive Summary

In adherence to Phase 4.1 engineering integrity rules, this document transparently catalogs all technical limitations, architectural boundaries, and roadmap dependencies present in the CreatorConnect Admin Web Console and backend platform. Documenting these items prevents false assumptions, assists compliance officers, and defines exact scope boundaries for future milestones.

---

## 2. Priority Classification of Remaining Architectural Boundaries

| Priority | Feature / Domain                         | Description                                                                                                          | Current Behavior                                                                                                            | Target Resolution Milestone                                                     |
| :------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **P2**   | **Referral & Affiliate Tracking**        | Dynamic affiliate commissions and invitation attribution tables are not modeled in Prisma schema.                    | `/admin/referrals` renders an explicit `Planned Feature / Not Yet Available` state; zero fake numbers displayed.            | Phase 5 Growth Milestone (Requires formal database schema proposal).            |
| **P2**   | **Global Legal Holds Aggregator**        | Backend models legal holds on a per-user route (`/api/v1/users/:id/legal-holds`); no global aggregator route exists. | `/admin/lifecycle` serves as a read-only compliance policy overview.                                                        | Phase 3B.9 Governance Activation (Following formal executive approval).         |
| **P3**   | **Local Dual-Approval Test Requirement** | Anti-conflict-of-interest check strictly prohibits self-approval of refund requests.                                 | Local development environments must provision at least two separate admin accounts to test refunds $\ge 50,000\text{ INR}$. | Operational constraint (By-design security invariant; no remediation required). |
| **P3**   | **Port 3000 / 3002 Dual Binding**        | Next.js runs on `:3002`, Fastify API runs on `:3000`.                                                                | Full live browser execution requires running both dev servers simultaneously.                                               | Production deployment will use reverse proxy / unified domain routing.          |

---

## 3. Detailed Technical Analysis

### 3.1. Referrals Prototype Safety (Resolved in Phase 4.1)

- **Previous Limitation**: The screen previously showed placeholder growth metrics and suggested that platform configuration keys could substitute for a full referral system.
- **Phase 4.1 Resolution**: Fully remediated. All mock metrics, fake conversion percentages, and non-functional actions were eliminated. The screen now displays an honest, prominent `Planned Feature` badge and architectural status disclosure.

### 3.2. Admin Audit Trail (Resolved in Phase 4.1)

- **Previous Limitation**: The frontend previously lacked a unified `GET /api/v1/admin/audit` endpoint and rendered static mock logs.
- **Phase 4.1 Resolution**: Fully remediated. A production-grade backend endpoint was implemented using stable keyset cursor pagination (`createdAt DESC, id DESC`), bounded queries (`take: limit + 1`), recursive metadata redaction, and direct frontend integration.

### 3.3. Dual-Approval Financial Invariant (Enforced By-Design)

- **Architectural Characteristic**:
  ```typescript
  if (approval.requestedById === decidingAdminId) {
    throw new ConflictOfInterestError(
      'Anti-conflict-of-interest violation: Administrators cannot approve or reject their own refund requests.',
    );
  }
  ```
- **Operational Nuance**: Single-admin local development environments will observe rejections when attempting to approve refunds they initiated. This is a non-negotiable security control enforcing the Four-Eyes principle.

---

## 4. Sign-Off

All remaining items are non-blocking roadmap enhancements. The core administrative console operates securely, reliably, and with full data-source integrity across all 20 functional domains.
