# KONTi Dashboard — Plan for Pending Feedback Items

_Generated 2026-04-29 from an audit of `gmena83/Arch-Firm-Hub @ main` against `KONTi_Dashboard_Feedback_Consolidated_v2.xlsx`._

This plan addresses every feedback item that is **not yet Done** after the 2026-04-29 audit. Status counts after audit:

| Status | Count |
|---|---|
| Done | 16 |
| In Progress | 16 |
| Open | 18 |
| Needs Decision | 7 |

The updated tracker is `KONTi_Dashboard_Feedback_Consolidated_v3.xlsx` with a new `Verification Note (2026-04-29)` column citing exact files and line ranges for each verdict.

The plan groups remaining work into six waves. Earlier waves unblock later waves, so the order matters more than the labels. All file paths are relative to repo root.

---

## Wave 0 — Persistence foundation (unblocks everything mutable)

_Why first:_ every other improvement that involves "save" is a lie until this lands. Confirmed in audit: `lib/db/src/schema/index.ts` is an empty stub; routes mutate plain arrays (`PROJECT_NOTES`, `PROJECT_RECEIPTS`, `PROJECT_REPORT_TEMPLATE`, `PROJECT_PUNCHLIST`). Tracked as Phase A in `development.md`.

| ID | Priority | Effort | Owner | Notes |
|---|---|---|---|---|
| **B-10** | Critical | M | Backend | Move `PROJECT_RECEIPTS` and `PROJECT_CONTRACTOR_ESTIMATE` from `artifacts/api-server/src/routes/estimating.ts` (~L94-96) to Drizzle. Add `receipts` and `contractor_estimates` tables in `lib/db/src/schema/`. |
| **I-01** | Critical | M | Backend | Same migration covers project mutations. Treat `seed.ts` as read-only fixture; write deltas via Drizzle. |
| **I-03** | Critical | M | Backend | Persist `PROJECT_PUNCHLIST` map. Once persisted, the phase-advance gate becomes meaningful across restarts. |
| **D-01** | Critical (V2) | M | Backend | `PROJECT_NOTES` and `SPEC_EVENTS` in `routes/ai.ts` (~L23-26). V2 scope but cheapest to migrate alongside the rest. |

**Sequencing:** notes → receipts → punchlist → bulk seed migration. Each step is independently shippable. Definition of done: a `pnpm --filter @workspace/api-server run dev` followed by a restart shows the same data.

---

## Wave 1 — High-value V1 fixes (clear, low-medium effort)

These are the items the client will notice within minutes of opening the next build.

### Cost calculator polish

| ID | Priority | Effort | Notes / file pointers |
|---|---|---|---|
| **B-04** | High | DONE — verified in audit. |
| **B-06** | High | M | `components/estimating/variance-report.tsx` (~L71-80) shows buckets but no Design / Materials / Labor / Permits / Taxes / Contingency category breakdown. Group line items + per-category subtotal. |
| **B-03** | High | M | Link `Materials Library` → calculator: when a material is added to a project, auto-create a calculator line. Allow override. Touches `routes/estimating.ts` and `pages/calculator.tsx`. |
| **B-02** | High | M | Add `laborType: "hourly" \| "lump_sum"` to line items. Update totals + variance to handle both. |
| **B-05** | Medium | M | Refactor contractor section in `components/estimating/contractor-calculator.tsx` to show only contractor-specific fields. Move project metadata to a `Project Info` card. |
| **B-09** | Medium | S | Add a `Receipts & Variance` shortcut card on the dashboard. Deep-link to the variance tab. |
| **B-07** | Low | S | Rename `imports` to `Imported Materials / Shipping` in `components/estimating/imports-panel.tsx`. Add a tooltip. |
| **B-08** | Low | S | Add tooltip on `Effective Rate` field explaining the formula; remove if unused. |

### Project Detail polish

| ID | Priority | Effort | Notes |
|---|---|---|---|
| **A-07** | High | L | Add a `Fotos & Medios` tab in `pages/project-detail.tsx`. Image/video upload with caption + date, threaded comments per photo, link to punchlist. Depends on Wave 0 for persistence. |
| **A-11** | High | M | Consolidate weather data, change orders, punchlist items, phase notes into a unified Contractor Monitoring report. Filters by date range and category. PDF export. (`components/contractor-monitoring-section.tsx` is currently status-only.) |

### Project Report polish (mostly cosmetic + small data)

| ID | Priority | Effort | Notes |
|---|---|---|---|
| **C-08** | Low | S | Increase report header logo to ~60px. CSS only. |
| **C-09** | Medium | M | Replace dark-first palette with KONTi brand palette in `pages/project-report.tsx` and chart `CHART_COLORS`. |
| **C-12** | Low | S | Add explicit `White / Light` preset to the existing `THEME_VARS` toggle. |
| **C-05** | Low | S | Rename weather field to `Weather Status`. |
| **C-04** | Medium | M | Match donut/pie chart style to the team punchlist `phase-pie-chart`. (Pie chart already present at `project-report.tsx` L440-499.) |
| **C-07** | Medium | S | Tooltip on management fee line + edit link to calculator. |
| **C-06** | High | M | Audit client report data model against the team's report template. Align category names, subtotals, section order. Optional `Report Template` configuration screen. |
| **C-02** | High | M | Create a separate client-facing report variant that aggregates costs by category without BOM. Keep BOM in team view only. |
| **C-01** | High | M | Map punchlist categories + items to team Excel structure. Add `Photo Link` column. Include contractor monitoring summary below the punchlist. |
| **C-11** | High | L | Site Photos section: bulk upload with category tags, Drive-compatible links, gallery view in PDF export. Depends on Wave 0 + A-07. |
| **C-10** | Medium | M | Date-range picker in the report header. Snapshot each generated report. `Report History` panel with download links. |
| **B-12** | High | M | PDF export currently screenshots the dashboard URL (`routes/projects.ts` ~L354). Render saved `PROJECT_REPORT_TEMPLATE` server-side (HTML → PDF). Falls back to default if none saved. (Phase E in dev.md.) |

### Permits

| ID | Priority | Effort | Notes |
|---|---|---|---|
| **E-01** | High | M | Add `Permit Header` section: legal name, license numbers, engineers of record, approval dates. Store in seed + project schema. |
| **E-02** | High | M | Permit-type taxonomy (PCOC, USO, Consulta de Ubicación, Planos…). Group permit list with collapsible sections. |

### Notifications

| ID | Priority | Effort | Notes |
|---|---|---|---|
| **I-04** | Medium | M | Activity log already records `email_sent` rows (`routes/projects.ts` L705/L738/L1074) but no outbound mailer exists. Integrate SendGrid/SES; trigger when a document is marked `Requires Client Signature`. |

---

## Wave 2 — V2 backlog (out of V1 scope but worth tracking)

Defer until V1 is shipped. These items are confirmed not-implemented; they live on the `V2 Backlog` sheet.

| ID | Title | Notes |
|---|---|---|
| A-02 | Gastos no facturables tab | Internal accounting feature; defer until expense tracking is product-prioritized. |
| A-05 | Document version history | Requires versioned blob storage; pair with cloud storage migration. |
| A-09 | Client self-administer media | Builds on A-07; add client write permissions once that lands. |
| A-12 | Client audit log | Compliance feature; large backend lift. |
| B-11 | Real receipt OCR | Replace mock with PDF.co (already configured via `PDF_CO_API_KEY`) + structured AI extraction. Phase E in dev.md. |
| B-14 | Auto-update labor rates from receipts | Depends on B-11. |
| G-01 | Add Contractor — DONE despite V2 scope | No further work needed; flagged to confirm scope reclassification. |

---

## Wave 3 — Items that need a product decision before any code

These are blocking on a product/UX call. The technical work is straightforward once the decision is made.

| ID | Decision required | Tech notes |
|---|---|---|
| **A-10** | Gantt-style view vs split-phase cards for parallel phases? | Workflow header explicitly says "las fases pueden ir en paralelo" — V1. The visualization style is the only open question. |
| **H-02** | Native CRM or Asana mirror as source of truth? | Affects whether Leads page becomes a real CRM or a read-only mirror. |
| **D-02** | AI assistant role for change orders / specs? | Once decided, add contextual help text. |
| **E-04** | Drive sync vs manual download vs email link for approved permits? | V1 needs a basic client download button at minimum. |
| **E-05** | Manual signed-PDF upload vs DocuSign/HelloSign integration? | V1 covered by manual upload; e-sign is V2. |
| **H-03** | Asana template-driven project creation flow? | V2 third-party integration; needs Asana API credentials and template definition. |
| **J-01** | Google Drive scope (storage backend vs link-out only)? | V2; also affects E-04. |

**Recommendation:** schedule a 60-minute product session covering A-10, H-02, D-02, E-04, E-05 in one sitting. They cluster around three real questions: (a) how clients interact with documents (E-04, E-05, J-01), (b) how phases are visualized (A-10), (c) what the CRM is (H-02, H-03, D-02).

---

## Suggested sprint shape (V1 only)

If a sprint is two weeks, this maps cleanly onto four sprints, each independently demoable.

- **Sprint A — Persistence (Wave 0):** B-10, I-01, I-03, D-01. End state: data survives restarts.
- **Sprint B — Calculator + cosmetics (Wave 1, calculator + low effort):** B-02, B-03, B-05, B-06, B-07, B-08, B-09, C-05, C-08, C-12, A-13 _(verified done)_. End state: calculator matches team's working model.
- **Sprint C — Report alignment (Wave 1, report + permits):** C-01, C-02, C-04, C-06, C-07, C-09, C-10, B-12, E-01, E-02. End state: client-facing report matches team's Excel format.
- **Sprint D — Photos & notifications (Wave 1, larger items):** A-07, A-11, C-11, I-04. Ends V1 scope.

Wave 3 product decisions happen in parallel; their implementation lands in whichever sprint they fall after the call.

---

## Definition of done for V1

- All `Done` rows in the v3 tracker stay `Done` after a fresh deploy + restart.
- All `In Progress` rows from this plan are either `Done` or have an explicit V2-deferral note.
- Every V1 `Open` row in this plan is closed with a code reference.
- A regression run of `pnpm --filter @workspace/api-server run test:e2e` passes.
- The client reviews the next build and confirms the report + calculator match their team's Excel.
