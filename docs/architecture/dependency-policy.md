# CreatorConnect — Dependency Governance & Library-First Policy

## 1. Core Mandate: Library-First Development

CreatorConnect enforces a strict engineering principle:

> **"USE A LIBRARY WHEN IT PROVIDES MEANINGFUL, TRUSTWORTHY, REUSABLE VALUE. DO NOT REINVENT ESTABLISHED ENGINEERING SOLUTIONS."**

Engineers must not write custom implementations for problems that have been solved, hardened, and maintained by mature open-source libraries.

### Concrete Non-Negotiables:

- **DO NOT** write custom queue/retry logic when **BullMQ** provides it.
- **DO NOT** write custom validation engines when **TypeBox / Zod** provides it.
- **DO NOT** build custom UI primitives (accordions, dialogs, dropdowns) when **Radix UI / shadcn/ui** provides accessible, keyboard-navigable primitives.
- **DO NOT** create custom HTTP client wrappers when generated **Orval / openapi-typescript** clients solve it deterministically.
- **DO NOT** hand-roll custom date formatting or timezone arithmetic when **date-fns** provides tree-shakeable functions.
- **DO NOT** roll custom JWT hashing or identity token verification when **Supabase Auth** and official JWT verification libraries handle it.
- **DO NOT** create custom image resizing or video transcoding logic when **Sharp** and **FFmpeg** provide native, hardened pipelines.
- **DO NOT** build custom E2E automation frameworks when **Playwright** provides cross-browser resilience.

---

## 2. The Balance: Avoiding Dependency Bloat

While library-first is mandatory, **"Use a library" does NOT mean "install an npm package for everything."**

If 10 lines of clean, native, zero-dependency TypeScript code can solve a trivial problem (e.g., `clsx` logic, simple string slugification) without security or cross-browser edge cases, avoid adding an unvetted 50-dependency tree.

### 7-Point Dependency Vetting Checklist

Before adding any new dependency to `package.json`, the Technical Lead or PR reviewer must verify:

```mermaid
flowchart TD
    Start[Proposed Dependency] --> C1{1. Already Solved in Repo?}
    C1 -- Yes --> Reject1[REJECT: Reuse Existing Code or Shared Package]
    C1 -- No --> C2{2. Solved by Native Node/TS/Web Standard?}
    C2 -- Yes --> Reject2[REJECT: Use Native Standard]
    C2 -- No --> C3{3. Weekly Downloads > 100k & Active Commits < 6mo?}
    C3 -- No --> Reject3[REJECT: Unmaintained / Low Community Adoption]
    C3 -- Yes --> C4{4. Permissive License (MIT, Apache-2.0, BSD)?}
    C4 -- No --> Reject4[REJECT: License Risk (e.g. GPL / AGPL in proprietary app)]
    C4 -- Yes --> C5{5. First-Class TypeScript Typings?}
    C5 -- No --> Reject5[REJECT: Lacks Types / Maintenance Debt]
    C5 -- Yes --> C6{6. Clean Security Audit (Zero Critical/High CVEs)?}
    C6 -- No --> Reject6[REJECT: Vulnerability Risk]
    C6 -- Yes --> C7{7. Bundle / Runtime Overhead Justified?}
    C7 -- No --> Reject7[REJECT: Bundle Bloat]
    C7 -- Yes --> Approved[APPROVED: Add to Shared Package or App]
```

---

## 3. Strict Prevention of Duplicate Libraries

The project strictly prohibits running parallel or competing libraries for the same technical responsibility:

| Domain Responsibility        | Canonical Approved Technology                 | Prohibited Duplications                    | Rationale                                                                                       |
| :--------------------------- | :-------------------------------------------- | :----------------------------------------- | :---------------------------------------------------------------------------------------------- |
| **ORM / Data Access**        | **Prisma**                                    | Drizzle, TypeORM, MikroORM, raw pg queries | Unified migration engine, schema clarity, single query-logging middleware.                      |
| **Backend Validation**       | **TypeBox** (for Fastify routes)              | Zod everywhere, Joi, Yup                   | TypeBox generates JSON Schema natively at near-instant compile speed for Fastify + OpenAPI 3.1. |
| **Frontend Form Validation** | **Zod** (via `@hookform/resolvers`)           | Yup, Joi, Superstruct                      | React Hook Form ecosystem standard; shared with `@creatorconnect/validation`.                   |
| **HTTP Client**              | **Standard `fetch` + Orval generated client** | Axios, Got, Superagent, request            | Native Fetch API is built into Node 20+ and modern browsers. Zero bundle weight.                |
| **API Testing / Spec**       | **OpenAPI 3.1 + Scalar + Bruno**              | Postman collections, Insomnia, Swagger UI  | Version-controlled, offline-first, Git-friendly `.bru` collections and interactive Scalar docs. |
| **Server State**             | **TanStack Query**                            | SWR, RTK Query                             | Standardized cache invalidation, SSR hydration, optimistic updates.                             |
| **Client UI State**          | **Zustand** (only where required)             | Redux Toolkit, MobX, Recoil, Jotai         | Tiny (<2KB), boilerplate-free, decoupled from React lifecycle.                                  |
| **CSS & Styling**            | **Tailwind CSS + shadcn/ui**                  | Styled Components, Emotion, CSS Modules    | Zero runtime CSS injection, deterministic utility tokens, design system consistency.            |
| **Icons**                    | **Lucide React**                              | FontAwesome, Material Icons, react-icons   | Uniform 24x24 grid, tree-shakeable SVG strokes, accessible naming.                              |
| **Date / Time**              | **date-fns**                                  | Moment.js, Day.js, Luxon                   | Modular, tree-shakeable, pure functional TypeScript functions, immutable.                       |
| **Unit & Integration Test**  | **Vitest**                                    | Jest, Mocha, Chai                          | Native ESM, instant HMR, shared Vite configuration across monorepo.                             |
| **Logging**                  | **Pino**                                      | Winston, Bunyan, console.log               | Fastest JSON logger in Node.js ecosystem, zero GC pressure, redaction support.                  |

---

## 4. Enforcement Mechanism

1. **Automated ESLint Rules (`no-restricted-imports`)**: Enforces that client apps cannot import prohibited packages (e.g., `axios`, `moment`).
2. **`package.json` Lockfile Audits**: `pnpm dedupe` and `pnpm audit` run on every Pull Request in CI.
3. **Architecture Review Required**: Any change adding a top-level package to `packages/*` requires sign-off from the Technical Lead.
