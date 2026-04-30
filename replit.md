# KONTi Dashboard MVP

## Overview
The KONTi Dashboard MVP is a bilingual (EN/ES) project management and client dashboard designed for KONTi Design | Build Studio, a Puerto Rico-based sustainable architecture firm specializing in shipping container construction. This platform aims to streamline project oversight, client communication, and internal operations.

Key capabilities include:
- Project tracking with phases, tasks, documents, and budget.
- Material cost calculation and library management.
- Integration with AI for chat assistance.
- Receipt OCR functionality for labor baseline calculations.
- Comprehensive project reporting.

## User Preferences
I prefer simple language and detailed explanations. I want an iterative development process. Please ask before making major architectural changes or introducing new external dependencies. Do not make changes to files in the `artifacts/api-server/src/data/` directory unless explicitly requested for seed data updates. I prefer explanations that include code examples when discussing new features or modifications.

## System Architecture

The project is structured as a pnpm workspace monorepo using TypeScript (v5.9) and Node.js (v24).

**UI/UX Decisions:**
- **Branding:** Uses KONTi's brand colors (`#1C1814`, `#E6EAEB`, `#778894`, `#4F5E2A`) and Google Fonts (Montserrat, Cormorant). Logos are managed via an `@assets` alias.
- **Responsiveness:** Designed for phone, tablet, and desktop, employing Tailwind CSS for adaptive layouts. Specific conventions include mobile header offsets, responsive page gutters, dynamic card grids, collapsible list rows, and `overflow-x-auto` for wide tables and horizontal strips.
- **Theming:** Project Report features a theme toggle (light, white, dark) with per-project persistence.
- **Accessibility:** Tooltips are implemented with keyboard focusability and screen-reader announcements using `<button type="button" title="..." aria-label="...">` for improved accessibility.

**Technical Implementations & Features:**
- **Monorepo Structure:** Managed with pnpm workspaces, each package handles its own dependencies.
- **API Server (`artifacts/api-server`):** Built with Express 5, serving on port 8080. It handles authentication, project data, materials, dashboard summaries, and AI chat.
    - **Receipt OCR:** `POST /api/projects/:id/receipts/upload-file` integrates PDF.co for OCR, parsing receipt details and updating labor baselines.
    - **Authentication:** Demo accounts with different roles (admin, client, superadmin) are provided. Authentication tokens are stored in `localStorage`.
- **KONTi Dashboard (`artifacts/konti-dashboard`):** A React + Vite Single Page Application (SPA).
    - **Pages:** Includes login, dashboard, project list/detail, project report, material calculator, materials library, and AI assistant.
    - **Project Report:** Features an editable date, persisted locally, and used when generating PDF reports.
    - **Document Upload:** The upload modal remains open post-upload, displaying "Just uploaded" files with optimistic removal and per-document rollback.
- **API Codegen:** Orval generates API hooks and Zod schemas from an OpenAPI spec (`lib/api-spec/openapi.yaml`).
- **Build System:** `esbuild` is used for CJS bundling.
- **Security:** Regular dependency audits are performed using `osv-scanner`, with patched vulnerabilities and overridden transitive dependencies. `xlsx` library is pinned to a CDN version.
- **Data:** All current project data is static seed data defined in `artifacts/api-server/src/data/seed.ts`.
- **Testing:** API routes include dedicated regression test suites.

## External Dependencies
- **Anthropic API:** Used for Claude AI chat functionality (requires `ANTHROPIC_API_KEY`).
- **PDF.co:** Integrated for real OCR capabilities, specifically for processing receipts (requires `PDF_CO_API_KEY`).
- **Google Fonts:** For Montserrat and Cormorant font families.
- **SheetJS CDN:** For the `xlsx` library, pinned to version 0.20.3.
- **GitHub:** Used for backing up the repository to a private GitHub repository (`https://github.com/gmena83/konti-dashboard-backup`) via Replit integrations.