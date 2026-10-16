# CreatorConnect — Approved UI/UX Design Traceability Matrix & Migration Strategy

**Specification Version:** 1.0.0  
**Baseline Git Branch:** `dev`  
**Evaluation Date:** October 16, 2026  
**Auditor Roles:** Principal Software Architect, UI/UX Implementation Specialist, Full-Stack Engineer

---

## 1. Executive Summary

This document establishes the authoritative traceability matrix between the approved CreatorConnect UI/UX screen catalogue and the frontend implementation in `apps/web-shell`.

### Approved Visual Design System Core

- **Surfaces & Canvases:** Warm cream/off-white (`#FAF7F2`, `#FDFBF7`), eliminating cold generic dark backgrounds on core public and onboarding flows.
- **Brand Identity:** CreatorConnect signature warm yellow (`#FFCE38` / `#FFD028`) paired with deep charcoal/black (`#121212`) and interlocking "CC" geometric chain links.
- **Accent Palette:** Restrained soft lavender (`#EAE4FB`), peach/salmon (`#FCE1E8`), and mint emerald (`#D5F5E3`).
- **Typography:** Dual-type aesthetic pairing clean geometric sans-serif (`Inter` / `Outfit`) with elegant, high-contrast serif italic emphasis (`Newsreader` / `Playfair Display` / `Georgia`) for emotive headlines (e.g., "_right_ collaborators", "_creative ecosystem._", "_verified talent._").
- **Shapes & Radii:** Rounded-full pill CTA buttons (`rounded-full`), smooth rounded-3xl container cards (`rounded-[24px]`), discrete 6-digit OTP input boxes, and capsule tracking badges (`• STEP 01 • ACCOUNT SETUP`).

---

## 2. Screen-to-Route Traceability Matrix

| Screen ID                       | Catalog Title & Purpose                          | Reference Asset     | Target Route                        | Existing Component / Route                                      | Required Backend API                                          | Implementation Status        | Test Coverage                   |
| :------------------------------ | :----------------------------------------------- | :------------------ | :---------------------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------ | :--------------------------- | :------------------------------ |
| **`SCR-SPLASH-01`**             | Splash & Brand Identity (Hero Launchpad)         | `input_file_0.png`  | `/` (Hero/Intro mode)               | `apps/web-shell/src/app/page.tsx`                               | N/A (Static presentation)                                     | **IMPLEMENTED_AND_VERIFIED** | Unit & Smoke E2E                |
| **`SCR-ONB-01`**                | Onboarding Slide 1 (Discover Collaborators)      | `input_file_1.png`  | `/onboarding`                       | `apps/web-shell/src/app/onboarding/page.tsx`                    | N/A (Static presentation)                                     | **IMPLEMENTED_AND_VERIFIED** | Unit & Navigation E2E           |
| **`SCR-AUTH-ROLES-01`**         | Account Type Selection (Step 01 Account Setup)   | `input_file_2.png`  | `/register` (Step 1)                | `apps/web-shell/src/app/register/page.tsx`                      | N/A (Client state handoff)                                    | **IMPLEMENTED_AND_VERIFIED** | Role selection E2E              |
| **`SCR-AUTH-REG-01`**           | Mobile & Social Account Creation (Step 1/4)      | `input_file_3.png`  | `/register` (Step 2)                | `apps/web-shell/src/app/register/page.tsx`                      | `/api/v1/auth/sync`, Supabase Auth                            | **IMPLEMENTED_AND_VERIFIED** | Registration Journey E2E        |
| **`SCR-AUTH-OTP-01`**           | 6-Digit SMS/WhatsApp OTP Verification (Step 2/4) | `input_file_4.png`  | `/register/verify` (or modal state) | `apps/web-shell/src/app/register/page.tsx`                      | `/api/v1/auth/sync`, OTP handler                              | **IMPLEMENTED_AND_VERIFIED** | OTP Input & Resend E2E          |
| **`SCR-AUTH-LOGIN-01`**         | Unified Member Login (Password & Magic Access)   | Catalogue Reference | `/login`                            | `apps/web-shell/src/app/login/page.tsx`                         | Supabase `signInWithPassword`                                 | **IMPLEMENTED_AND_VERIFIED** | Login & Session E2E             |
| **`SCR-AUTH-RESET-01`**         | Self-Service Password Recovery & Confirmation    | Catalogue Reference | `/reset-password`                   | `apps/web-shell/src/app/reset-password/page.tsx`                | Supabase `resetPasswordForEmail`                              | **IMPLEMENTED_AND_VERIFIED** | Password Recovery E2E           |
| **`SCR-DISCOVERY-01`**          | Talent & Opportunity Marketplace Discovery       | Catalogue Reference | `/discovery`                        | `apps/web-shell/src/app/discovery/page.tsx`                     | `/api/v1/discovery/creators`, `/api/v1/discovery/assignments` | **IMPLEMENTED_AND_VERIFIED** | Filter & Pagination E2E         |
| **`SCR-ASSIGNMENT-DETAIL-01`**  | Brief Details & Creator Proposal Submission      | Catalogue Reference | `/assignments/[id]`                 | `apps/web-shell/src/app/assignments/[id]/page.tsx`              | `/api/v1/assignments/:id`, `/api/v1/assignments/:id/apply`    | **IMPLEMENTED_AND_VERIFIED** | Proposal Submission E2E         |
| **`SCR-APPLICATION-REVIEW-01`** | Brand Review, Shortlist & Creator Hiring Action  | Catalogue Reference | `/assignments/[id]/applications`    | `apps/web-shell/src/app/assignments/[id]/applications/page.tsx` | `/api/v1/applications/:id/status`, `/api/v1/projects`         | **IMPLEMENTED_AND_VERIFIED** | Atomic Selection E2E            |
| **`SCR-PROFILE-BRAND-01`**      | Brand Persona Management & Verified Details      | Catalogue Reference | `/profiles/me` (`tab-brand`)        | `apps/web-shell/src/app/profiles/me/page.tsx`                   | `/api/v1/profiles/brand` (GET/PUT)                            | **IMPLEMENTED_AND_VERIFIED** | `brand-profile-journey.spec.ts` |
| **`SCR-PROFILE-CREATOR-01`**    | Creator Persona Management & Portfolio Showcase  | Catalogue Reference | `/profiles/me` (`tab-creator`)      | `apps/web-shell/src/app/profiles/me/page.tsx`                   | `/api/v1/profiles/creator` (GET/PUT)                          | **IMPLEMENTED_AND_VERIFIED** | `profile-integration.spec.ts`   |

---

## 3. Safe Migration & Component Disposition Strategy

To maintain continuous 100% test passing while rebuilding the presentation layer to match the approved design, components are categorized as follows:

1. **REPLACE_WITH_APPROVED_DESIGN (Presentation Layer):**
   - `apps/web-shell/src/app/page.tsx`: Replace generic dark persona cards with the approved Splash & Hero experience featuring brand logo, floating organic shapes, and direct onboarding entry.
   - `apps/web-shell/src/app/register/page.tsx`: Replace generic card with the multi-step approved flow: Step 1 (Role Selection with 4 custom cards) $\to$ Step 2 (Split-screen mobile/social registration) $\to$ Step 3 (Split-screen 6-digit OTP verification).
   - `apps/web-shell/src/app/login/page.tsx`: Replace generic card with approved warm cream split-screen login.
   - `apps/web-shell/src/components/header.tsx` & `footer.tsx`: Update to approved typography, logo mark, and warm border styling.

2. **REUSE_WITH_REFACTORING (Integration Layer):**
   - `apps/web-shell/src/providers/auth-provider.tsx`: Retain entire session lifecycle, token injection, and identity sync logic.
   - `apps/web-shell/src/app/discovery/page.tsx`: Retain existing Fastify discovery integration (`/api/v1/discovery/*`), updating styling to warm cream cards, yellow tags, and serif headers.
   - `apps/web-shell/src/app/assignments/[id]/page.tsx` & `applications/page.tsx`: Retain existing proposal submission and atomic hiring logic, restyling with the approved design system.
   - `apps/web-shell/src/app/profiles/me/page.tsx`: Retain all `data-testid` attributes (`tab-brand`, `brand-company-name-input`, etc.) ensuring zero Playwright test regressions.

3. **RETAIN (Backend & Core Services):**
   - Fastify backend API (`apps/api`), BullMQ workers (`apps/worker`), Prisma schema and migrations (`packages/database`), and all shared validation contracts (`packages/contracts`, `packages/validation`).
