# KONTi Dashboard — V1 Final Status Report

**End of V1 development:** 2026-05-06 22:56 UTC
**Cutoff commit:** `ac2f981` (post Task #162 docs refresh)
**Release tag:** `v1.0` (queued — see Outstanding items below)
**Author:** Replit Agent on behalf of KONTi team
**Supersedes:** all prior status reports, feedback snapshots, parking notes,
audit memos, and triage drafts listed in *Appendix A — Sources consolidated*.

This is the **single source of truth** for V2 planning. From this point forward,
the V1.x backlog and the V2 future-bets list defined here are the authoritative
work queues; older snapshots are kept only for traceability.

---

## 1. Executive summary

KONTi Dashboard V1 is **shipped**. Every V1-scope feature works against the
3 seeded projects on both desktop and `?mobileV2=1` mobile, persistence is
durable across restarts, and the API contract is fully typed end-to-end.

| Bucket | Count | Notes |
|---|---:|---|
| Feedback items reconciled (V1 + V2 workbooks) | 56 | 55 Done, **1 Open** (B-14) |
| Project tasks shipped (MERGED) | 62 | Includes #170 (V1 readiness) and #162 (docs refresh) |
| Project tasks cancelled / superseded | 10 | |
| V1.x backlog (kept Active) | 6 | See §4 |
| Drafts to archive | 23 | See §5 — pending the user bulk-archiving in the Tasks UI |
| **Total project tasks on board** | **101** | |

**One-line story:** the persistence wave (#27, #28, #29, #30, #32, #141, #144,
#147, #150, #156), the typed-API pass (Phase B), Google sign-in + role
hardening (Phase C), the Drive integration (#128), the AI spec bot (#161), the
mobile V2 minimalist cards (#165), and the V1 polish wave under #170 (B6 deep
links, F17 mobile contrast, F18 calculator copy, G20 Drive email surfacing)
all landed. The dashboard is ready to hand to the client.

---

## 2. Outstanding issues at V1 cut

Two items are not "done" by the agent and require user action. Neither blocks
the V1 hand-off, but both should close before V1.1.

| Item | Owner | Why it's open | Where it lives |
|---|---|---|---|
| **Push `v1.0` git tag to origin** | User (or platform) | The sandbox blocks destructive git ops in the main agent. Tracked in handoff Task #171 (already MERGED with the explanation). | `replit.md` "V1 release notes" line |
| **Bulk-archive 23 PROPOSED drafts** | User | No programmatic cancel API. The 23 rows are listed in §5 below; archiving them in the Tasks UI gets the board down to the 6 V1.x must-haves. | §5 of this report |
| **B-14 — Auto-update labor rates from last 3 receipts** | Engineering | The only feedback-workbook item still Open. Deliberately deferred to V1.x because it depends on the receipt-OCR confidence work in #28 + a UI surface that wasn't sized into V1. | `reports/feedback-status-reconciled.md` |

Everything else from the 56 reconciled feedback items shipped.

---

## 3. What shipped in V1 (62 MERGED tasks, grouped)

### Persistence (Phase A) — durable Postgres via Drizzle
- **#27** Estimating + receipts persistence
- **#28** Real PDF/image OCR (PDF.co)
- **#29** PDF export uses saved report template
- **#30** AI assistant notes/spec-events persistence
- **#32** Punchlist persistence + corrupt-file recovery
- **#141** Estimating → Postgres (full migration)
- **#144** Lifecycle stores → Postgres (projects, tasks, leads, inspections, change orders, user profiles, notifications-seen, structured vars, assisted budgets, csv mappings, pre-design checklists, project activities)
- **#147** Durable lead-link (`lead_id` column + orphan guard)
- **#150** Project documents persistence (`project_documents` table)
- **#156** Audit-log shipping
- **#157** Cost-Plus non-billable expenses tab + permit handoff verification

### API contract (Phase B) — typed end-to-end
- **#33–#36** Move six client panels onto orval-generated hooks
- **#37** OpenAPI spec catch-up (notes, AI confirm, spec-updates, materials import, etc.)
- **#170 / G20** `DriveStatusResponse.connectedEmail`

### Auth + hardening (Phase C)
- **#61** Client portal expansion + per-document visibility
- **#62** KONTi brand pass + light report background
- **#73** Audit log foundation
- **#74** Header text readable on bright cover photos
- **#75** ContractorEstimate Rollup, ClientContactCard, calculator inline-edit, mgmt-fee editing
- **#86** Google sign-in
- **#87 / #88 / #89** Security audit — role middleware, ownership checks, error shape

### Tests (Phase D)
- **#41** Persistence + lifecycle integration coverage
- **#155** Cross-client notes isolation (and supersedes draft #76)
- E2E suite present locally; CI wiring is parked for V2 (#38)

### AI / PDF / OCR (Phase E)
- **#28 / #29 / #30** above
- **#161** Internal spec bot — change-order context with prompt-injection hardening (8 new tests)

### Performance + UX polish (Phase F)
- **#71** P1 quick wins (logo, permits copy, clickable activity)
- **#99** Reviewer feedback bundle #2 (calculator grouping, BOM gating, donut, weather rename, dashboard variance shortcut, etc.)
- **#165** Mobile V2 minimalist cards (`?mobileV2=1`)
- **#170 / F17** Mobile-only muted-foreground contrast bump
- **#170 / F18** Calculator empty-state copy (`Imported Materials`)

### Notifications + integrations (Phase G)
- **#102** Real signature handoff emails (Resend)
- **#127** Bidirectional Asana sync
- **#128** Google Drive integration (storage backend + Settings panel)
- **#170 / B6** Notification deep-link with deterministic hash + expand-all + retry-scroll fallback
- **#170 / G20** Drive `connectedEmail` surfaced in Settings banner

### Ops (Phase H)
- **#96** GitHub backup integration
- **#102** Health probe for the dashboard artifact
- **#170** V1 delivery readiness — backlog reconcile + doc refresh + final polish
- **#162** Refresh `development.md` with shipped/pending/cancelled + 10 future bets
- **#171** Tag v1.0 + parking handoff (handoff-only, no code)

(Full per-task notes live in `reports/feedback-status-reconciled.md` and
`development.md` "Shipped & validated" section.)

---

## 4. V1.x backlog — 6 must-haves to keep Active

Retained on the board. These are the only items the team should plan against
for V1.x. Anything else is V2.

| Ref | Title | Why it's V1.x not V2 |
|---|---|---|
| **#46** | Calculator master template + editable rows | Top-of-mind UX gap raised by Tatiana in early-tester demo |
| **#80** | Persist imported material lines per project | Trust / data-loss risk if a user imports then refreshes |
| **#81** | Move estimating data to project DB | Same trust risk; finishes the persistence story for cost-plus |
| **#82** | Graceful recovery from corrupt punch-list file | Data-integrity hardening (already partially in #32) |
| **#85** | Move construction-status detail into project page | Final IA cleanup so the status card lives next to the project |
| **#92** | Persist audit log across restarts | Compliance — currently in-memory after #156 |

Plus the carry-overs from §2:
- Push `v1.0` git tag (handoff #171)
- Archive the 23 drafts in §5 (UI action)
- **B-14** — labor rates auto-update from last 3 receipts

---

## 5. Drafts to archive (23) — V2 future-bets

These rows are still PROPOSED on the board but are explicitly **not** V1.x.
Bulk-archive them in the Tasks UI so the working backlog stays clean. They
are not deleted — the descriptions are preserved here as the V2 starting set.

### 5a. Confirmed duplicates (3)

| Ref | Title | Reason |
|---|---|---|
| #47 | Site photo upload, categorization, report links | Duplicate of #105 (MERGED) |
| #48 | Permits page: legal header + split by type | Duplicate of #106 (MERGED) |
| #76 | Cross-client notes isolation test | Duplicate of #155 (MERGED) |

### 5b. Park for V2 (20)

Each of these depends on a parent that itself was merged-as-stub or never
accepted. They become the seed of the V2 backlog.

| Ref | Title | Depends on | Theme |
|---|---|---|---|
| #38 | Wire e2e suite into CI | #37 | Tests |
| #39 | Standardize bilingual error messages | #37 | API contract |
| #40 | Cover lead-to-project lifecycle in e2e | #37 | Tests |
| #43 | Make project-detail panels responsive | #42 (superseded by #165) | Mobile |
| #44 | Audit modals for mobile usability | #43 | Mobile |
| #58 | Auto-regenerate priority spreadsheet | #55 | Reporting |
| #59 | Plain-language "what's happening now" sentence | #18 | UX |
| #64 | Show recently uploaded files in upload dialog | #60 | UX |
| #65 | Server-side upload size/type validation | #60 | Hardening |
| #68 | Lock down remaining read-only project endpoints | #61 | Hardening |
| #69 | Real spend per phase (vs. industry estimate) | #62 | Reporting |
| #70 | Per-project report color overrides | #62 | Brand |
| #77 | Test team replies to client questions | #31 | Tests |
| #78 | Preview templated PDF before sending | #29 | Reporting |
| #79 | Logo + brand colors for report template | #29 | Brand |
| #83 | Review/correct OCR receipt details | #28 | AI |
| #84 | E2E test for uploaded receipt photo flow | #28 | Tests |
| #90 | Audit trail covers all admin actions | #73 | Compliance |
| #91 | Export audit log as CSV | #73 | Compliance |
| #98 | Auto-push GitHub backup after each change | #96 | Ops |

### 5c. Follow-ups proposed in #170 (already on the board)

- **#171** Tag v1.0 + archive parked drafts — MERGED (handoff)
- **#172** Auto-test that notification taps land on the right panel — PROPOSED, recommended for V1.x

---

## 6. Top 10 V2 bets (carried forward from `development.md` §"Future developments")

These are the highest-value V2 directions identified in Task #162. They are
**not** on the project task board yet; the V2 planning session should turn the
chosen bets into accepted tasks.

1. **Multi-tenant accounts.** One KONTi instance per agency, with isolated data, branding, and auth.
2. **Mobile-first PWA shell.** Promote `?mobileV2=1` to a real installable PWA with offline doc caching.
3. **Native e-signature provider.** Wire DocuSign / HelloSign behind the existing `/sign` flow; keep the native fallback.
4. **Receipt OCR confidence + correction UI.** Surface low-confidence fields, let the team correct, and feed B-14 (labor-rate auto-update).
5. **Calculator template library.** Project templates per work type — finishes #46.
6. **Real-time collaboration on punchlist + notes.** WebSockets or Supabase Realtime for the team channel.
7. **Asana → KONTi reverse sync.** Today the sync is dashboard → Asana; reverse it for teams that prefer Asana as the source of truth.
8. **Vendor / supplier portal.** Limited-scope login for material suppliers to update prices and stock.
9. **Drive-native document editing.** Open docs directly in Google Docs/Sheets from the dashboard.
10. **Reporting analytics dashboard.** Cross-project KPIs (budget variance, schedule slip, change-order frequency) for the agency owner.

Rationale paragraphs for each live in `development.md` §"Future developments —
top 10 highest-value bets".

---

## 7. Operating posture

- **Deployment target:** Autoscale (cheap, cold starts). Reserved VM upgrade is optional and tracked outside the task board.
- **Database:** Replit Postgres via Drizzle; `drizzle-kit push` runs in `scripts/post-merge.sh` after every merge.
- **Integrations live:** Google Drive (storage), Asana (bidirectional sync), Resend (transactional email), GitHub (code backup), PDF.co (OCR), Anthropic (AI assistant).
- **Bilingual coverage:** EN/ES across every user-facing surface; Spanish copy reviewed in #62 + #99 + #170.
- **Brand palette:** `#1C1814` ink, `#E6EAEB` paper, `#778894` slate, `#4F5E2A` accent — defined in `artifacts/konti-dashboard/src/index.css`.
- **Mobile flag:** `?mobileV2=1` toggles the minimalist card layout shipped in #165; defaults remain desktop until V2 promotes the PWA.

---

## Appendix A — Sources consolidated into this report

The following files together form the V1 paper trail. From this report
forward, treat them as **historical archive**; do not edit them. New status
updates should append to this document or open a new V1.x / V2 report.

- `attached_assets/reports/KONTi_Feedback_Status_2026-04-30.md` (last pre-final snapshot)
- `reports/feedback-status-2026-05-01.md`
- `reports/feedback-status-reconciled.md` (current — 55 Done / 1 Open)
- `reports/e2e-audit-2026-05.md`
- `.local/reports/v1-backlog-parking.md` (Task #170 triage)
- `.local/reports/app-status-and-feedback-bundle.md`
- `.local/tasks/task-170.md` (audit results section)
- `.local/tasks/feedback-status-markdown-report.md`
- `.local/tasks/github-backup-and-feedback-status-update.md`
- `.local/tasks/feedback-bundle-3-and-status-reconcile.md`
- `attached_assets/KONTi_Dashboard_Feedback_Consolidated_v3_addressed.xlsx` (canonical workbook)
- `attached_assets/reports/KONTi_Dashboard_Feedback_Consolidated_v4.xlsx`

## Appendix B — Where to find things

- **Per-task notes & deliverables:** `development.md` §"Shipped & validated"
- **Per-feedback-item closure notes:** `reports/feedback-status-reconciled.md`
- **Architecture & runbook:** `replit.md`
- **Roadmap & top-10 V2 bets:** `development.md`
- **OpenAPI contract:** `lib/api-spec/openapi.yaml`
- **DB schema:** `lib/db/src/schema/` (lifecycle.ts, estimating.ts, audit.ts, etc.)
- **Bootstrap fixture (read-only at runtime):** `artifacts/api-server/src/data/seed.ts`
