# Feedback status reconciliation — Apr 30 2026

Source workbook: `attached_assets/KONTi_Dashboard_Feedback_Consolidated_v2_1777518178155.xlsx`

Reconciled workbook: `attached_assets/KONTi_Dashboard_Feedback_Consolidated_v3_addressed.xlsx`

## Totals (Sheet 1, all 57 V1+V2 items)

| Status | Count |
|---|---:|
| Open | 6 |
| In Progress | 0 |
| Done | 45 |
| Done — needs verification | 1 |
| Needs Spec | 0 |
| Needs Decision | 5 |

## Items moved to **Done — needs verification**

These rows look closed on paper but a PM should eyeball the live UI before promoting them to plain Done.

| ID | Was | Now | Why verification is suggested |
|---|---|---|---|
| A-11 | In Progress | Done — needs verification | Likely closed by #62 + #75 (Contractor Estimate Rollup on the project report); needs PM eyes-on confirmation that the consolidated view matches the original ask. |

## Items moved to **Done**

| ID | Was | Now | Closed by |
|---|---|---|---|
| A-01 | Open | Done | Done in #99 (Reviewer feedback bundle #2): project-invoices.tsx Total/Paid/Balance/Status columns now render from invoice data. |
| A-03 | Open | Done | Done in #61 (client portal expansion: client uploads enabled). |
| A-04 | Open | Done | Done in #63 (document organization: contracts/agreements grouping). |
| A-06 | Open | Done | Done in #61 (per-document client visibility) and reinforced by #88 (client ownership checks). |
| A-07 | Open | Done | Done in #105 (Site photos: upload, categorize, link them from the project report). |
| A-08 | Open | Done | Done in #75 (ClientContactCard with phone, postal, physical addresses). |
| A-12 | Open | Done | Done in #61 hardening + verified 2026-05 (Task #156): client-side audit log shipped — backend GET /api/projects/:id/audit-log accepts the client role behind enforceClientOwnership with a `?clientOnly=true` filter (artifacts/api-server/src/routes/projects.ts ~L2386), and the bilingual ClientActivityCard is mounted on the project detail page (artifacts/konti-dashboard/src/components/client-activity-card.tsx + project-detail.tsx ~L1721) with a Show-all / Client-only toggle. Non-owner 403 + owner 200 paths covered by client-ownership.test.ts L382-L420 (pre-existing — no new test was needed in this task). |
| A-13 | Open | Done | Done in #62 (KONTi brand pass) and #74 (header text readable on bright cover photos). |
| B-01 | Open | Done | Done in #75 (CSV header aliases: Description, UnitPrice, etc.). |
| B-03 | Open | Done | Done in #75 (calculator auto-populates from imported materials). |
| B-04 | Open | Done | Done in #75 (inline edit + PATCH /projects/:id/calculations/:lineId persistence). |
| B-05 | Open | Done | Done in #75 (Project Information panel with bathrooms/kitchens/margin/mgmt-fee inputs). |
| B-06 | Open | Done | Done in #99 (Reviewer feedback bundle #2): calculator estimate table now groups by category with per-category subtotal cards, mirroring the team's external estimate format. |
| B-07 | Open | Done | Done in #99 (Reviewer feedback bundle #2): renamed Imports tab to 'Imported Materials' / 'Materiales Importados' with hover tooltip describing CSV/Excel bulk import. |
| B-08 | Open | Done | Done in #75 (renamed to 'Effective Price' with tooltip + legend). |
| B-09 | Open | Done | Done in #99 (Reviewer feedback bundle #2): added 'Receipts & Variance' shortcut card on dashboard linking team users straight to /calculator?tab=variance. |
| B-10 | In Progress | Done | Done in #27 (receipts and contractor estimates persist across restart). |
| B-11 | In Progress | Done | Done in #28 (real PDF/image OCR replaces the mock). |
| B-12 | In Progress | Done | Done in #29 (PDF export now uses the saved report template). |
| B-13 | Open | Done | Done in #99 (Reviewer feedback bundle #2): Materials Library 'Add Material' button now opens a modal that POSTs a single material via the existing /api/estimating/materials/import endpoint and refreshes the catalog. |
| C-02 | Open | Done | Done in #99 (Reviewer feedback bundle #2): contractor BOM detail now gated by !isClientView so client viewers only see the Cost-by-Category rollup and never the raw line items. |
| C-03 | Open | Done | Done in #99 (Reviewer feedback bundle #2): phase numbers no longer rendered anywhere in the project report (phase chips, timeline, donut all show labels only). |
| C-04 | Open | Done | Done in #99 (Reviewer feedback bundle #2): added Phase Progress donut on the project report mirroring the punchlist phase-pie style with per-phase % completion and an avg-completion centre label. |
| C-05 | Open | Done | Done in #99 (Reviewer feedback bundle #2): renamed 'Site Conditions' to 'Weather Status' / 'Estado del Clima' in the report header tile and the dedicated weather section. |
| C-06 | Open | Done | Done in #99 (Reviewer feedback bundle #2): Cost-by-Category card and the BOM detail are both driven from the same calc.subtotalByCategory data so totals always match. |
| C-07 | Open | Done | Done in #75 (mgmt fee editable from the project report; flows through to the rollup). |
| C-08 | Open | Done | Done in #71 (P1 quick wins: report logo enlarged). |
| C-09 | Open | Done | Done in #62 (KONTi brand pass replaced the dark/black palette). |
| C-10 | In Progress | Done | Done in #99 (Reviewer feedback bundle #2): replaced auto-generated reportDate with an editable <input type='date'> in the sticky report header, persisted per project via localStorage. |
| C-11 | Open | Done | Done in #105 (Site photos: upload, categorize, link them from the project report — bulk upload + Drive-compatible URL field). |
| C-12 | Open | Done | Done in #62 (light backgrounds across the project report). |
| D-01 | In Progress | Done | Done in #30 (AI assistant notes/updates persist across restart). |
| E-01 | Open | Done | Done in #106 (Permits page: legal header + split by permit type). |
| E-02 | Open | Done | Done in #106 (Permits page: legal header + split by permit type). |
| E-03 | Open | Done | Done in #71 (P1 quick wins: permits copy fixed). |
| F-01 | Open | Done | Done in #71 (P1 quick wins: clickable activity). |
| F-02 | In Progress | Done | Done in #61 (client home in client portal) and #72 (dashboard restructure). |
| G-01 | Open | Done | Already shipped despite V2 scope: ContractorUploadModal (single + CSV modes) in artifacts/konti-dashboard/src/pages/team.tsx (~L69-115). |
| H-01 | Open | Done | Done in #99 (Reviewer feedback bundle #2): leads page now renders an inline lead-score legend (Hot / Warm / Cold / New thresholds) right next to the table. |
| H-02 | Needs Decision | Done | Done in #127 (real bidirectional Asana integration): leads now create real Asana tasks via lib/asana-client.createTask() with graceful fallback when the connector is unavailable; dashboard activity (uploads, photos, site visits, client interactions, phase changes, contract signed) is mirrored into Asana via lib/asana-sync.ts; admin-only Settings → Asana panel for connect/configure/sync log/retry; project_team_actions modals for site visits, client interactions, and Asana task linking. |
| I-01 | In Progress | Done | Done in #60 (file upload regression on the demo project fixed). |
| I-02 | Open | Done | Done in #99 (Reviewer feedback bundle #2): document upload modal now requires a category dropdown so demo-project docs are sorted into the correct buckets. |
| I-03 | In Progress | Done | Done in #32 (punchlist persists across restart). |
| I-04 | Open | Done | Done in #102 (Real signature handoff emails): permits-panel.tsx adds a 'Request signature' / 'Solicitar firma' button for staff that POSTs to a new dedupe-protected /projects/:id/request-signature/:signatureId endpoint and dispatches a bilingual Resend-backed email; the existing /sign endpoint now also emails the team a signature-completed notice; the previously-simulated Pre-Design kickoff, decline-notify-team, and proposal-acceptance emails are now real sends. All five flows isolate failures (mutation succeeds, email_failed activity row + UI toast surfaced) and are covered by node:test fixtures in artifacts/api-server/src/routes/__tests__/signature-emails.test.ts. |
| J-01 | Needs Decision | Done | Done in #128 (Google Drive integration as document storage backend): Settings page now exposes a Drive panel where admins/superadmins pick a root folder, choose visibility (private vs anyone-with-link) and delete (trash vs purge) policies, and trigger a backfill of in-app documents. When connected, every project upload streams into a per-project / per-category sub-folder in Drive, deletes are mirrored, and a viewer link is shown next to the file in the project document list. When disconnected, uploads continue to land in the in-app store as before — no behavior change. |

## Items still **Open**

| ID | Was | Now | Note |
|---|---|---|---|
| A-02 | Open | Open | — |
| A-05 | Open | Open | — |
| A-09 | Open | Open | — |
| B-02 | Open | Open | — |
| B-14 | Open | Open | — |
| C-01 | Open | Open | Punchlist persistence shipped in #32; photo links + categories on the report still pending. |

## Items needing a product decision

| ID | Was | Now |
|---|---|---|
| A-10 | Needs Decision | Needs Decision |
| D-02 | Needs Decision | Needs Decision |
| E-04 | Needs Decision | Needs Decision |
| E-05 | Needs Decision | Needs Decision |
| H-03 | Needs Decision | Needs Decision |

## Notes

- Sheet 4 (Legend & Guide) is preserved unchanged.
- Sheet 2 (V2 Backlog) statuses are kept in sync with Sheet 1 for the same IDs (B-11, D-01, etc.).
- 'Done' rows have a one-line justification appended to the Scope Rationale column linking to the merged task ref.
- A-07, C-11 closed by #105 (site photos). E-01, E-02 closed by #106 (permits split + legal header). G-01 was already shipped despite V2 scope.

## Post-reconciliation fixes (Apr 30 2026)

These items were merged after this report was first published. They came from
Tatiana's live demo session rather than the v2 workbook, so they are tracked
here instead of as numbered IDs.

| Task | Area | What shipped |
|---|---|---|
| #64 | Project Detail > Upload Dialog | Upload dialog now stays open after a successful upload and shows a per-session "Just uploaded" panel listing each new file with thumbnail (or file icon), name, size, category badge, and a Remove button. Remove calls a new `DELETE /api/projects/:projectId/documents/:documentId` endpoint with optimistic UI and per-doc rollback. Endpoint enforces team/admin/superadmin + owning client (clients can only delete files they uploaded), and emits a `document_removed` activity entry. Backed by 10/10 passing API tests. |

### Side effects on previously tracked items

- **A-09** (clients self-administer their own uploads) remains Open as a V2
  item, but the *delete-own-uploads* slice is now functionally available via
  the new DELETE endpoint — clients see the Remove button on files they
  uploaded inside the upload dialog. Full V2 scope (out-of-dialog gallery
  management, caption editing) is still pending.
- **I-01** (upload persistence) is unchanged — document blobs are still
  in-memory; the new DELETE handler operates against the same in-memory
  store, so when persistence lands (follow-up #114) both POST and DELETE
  paths must migrate together.
