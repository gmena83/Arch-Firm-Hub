# KONTi Dashboard MVP

## Overview

The KONTi Dashboard is a bilingual (EN/ES) project management and client dashboard for KONTi Design | Build Studio, a Puerto Rico-based sustainable architecture firm specializing in shipping container construction. This project aims to provide a comprehensive tool for managing projects, client interactions, and internal operations.

## User Preferences

- **I prefer a clear, concise, and professional communication style.**
- **I value iterative development and expect regular updates on progress.**
- **I prefer detailed explanations for complex technical decisions.**
- **Before making major architectural changes or introducing new dependencies, please ask for approval.**
- **Do not make changes to the `artifacts/api-server/src/data/seed.ts` file without explicit instruction.**
- **Ensure all new features are covered by relevant tests.**

## System Architecture

The project is structured as a pnpm workspace monorepo utilizing TypeScript.

### UI/UX Decisions

- **Bilingual Support:** The dashboard supports both English and Spanish.
- **Branding:**
    - **Colors:** `#1C1814` (dark brown), `#E6EAEB` (light gray), `#778894` (slate), `#4F5E2A` (olive green).
    - **Fonts:** Montserrat (400/600/700) and Cormorant (400/400i/700) from Google Fonts.
    - **Logos:** `@assets/Horizontal02_WhitePNG_*` for dark backgrounds and `@assets/Horizontal02_VerdePNG_*` for light backgrounds. The `@assets` alias resolves to `./attached_assets/`.
- **Responsive Layout:** The dashboard is designed for phone (~375px), tablet (~768px), and desktop.
    - Mobile header offset: `pt-28 md:pt-0` on `<main>`.
    - Page gutters: `px-3 sm:px-4 md:px-8` from `app-layout.tsx`.
    - Card grids: `grid sm:grid-cols-2 lg:grid-cols-3`.
    - List rows: `p-3 sm:p-4 flex items-center gap-3 sm:gap-4`; secondary content uses `hidden sm:block`.
    - Wide tables: wrapped in `overflow-x-auto` with `min-w-[…]`.
    - Hero/header rows: `flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3`.
    - Long horizontal strips: wrapped in `overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0`.
    - Chat/fixed-height panels: `h-[calc(100dvh-360px)] md:h-[calc(100vh-280px)]`.
    - Page H1: `text-xl sm:text-2xl` and `shrink-0` on inline icons.

### Technical Implementations

- **Monorepo Tool:** pnpm workspaces.
- **Node.js:** Version 24.
- **Package Manager:** pnpm.
- **TypeScript:** Version 5.9.
- **API Framework:** Express 5.
- **API Codegen:** Orval (from OpenAPI spec).
- **Build Tool:** esbuild (CJS bundle).
- **Authentication:** Token-based authentication with demo credentials for admin, client, and superadmin roles. Credentials stored in `localStorage` (`konti_auth`). Language preference (`en` or `es`) stored in `localStorage` (`konti_lang`).
- **Project Report:** Editable report header date, persisted per project in `localStorage` (`konti.report.date.<projectId>`). PDF generation on the server.
- **Dependency Management:** `pnpm run typecheck` for full typecheck, `pnpm run build` for typecheck + build.
- **Security:** `osv-scanner` for dependency auditing.
- **GitHub Backup:** The repository is mirrored to a private GitHub repository for backup.

### Feature Specifications

- **API Server (`artifacts/api-server`):**
    - Runs on port 8080.
    - Provides routes for authentication, projects, tasks, weather, documents, calculations, receipts, materials, dashboard summary, activity, and AI chat.
    - **Receipt OCR:** `POST /api/projects/:id/receipts/upload-file` processes base64 encoded files via PDF.co, performs OCR (eng+spa), parses data heuristically, and updates project labor baselines.
    - Utilizes static seed data for 3 synthetic Puerto Rico projects.
    - Integrates with Anthropic API for Claude AI chat.
- **KONTi Dashboard (`artifacts/konti-dashboard`):**
    - React + Vite Single Page Application (SPA).
    - Routes: `/login`, `/dashboard`, `/projects`, `/projects/:id`, `/projects/:id/report`, `/calculator`, `/materials`, `/ai`.
    - Components for various pages, authentication, language handling, and UI layout.
    - Report theme toggle with `light`, `white`, and `dark` presets, persisted per project.
    - Document upload modal with "Just uploaded" panel, optimistic removal, and server-side deletion (`DELETE /api/projects/:projectId/documents/:documentId`).

## External Dependencies

- **PDF.co:** Used for OCR processing of receipts. (Requires `PDF_CO_API_KEY`).
- **Anthropic API:** Integrated for Claude AI chat functionality. (Requires `ANTHROPIC_API_KEY`).
- **Google Fonts:** Used for Montserrat and Cormorant font families.
- **SheetJS CDN:** Used for the `xlsx` library (pinned to `xlsx-0.20.3`).
- **GitHub:** Used for repository backup and mirroring. (Connection ID `conn_github_01KQE5WDMH98BBX68KHP36KKGG`).
- **Asana:** Bidirectional sync of dashboard activity (uploads, photos, site visits, client interactions, phase changes, contract signed) onto the team's Asana board, plus real Asana task creation when a lead is converted. Configured via Settings → Integrations (admin/superadmin only). Requires the Replit Asana connector (`ccfg_asana_17D6AEDD454A41BA8870C2542E`) — when not authorized, the integration degrades gracefully: `isAsanaEnabled()` returns false, the sync hook short-circuits, lead conversion still creates the lead without an Asana gid, and the Settings panel shows "Not connected" with the authorization prompt. To re-propose, call `proposeIntegration({integrationId: "connector:ccfg_asana_17D6AEDD454A41BA8870C2542E"})`. Backend: `lib/asana-client.ts`, `lib/integrations-config.ts` (JSON-persisted, sync log capped 50, retry queue with exp backoff), `lib/asana-sync.ts` (hook + drainer), `routes/integrations.ts`. Self-emitted `asana_sync_*` events excluded from the hook to prevent feedback loops.