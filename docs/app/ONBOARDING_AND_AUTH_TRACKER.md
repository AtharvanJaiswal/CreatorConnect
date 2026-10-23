# CreatorConnect Mobile App — Implementation & Verification Tracker

> **Source of Truth**: `docs/Onboarding Auth UI.pdf` (Client-Approved Visual Reference & BRD)  
> **Target Package**: `apps/app`  
> **Framework**: Flutter (Dart ^3.9.2, Material 3)  
> **Status**: Active Tracking & Continuous Validation

---

## 1. Quality & Validation Commands

Always run these commands before committing or opening a PR to guarantee zero regressions:

```bash
# 1. Run static analysis (must report: "No issues found!")
cd apps/app
dart analyze

# 2. Run automated test suite (must report: "All tests passed!")
flutter test

# 3. Launch local dev server or target device
flutter run -d web-server --web-port 8085
# or on mobile/emulator:
flutter run
```

---

## 2. Design System Tokens (Single Source of Truth)

All app screens **must strictly use** these tokens. Loose or inline hex values and random fonts are prohibited.

### 2.1 Color Tokens (`lib/core/theme/app_colors.dart`)

| Token Name            | Hex Code  | Description      | Role / Usage                                        |
| :-------------------- | :-------- | :--------------- | :-------------------------------------------------- |
| `backgroundPrimary`   | `#FAF6EF` | Warm Cream       | Default screen scaffold background                  |
| `backgroundSecondary` | `#F2ECE1` | Soft Sand        | Secondary backgrounds, cards, and input fills       |
| `surface`             | `#FFFFFF` | Pure White       | Elevated cards, dialogs, badges                     |
| `primary`             | `#FFD64A` | Creator Yellow   | Brand primary, action buttons, splash hero card     |
| `secondary`           | `#C9B6F7` | Soft Lilac       | Hero illustration card for Discovery (SCR-03)       |
| `accent`              | `#FFB6C8` | Bubblegum Pink   | Hero card for Opportunity (SCR-04), accent shapes   |
| `accentMint`          | `#B6E09B` | Mint Green       | Avatar badges, tag backgrounds                      |
| `accentSky`           | `#A6CCF7` | Sky Blue         | Category tags, auxiliary accents                    |
| `textPrimary`         | `#14110F` | Deep Espresso    | Primary headings, button text, high-contrast labels |
| `textSecondary`       | `#6F675E` | Warm Gray        | Subtitles, body copy, secondary button labels       |
| `textMuted`           | `#A39A8F` | Muted Gray       | Placeholders, captions, disabled text               |
| `border`              | `#E7E0D5` | Neutral Border   | Outlined inputs, card borders                       |
| `disabled`            | `#D8D1C6` | Neutral Disabled | Inactive indicator dots, disabled buttons           |
| `success`             | `#2E9E6B` | Green            | Verified indicators, success status                 |
| `warning`             | `#C98A16` | Amber            | Warning notices, pending states                     |
| `error`               | `#D8483C` | Crimson Red      | Inline validation errors                            |

### 2.2 Typography Tokens (`lib/core/theme/app_typography.dart`)

- **Primary Font Family**: **`Archivo`** (Google Fonts)
- **Expressive Accent Font**: **`Instrument Serif Italic`** (Google Fonts)

| Style Token     | Font Family      | Weight       | Size      | Line Height | Tracking     | Purpose                                               |
| :-------------- | :--------------- | :----------- | :-------- | :---------- | :----------- | :---------------------------------------------------- |
| `displayLarge`  | Archivo          | 800          | 30–32px   | 1.05        | -3% (-0.9px) | Main headlines (`Create. Connect.`)                   |
| `displayAccent` | Instrument Serif | 400 (Italic) | 32–35px   | 1.10        | 0.0          | Signature words (_Collaborate._, _right_, _together_) |
| `headingLarge`  | Archivo          | 800          | 25px      | 1.20        | -2.5%        | Screen titles (`Welcome back`, `Create account`)      |
| `headingMedium` | Archivo          | 700          | 18px      | 1.25        | -0.2px       | Card headers, section titles                          |
| `bodyMedium`    | Archivo          | 400          | 14–14.5px | 1.45–1.5    | 0.0          | Description & body paragraphs                         |
| `buttonLarge`   | Archivo          | 700          | 15px      | 1.00        | -0.1px       | CTA buttons (`Next`, `Get Started`, `Continue`)       |
| `label`         | Archivo          | 700          | 10px      | 1.00        | +9% (+0.9px) | Uppercase tags (`NEW BRIEF`, `MOBILE NUMBER`)         |
| `caption`       | Archivo          | 400          | 11.5px    | 1.20        | 0.0          | Helper text, cooldown timers                          |

### 2.3 Radii & Spacing Grid (`lib/core/theme/app_theme.dart`)

- **Pill Buttons (`AppRadii.button`)**: `999.0px`
- **Cards (`AppRadii.card`)**: `28.0px`
- **Modals / Sheets (`AppRadii.modal`)**: `32.0px`
- **Input Fields (`AppRadii.input`)**: `16.0px`
- **Chips & Badges (`AppRadii.chip`)**: `999.0px`
- **Spacing 4px Grid**: `xs: 4`, `sm: 8`, `md: 16`, `lg: 24`, `xl: 32`, `xxl: 48`, `xxxl: 64`

---

## 3. Screen Implementation & Roadmap Status

| Screen ID   | Screen Name                  | Implemented File                                                         |   Status    | Automated Test Coverage                                                                                                      |
| :---------- | :--------------------------- | :----------------------------------------------------------------------- | :---------: | :--------------------------------------------------------------------------------------------------------------------------- |
| **SCR-01**  | Splash Screen                | `lib/features/auth/presentation/screens/splash_screen.dart`              | ✅ Complete | Brand logo, Archivo title, Instrument Serif tagline, navigation tap                                                          |
| **SCR-02**  | Onboarding 1 — Value         | `lib/features/auth/presentation/screens/onboarding_screen.dart`          | ✅ Complete | Hero card with floating pen badge, headline, subtitle, step indicator `[▬ ● ●]`, Next button, Skip                           |
| **SCR-03**  | Onboarding 2 — Discovery     | `lib/features/auth/presentation/screens/onboarding_screen.dart`          | ✅ Complete | Lilac card, 3 overlapping circle avatars with white borders, `Find your people` badge, step indicator `[● ▬ ●]`, Next button |
| **SCR-04**  | Onboarding 3 — Opportunity   | `lib/features/auth/presentation/screens/onboarding_screen.dart`          | ✅ Complete | Accent card with brief card preview, `Find work. Get hired.`, `Get Started` CTA                                              |
| **SCR-05**  | Account Type Selection       | `lib/features/auth/presentation/screens/account_type_screen.dart`        | ✅ Complete | 4 single-select role cards, staggered entrance animation, animated Continue button                                           |
| **SCR-06**  | Mobile Registration          | `lib/features/auth/presentation/screens/mobile_register_screen.dart`     | ✅ Complete | `+91` locked prefix, 10-digit validation, Send OTP, Google & Email alternative CTAs                                          |
| **SCR-07**  | OTP Verification             | `lib/features/auth/presentation/screens/otp_verification_screen.dart`    | ✅ Complete | 6 OTP boxes, 30s live countdown timer, auto-advance, Change phone action                                                     |
| **SCR-07b** | OTP Error State              | `lib/features/auth/presentation/screens/otp_verification_screen.dart`    | ✅ Complete | Attempt countdown counter (`2 attempts remaining`), soft error styling                                                       |
| **SCR-08**  | Email & Password Register    | `lib/features/auth/presentation/screens/email_register_screen.dart`      | ✅ Complete | Live password strength meter, 3 ticking rule checks, confirm match indicator                                                 |
| **SCR-09**  | Email Verification Sent      | `lib/features/auth/presentation/screens/email_sent_screen.dart`          | ✅ Complete | 24-hour expiry badge, Open Email App CTA, resend cooldown timer                                                              |
| **SCR-10**  | Google OAuth Handoff         | `lib/features/auth/presentation/screens/google_auth_screen.dart`         | ✅ Complete | App-side handoff loader with Cancel action                                                                                   |
| **SCR-11**  | Login Screen                 | `lib/features/auth/presentation/screens/login_screen.dart`               | ✅ Complete | Unified mobile/email field, password toggle, inline error banner, Google OAuth, navigation                                   |
| **SCR-12**  | Forgot Password              | `lib/features/auth/presentation/screens/forgot_password_screen.dart`     | ✅ Complete | Email validation, Send Reset Link action, Reset link confirmation card                                                       |
| **SCR-13**  | Reset Password               | `lib/features/auth/presentation/screens/reset_password_screen.dart`      | ✅ Complete | Live strength meter, 3 ticking rules, password match confirmation, Update Password CTA                                       |
| **SCR-14**  | Account Already Exists Sheet | `lib/features/auth/presentation/bottom_sheets/account_exists_sheet.dart` | ✅ Complete | 32px modal bottom sheet, alert badge, Go to Login action, dismiss trigger                                                    |
| **SCR-15**  | Session Expired Dialog       | `lib/features/auth/presentation/dialogs/session_expired_dialog.dart`     | ✅ Complete | Security modal dialog with session timeout notice, un-dismissible backdrop, Log In CTA                                       |

---

## 4. Reusable Core UI Components

Located in `apps/app/lib/core/widgets/`:

- **`BrandLogoMark`** (`brand_logo.dart`):
  - Black squircle (`#14110F`) with high-resolution vector angled infinity/link connector.
  - Fully customizable size, colors, and corner radius.
- **`AppButton`** (`app_button.dart`):
  - Pill radius (`999px`), Archivo 700 15px text.
  - Supported variants: `primary` (yellow), `dark` (`#14110F`), `outlined`.
  - Built-in `isLoading` progress indicator and disabled state styling.
- **`StepIndicator`** (`step_indicator.dart`):
  - Animated capsule transition: active index expands to `24px x 8px` (`#14110F`), inactive dots remain `8px x 8px` (`#D8D1C6`).
- **`AppTextField`** (`app_text_field.dart`):
  - Exact `APPTEXTFIELD` specification supporting default, focused, filled, error, and disabled states with `16px` radius.
  - Supports locked prefixes (e.g., `+91`), visibility eye toggles, and animated inline validation errors.
- **`RoleCard`** (`role_card.dart`):
  - `ROLECARD` component from spec with custom accent color styling, radio check indicator, and micro-bounce press animation.
- **`OtpInputField`** (`otp_input_field.dart`):
  - 6 individual digit boxes with auto-advance, backspace navigation, and clipboard paste support.

---

## 5. Verification Log & Test Suite

Maintained across `apps/app/test/widget_test.dart`, `apps/app/test/registration_test.dart`, and `apps/app/test/auth_login_recovery_test.dart`:

```
00:00 +0: (setUpAll)
00:00 +0: SCR-11: Login Screen Tests Renders Login Screen elements and handles inline credentials error
00:09 +1: SCR-05: Account Type Selection Tests Renders all 4 roles and enables Continue on selection
00:11 +3: SCR-12: Forgot Password Screen Tests Validates email and triggers reset link submission
00:11 +4: SCR-06: Mobile Registration Tests Validates 10-digit input and navigates to OTP on Send OTP
00:17 +8: SCR-07: OTP Verification Tests Renders OTP screen with attempts, resend cooldown, and handles success
00:17 +9: SCR-07: OTP Verification Tests Shows attempt counter when verification fails (SCR-07b)
00:18 +10: SCR-08: Email Registration Tests Password strength checklist ticks live as user types
00:19 +11: SCR-09 & SCR-10: Email Sent & Google Entry Tests SCR-09 renders expiry badge and action buttons
00:19 +12: SCR-09 & SCR-10: Email Sent & Google Entry Tests SCR-10 Google sign-in handoff renders connecting message and Cancel
00:22 +13: SCR-01 Splash screen renders brand mark, title, and tagline for new user
00:26 +14: Splash bypasses onboarding and navigates to LoginScreen if user already seen onboarding
00:27 +15: Splash bypasses onboarding and navigates to /home if user is already logged in
00:27 +16: SCR-02 Onboarding 1 (Value) renders exact copy, cards, and indicators
00:27 +17: SCR-03 Onboarding 2 (Discovery) advances and renders copy and badges
00:28 +18: Skip button navigates directly to Account Type Selection
00:28 +19: All tests passed!
```

---

## 6. Validation Rule For Every Subsequent Step

Whenever adding a new screen, widget, or service:

1. **Never hardcode raw colors or fonts**: Reference `AppColors` and `AppTypography`.
2. **Never create redundant folders**: Preserve Clean Architecture under `lib/features/<domain>/presentation/{screens,widgets,dialogs,bottom_sheets,controllers}`.
3. **Execute validation**:
   - Run `dart analyze` — must output **0 warnings, 0 errors**.
   - Run `flutter test` — all existing and new widget tests must pass.
4. **Update this document**: Update Section 3 table and changelog in `docs/app/CHANGELOG.md`.
