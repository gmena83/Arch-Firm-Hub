# Feedback status reconciliation — Apr 30 2026

Source workbook: `attached_assets/KONTi_Dashboard_Feedback_Consolidated_v2_1777518178155.xlsx`

Reconciled workbook: `attached_assets/KONTi_Dashboard_Feedback_Consolidated_v3_addressed.xlsx`

## Totals (Sheet 1, all 57 V1+V2 items)

| Status | Count |
|---|---:|
| Open | 26 |
| In Progress | 0 |
| Done | 23 |
| Done — needs verification | 1 |
| Needs Spec | 0 |
| Needs Decision | 7 |

## Items moved to **Done — needs verification**

These rows look closed on paper but a PM should eyeball the live UI before promoting them to plain Done.

| ID | Was | Now | Why verification is suggested |
|---|---|---|---|
| A-11 | In Progress | Done — needs verification | Likely closed by #62 + #75 (Contractor Estimate Rollup on the project report); needs PM eyes-on confirmation that the consolidated view matches the original ask. |

## Items moved to **Done**

| ID | Was | Now | Closed by |
|---|---|---|---|
| A-03 | Open | Done | Done in #61 (client portal expansion: client uploads enabled). |
| A-04 | Open | Done | Done in #63 (document organization: contracts/agreements grouping). |
| A-06 | Open | Done | Done in #61 (per-document client visibility) and reinforced by #88 (client ownership checks). |
| A-08 | Open | Done | Done in #75 (ClientContactCard with phone, postal, physical addresses). |
| A-13 | Open | Done | Done in #62 (KONTi brand pass) and #74 (header text readable on bright cover photos). |
| B-01 | Open | Done | Done in #75 (CSV header aliases: Description, UnitPrice, etc.). |
| B-03 | Open | Done | Done in #75 (calculator auto-populates from imported materials). |
| B-04 | Open | Done | Done in #75 (inline edit + PATCH /projects/:id/calculations/:lineId persistence). |
| B-05 | Open | Done | Done in #75 (Project Information panel with bathrooms/kitchens/margin/mgmt-fee inputs). |
| B-08 | Open | Done | Done in #75 (renamed to 'Effective Price' with tooltip + legend). |
| B-10 | In Progress | Done | Done in #27 (receipts and contractor estimates persist across restart). |
| B-11 | In Progress | Done | Done in #28 (real PDF/image OCR replaces the mock). |
| B-12 | In Progress | Done | Done in #29 (PDF export now uses the saved report template). |
| C-07 | Open | Done | Done in #75 (mgmt fee editable from the project report; flows through to the rollup). |
| C-08 | Open | Done | Done in #71 (P1 quick wins: report logo enlarged). |
| C-09 | Open | Done | Done in #62 (KONTi brand pass replaced the dark/black palette). |
| C-12 | Open | Done | Done in #62 (light backgrounds across the project report). |
| D-01 | In Progress | Done | Done in #30 (AI assistant notes/updates persist across restart). |
| E-03 | Open | Done | Done in #71 (P1 quick wins: permits copy fixed). |
| F-01 | Open | Done | Done in #71 (P1 quick wins: clickable activity). |
| F-02 | In Progress | Done | Done in #61 (client home in client portal) and #72 (dashboard restructure). |
| I-01 | In Progress | Done | Done in #60 (file upload regression on the demo project fixed). |
| I-03 | In Progress | Done | Done in #32 (punchlist persists across restart). |

## Items still **Open**

| ID | Was | Now | Note |
|---|---|---|---|
| A-01 | Open | Open | — |
| A-02 | Open | Open | — |
| A-05 | Open | Open | — |
| A-07 | Open | Open | Tracked as Task #47 (Site photo upload, categorization, links from report). |
| A-09 | Open | Open | — |
| A-12 | Open | Open | Admin-side audit log shipped in #73; client-side audit log still V2. |
| B-02 | Open | Open | — |
| B-06 | Open | Open | Partially mitigated by #75 contractor rollup; full categorical summary still pending. |
| B-07 | Open | Open | — |
| B-09 | Open | Open | — |
| B-13 | Open | Open | — |
| B-14 | Open | Open | — |
| C-01 | Open | Open | Punchlist persistence shipped in #32; photo links + categories on the report still pending. |
| C-02 | Open | Open | — |
| C-03 | Open | Open | — |
| C-04 | Open | Open | — |
| C-05 | Open | Open | — |
| C-06 | Open | Open | — |
| C-10 | In Progress | Open | — |
| C-11 | Open | Open | Tracked as Task #47 (Site photo upload, categorization, links from report). |
| E-01 | Open | Open | Tracked as Task #48 (Permits page: legal header + split by permit type). |
| E-02 | Open | Open | Tracked as Task #48 (Permits page: legal header + split by permit type). |
| G-01 | Open | Open | — |
| H-01 | Open | Open | — |
| I-02 | Open | Open | — |
| I-04 | Open | Open | — |

## Items needing a product decision

| ID | Was | Now |
|---|---|---|
| A-10 | Needs Decision | Needs Decision |
| D-02 | Needs Decision | Needs Decision |
| E-04 | Needs Decision | Needs Decision |
| E-05 | Needs Decision | Needs Decision |
| H-02 | Needs Decision | Needs Decision |
| H-03 | Needs Decision | Needs Decision |
| J-01 | Needs Decision | Needs Decision |

## Notes

- Sheet 4 (Legend & Guide) is preserved unchanged.
- Sheet 2 (V2 Backlog) statuses are kept in sync with Sheet 1 for the same IDs (B-11, D-01, etc.).
- 'Done' rows have a one-line justification appended to the Scope Rationale column linking to the merged task ref.
- Items A-07 / C-11 / E-01 / E-02 are proposed but not yet merged tasks (#47, #48); they remain Open.
