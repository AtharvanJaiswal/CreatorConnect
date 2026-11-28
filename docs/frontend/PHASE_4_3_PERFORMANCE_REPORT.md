# CreatorConnect — Phase 4.3 Performance Report (Desktop & Mobile Emulation)

**Test Methodology:** Headless Playwright Performance API & EventTiming (`PerformanceObserver`) probes executed against production `next start` (`Next.js 15.5.29`, port `3002`) and compiled `@creatorconnect/api` (`dist/main.js`, port `3000`) seeded with a live `SUPER_ADMIN` session.  
**Methodology Boundary:** Values below are **local headless desktop and mobile viewport emulation lab measurements** (`127.0.0.1`). Real cellular networks, physical iOS/Android hardware CPUs, and production Chrome User Experience Report (CrUX) field telemetry are **NOT MEASURED**.

---

## 1. Core Web Vitals & Transfer Budget Comparison

### A. Chromium Desktop (`1440 x 900`, `deviceScaleFactor: 1`)

| Route              | TTFB (`ms`) | FCP (`ms`) | LCP (`ms`) |                CLS                 |                           Interactive EventTiming INP (`ms`)                            |      Overflow X       | JS / Total KB |
| :----------------- | :---------: | :--------: | :--------: | :--------------------------------: | :-------------------------------------------------------------------------------------: | :-------------------: | :-----------: |
| `/admin/login`     |    `9.6`    |    `84`    |    `84`    |                `0`                 |                                            —                                            | `false` (`1440/1440`) | `193 / 207.5` |
| `/admin/dashboard` |   `39.3`    |    `88`    |   `176`    |                `0`                 |                                            —                                            | `false` (`1440/1440`) | `7.1 / 16.8`  |
| `/admin/users`     |   `30.0`    |    `88`    |   `156`    |              `0.0068`              |                                            —                                            | `false` (`1440/1440`) | `11.2 / 27.2` |
| `/admin/audit`     |   `16.1`    |    `48`    |   `112`    |              `0.044`               | **`24 ms`** _(3 events; `inputDelay 0.9ms`, `processing 0.5ms`, `presentation 22.6ms`)_ | `false` (`1440/1440`) | `6.6 / 22.2`  |
| `/admin/refunds`   |   `16.6`    |    `56`    |   `116`    | **`0.1011`** _(borderline `>0.1`)_ | **`56 ms`** _(3 events; `inputDelay 0.9ms`, `processing 0.7ms`, `presentation 54.4ms`)_ | `false` (`1440/1440`) | `7.9 / 18.6`  |
| `/admin/lifecycle` |   `16.7`    |    `44`    |    `92`    |              `0.0017`              |                                            —                                            | `false` (`1440/1440`) | `4.8 / 15.8`  |

### B. Chromium Mobile Emulation (`390 x 844`, `isMobile: true`, `hasTouch: true`, `dpr: 3`)

| Route              | TTFB (`ms`) | FCP (`ms`) | LCP (`ms`) | CLS | Interactive EventTiming INP (`ms`) |     Layout Width (`scroll / inner`)     | JS / Total KB |
| :----------------- | :---------: | :--------: | :--------: | :-: | :--------------------------------: | :-------------------------------------: | :-----------: |
| `/admin/login`     |   `22.6`    |    `76`    |    `76`    | `0` |                 —                  |               `390 / 390`               | `193 / 207.5` |
| `/admin/dashboard` |   `25.2`    |    `88`    |   `152`    | `0` |                 —                  | **`529 / 529`** _(viewport zoomed out)_ | `7.1 / 16.0`  |
| `/admin/users`     |   `28.5`    |    `44`    |   `116`    | `0` |                 —                  |             **`500 / 500`**             | `11.2 / 20.7` |
| `/admin/audit`     |   `17.1`    |    `44`    |   `112`    | `0` |      **`16 ms`** _(6 events)_      |             **`500 / 500`**             | `6.6 / 22.2`  |
| `/admin/refunds`   |   `28.4`    |    `60`    |   `116`    | `0` |      **`32 ms`** _(3 events)_      |             **`514 / 514`**             | `7.9 / 18.2`  |
| `/admin/lifecycle` |   `23.2`    |    `44`    |   `108`    | `0` |                 —                  |             **`516 / 516`**             | `4.8 / 15.4`  |

### C. Firefox Desktop (`1440 x 900`) & WebKit Mobile Viewport (`390 x 844`, `hasTouch: true`)

| Profile & Engine                       | Route Sample Range           | TTFB (`ms`) | FCP (`ms`) | LCP (`ms`)  | CLS |          EventTiming INP (`ms`)          | Horizontal Overflow (`overflowX`)                            |
| :------------------------------------- | :--------------------------- | :---------: | :--------: | :---------: | :-: | :--------------------------------------: | :----------------------------------------------------------- |
| **Firefox Desktop** (`1440x900`)       | 6 routes                     |  `16 – 63`  | `47 – 259` | `159 – 533` | `0` |        `24 ms` (`/admin/refunds`)        | `false` (`1440 / 1440` across all 6 routes)                  |
| **WebKit Mobile Viewport** (`390x844`) | `/admin/login`               |    `15`     |    `60`    |    `60`     | `0` |                    —                     | `false` (`390 / 390`)                                        |
| **WebKit Mobile Viewport** (`390x844`) | 5 authenticated shell routes |  `10 – 18`  | `40 – 88`  | `223 – 306` | `0` | `16 ms` (`/refunds`), `40 ms` (`/audit`) | **`true`** (`scrollWidth: 499–529px` vs `innerWidth: 390px`) |

---

## 2. Diagnostic Findings & Recommendations

1. **Responsive Mobile Overflow on Authenticated Admin Shell (`overflowX: true` at `390px`):**
   - **Root Cause Observed:** `apps/web-shell/src/components/admin/AdminSidebar.tsx:212` renders `<aside className="w-64 ... shrink-0 ...">` unconditionally alongside `<div className="flex-1 flex flex-col min-w-0">` in `apps/web-shell/src/app/admin/layout.tsx:76-77`. The fixed `256px` (`w-64`) sidebar plus page header/table content expands minimum width to `499–529px`, triggering horizontal overflow on WebKit at `390px` and auto-zoom-out on Chromium `isMobile`.
   - **Mitigation Path:** Admin Web Console is primarily a desktop operational console (`1440x900` fits cleanly with `0` overflow across Chromium & Firefox); if mobile tablet/phone admin workflows are targeted later, convert `AdminSidebar` into a `<lg:hidden` collapsible drawer. Tracked in [`PHASE_4_3_KNOWN_LIMITATIONS.md`](./PHASE_4_3_KNOWN_LIMITATIONS.md).
2. **`/admin/refunds` Borderline Desktop CLS (`0.1011`):**
   - **Root Cause Observed:** Async load transition on initial table/KPI mount shifts layout vertically by `0.1011` (just above the `<= 0.1` Good threshold) in Chromium Desktop.
   - **Mitigation Path:** Reserve fixed skeleton/min-height containers (`min-h-[...]`) on refund summary cards and table wrapper during initial hydration fetch.
3. **Sub-Budget Speed & Responsiveness:**
   - All `TTFB` (`<= 63ms`), `FCP` (`<= 259ms`), `LCP` (`<= 533ms` vs `<= 2500ms`), and real EventTiming `INP` interactions (`16–56ms` vs `<= 200ms`, dominated by paint presentation delay rather than main-thread JS blocking `< 8ms` processingTime) stay well inside Google Core Web Vitals Good thresholds.
