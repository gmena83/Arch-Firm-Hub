# KONTi Dashboard MVP

## Overview

The KONTi Dashboard is a bilingual (EN/ES) project management and client dashboard for KONTi Design | Build Studio, a Puerto Rico-based sustainable architecture firm specializing in shipping container construction. This project provides a comprehensive tool for managing projects, client interactions, and internal operations, offering a streamlined approach to project oversight and client engagement for sustainable architecture projects.

## User Preferences

- I prefer a clear, concise, and professional communication style.
- I value iterative development and expect regular updates on progress.
- I prefer detailed explanations for complex technical decisions.
- Before making major architectural changes or introducing new dependencies, please ask for approval.
- Do not make changes to the `artifacts/api-server/src/data/seed.ts` file without explicit instruction.
- Ensure all new features are covered by relevant tests.

## System Architecture

The project is structured as a pnpm workspace monorepo utilizing TypeScript.

### UI/UX Decisions

- **Bilingual Support:** The dashboard supports both English and Spanish, with all user-facing strings on the calculator surface wrapped in an i18n helper for dynamic language switching.
- **Variance Report:** The Calculator's Variance tab displays estimated, invoiced, and actual costs per bucket and material category, with delta pills for `Δ vs Invoiced` and `Δ vs Estimated`. Unassigned invoices are categorized, and the report includes total estimated, invoiced, and actual figures. Client views hide all invoiced data.
- **Role-Aware Project Card Images:** Project cards display `liveCoverImage` for KONTi staff and curated brand mockup images with progress milestones for clients.
- **Branding:** Uses a specific color palette (`#1C1814`, `#E6EAEB`, `#778894`, `#4F5E2A`), Montserrat and Cormorant fonts, and `@assets/Horizontal02_WhitePNG_*` or `@assets/Horizontal02_VerdePNG_*` logos.
- **Responsive Layout:** Designed for phone, tablet, and desktop, with responsive adjustments for offsets, gutters, card grids, list rows, tables, hero sections, chat panels, and page headings.

### Technical Implementations

- **Monorepo Tools:** pnpm workspaces, Node.js v24, TypeScript v5.9.
- **API:** Express 5 framework, with Orval for API codegen from OpenAPI spec, and esbuild for CJS bundling. Runs on port 8080.
- **Authentication:** Token-based authentication using `localStorage` for credentials (`konti_auth`) and language preference (`konti_lang`).
- **Project Report:** Editable report header date persisted in `localStorage`, with server-side PDF generation.
- **Security:** `osv-scanner` for dependency auditing.
- **API Server (`artifacts/api-server`):** Provides routes for authentication, projects, tasks, weather, documents, calculations, receipts, materials, dashboard summary, activity, and AI chat. Includes receipt OCR processing via PDF.co and integrates with Anthropic API for Claude AI chat. Uses static seed data for 3 projects.
- **Estimating + Calculator Persistence:** Imported materials, labor rates, project receipts, report templates, contractor estimates, and per-line calculator entries persist to Postgres via Drizzle (`@workspace/db` schema in `lib/db/src/schema/estimating.ts`). Writes are fire-and-forget through a serialised queue (`flushEstimatingPersistence()` and `flushCalculatorPersistence()` exposed for tests). On boot, `bootstrap()` in `artifacts/api-server/src/index.ts` awaits `ensureEstimatingHydrated()` + `ensureCalculatorHydrated()` before `app.listen`, and a one-time JSON migration (`migrateEstimatingJsonIfNeeded`, idempotency keyed by `estimating-json-2026-05` in `estimating_migrations`) imports any legacy `.data/estimating.json` and renames the file to `.migrated.<ISO>` so subsequent boots are no-ops. Projects with no calculator rows in Postgres continue to use `seed.ts` defaults.
- **KONTi Dashboard (`artifacts/konti-dashboard`):** React + Vite SPA with routes for login, dashboard, projects, calculator, materials, and AI. Includes report theme toggles (light, white, dark) persisted per project, and a document upload modal with optimistic removal.

### External Dependencies

- **PDF.co:** For OCR processing of receipts (`PDF_CO_API_KEY`).
- **Anthropic API:** For Claude AI chat functionality (`ANTHROPIC_API_KEY`).
- **Google Fonts:** For Montserrat and Cormorant font families.
- **SheetJS CDN:** For the `xlsx` library (version `0.20.3`).
- **GitHub:** For repository backup and mirroring (`conn_github_01KQE5WDMH98BBX68KHP36KKGG`).
- **Asana:** Bidirectional sync of dashboard activity and task creation via the Replit Asana connector (`ccfg_asana_17D6AEDD454A41BA8870C2542E`).
- **Google Drive:** Optional document storage backend, mirroring uploads, deletions, and visibility toggles to Drive via the Replit Google Drive connector.
- **Managed API Keys:** Integration with a system for managing `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PDF_CO_API_KEY`, `GAMMA_APP_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` with masked previews, test functionalities, and an audit log of superadmin actions.