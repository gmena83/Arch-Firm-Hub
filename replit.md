# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## KONTi Dashboard MVP

### Project Summary
A bilingual (EN/ES) project management and client dashboard for KONTi Design | Build Studio, a Puerto Rico-based sustainable architecture firm specializing in shipping container construction.

### Artifacts
1. **API Server** (`artifacts/api-server`) — Express 5 API on port 8080
   - Routes: `/api/auth/login`, `/api/projects`, `/api/projects/:id`, `/api/projects/:id/tasks`, `/api/projects/:id/weather`, `/api/projects/:id/documents`, `/api/projects/:id/calculations`, `/api/projects/:id/receipts`, `/api/projects/:id/receipts/upload-file` (real OCR via PDF.co), `/api/materials`, `/api/dashboard/summary`, `/api/dashboard/activity`, `/api/ai/chat`
   - Receipt OCR: `POST /api/projects/:id/receipts/upload-file` accepts JSON `{fileBase64, filename, trade, hours?, vendor?, date?, amount?}`. Server uploads via PDF.co (`PDF_CO_API_KEY`), runs OCR (image→PDF→text with `eng+spa`), parses vendor/date/amount/hours heuristically, merges with overrides, persists into `PROJECT_RECEIPTS` and recomputes labor baseline (last 3 receipts per trade). The original CSV/JSON `POST /api/projects/:id/receipts` endpoint is kept as a bulk-entry fallback.
   - All static seed data (no live DB) — 3 synthetic Puerto Rico projects
   - Claude AI chat via Anthropic API (ANTHROPIC_API_KEY env var)

2. **KONTi Dashboard** (`artifacts/konti-dashboard`) — React + Vite SPA at `/`
   - Port set by `PORT` env var, base path set by `BASE_PATH`

### Pages / Routes
| Route | Component | Purpose |
|---|---|---|
| `/login` | LoginPage | Split dark/light login with demo credentials |
| `/dashboard` | DashboardPage | Project cards, stats bar, activity feed |
| `/projects` | ProjectsPage | List of all projects |
| `/projects/:id` | ProjectDetailPage | Phase timeline, weather, tasks, documents, budget |
| `/projects/:id/report` | ProjectReportPage | Gamma.app-style dark report with charts |
| `/calculator` | CalculatorPage | Material cost calculator with overrides |
| `/materials` | MaterialsPage | Searchable materials library |
| `/ai` | AiAssistantPage | Claude AI chat (client + internal modes) |

### Branding
- **Colors**: `#1C1814` (dark brown), `#E6EAEB` (light gray), `#778894` (slate), `#4F5E2A` (olive green)
- **Fonts**: Montserrat (400/600/700) + Cormorant (400/400i/700) via Google Fonts
- **Logos**: `@assets/Horizontal02_WhitePNG_*` (dark bg), `@assets/Horizontal02_VerdePNG_*` (light bg)
  - `@assets` alias resolves to `./attached_assets/` at workspace root

### Auth
- Demo: `demo@konti.com` / `konti2026` (admin role)
- Client: `client@konti.com` / `konti2026` (client role)
- Stored in `localStorage` key `konti_auth`
- Language stored in `localStorage` key `konti_lang` (`en` or `es`)

### Project Report — editable date (Task #99 / C-10)
- The report header date is editable per project, persisted under
  `localStorage` key `konti.report.date.<projectId>`.
- `downloadPdf()` POSTs `{ reportDate: "yyyy-mm-dd" }` to
  `/api/projects/:id/pdf`. The server validates the shape and stamps that
  date into the PDF header (`generatedAt`); falls back to "now in PR" if
  missing/invalid.
- Cross-project navigation re-loads the per-project date via a
  `loadedProjectId` guard — see `project-report.tsx`.

### Key Files
- `artifacts/api-server/src/data/seed.ts` — all static project data
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/konti-dashboard/src/App.tsx` — router configuration
- `artifacts/konti-dashboard/src/pages/` — all page components
- `artifacts/konti-dashboard/src/hooks/` — use-auth, use-lang, use-toast
- `artifacts/konti-dashboard/src/components/layout/` — sidebar, app-layout
- `artifacts/konti-dashboard/src/index.css` — KONTi brand CSS vars + Google Fonts
- `lib/api-client-react/src/generated/api.ts` — generated API hooks (orval)
- `lib/api-spec/openapi.yaml` — OpenAPI 3.0 spec

### 3 Synthetic Projects
1. **Casa Solar Rincón** (`proj-1`) — Phase 1: Discovery, Rincón PR
2. **Residencia Martínez Ocasio** (`proj-2`) — Phase 5: Construction 67%, San Juan PR (client: Benito Antonio Martínez Ocasio)
3. **Café Colmado Santurce** (`proj-3`) — Completed, Santurce PR

### Responsive Layout Conventions
The dashboard targets phone (~375px), tablet (~768px), and desktop. Conventions:
- **Mobile header offset**: `pt-28 md:pt-0` on `<main>` clears the two-row mobile header (logo + bell/lang toggle).
- **Page gutters**: `px-3 sm:px-4 md:px-8` from `app-layout.tsx`. Pages with their own container (e.g. `permits.tsx`) use `p-3 sm:p-6`.
- **Card grids**: `grid sm:grid-cols-2 lg:grid-cols-3` for project cards (1→2→3 columns).
- **List rows**: `p-3 sm:p-4 flex items-center gap-3 sm:gap-4`; secondary content (cover image, budget text) uses `hidden sm:block`; action buttons may collapse to icon-only on phone (`<span className="hidden sm:inline">View</span>`).
- **Wide tables**: wrap in `overflow-x-auto` with `min-w-[…]` on the table itself (e.g. `min-w-[640px]` for BOM, `min-w-[700px]` for calculator, `min-w-[480px]` for materials).
- **Hero/header rows**: `flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3` to stack on phone.
- **Long horizontal strips** (e.g. 9-phase timeline): wrap in `overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0` with `min-w-[60px]` per item.
- **Chat / fixed-height panels**: prefer `h-[calc(100dvh-360px)] md:h-[calc(100vh-280px)]` to account for the larger mobile header.
- **Page H1**: `text-xl sm:text-2xl` and `shrink-0` on inline icons to prevent overflow.

## Security: Dependency Audit Trail (Task #49)

Run `runDependencyAudit` (osv-scanner) periodically. Resolutions applied:

- **Patched via catalog**: vite ^7.3.2, drizzle-orm ^0.45.2.
- **Patched via pnpm overrides** (transitive): brace-expansion ^2.0.3,
  lodash ^4.18.0, path-to-regexp@8 ^8.4.0, picomatch@2 ^2.3.2,
  picomatch@4 ^4.0.4, yaml ^2.8.3.
- **xlsx**: pinned to SheetJS CDN tarball xlsx-0.20.3 (npm distribution
  is unmaintained at 0.18.5; SheetJS now distributes via cdn.sheetjs.com).
  Lockfile integrity hash is the trust anchor — install with
  `pnpm install --frozen-lockfile` in CI to enforce.

### Known scanner false positives (xlsx-0.20.3)
osv-scanner continues to flag two advisories against xlsx, but both are
patched in 0.20.3:

| Advisory | Affected range | Installed | Status |
|---|---|---|---|
| GHSA-4r6h-8v6p-xvw6 (Prototype Pollution) | < 0.19.3 | 0.20.3 | patched |
| GHSA-5pgg-2g8v-p4x9 (ReDoS) | < 0.20.2 | 0.20.3 | patched |

The scanner appears to match by package name without consulting advisory
version ranges, likely because the npm registry only knows about 0.18.5.


## GitHub Backup (Task #96)

The repo is mirrored to a private GitHub repository for safekeeping:
**https://github.com/gmena83/konti-dashboard-backup**

The GitHub connection is wired through the Replit integrations system
(connection id `conn_github_01KQE5WDMH98BBX68KHP36KKGG`); future pushes
should reuse that connection rather than embedding any long-lived
credentials in this workspace. Pushes are made via a one-shot remote URL
so no token is ever written to `.git/config` or any file on disk.

### Initial backup verification (Apr 30 2026)

Two pushes were performed during Task #96:

1. After the GitHub repo was created — pushed `f9c8099`. Verified by reading
   `GET /repos/gmena83/konti-dashboard-backup/git/ref/heads/main`; remote
   SHA matched local SHA exactly.
2. After T002 (feedback reconciliation) added new files — pushed `d7c7ef3`.
   Re-verified the same way; remote SHA matched local SHA exactly.

| Push | Local HEAD on `main`                        | Remote HEAD on `main`                       | Match |
|------|---------------------------------------------|---------------------------------------------|-------|
| #1   | `f9c80999f5ff647da4ef341cc859b14fa68a0a7f`  | `f9c80999f5ff647da4ef341cc859b14fa68a0a7f`  | yes   |
| #2   | `d7c7ef3a218392bf37b102925af73981846e2f09`  | `d7c7ef3a218392bf37b102925af73981846e2f09`  | yes   |

Repo is private (`private: true`, default branch `main`).

### Follow-up

Task #98 (proposed) will add an automated mirror so the GitHub copy stays
in sync after every Replit commit instead of going stale.
