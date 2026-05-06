# KONTi Dashboard — Development Roadmap

_Last refreshed 2026-05-04 from a sweep of the project task board and a fresh code review._

---

## Executive summary

Persistence is now real: Phase A is largely done, with receipts, contractor estimates, AI assistant notes, the saved report template, and punchlist edits all surviving restarts. The API contract pass is mostly complete — every dashboard panel that mattered has been migrated onto the codegen'd typed hooks, and the punchlist endpoint family is documented. Google sign-in shipped for both staff and clients. The audit log shipped (admins can see who changed what and when). A daily backup of the project to a private GitHub repository is running. The client portal expanded to cover uploads, invoices, visibility, and history. Brand polish landed across the report, the dashboard chrome, and the calculator. The three security audits closed (#87 authentication, #88 client-ownership bypasses, #89 public API exposure), and dependency vulnerabilities have been swept multiple times. The end-to-end lifecycle suite (#37) is in place but is not yet wired into CI, so the gates only run when someone remembers to invoke them locally.

---

## Shipped & validated

Every task in this section has been MERGED. They are grouped by theme rather than by phase so the document reads as a delivery log.

_Foundations & MVP_
- **#1** — KONTi Design | Build Studio — Project Dashboard MVP
- **#2** — Add superadmin credentials for Tatiana and Gonzalo
- **#3** — UX Polish: language toggle in top nav, client portal view, mobile responsiveness
- **#4** — PDF export button on report page + OpenAI fallback for AI assistant
- **#5** — Login logo fix + Perplexity material pricing
- **#6** — Phase 3: Settings, Notifications, Team Directory, Permits
- **#7** — Weather history chart + richer documents
- **#8** — Menatech branding + login logo polish

_Project lifecycle phases_
- **#9** — Phase 1 — Lead intake & Discovery
- **#10** — Phase 2 — Pre-Design & Viability Study
- **#11** — Phase 3 — Design sub-phases & Change Orders
- **#12** — Phase 4 — Permits authorization workflow
- **#13** — Phase 5 — Construction Cost-Plus & inspections
- **#14** — Document the Phase 2 endpoints in the public API spec
- **#15** — Limit clients to advancing only their own projects
- **#16** — Make the rest of the project detail panels fully type-safe
- **#17** — Let staff remove inspections that were created in error
- **#18** — Show the construction status card on the client home for a more focused view
- **#19** — Apply the same ownership check to all client-facing project actions
- **#21** — Fix project creation save bug

_Calculator, AI assistant, client comms, punchlist_
- **#22** — Estimating calculator overhaul (Excel + receipts + variance reports)
- **#23** — AI assistant UX upgrade (markdown, voice, confirm-before-classify, client questions, spec report)
- **#24** — Client view: notes/queries panel + notifications popup
- **#25** — Punchlist as phase advancement gate
- **#26** — Polish bundle: permits Design section, team page edits, notifications button fix

_Persistence (Phase A complete)_
- **#27** — Persist receipts and contractor estimates so they survive a server restart
- **#28** — Replace mocked receipt OCR with real PDF/image extraction
- **#29** — Use the saved report template when exporting project PDFs
- **#30** — Save AI assistant notes and updates so they survive restarts
- **#32** — Persist punchlist edits so they survive a server restart

_Tests & contract_
- **#31** — Add automated tests for the new AI assistant endpoints
- **#33** — Show punchlist endpoints in the API documentation
- **#34** — Update the project page in real time after advancing a phase
- **#37** — End-to-end platform test suite (3 projects, full lifecycle)

_Polish, sidebar, naming, branding_
- **#35** — Update old team-member names in project history and AI knowledge base
- **#36** — Sidebar polish: notifications panel on-screen, bigger KONTi logo, smaller menatech footer
- **#41** — Write development.md roadmap from current app review
- **#42** — Make the dashboard responsive across phone, tablet, and desktop
- **#45** — Build a feedback-vs-changelog report to share with the client

_Security & dependency hygiene_
- **#49** — Fix 16 dependency vulnerabilities
- **#50** — Fix 16 dependency vulnerabilities
- **#53** — Security scan
- **#54** — Fix 2 dependency vulnerabilities
- **#86** — Fix 2 dependency vulnerabilities
- **#87** — Authentication Issues
- **#88** — Client Ownership Bypasses
- **#89** — Public API Exposure

_Client portal, reports, dashboard restructure_
- **#55** — Critical feedback priority spreadsheet
- **#60** — Fix file upload regression on the demo project
- **#61** — Client portal expansion — uploads, invoices, visibility, history
- **#62** — Report visual polish & KONTi brand pass
- **#63** — Document organization & small polish bundle
- **#71** — P1 quick wins: header polish, permits copy, report logo, clickable activity
- **#72** — Restructure the dashboard so the most-used sections are on top
- **#73** — Add an audit log so admins can see who changed what and when
- **#74** — Make project header text readable on bright cover photos
- **#75** — Calculator clarity bundle: editable fields, auto-import, label cleanup

_Operations & feedback bundles_
- **#96** — Back up the project to a private GitHub repository
- **#97** — [ALREADY DONE in #96] Mark items shipped as Done in the consolidated feedback list
- **#99** — Reviewer feedback polish bundle #2 (13 still-Open V1 items)
- **#100** — Sign in with Google for KONTi staff and clients

---

## Pending — accepted but not started

These tasks are on the project board in PROPOSED state. They're grouped by phase so the next sprint can pick a coherent slice.

_Phase A (persistence finishing touches)_
- **#80** — Save imported material lines on a project so they don't vanish on restart
- **#81** — Move estimating data to the project database so it survives cloud redeploys
- **#82** — Recover gracefully if the punch list file gets corrupted

_Phase C (auth & error standardization)_
- **#39** — Standardize error responses so every failure includes a human-readable message
- **#68** — Lock down remaining project endpoints so logged-out users can't peek

_Phase D (test coverage & CI)_
- **#38** — Wire the e2e suite into CI so every push runs the lifecycle gates
- **#40** — Cover the synthesized lead-to-project lifecycle in the e2e suite
- **#76** — Test that one client can't read another client's project notes
- **#77** — Test that team replies to client questions get saved and answered
- **#84** — Auto-test that uploaded receipt photos flow end-to-end through the UI

_Phase E (AI / OCR / PDF refinement)_
- **#78** — Let teams preview the templated PDF before sending it to clients
- **#79** — Let teams upload a logo and brand colors for the report template
- **#83** — Let users review and correct receipt details before saving

_Phase G (UX, mobile, freshness)_
- **#43** — Make project detail panels responsive on phones
- **#44** — Audit modals and dialogs for mobile usability
- **#59** — Add a plain-language 'what's happening now' sentence to the client construction card
- **#64** — Show recently uploaded files in a list inside the upload dialog
- **#85** — Move the dashboard's construction status detail into each project page

_Calculator, reports, permits feature work_
- **#46** — Calculator: master template each project copies, with editable rows
- **#47** — Site photo upload, categorization, and links from the report
- **#48** — Permits page: legal header + split by permit type
- **#58** — Make the priority spreadsheet auto-regenerate when the feedback report changes
- **#65** — Stop oversized or wrong-type uploads at the server, not just the browser
- **#69** — Show real spend per project phase instead of an industry estimate
- **#70** — Let users tweak each project's report colors to match site branding

_Audit log expansion_
- **#90** — Cover all admin actions in the audit trail
- **#91** — Let admins export the audit log as CSV
- **#92** — Persist the audit log so it survives restarts

_Operations_
- **#98** — Keep the GitHub backup up-to-date automatically after each change

---

## Cancelled / superseded

- **#20**
- **#51**
- **#52**
- **#56**
- **#57**
- **#66**
- **#67**
- **#93**
- **#94**
- **#95**

---

## Phase A — Persistence (data durability)

**Status: Complete (#27, #28, #29, #30, #32 shipped; #80, #81, #82 are minor follow-ups).**

**Why first:** every other improvement is undermined while data disappears on restart. A user who enters a receipt and finds it missing the next morning will not enter another one. Once the data layer is durable, the rest of the roadmap compounds: tests can assert state across restarts, performance work can rely on stable seed data, and AI features can quote previously-saved notes.

**User-facing outcome:** when this phase lands, "save" actually means save. The user can close the tab, redeploy, restart the workflow, walk away for a week, and return to find every entry where they left it.

**What "done" looks like:** the in-memory arrays in `seed.ts` are read-only, every mutation goes through Drizzle, and a fresh `pnpm --filter @workspace/api-server run dev` followed by an immediate restart shows the same data both times.

- **AI assistant in-memory state.** `artifacts/api-server/src/routes/ai.ts` keeps `PROJECT_NOTES` (~L23) and `SPEC_EVENTS` (~L26) as plain arrays. → Move both to Drizzle tables. Tracked as **#30**.
- **Estimating in-memory state.** `artifacts/api-server/src/routes/estimating.ts` holds `EXTRA_MATERIALS`, `LABOR_RATES`, `PROJECT_RECEIPTS`, `PROJECT_REPORT_TEMPLATE`, `PROJECT_CONTRACTOR_ESTIMATE` in process memory. → Persist with Drizzle. Tracked as **#27**.
- **Seed data is mutated in place.** `artifacts/api-server/src/data/seed.ts` exports `PROJECTS`, `PROJECT_TASKS`, `DOCUMENTS`, etc. as mutable arrays. → Treat the seed as a read-only fixture and write deltas to the real database.
- **Punchlist mutations.** Same pattern. Tracked as **#32**.

---

## Phase B — API contract & type safety

**Status: Complete (#16, #33 shipped).**

The codegen workflow (`pnpm --filter @workspace/api-spec run codegen`) is the safest way to keep the dashboard in sync with the API. Every route added without a spec update bypasses it.

- Document the missing endpoints in `lib/api-spec/openapi.yaml` (notes, AI confirm-classification, spec-updates report, materials import, receipts, report-template, punchlist family). Tracked as **#33**.
- Migrate the remaining client panels off `customFetch` so every call is typed end-to-end. Tracked as **#16**.

**User-facing outcome:** none directly — the payoff is that the next time someone changes a request or response shape on the server, the dashboard fails to compile instead of in the browser.

**What "done" looks like:** the OpenAPI spec is the source of truth for every request the dashboard makes; a grep for `customFetch` in panels returns zero matches.

---

## Phase C — Authorization & ownership hardening

**Status: Mostly complete (#15, #19, #87, #88, #89 shipped; #39 and #68 still pending).**

Earlier tasks (#15, #19) introduced an ownership pattern. The three security audits (#87, #88, #89) closed the bigger gaps. What remains is consistent error shapes (#39) and locking down the remaining read endpoints (#68).

- Public read routes that should require a role in `routes/projects.ts` — wrap with `requireRole` and `enforceClientOwnership`. Tracked as **#68**.
- Standardize error responses so every failure ships `{ code, message, messageEs }`. Tracked as **#39**.

**User-facing outcome:** clients see only the projects they own; errors render with the same bilingual toast everywhere.

**What "done" looks like:** every handler in `routes/projects.ts` either explicitly opts out of auth or runs through `requireRole` + `enforceClientOwnership`; a single error middleware shapes every failure.

---

## Phase D — Test coverage & CI gates

**Status: Foundation laid (#37 shipped); CI wiring (#38) and lifecycle / cross-client tests (#40, #76, #77, #84) still pending.**

- Missing route-level integration tests (ai.ts covered by **#31** ✅; dashboard.ts, notifications.ts, leads.ts still open).
- CI integration. Tracked as **#38**.
- Lead-to-project lifecycle in e2e. Tracked as **#40**.
- Cross-client notes isolation. Tracked as **#76**.
- Team-reply persistence. Tracked as **#77**.
- Receipt upload e2e. Tracked as **#84**.

**User-facing outcome:** none directly, but the team ships faster and breaks fewer things.

**What "done" looks like:** every route has at least one happy-path and one auth-failure test; the e2e suite runs on every push; a red CI blocks merge.

---

## Phase E — AI assistant, PDF export, and OCR

**Status: Mostly complete (#28, #29, #30 shipped); preview & branding follow-ups (#78, #79, #83) pending.**

- Receipt OCR is now real (PDF.co). Shipped as **#28**.
- Report-template PDF export uses the saved template. Shipped as **#29**.
- Templated PDF preview before sending. Tracked as **#78**.
- Logo + brand colors on the report template. Tracked as **#79**.
- Receipt review/correction step before saving. Tracked as **#83**.

**User-facing outcome:** receipts uploaded as a photo become structured rows; the report PDF reflects the user's chosen template; teams will soon be able to preview before sending.

**What "done" looks like:** receipts → structured rows; saved template used verbatim; preview-before-send wired into the report panel.

---

## Phase F — Performance & bundle

**Status: Not yet started — same items still apply.**

- API bundle is 2.1 MB; dynamic-import the AI router or split it into its own service.
- Vite cold start ~5 s; configure `manualChunks` for `lucide-react`, `recharts`, `@radix-ui/*`.
- Source maps are 5 MB; gate generation on `NODE_ENV` so production doesn't pay the bandwidth cost.

**User-facing outcome:** the dashboard feels snappier; the API cold-starts faster.

**What "done" looks like:** the api-server build no longer prints the bundle-size warning; Vite's initial chunk for `/` is under 300 KB; production HTML doesn't reference `.map` files.

---

## Phase G — UX freshness, i18n, accessibility

**Status: Partially complete (#34, #42, #71, #72, #74 shipped); phone-detail responsiveness (#43, #44, #59, #85) still pending.**

- Real-time freshness after phase advance. Shipped as **#34**.
- Dashboard responsive across breakpoints. Shipped as **#42**.
- Project detail panels responsive on phones. Tracked as **#43**.
- Modal/dialog mobile audit. Tracked as **#44**.
- Plain-language "what's happening now" sentence on the client construction card. Tracked as **#59**.
- Recently-uploaded files list inside the upload dialog. Tracked as **#64**.
- Move dashboard's construction status detail into each project page. Tracked as **#85**.

**User-facing outcome:** the dashboard feels current after every action; phones become first-class.

**What "done" looks like:** advancing a phase updates dependent cards without a refresh; the project-detail page is fully usable on a phone; modals don't trap users on small screens.

---

## Phase H — Deployment & ops

**Status: Backup automated via GitHub (#96); deployment-mode & healthcheck decisions still open. Audit log groundwork shipped (#73), expansion items #90–#92 pending.**

- Deployment target. `.replit` deploys as `autoscale`; the Reserved VM trade-off is a product call.
- Healthchecks. Add a static health probe for the dashboard artifact.
- Logging. Confirm Pino's pretty-print transport never runs in production.
- Cover all admin actions in the audit trail. Tracked as **#90**.
- CSV export of the audit log. Tracked as **#91**.
- Persist the audit log across restarts. Tracked as **#92**.
- Keep the GitHub backup current automatically after each change. Tracked as **#98**.

**User-facing outcome:** if the team chooses Reserved VM, the first visit of the day no longer hangs; deploys fail loudly when the SPA shell is broken; admins get a complete, exportable audit trail.

**What "done" looks like:** deployment mode documented as a deliberate decision; dashboard healthcheck wired into the deploy gate; audit log durable and exportable.

---

## Future developments — top 10 highest-value bets

These are not yet on the project board. They're the ten ideas that the team believes would deliver the most additional value to KONTi clients over the next 6–12 months, ranked roughly by combined impact and feasibility. Each item is a discussion starter, not a committed plan.

### 1. Native mobile app for site teams (offline-capable)
Site supervisors live on their phones, often with poor connectivity. A focused Expo app that lets them snap categorized site photos, tick off punchlist items, log inspections, and capture receipts — all queued offline and synced when signal returns — would close the biggest gap between "the office uses KONTi" and "everyone uses KONTi." It also makes Phase G's mobile responsiveness work largely moot for field staff.

### 2. Real-time client messaging built into the project portal
Today clients ask questions through the notes panel and wait for staff to reply on their next dashboard visit. A real-time thread per project — with web push, email digest, and read receipts — turns the portal into the single channel of record and stops conversations from leaking into WhatsApp and email where they vanish.

### 3. Automated daily / weekly client digest with photos and progress
Clients want reassurance more than they want detail. A scheduled email (daily during construction, weekly during design) summarizing what changed, embedding the latest site photos, and linking to the report would dramatically reduce inbound "any update?" pings and reinforce the brand on a regular cadence.

### 4. Subcontractor portal with limited-scope logins
Plumbers, electricians, and other trades currently submit invoices and RFIs by email or paper. A scoped login that exposes only the project documents, plans, and tasks they need — and lets them upload invoices that flow straight into the calculator's actual-cost column — would compress days of admin work per project and make the cost-plus model auditable.

### 5. Milestone-based invoicing & online payment collection
Tie billing milestones to the existing phase-advance gates (Discovery, Pre-Design, Permits, Construction, Punchlist) and collect via Stripe. Auto-issue an invoice when a phase advances, accept card / ACH / Apple Pay, and reflect paid status on the client portal. This turns the dashboard from a project-tracker into revenue infrastructure.

### 6. E-signature flow for contracts and change orders
Change orders are the highest-friction moment in the cost-plus model — the client sees a number change and wants a paper trail. A built-in signature flow (e.g. via DocuSign or a self-hosted equivalent) attached to the change-order panel would replace the current "print, sign, scan, email" loop and create a defensible audit log automatically.

### 7. Calendar & Gantt view tied to project phases and inspections
The data is already there (phase dates, inspections, change orders, deliverables) but it lives in panels. A calendar/Gantt overlay across all active projects would give project managers a single resource-allocation view, surface scheduling conflicts before they happen, and let clients see realistic dates instead of inferring them.

### 8. Predictive budget & schedule overrun alerts
With #27, #28, #32, #75 in place, KONTi finally has clean per-project actuals. Train a small model (or even a rules engine) on historical phase durations and cost variances and surface "this project is trending 12% over and 9 days late" warnings on the dashboard. Even a simple version turns the calculator from a record-keeping tool into a decision-support tool.

### 9. CRM / pipeline integrations (HubSpot, Asana, Google Workspace)
Leads and projects already exist as first-class objects. A bidirectional sync with the tools KONTi already pays for — HubSpot for the sales pipeline, Asana for internal tasks, Google Drive for documents and Google Calendar for inspections — eliminates the double-entry that currently keeps half the team on spreadsheets.

### 10. Drone / 360° photo and floor-plan markup in the report
Site photos already flow into the report (#47). The next step is supporting drone footage, 360° spheres, and clickable annotations on uploaded floor plans, so the report becomes a living visual record. This is the single feature most likely to make a client recommend KONTi to a friend, because it's the moment they say "wow."

---

## Appendix — Already-proposed follow-up tasks

These are the task references on the project board, mapped to the phases above. Shipped items are prefixed with ✅.

| Ref | Phase | Title |
| --- | --- | --- |
| ✅ #16 | B | Make the rest of the project detail panels fully type-safe |
| ✅ #17 | G | Let staff remove inspections that were created in error |
| ✅ #18 | G | Show the construction status card on the client home for a more focused view |
| ✅ #27 | A | Persist receipts and contractor estimates so they survive a server restart |
| ✅ #28 | E | Replace mocked receipt OCR with real PDF/image extraction |
| ✅ #29 | E | Use the saved report template when exporting project PDFs |
| ✅ #30 | A | Save AI assistant notes and updates so they survive restarts |
| ✅ #31 | D | Add automated tests for the new AI assistant endpoints |
| ✅ #32 | A | Persist punchlist edits so they survive a server restart |
| ✅ #33 | B | Show punchlist endpoints in the API documentation |
| ✅ #34 | G | Update the project page in real time after advancing a phase |
| #38 | D | Wire the e2e suite into CI so every push runs the lifecycle gates |
| #39 | C | Standardize error responses so every failure includes a human-readable message |
| #40 | D | Cover the synthesized lead-to-project lifecycle in the e2e suite |
| #43 | G | Make project detail panels responsive on phones |
| #44 | G | Audit modals and dialogs for mobile usability |
| #46 | — | Calculator: master template each project copies, with editable rows |
| #47 | — | Site photo upload, categorization, and links from the report |
| #48 | — | Permits page: legal header + split by permit type |
| #58 | — | Make the priority spreadsheet auto-regenerate when the feedback report changes |
| #59 | G | Add a plain-language 'what's happening now' sentence to the client construction card |
| #64 | G | Show recently uploaded files in a list inside the upload dialog |
| #65 | — | Stop oversized or wrong-type uploads at the server, not just the browser |
| #68 | C | Lock down remaining project endpoints so logged-out users can't peek |
| #69 | — | Show real spend per project phase instead of an industry estimate |
| #70 | — | Let users tweak each project's report colors to match site branding |
| #76 | D | Test that one client can't read another client's project notes |
| #77 | D | Test that team replies to client questions get saved and answered |
| #78 | E | Let teams preview the templated PDF before sending it to clients |
| #79 | E | Let teams upload a logo and brand colors for the report template |
| #80 | A | Save imported material lines on a project so they don't vanish on restart |
| #81 | A | Move estimating data to the project database so it survives cloud redeploys |
| #82 | A | Recover gracefully if the punch list file gets corrupted |
| #83 | E | Let users review and correct receipt details before saving |
| #84 | D | Auto-test that uploaded receipt photos flow end-to-end through the UI |
| #85 | G | Move the dashboard's construction status detail into each project page |
| #90 | H | Cover all admin actions in the audit trail |
| #91 | H | Let admins export the audit log as CSV |
| #92 | H | Persist the audit log so it survives restarts |
| #98 | H | Keep the GitHub backup up-to-date automatically after each change |

---

## Quick wins (cherry-pick list)

For when there's an unexpected free hour and someone wants a small, satisfying landing without picking up a multi-day phase.

- **5–10 minutes each:**
  - Gate source-map generation on `NODE_ENV` (Phase F).
  - ~~Replace the hard-coded labor-rate tolerance in `estimating.test.ts` (Phase D).~~
  - Wrap the few hard-coded English strings in `sidebar.tsx` and `login.tsx` with the `t(en, es)` helper (Phase G).
  - Run `pnpm audit` and triage anything new (security passes have become a recurring activity).
- **One afternoon each:**
  - Document one missing route in `openapi.yaml` and migrate one panel off `customFetch` (Phase B — mostly done; only edge cases remain).
  - Add `requireRole` + `enforceClientOwnership` to the remaining public read routes in `projects.ts` (Phase C, **#68**).
  - ~~Add `queryClient.invalidateQueries` after `advancePhase` and any other phase-changing mutation (Phase G).~~
  - Add the static dashboard healthcheck and confirm Pino isn't pretty-printing in production (Phase H).

These are not a substitute for working through the phases in order — they're a way to keep momentum on a slow day.

---

## How to use this document

- **Picking up a phase:** start with the topmost unchecked item, read the linked file at the cited line range, and confirm the finding still applies (the codebase moves fast). Then either open the linked task ref or scope a new one.
- **Closing an item:** when a finding is addressed, link the task or PR next to it and strike the line through with `~~...~~`. Don't delete it — the history of which findings were closed is itself useful context.
- **Adding new findings:** add them under the relevant phase rather than starting a new doc. If a finding doesn't fit any phase, reconsider whether it's really a roadmap item or a one-off bug ticket.
- **Promoting a future development:** the ten items in "Future developments — top 10 highest-value bets" are not project tasks yet. If one of them rises to the top of the priority list, ask the planning agent to convert it into a project task and it will land on the board with the standard task structure.

_Maintained by the engineering team._
