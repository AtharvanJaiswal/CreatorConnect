# CreatorConnect — Phase 4.3.1 CLS Remediation Report (`/admin/refunds` & Admin Tables)

**Primary Target:** `/admin/refunds` (`apps/web-shell/src/app/admin/refunds/page.tsx`, `AdminTable.tsx`)  
**Measurement Method:** Headless Playwright `PerformanceObserver` (`layout-shift` with `entry.sources`, `hadRecentInput === false`) against production `next start -p 3002` + compiled `apps/api/dist/main.js`  
**Methodology Distinction:** All values below are **controlled local headless lab measurements (`127.0.0.1`)**. Real-device production field telemetry (Chrome User Experience Report / CrUX) is **not available locally**.

---

## 1. Root Cause Analysis (`/admin/refunds` Before `CLS = 0.101089`)

Tracing individual `layout-shift` `entry.sources` on `/admin/refunds` at `1440x900` pinpointed a single `t = 306ms` async hydration shift contributing **100%** of the `0.101089` score:

| Shifting Element (`entry.sources`)              |   Before Async Load (`prevRect`)    |     After Async Load (`currRect`)     | Shift Mechanism                                                 |
| :---------------------------------------------- | :---------------------------------: | :-----------------------------------: | :-------------------------------------------------------------- |
| `th` (`Requested Sum`)                          |  `x=629.1, y=252, w=188.6, h=44.5`  |   `x=892.1, y=252, w=125.2, h=60.5`   | Header wrapped 1 -> 2 lines (`+16px` height)                    |
| `th` (`Approval State`)                         |  `x=817.7, y=252, w=191.6, h=44.5`  |  `x=1017.3, y=252, w=134.5, h=60.5`   | Header wrapped 1 -> 2 lines (`+16px` height)                    |
| `th` (`Requested At`)                           | `x=1009.3, y=252, w=170.9, h=44.5`  |  `x=1151.8, y=252, w=117.1, h=60.5`   | Header wrapped 1 -> 2 lines (`+16px` height)                    |
| `th` / `#text` (`Refund Case & Payment Intent`) |    `x=289, y=266, w=340.1, h=16`    |     `x=289, y=274, w=603.1, h=16`     | Expanded `+263px` on UUID row load, compressing sibling `<th>`s |
| **`tbody.divide-y`**                            | **`x=289, y=296.5, w=1118, h=448`** | **`x=289, y=312.5, w=1118, h=587.5`** | **Shifted down `+16px` across `65%` of `1440x900` viewport**    |

Because `<table className="w-full ...">` used auto column sizing during the skeleton phase (`8` symmetric placeholder bars), arriving UUIDs (`Intent: 01a2212a-...`) widened column 1 by `263px`, compressing sibling `<th>` labels enough to wrap from `44.5px` (1 line) to `60.5px` (2 lines) and pushing the entire `<tbody>` down `16px`.

---

## 2. Remediations Implemented

1. **Non-Wrapping Table Headers ([`AdminTable.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/components/admin/ui/AdminTable.tsx)):**
   - Added `whitespace-nowrap` to all `<th scope="col">` headers inside the `overflow-x-auto` table container so `<thead>` remains locked at exact `44.5px` height between skeleton and populated states.
2. **Pre-Allocated Column Widths on Refunds & Audit Tables ([`refunds/page.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/app/admin/refunds/page.tsx), [`audit/page.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/app/admin/audit/page.tsx)):**
   - Added explicit balanced `headerClassName` and `className` column proportions (`min-w-[300px] lg:w-[44%]`, `w-[140px]`, `w-[190px]`, `w-[125px]`, `w-[195px]` on `/admin/refunds`; `w-[280px] lg:w-[28%]`, `w-[240px] lg:w-[24%]`, `w-[300px] lg:w-[30%]`, `w-[180px] lg:w-[18%]` on `/admin/audit`) so column coordinates match before and after async fetch.
3. **Mobile Count Line-Wrap Stabilization ([`users/page.tsx`](file:///f:/CreatorConnect/apps/web-shell/src/app/admin/users/page.tsx)):**
   - Placed `Total accounts: {totalUsers}.` inside `<span className="block sm:inline tabular-nums">` so switching `0 -> 1000+` on narrow phones (`320px`) does not change heading subtitle line count.

---

## 3. Before vs After CLS Lab Measurements (`1440x900` & Mobile Viewports)

| Route & Transition                                 |     Before CLS (`1440x900`)     |           After CLS (`1440x900`)           | Mobile After CLS (`320 / 360 / 390 / 430`) | Target (`<= 0.1` / `<= 0.05`) |
| :------------------------------------------------- | :-----------------------------: | :----------------------------------------: | :----------------------------------------: | :---------------------------- |
| **`/admin/refunds` (Initial Hydration Load)**      | **`0.101089`** _(FAIL `> 0.1`)_ |     **`0.000000`** _(0 shift entries)_     |        `0` / `0` / `0` / `0.001022`        | **PASS (`-100%`)**            |
| **`/admin/refunds` (Open/Escape Modal + Refresh)** |     Not separately isolated     | **`0.000000`** _(after interactive cycle)_ |                     —                      | **PASS**                      |
| `/admin/audit`                                     |           `0.037455`            | `0.040379` _(footer push beyond viewport)_ |         `0` across all 4 viewports         | **PASS (`< 0.05`)**           |
| `/admin/users`                                     |           `0.004471`            |                 `0.004471`                 |         `0.006–0.008` (`360–430`)          | **PASS (`< 0.05`)**           |
| `/admin/dashboard`                                 |           `0.000022`            |                 `0.000022`                 |    `0` / `0.0001` / `0.0148` / `0.0144`    | **PASS (`< 0.05`)**           |
| `/admin/lifecycle`                                 |           `0.001689`            |                 `0.001689`                 |         `0` across all 4 viewports         | **PASS (`< 0.05`)**           |
| `/admin/disputes`                                  |           `0.001688`            |                 `0.001688`                 |                     —                      | **PASS (`< 0.05`)**           |

**Note on Interactive Verification:** [`tests/e2e/admin-console-journey.spec.ts`](file:///f:/CreatorConnect/tests/e2e/admin-console-journey.spec.ts) (`Journey 7.7`) now asserts live `/admin/refunds` CLS `<= 0.05` across initial fetch, `Initiate Refund` modal open/Escape close, and `Refresh` reload.
