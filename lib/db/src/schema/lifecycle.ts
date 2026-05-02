// Project lifecycle persistence (Task #144).
//
// These tables back the in-memory stores in `artifacts/api-server/src/data/seed.ts`
// that the production routes mutate as the user drives a project through
// its lifecycle (intake → discovery → design → permits → construction →
// completed). Until #144 every mutation lived only in process memory; a
// container redeploy lost everything. This module mirrors the #141
// estimating playbook exactly: per-store save helpers + one-time
// seed-hydration migration with a clobber guard.
//
// Column choices mirror `estimating.ts`:
//   - `text` IDs everywhere (route-generated string IDs).
//   - `doublePrecision` for monetary / numeric fields (matches the
//     in-memory model, no string⇄number coercion at the route boundary).
//   - `jsonb` for small string arrays (teamMembers, csv mapping payload).
//   - Composite (projectId,id) PK for line tables so per-project
//     delete-then-insert stays atomic and IDs may collide globally.
//
// We DO NOT modify seed.ts — this preserves the documented "seed is the
// canonical demo dataset" contract. Hydration mutates the in-memory
// constants in place at boot from the persisted DB rows.

import {
  pgTable,
  text,
  doublePrecision,
  integer,
  boolean,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// -- projects ----------------------------------------------------------------
// Mirrors the PROJECTS array in seed.ts. The shape there is loosely-typed
// (no exported Project interface) so this column list is deliberately
// permissive — every field except `id` may be NULL so a partially-shaped
// project (e.g. a freshly-scaffolded synthesized project) can round-trip.
export const projectsTable = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    nameEs: text("name_es").notNull(),
    clientName: text("client_name").notNull(),
    location: text("location").notNull(),
    city: text("city").notNull(),
    phase: text("phase").notNull(),
    phaseLabel: text("phase_label").notNull(),
    phaseLabelEs: text("phase_label_es").notNull(),
    phaseNumber: integer("phase_number").notNull(),
    progressPercent: doublePrecision("progress_percent").notNull(),
    budgetAllocated: doublePrecision("budget_allocated").notNull(),
    budgetUsed: doublePrecision("budget_used").notNull(),
    startDate: text("start_date").notNull(),
    estimatedEndDate: text("estimated_end_date").notNull(),
    description: text("description").notNull(),
    coverImage: text("cover_image").notNull(),
    asanaGid: text("asana_gid"),
    gammaReportUrl: text("gamma_report_url"),
    teamMembers: jsonb("team_members").$type<string[]>().notNull(),
    status: text("status").notNull(),
    clientUserId: text("client_user_id"),
    clientPhone: text("client_phone"),
    clientPostalAddress: text("client_postal_address"),
    clientPhysicalAddress: text("client_physical_address"),
    currentStatusNote: text("current_status_note"),
    currentStatusNoteEs: text("current_status_note_es"),
    squareMeters: doublePrecision("square_meters"),
    bathrooms: integer("bathrooms"),
    kitchens: integer("kitchens"),
    projectType: text("project_type"),
    contingencyPercent: doublePrecision("contingency_percent"),
  },
);

// -- project_tasks -----------------------------------------------------------
export const projectTasksTable = pgTable(
  "project_tasks",
  {
    projectId: text("project_id").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    titleEs: text("title_es").notNull(),
    dueDate: text("due_date").notNull(),
    completed: boolean("completed").notNull(),
    assignee: text("assignee").notNull(),
    priority: text("priority").notNull(),
    phase: text("phase").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.id] }),
    index("project_tasks_project_id_idx").on(t.projectId),
  ],
);

// -- leads -------------------------------------------------------------------
export const leadsTable = pgTable("leads", {
  id: text("id").primaryKey(),
  position: integer("position").notNull().default(0),
  source: text("source").notNull(),
  projectType: text("project_type").notNull(),
  location: text("location").notNull(),
  budgetRange: text("budget_range").notNull(),
  terrainStatus: text("terrain_status").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  score: integer("score").notNull(),
  status: text("status").notNull(),
  bookingType: text("booking_type"),
  bookingSlot: text("booking_slot"),
  bookingLabel: text("booking_label"),
  asanaGid: text("asana_gid"),
});

// -- project_inspections -----------------------------------------------------
export const projectInspectionsTable = pgTable(
  "project_inspections",
  {
    projectId: text("project_id").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    titleEs: text("title_es").notNull(),
    inspector: text("inspector").notNull(),
    scheduledDate: text("scheduled_date").notNull(),
    completedDate: text("completed_date"),
    status: text("status").notNull(),
    notes: text("notes"),
    notesEs: text("notes_es"),
    reportSentTo: text("report_sent_to"),
    reportSentToName: text("report_sent_to_name"),
    reportSentAt: text("report_sent_at"),
    reportSentNote: text("report_sent_note"),
    reportDocumentUrl: text("report_document_url"),
    reportDocumentName: text("report_document_name"),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.id] }),
    index("project_inspections_project_id_idx").on(t.projectId),
  ],
);

// -- project_change_orders ---------------------------------------------------
export const projectChangeOrdersTable = pgTable(
  "project_change_orders",
  {
    projectId: text("project_id").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    number: text("number").notNull(),
    title: text("title").notNull(),
    titleEs: text("title_es").notNull(),
    description: text("description").notNull(),
    descriptionEs: text("description_es").notNull(),
    amountDelta: doublePrecision("amount_delta").notNull(),
    scheduleImpactDays: integer("schedule_impact_days").notNull(),
    reason: text("reason").notNull(),
    reasonEs: text("reason_es").notNull(),
    requestedBy: text("requested_by").notNull(),
    requestedAt: text("requested_at").notNull(),
    status: text("status").notNull(),
    decidedBy: text("decided_by"),
    decidedAt: text("decided_at"),
    decisionNote: text("decision_note"),
    outsideOfScope: boolean("outside_of_scope").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.id] }),
    index("project_change_orders_project_id_idx").on(t.projectId),
  ],
);

// -- user_profiles -----------------------------------------------------------
// We persist ONLY the editable contact fields touched by PATCH /me. Roles,
// passwords, names, etc. remain seed-only — those aren't user-editable.
export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  phone: text("phone"),
  postalAddress: text("postal_address"),
  physicalAddress: text("physical_address"),
});

// -- project_notifications_seen ---------------------------------------------
// Per-user "seen" flags for notification IDs. Composite PK so two writes
// targeting the same (user, notification) pair are idempotent.
export const projectNotificationsSeenTable = pgTable(
  "project_notifications_seen",
  {
    userId: text("user_id").notNull(),
    notificationId: text("notification_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.notificationId] }),
    index("project_notifications_seen_user_id_idx").on(t.userId),
  ],
);

// -- project_structured_vars -------------------------------------------------
export const projectStructuredVarsTable = pgTable("project_structured_vars", {
  projectId: text("project_id").primaryKey(),
  squareMeters: doublePrecision("square_meters").notNull(),
  zoningCode: text("zoning_code").notNull(),
  projectType: text("project_type").notNull(),
  submittedAt: text("submitted_at").notNull(),
  submittedBy: text("submitted_by").notNull(),
});

// -- project_assisted_budgets ------------------------------------------------
export const projectAssistedBudgetsTable = pgTable("project_assisted_budgets", {
  projectId: text("project_id").primaryKey(),
  low: doublePrecision("low").notNull(),
  mid: doublePrecision("mid").notNull(),
  high: doublePrecision("high").notNull(),
  currency: text("currency").notNull(),
  perSqMeterMid: doublePrecision("per_sq_meter_mid").notNull(),
});

// -- project_csv_mappings ----------------------------------------------------
// Per-project CSV column mappings, keyed by import kind
// (materials | labor | receipts). Mapping payload is `Record<string, string|null>`.
export const projectCsvMappingsTable = pgTable(
  "project_csv_mappings",
  {
    projectId: text("project_id").notNull(),
    kind: text("kind").notNull(),
    mapping: jsonb("mapping").$type<Record<string, string | null>>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.kind] }),
    index("project_csv_mappings_project_id_idx").on(t.projectId),
  ],
);

// -- pre_design_checklists ---------------------------------------------------
export const preDesignChecklistsTable = pgTable(
  "pre_design_checklists",
  {
    projectId: text("project_id").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    labelEs: text("label_es").notNull(),
    status: text("status").notNull(),
    assignee: text("assignee").notNull(),
    completedAt: text("completed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.id] }),
    index("pre_design_checklists_project_id_idx").on(t.projectId),
  ],
);

// -- project_activities ------------------------------------------------------
// The append-only activity feed (also mirrored into AUDIT_LOG, which is
// in-memory only and rebuilt at boot from these rows).
export const projectActivitiesTable = pgTable(
  "project_activities",
  {
    projectId: text("project_id").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    timestamp: text("timestamp").notNull(),
    type: text("type").notNull(),
    actor: text("actor").notNull(),
    description: text("description").notNull(),
    descriptionEs: text("description_es").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.id] }),
    index("project_activities_project_id_idx").on(t.projectId),
  ],
);

// -- lifecycle_migrations ----------------------------------------------------
// Single-row marker tracking that the one-time seed → Postgres hydration
// has already run, so we never re-import on subsequent boots even if the
// DB was wiped and re-populated by hand.
export const lifecycleMigrationsTable = pgTable("lifecycle_migrations", {
  id: text("id").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  details: text("details"),
});
