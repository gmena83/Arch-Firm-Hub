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
   - Routes: `/api/auth/login`, `/api/projects`, `/api/projects/:id`, `/api/projects/:id/tasks`, `/api/projects/:id/weather`, `/api/projects/:id/documents`, `/api/projects/:id/calculations`, `/api/materials`, `/api/dashboard/summary`, `/api/dashboard/activity`, `/api/ai/chat`
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
