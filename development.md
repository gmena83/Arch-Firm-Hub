# KONTi Dashboard — Development Roadmap

_Generated 2026-04-23 from a code + logs + test-result audit of the KONTi MVP._

This roadmap captures the gaps, fixes, and optimizations identified during a sweep of the codebase, the running workflows' logs, and the most recent end-to-end test results. It is organized into eight Dev Phases (A–H), in roughly the order you'd want to attack them. Each item lists the files involved and a one-line fix hint so an engineer can pick it up directly. The appendix lists the follow-up tasks that have already been proposed in the project, mapped to the phases below.

---

## Executive summary

- **Status:** All three artifacts (api-server, konti-dashboard, mockup-sandbox) are running. The dashboard typecheck is clean. Production deploy succeeded — what looked like a crash in the deploy logs is just normal Autoscale cool-down (server idled, got `SIGTERM`).
- **Biggest gap (Phase A):** Most mutable data (notes, receipts, contractor estimates, report templates, punchlist edits, project mutations) lives in plain in-memory arrays in `seed.ts` and route modules, so anything entered after deploy is lost on restart.
- **Second-biggest gap (Phase B):** ~6 client panels still call the legacy `customFetch` helper instead of the typed hooks generated from the OpenAPI spec, and several routes are not in `lib/api-spec/openapi.yaml` at all — so the contract drifts every time a route is added.
- **Hardening (Phase C):** Several read-only project routes are still public; standardize role + ownership checks. Error response shape is inconsistent.
- **Test coverage (Phase D):** AI, notifications, leads, and dashboard routes have no integration tests; one estimating test has a brittle hardcoded tolerance.
- **AI / PDF / OCR (Phase E):** Receipt OCR and the report-template PDF export are still mocked or short-circuited.
- **Performance (Phase F):** API bundle is 2.1 MB with a build-time warning; Vite has a slow cold start; production source maps are 5 MB.
- **UX freshness, i18n, a11y (Phase G):** Phase-advance doesn't fully refresh dependent panels; a few hard-coded English strings remain; a few forms lack accessible labels.
- **Ops (Phase H):** Currently `autoscale` (cheap, cold starts). Switch to Reserved VM if always-on latency matters; add a static health probe for the dashboard artifact.

---

## Phase A — Persistence (data durability)

**Why first:** every other improvement is undermined while data disappears on restart.

- **AI assistant in-memory state.** `artifacts/api-server/src/routes/ai.ts` keeps `PROJECT_NOTES` (~L23) and `SPEC_EVENTS` (~L26) as plain arrays. → Move both to Drizzle tables and rewrite the read/write paths in `POST /api/projects/:id/notes` (~L161) and the spec-events helpers. Tracked as **#30**.
- **Estimating in-memory state.** `artifacts/api-server/src/routes/estimating.ts` holds `EXTRA_MATERIALS` (~L81), `LABOR_RATES` (~L92), `PROJECT_RECEIPTS` (~L94), `PROJECT_REPORT_TEMPLATE` (~L95), and `PROJECT_CONTRACTOR_ESTIMATE` (~L96) all in process memory. → Persist with Drizzle so receipts and contractor estimates survive a restart. Tracked as **#27**.
- **Seed data is mutated in place.** `artifacts/api-server/src/data/seed.ts` exports `PROJECTS`, `PROJECT_TASKS`, `DOCUMENTS`, etc. as mutable arrays (~L54, L132, L398). Routes push into them. → Treat the seed as a read-only fixture and write deltas to the database, or migrate the entire data layer behind a repository.
- **Punchlist mutations.** Same pattern as above — punchlist edits live in the in-memory `PROJECT_PUNCHLIST` map. Tracked as **#32**.

---

## Phase B — API contract & type safety

The codegen workflow is the safest way to keep the dashboard in sync with the API. Every route added without a spec update bypasses it.

- **Document the missing endpoints in `lib/api-spec/openapi.yaml`:**
  - `GET /api/projects/:id/notes` and `POST /api/projects/:id/notes` (`ai.ts` ~L151, L161)
  - `POST /api/ai/confirm-classification` (`ai.ts` ~L239)
  - `GET /api/projects/:id/spec-updates-report` (`ai.ts` ~L251)
  - `POST /api/projects/:id/spec-updates-report/pdf` (`ai.ts` ~L278)
  - `POST /api/estimating/materials/import` (`estimating.ts` ~L152)
  - `POST /api/projects/:id/receipts` (`estimating.ts` ~L246)
  - `POST /api/projects/:id/report-template` (`estimating.ts` ~L329)
  - The full punchlist endpoint family. Tracked as **#33**.
- After documenting, run `pnpm --filter @workspace/api-spec run codegen` to regenerate the typed React Query hooks in `lib/api-client-react`.
- **Migrate the remaining client panels off `customFetch`** so every call is typed end-to-end. Tracked as **#16**.
  - `artifacts/konti-dashboard/src/pages/project-detail.tsx` (multiple call sites)
  - `artifacts/konti-dashboard/src/components/punchlist-panel.tsx` (~L110)
  - `artifacts/konti-dashboard/src/components/design-panel.tsx` (~L110)
  - `artifacts/konti-dashboard/src/components/change-orders-panel.tsx` (~L88)
  - `artifacts/konti-dashboard/src/components/proposals-panel.tsx` (~L58)
  - `artifacts/konti-dashboard/src/components/inspections-section.tsx` (~L92)

---

## Phase C — Authorization & ownership hardening

Earlier tasks (#15, #19) introduced an ownership pattern for client-facing project actions. Apply it consistently.

- **Public read routes that should require a role.** In `artifacts/api-server/src/routes/projects.ts`:
  - `GET /api/projects` (~L88)
  - `GET /api/projects/:projectId` (~L164)
  - `GET /api/projects/:projectId/tasks` (~L173)
  - `GET /api/projects/:projectId/weather` (~L178)

  → Wrap with `requireRole(["team", "admin", "superadmin", "architect", "client"])` and `enforceClientOwnership` so clients only see their own projects. Tracked as **#20**.
- **Standardize error responses.** Several handlers throw raw strings or send `{ error }` objects with no stable shape. → Centralize in an error middleware so every failure ships `{ code, message, messageEs }`. Tracked as **#39**.

---

## Phase D — Test coverage & CI gates

The end-to-end suite (Task #37) is the new safety net; this phase wires it tight and fills the remaining holes.

- **Missing route-level integration tests** in `artifacts/api-server/src/routes/`:
  - `ai.ts` — covered by **#31**
  - `dashboard.ts`
  - `notifications.ts`
  - `leads.ts`
- **Brittle existing test.** `artifacts/api-server/src/routes/estimating.test.ts` (~L104) hard-codes `Math.abs(carpAfter.hourlyRate - 41.61) < 0.05`. The expected value drifts whenever seed labor rates change. → Either compute the expected value from the seed in the test, or assert a relationship instead of a literal.
- **CI integration.** Wire the e2e suite into a GitHub Action so every push runs the lifecycle gates. Tracked as **#38**.
- **Lead-to-project lifecycle in e2e.** Add the synthesized lead → project flow to the suite. Tracked as **#40**.

---

## Phase E — AI assistant, PDF export, and OCR

These are the items where "demo magic" still hides behind a stub.

- **Receipt OCR is faked.** `artifacts/api-server/src/routes/estimating.ts` (~L265) "parses" receipts by splitting CSV-like rows and looking for keywords. → Replace with PDF.co for image/PDF text extraction, then a small structured-extraction call to the AI provider. Tracked as **#28**.
- **Report-template PDF export bypasses the saved template.** `artifacts/api-server/src/routes/projects.ts` (~L354) generates the PDF by hitting a dashboard URL, ignoring the `PROJECT_REPORT_TEMPLATE` that the user customized in `estimating.ts` (~L95). → Render the saved template directly. Tracked as **#29**.
- **Naive client-question detection.** `artifacts/api-server/src/routes/ai.ts` (~L385) uses a regex that misses questions without `?`. → Either tighten the regex or add a small classifier call.
- **AI provider fallback has no retry/backoff.** `ai.ts` (~L422) only switches to OpenAI when the Anthropic SDK throws. → Add a short retry with backoff before the fallback to absorb transient timeouts.

---

## Phase F — Performance & bundle

- **API bundle is 2.1 MB.** The api-server build log explicitly warns about `dist/index.mjs`. The Anthropic and OpenAI SDKs dominate. → Either dynamic-import the AI router only when the AI route is hit, or split AI into its own service so the rest of the API stays small.
- **Vite cold start ~5 s on Replit.** Configure `manualChunks` in `artifacts/konti-dashboard/vite.config.ts` for `lucide-react`, `recharts`, and `@radix-ui/*` so subsequent loads benefit from the browser cache.
- **Source maps are 5 MB.** Make sure they ship only in development; gate generation on `NODE_ENV` in the build script.

---

## Phase G — UX freshness, i18n, accessibility

- **Real-time freshness after phase advance.** `artifacts/konti-dashboard/src/pages/project-detail.tsx`'s `advancePhase` mutation does not invalidate every dependent query (punchlist, milestones, design phases). → Add `queryClient.invalidateQueries({ queryKey: ["projects", id] })` in `onSuccess` and broaden the key to cover descendant panels. Tracked as **#34**.
- **Hard-coded English strings.** Spot checks found copy that should run through the `t(en, es)` helper:
  - `artifacts/konti-dashboard/src/components/layout/sidebar.tsx` — section headings
  - `artifacts/konti-dashboard/src/pages/login.tsx` — supporting copy
- **Accessibility polish.** Custom panels (e.g. `PunchlistPanel`) lack `aria-describedby` on their forms; some text inputs are missing a paired `<Label htmlFor>`. → Audit `artifacts/konti-dashboard/src/components/ui/` consumers and add labels.
- **Client home focus.** Show the construction status card on the client home for a more focused view. Tracked as **#18**.
- **Inspection management.** Let staff remove inspections that were created in error. Tracked as **#17**.

---

## Phase H — Deployment & ops

- **Deployment target.** `.replit` deploys as `autoscale`. The production logs show the server idling and receiving `SIGTERM` ~2 minutes after the last request — that's normal Autoscale behavior, not a crash. If predictable cold-start-free latency matters more than cost, switch to a Reserved VM.
- **Healthchecks.** `artifacts/api-server/src/routes/health.ts` covers the API. Add a static health probe (e.g. a 200 response on `/index.html`) for the dashboard artifact so deploy gates can verify the SPA shell, not just the API.
- **Logging.** Pino is configured but the worker thread shims (`pino-worker.mjs`, `pino-file.mjs`, `pino-pretty.mjs`) are bundled into production. Confirm that pretty-printing is dev-only and that the log level defaults to `info` in prod.

---

## Appendix — Already-proposed follow-up tasks

These are the task references already on the project board, mapped to the phases above. New work should reference these by number rather than re-creating them.

| Ref | Phase | Title |
| --- | --- | --- |
| #16 | B | Make the rest of the project detail panels fully type-safe |
| #17 | G | Let staff remove inspections that were created in error |
| #18 | G | Show the construction status card on the client home for a more focused view |
| #20 | C | Lock down the team-only project actions with the same ownership pattern |
| #27 | A | Persist receipts and contractor estimates so they survive a server restart |
| #28 | E | Replace mocked receipt OCR with real PDF/image extraction |
| #29 | E | Use the saved report template when exporting project PDFs |
| #30 | A | Save AI assistant notes and updates so they survive restarts |
| #31 | D | Add automated tests for the new AI assistant endpoints |
| #32 | A | Persist punchlist edits so they survive a server restart |
| #33 | B | Show punchlist endpoints in the API documentation |
| #34 | G | Update the project page in real time after advancing a phase |
| #38 | D | Wire the e2e suite into CI so every push runs the lifecycle gates |
| #39 | C | Standardize error responses so every failure includes a human-readable message |
| #40 | D | Cover the synthesized lead-to-project lifecycle in the e2e suite |

---

_Maintained by the engineering team. When a finding above is addressed, link the task / PR next to it and strike the line through. When new findings appear, add them under the relevant phase rather than starting a new doc._
