# Mobile App Changelog (`apps/app`)

All notable changes, screen implementations, and architecture updates to the mobile application are documented here.

---

## [User Profile Screen & Security Credentials Lock] — 2026-10-22

### Added

- **Authenticated User Profile Screen (`lib/features/profile/presentation/screens/user_profile_screen.dart`)**:
  - Replaced dummy public profile view on bottom nav Tab 4 with a dedicated self-profile screen.
  - Dynamically loads real user identity from Supabase Auth (`user.email`, `user.phone`, `userMetadata`) and `ProfileRepositoryImpl` (display name, bio, city, categories, deliverables, rates, and social accounts).
  - Syncs with backend API (`GET /api/v1/profiles/me` and `GET /api/v1/users/me`) and local persistence on startup and pull-to-refresh.
- **Account Credentials & Security Lock**:
  - Registered **Email** and **Mobile Number** are strictly read-only and locked with `Icons.lock_rounded` and "Cannot Change" badges.
  - Explanatory security banner informing users that authentication credentials cannot be altered to preserve account verification integrity.
- **Interactive Profile Editing & Deep Links**:
  - "Edit Profile" button with quick-edit bottom sheet allowing editing of Display Name, Bio, and City, syncing to Supabase metadata and backend API.
  - Direct navigation links to Module C setup screens (`/profile/basic-info`, `/profile/category-skills`, `/profile/creator-details`, `/profile/social-accounts`, `/profile/completion`).
  - Added safe logout confirmation dialog with clean Supabase session termination.
- **Testing**:
  - Added `UserProfileScreen` tests in `test/profile_screens_test.dart` verifying all 57 tests pass cleanly.

---

## [Phase 1: Design Tokens & Onboarding] — 2026-10-19

### Added

- **Design Tokens (`lib/core/theme/`)**:
  - `app_colors.dart`: Extracted full 16-color token system from `docs/Onboarding Auth UI.pdf` (`backgroundPrimary`, `primary`, `secondary`, `accent`, `accentMint`, `accentSky`, `textPrimary`, `textSecondary`, `border`, `disabled`, etc.).
  - `app_typography.dart`: Exact Google Fonts integration with `Archivo` (headings & body) and `Instrument Serif Italic` (expressive italic accents).
  - `app_theme.dart`: Standardized Material 3 ThemeData, 4px grid spacing, and radii tokens (Buttons: 999px pill, Cards: 28px, Inputs: 16px).
- **Core Widgets (`lib/core/widgets/`)**:
  - `BrandLogoMark`: Scalable vector emblem featuring black squircle with infinity link connector.
  - `AppButton`: Reusable pill button supporting primary, dark, and outlined variants with loading/disabled states.
  - `StepIndicator`: Smooth animated capsule pill for active step with neutral inactive dots.
- **Screens (`lib/features/auth/presentation/screens/`)**:
  - `SCR-01 Splash`: Yellow background `#FFD64A`, organic circular shapes, brand squircle, `CreatorConnect` title, `create together` italic tagline, bottom 3 dots, auto-advance + tap to continue.
  - `SCR-02 Onboarding 1 (Value)`: Yellow hero card with floating marker badge and lilac/pink shapes, headline `"Create. Connect. Collaborate."` (`Collaborate.` in Instrument Serif Italic), subtitle, step indicator `[▬ ● ●]`, Next button, top Skip.
  - `SCR-03 Onboarding 2 (Discovery)`: Soft lilac hero card with 3 overlapping avatars (mint, yellow, pink) with white borders, `"Find your people"` badge, headline `"Discover the right collaborators"` (`right` in Instrument Serif Italic), subtitle, step indicator `[● ▬ ●]`, Next button, top Skip.
  - `SCR-04 Onboarding 3 (Opportunity)`: Soft pink hero card with campaign brief preview, `"Find work. Get hired."`, subtitle, `"Get Started"` CTA.
- **Testing & Verification**:
  - `test/widget_test.dart`: 4/4 automated widget tests verifying all brand elements, copies, button taps, and slide navigation.
  - Verified `dart analyze` reports **0 issues**.
  - Verified `flutter test` reports **All tests passed!**.
- **Documentation**:
  - Created `docs/app/ONBOARDING_AND_AUTH_TRACKER.md` as continuous source of truth and validation guide.
  - Created `docs/app/README.md` and `docs/app/CHANGELOG.md`.

---

## [Phase 2: Registration Screens & Backend Sync] — 2026-10-19

### Added

- **Domain & Data Layers (`lib/features/auth/`)**:
  - `domain/entities/user_role.dart`: Domain enum (`creator`, `professional`, `podcaster`, `brand`) with titles, descriptions, icons, and contract API values (`'CREATOR'`, `'PROFESSIONAL'`, `'PODCASTER'`, `'BRAND'`).
  - `data/datasources/auth_remote_datasource.dart`: Complete Supabase GoTrue Auth operations (Phone OTP, Email signup/login, Google OAuth) + internal PostgreSQL backend synchronization (`POST /api/v1/auth/sync`).
  - `data/repositories/auth_repository_impl.dart`: Clean Architecture repository implementation handling session tokens, attempt counters, and role synchronizations.
- **Core Components (`lib/core/widgets/`)**:
  - `AppTextField`: Standard `APPTEXTFIELD` matching all 5 design states (default, focused, filled, error, disabled) with `16px` border radius and animated error text.
  - `RoleCard`: `ROLECARD` component featuring role accent backgrounds, radio checkmark, and micro-bounce tap feedback.
  - `OtpInputField`: 6-digit input with auto-advance, backspace navigation, paste support, and animated focus/error borders.
- **Registration Screens (`lib/features/auth/presentation/screens/`)**:
  - `SCR-05 Account Type Selection`: Staggered card entrance animations, role selection, animated Continue CTA.
  - `SCR-06 Mobile Registration`: Locked `+91` prefix, 10-digit live validation, Send OTP button, Google & Email alternate signups.
  - `SCR-07 & SCR-07b OTP Verification`: 6-box input, 30-second live resend countdown, attempt countdown counter (`2 attempts remaining`), change phone number navigation.
  - `SCR-08 Email & Password Register`: Live password strength meter (weak/medium/strong) + 3 interactive ticking checklist rules, password match validation.
  - `SCR-09 Email Verification Sent`: 24-hour expiry badge, Open Email App CTA, resend cooldown timer.
  - `SCR-10 Google Sign-In Entry State`: Native app handoff loader with Cancel action.
- **Testing & Verification**:
  - Added `test/registration_test.dart` covering role selection, mobile validation, OTP error states, password checklist, and expiry badges.
  - Hardened `AppButton` and `EmailRegisterScreen` against flex and text overflow across diverse mobile viewport widths.
  - Verified pixel-perfect rendering with native high-resolution screenshot captures for SCR-05, SCR-06, SCR-07, SCR-08, SCR-09, and SCR-10.
  - Total test suite: **11/11 automated tests passing** across `widget_test.dart` and `registration_test.dart`.
  - Static analysis: **0 warnings, 0 errors** on `dart analyze`.

---

## [Phase 3: Login & Recovery Screens] — 2026-10-19

### Added

- **Domain & Data Layer Extensions (`lib/features/auth/`)**:
  - `AuthRepository`: Added `signInWithPassword(identifier, password)`, `sendPasswordResetEmail(email)`, `updatePassword(newPassword)`, and `signOut()`.
  - `AuthRemoteDataSource`: Implemented unified login resolving email or auto-formatted `+91` Indian mobile numbers via Supabase Auth, password reset email trigger via `resetPasswordForEmail`, and password updates via `updateUser`.
  - `AuthRepositoryImpl`: Concrete implementation managing session tokens and error normalization.
- **Login & Recovery Screens (`lib/features/auth/presentation/screens/`)**:
  - `SCR-11 Login Screen`:
    - Unified single input field accepting either email address or 10-digit mobile number.
    - Password field with show/hide toggle.
    - "Forgot password?" link navigating directly to password recovery.
    - Prominent animated inline credential error banner with retry.
    - Quick "Continue with Google" OAuth entry.
    - "Don't have an account? Sign up" returning to Account Type Selection (SCR-05).
  - `SCR-12 Forgot Password Screen`:
    - Email address input with live regex validation.
    - "Send Reset Link" action button with async loading state.
    - Interactive "Reset Link Sent" confirmation card with email target and "Open Email App" / "Back to Login" CTAs.
  - `SCR-13 Reset Password Screen`:
    - New password input with real-time 3-color strength meter (Weak/Medium/Strong).
    - 3-rule interactive checklist (8+ chars, 1 number, 1 special character) with live ticking checkmarks.
    - Confirm password matching validation indicator.
    - "Update Password" action with loading feedback and route handoff to Login.

---

## [Phase 4: System Modals & Error States] — 2026-10-19

### Added

- **System Modals & Dialogs (`lib/features/auth/presentation/`)**:
  - `SCR-14 Account Already Exists Sheet` (`bottom_sheets/account_exists_sheet.dart`):
    - 32px top-radius modal bottom sheet.
    - Amber warning badge with circular alert icon.
    - Clear duplicate notice ("An account with this email/mobile already exists").
    - Primary "Go to Login" button pre-populating identifier on `LoginScreen`.
    - Secondary "Use Different Details" dismiss action.
    - Wired into duplicate account detection on `MobileRegisterScreen` and `EmailRegisterScreen`.
  - `SCR-15 Session Expired Dialog` (`dialogs/session_expired_dialog.dart`):
    - Clean Material 3 security alert dialog with non-dismissible backdrop barrier (`barrierDismissible: false`).
    - Soft lilac clock emblem (`#C9B6F7`).
    - "Session Expired" title with explanation of token invalidation.
    - Direct "Log In Again" CTA redirecting to `LoginScreen`.
- **Navigation & Routing Updates (`lib/main.dart`)**:
  - Added named routes `/login`, `/forgot-password`, and `/reset-password`.
  - Linked "Already have an account? Log in" on Onboarding Slide 3 (SCR-04), Mobile Register (SCR-06), and Email Register (SCR-08).
- **Testing & Quality Assurance**:
  - Added `test/auth_login_recovery_test.dart` (5 comprehensive test suites):
    - Login screen credential validation and error banner.
    - Password visibility toggle.
    - Forgot password email submission and confirmation card.
    - Reset password checklist and matching verification.
    - Account exists modal bottom sheet and session expired dialog triggers.
  - Total automated test suite: **17/17 tests passing cleanly** with 0 failures across all 3 test suites (`widget_test.dart`, `registration_test.dart`, `auth_login_recovery_test.dart`).
  - Static analysis: **0 warnings, 0 errors** on `dart analyze`.

---

## [Phase 5: Smart Session Routing & Onboarding Persistence] — 2026-10-19

### Added

- **Local State & Onboarding Gate (`lib/features/auth/data/datasources/auth_local_datasource.dart`)**:
  - `AuthLocalDataSource`: Manages persistent device flags via `shared_preferences` (`cc_has_completed_onboarding`, `cc_saved_user_role`).
  - `hasCompletedOnboarding()`: Accurately checks whether returning users have already viewed the onboarding carousel.
  - `setOnboardingCompleted()`: Marks onboarding as completed upon finishing onboarding, completing registration (mobile OTP / email), or logging in.
  - `clearOnboarding()`: Development and testing reset helper.
- **Smart Splash Screen Routing (`lib/features/auth/presentation/screens/splash_screen.dart`)**:
  - **Authenticated Users (Active Session)**: Bypasses onboarding & login completely, routing straight to `/dev-home` (or authenticated home).
  - **Registered / Returning Users (No Active Session)**: Bypasses onboarding completely, routing directly to `LoginScreen` (`/login`).
  - **First-time New Users**: Gracefully lands on the 3-slide Onboarding carousel (`/onboarding`).
- **Onboarding Completion Handlers (`lib/features/auth/presentation/screens/onboarding_screen.dart`)**:
  - Tapping "Next" to slide 3 completion, tapping "Skip", or tapping "Already have an account? Log in" immediately marks onboarding as completed in local storage.
- **Dev & Session Controls in `AppTemplateHomeScreen` (`lib/main.dart`)**:
  - Added AppBar options for "Log Out" (clears session and returns to `/login` without re-showing onboarding) and "Reset Onboarding (Dev)".
- **Automated Verification**:
  - Added unit and widget tests in `apps/app/test/widget_test.dart` asserting that returning users and authenticated users bypass onboarding.
  - Total automated test suite: **19/19 tests passing** across `widget_test.dart`, `registration_test.dart`, and `auth_login_recovery_test.dart`.
  - Static analysis: **0 warnings, 0 errors** on `dart analyze`.

---

## [Phase 6: Role-Based Dashboard Routing & Authorization RBAC] — 2026-10-22

### Added & Improved

- **Direct Role-Based Home Navigation (Eliminated `/dev-home` as landing screen)**:
  - `SplashScreen`: Authenticated users bypass onboarding and developer screens, routing directly to `/home`.
  - `LoginScreen`: Successful authentication directly navigates to `/home`.
  - `OtpVerificationScreen`: "Go to Dashboard" directly navigates to `/home`.
  - `EmailSentScreen`: Added "Already verified? Log in to Dashboard" direct navigation link.
  - `AppTemplateHomeScreen`: Wrapped header titles in `Expanded` to resolve right-overflow layout exceptions on mobile viewports.
- **Role Synchronization with Backend & Database (`apps/api` & `apps/app`)**:
  - `AuthRemoteDataSource`: Passes `role` in `signUpWithEmail`, `sendPhoneOtp`, and updates Supabase user metadata on `verifyPhoneOtp`.
  - `AuthRepositoryImpl`: Saves authoritative database role upon verification, email registration, and password login from `/api/v1/auth/sync`.
  - `AuthService` (`apps/api`): Idempotently assigns `preferredRole` to existing users without roles and returns canonical user roles from PostgreSQL.
  - `PrismaUserRepository`: Added `assignRole(userId, roleName)` for transactional role persistence in `user_roles`.
- **Role Isolation & Access Control (RBAC)**:
  - `GET /api/v1/home/dashboard` (`discovery.module-d.routes.ts`): Enforces strict role boundaries when authenticated via Bearer token.
    - Creators / Influencers / Podcasters / Production Professionals cannot access the Brand dashboard (403 Forbidden `AuthInsufficientRoleError`).
    - Brands cannot access the Creator dashboard (403 Forbidden `AuthInsufficientRoleError`).
    - Unparameterized dashboard requests automatically resolve to the user's database role.
  - `ModuleDShellScreen`: Removed the floating debug role-switcher pill to prevent unauthorized client-side role jumping.
  - `HomeDashboardNotifier`: Role-aware initialization from local storage, Supabase user metadata, and backend response.
- **Automated Verification & Quality**:
  - Static Analysis: **0 warnings, 0 errors** on `dart analyze`.
  - Automated Tests: **56/56 tests passing** across all test suites.
  - API TypeScript Build: **Clean compilation (0 errors)** on `pnpm --filter @creatorconnect/api build`.
