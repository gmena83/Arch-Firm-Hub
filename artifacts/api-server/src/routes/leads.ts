import { Router, type IRouter } from "express";
import {
  LEADS,
  PROJECTS,
  scaffoldSynthesizedProjectState,
  computeLeadScore,
  type Lead,
  type LeadProjectType,
  type LeadBudget,
  type LeadTerrain,
  type LeadSource,
  type BookingType,
} from "../data/seed";
import { requireRole } from "../middlewares/require-role";
import { getAsanaConfig, isAsanaEnabled } from "../lib/integrations-config";
import { createTask } from "../lib/asana-client";
import { logger } from "../lib/logger";
import {
  persistLeadsToDb,
  persistProjectsToDb,
  persistPreDesignChecklistForProject,
  persistInspectionsForProject,
  persistChangeOrdersForProject,
  persistActivitiesForProject,
} from "../lib/lifecycle-persistence";

type ProjectRecord = (typeof PROJECTS)[number];

const router: IRouter = Router();

router.get("/leads", requireRole("admin", "architect", "superadmin"), async (_req, res) => {
  // Sort newest first when equal score
  const sorted = [...LEADS].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.createdAt.localeCompare(a.createdAt);
  });
  res.json(sorted);
});

const VALID_SOURCES: LeadSource[] = ["website", "social", "referral", "media", "events"];
const VALID_TYPES: LeadProjectType[] = ["residencial", "comercial", "mixto", "contenedor"];
const VALID_BUDGETS: LeadBudget[] = ["under_150k", "150k_300k", "300k_500k", "500k_1m", "over_1m"];
const VALID_TERRAINS: LeadTerrain[] = ["no_terrain", "with_terrain", "with_plans"];
const VALID_BOOKING_TYPES: BookingType[] = ["consultation_30min", "weekly_seminar"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/leads", async (req, res) => {
  const body = req.body as {
    source: LeadSource;
    projectType: LeadProjectType;
    location: string;
    budgetRange: LeadBudget;
    terrainStatus: LeadTerrain;
    contactName: string;
    email: string;
    phone: string;
    notes?: string;
    booking?: { type: BookingType; slot: string; label: string };
  };

  if (
    !body.source || !body.projectType || !body.location ||
    !body.budgetRange || !body.terrainStatus ||
    !body.contactName || !body.email || !body.phone
  ) {
    res.status(400).json({ error: "bad_request", message: "Missing required fields" });
    return;
  }
  if (!VALID_SOURCES.includes(body.source)) {
    res.status(400).json({ error: "bad_request", message: "Invalid source" });
    return;
  }
  if (!VALID_TYPES.includes(body.projectType)) {
    res.status(400).json({ error: "bad_request", message: "Invalid projectType" });
    return;
  }
  if (!VALID_BUDGETS.includes(body.budgetRange)) {
    res.status(400).json({ error: "bad_request", message: "Invalid budgetRange" });
    return;
  }
  if (!VALID_TERRAINS.includes(body.terrainStatus)) {
    res.status(400).json({ error: "bad_request", message: "Invalid terrainStatus" });
    return;
  }
  if (!EMAIL_RE.test(body.email) || body.email.length > 200) {
    res.status(400).json({ error: "bad_request", message: "Invalid email" });
    return;
  }
  if (typeof body.contactName !== "string" || body.contactName.length > 200 ||
      typeof body.phone !== "string" || body.phone.length > 50 ||
      typeof body.location !== "string" || body.location.length > 200) {
    res.status(400).json({ error: "bad_request", message: "Field length exceeded" });
    return;
  }
  if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 2000)) {
    res.status(400).json({ error: "bad_request", message: "Invalid notes" });
    return;
  }
  if (body.booking !== undefined) {
    if (!body.booking || !VALID_BOOKING_TYPES.includes(body.booking.type) ||
        typeof body.booking.slot !== "string" || isNaN(Date.parse(body.booking.slot)) ||
        typeof body.booking.label !== "string" || body.booking.label.length > 200) {
      res.status(400).json({ error: "bad_request", message: "Invalid booking" });
      return;
    }
  }

  const id = `lead-${Date.now()}`;
  const score = computeLeadScore({
    projectType: body.projectType,
    budgetRange: body.budgetRange,
    location: body.location,
    terrainStatus: body.terrainStatus,
  });

  const lead: Lead = {
    id,
    source: body.source,
    projectType: body.projectType,
    location: body.location,
    budgetRange: body.budgetRange,
    terrainStatus: body.terrainStatus,
    contactName: body.contactName,
    email: body.email,
    phone: body.phone,
    notes: body.notes,
    createdAt: new Date().toISOString(),
    score,
    status: "new",
    booking: body.booking,
  };

  LEADS.unshift(lead);
  // Task #144 — persist the new lead row before responding 201 so a
  // crash-after-ack cannot lose acknowledged leads.
  try { await persistLeadsToDb(); }
  catch {
    res.status(500).json({ error: "persist_failed", message: "Lead was captured in memory but failed to save. Please retry." });
    return;
  }
  res.status(201).json(lead);
});

// Task #147 — in-memory cache only. The durable lead → project link is
// the `leadId` column on the projects table; this map is just a fast
// lookup populated as accepts happen in the current process. After a
// restart the map is empty, but the accept handler falls back to a
// scan over PROJECTS keyed by `leadId` so idempotency still holds.
const ACCEPTED_LEAD_PROJECTS = new Map<string, string>();

function findProjectForAcceptedLead(leadId: string): ProjectRecord | undefined {
  const cachedId = ACCEPTED_LEAD_PROJECTS.get(leadId);
  if (cachedId) {
    const cached = PROJECTS.find((p) => p.id === cachedId);
    if (cached) return cached;
  }
  // Cache miss (cold start after restart) — scan PROJECTS for the
  // persisted leadId column. Hydrate the cache on hit so subsequent
  // calls in the same process are O(1).
  const found = PROJECTS.find((p) => (p as Record<string, unknown>)["leadId"] === leadId);
  if (found) ACCEPTED_LEAD_PROJECTS.set(leadId, found.id);
  return found;
}

router.post("/leads/:id/accept", requireRole("admin", "architect", "superadmin"), async (req, res) => {
  const lead = LEADS.find((l) => l.id === req.params["id"]);
  if (!lead) {
    res.status(404).json({ error: "not_found", message: "Lead not found" });
    return;
  }
  const acceptBody = (req.body ?? {}) as Record<string, unknown>;

  // Idempotent: if already accepted, look up the original synthesized
  // project. The lookup uses the persisted `leadId` column so it survives
  // a restart — see findProjectForAcceptedLead above.
  if (lead.status === "accepted") {
    const existingProject = findProjectForAcceptedLead(lead.id);
    if (existingProject) {
      res.status(200).json({
        lead,
        project: existingProject,
        asanaGid: lead.asanaGid ?? "",
        asanaMessage: `Lead already accepted (ASANA gid: ${lead.asanaGid ?? "n/a"})`,
      });
      return;
    }
    // The lead is marked accepted but the project row is gone (e.g. the
    // operator deleted it manually). Refuse to silently synthesize a
    // duplicate — the team must reset the lead status before re-accepting.
    res.status(409).json({
      error: "already_accepted_orphan",
      message: "This lead is already marked accepted but the original project was not found. Reset the lead before re-accepting.",
      messageEs: "Este lead ya está marcado como aceptado pero no se encontró el proyecto original. Restablezca el lead antes de volver a aceptarlo.",
    });
    return;
  }

  lead.status = "accepted";
  // Task #127 — when the Asana integration is configured, create a real
  // Asana task and stamp the returned gid on both the lead and project.
  // Otherwise fall back to the demo stub so the rest of the flow still works.
  let asanaMessageEn = "";
  let asanaMessageEs = "";
  if (isAsanaEnabled()) {
    const cfg = getAsanaConfig();
    const taskName = `${lead.contactName} — ${lead.projectType} (${lead.location})`;
    const notes = [
      `KONTi lead accepted from ${lead.source}.`,
      `Budget range: ${lead.budgetRange}. Land status: ${lead.terrainStatus}.`,
      `Phone: ${lead.phone} · Email: ${lead.email}`,
      lead.notes ? `Notes: ${lead.notes}` : "",
    ].filter(Boolean).join("\n");
    try {
      const task = await createTask({
        name: taskName,
        notes,
        workspaceGid: cfg.workspaceGid as string,
        boardGid: cfg.boardGid as string,
        ...(cfg.defaultAssigneeGid ? { assigneeGid: cfg.defaultAssigneeGid } : {}),
      });
      lead.asanaGid = task.gid;
      asanaMessageEn = `ASANA task created (gid: ${task.gid})`;
      asanaMessageEs = `Tarea ASANA creada (gid: ${task.gid})`;
    } catch (err) {
      logger.warn({ err: (err as Error).message, leadId: lead.id }, "lead-accept: Asana createTask failed; falling back to stub");
      lead.asanaGid = `12345678${Math.floor(Math.random() * 90000 + 10000)}`;
      asanaMessageEn = `Asana unavailable; using local stub gid ${lead.asanaGid}`;
      asanaMessageEs = `Asana no disponible; usando gid local ${lead.asanaGid}`;
    }
  } else {
    lead.asanaGid = `12345678${Math.floor(Math.random() * 90000 + 10000)}`;
    asanaMessageEn = `ASANA task created (gid: ${lead.asanaGid})`;
    asanaMessageEs = `Tarea ASANA creada (gid: ${lead.asanaGid})`;
  }

  // Synthesize a discovery-phase project (in-memory only)
  const projectId = `proj-${Date.now()}`;
  const newProject: ProjectRecord = {
    id: projectId,
    name: `Discovery — ${lead.contactName}`,
    nameEs: `Descubrimiento — ${lead.contactName}`,
    clientName: lead.contactName,
    location: lead.location,
    city: lead.location.split(",")[0]?.trim() ?? lead.location,
    phase: "discovery" as const,
    phaseLabel: "Discovery & Pre-Design",
    phaseLabelEs: "Descubrimiento y Pre-Diseño",
    phaseNumber: 1,
    progressPercent: 5,
    budgetAllocated: 0,
    budgetUsed: 0,
    startDate: new Date().toISOString().slice(0, 10),
    estimatedEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    description: lead.notes ?? `New ${lead.projectType} project from ${lead.source} lead.`,
    coverImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&auto=format&fit=crop",
    asanaGid: lead.asanaGid,
    gammaReportUrl: `/projects/${projectId}/report`,
    teamMembers: ["Carla Gautier"],
    status: "active" as const,
    clientUserId: typeof acceptBody["clientUserId"] === "string" ? acceptBody["clientUserId"] : "user-client-1",
    clientPhone: "",
    clientPostalAddress: "",
    clientPhysicalAddress: "",
    currentStatusNote: "",
    currentStatusNoteEs: "",
    // B-05: project metadata defaults — team can refine on Project Detail.
    squareMeters: 0,
    bathrooms: 0,
    kitchens: 0,
    projectType: lead.projectType,
    contingencyPercent: 8,
  };
  // Task #147 — stamp the durable lead → project link so the projects
  // row carries it through `persistProjectsToDb()` below. After a
  // restart, `findProjectForAcceptedLead()` rebuilds the in-memory map
  // from this column.
  (newProject as Record<string, unknown>)["leadId"] = lead.id;
  PROJECTS.push(newProject);
  ACCEPTED_LEAD_PROJECTS.set(lead.id, projectId);
  // Scaffold full per-project state so the new project can be driven through
  // the entire lifecycle (pre-design checklist, design stepper, signatures,
  // permit items, calculator/cost-plus/inspections/milestones).
  scaffoldSynthesizedProjectState(projectId);

  // Task #144 — persist BOTH the updated lead (status flip + asanaGid) AND
  // the synthesized project (plus every lifecycle-backed store the
  // scaffold writes into: pre-design checklist, inspections, change orders,
  // initial activity) before we ack 200 so a crash cannot lose any side
  // of the acceptance.
  try {
    await Promise.all([
      persistProjectsToDb(),
      persistLeadsToDb(),
      persistPreDesignChecklistForProject(projectId),
      persistInspectionsForProject(projectId),
      persistChangeOrdersForProject(projectId),
      persistActivitiesForProject(projectId),
    ]);
  } catch {
    return res.status(500).json({ error: "persist_failed", message: "Lead acceptance was applied in memory but failed to save. Please retry." });
  }

  res.json({
    lead,
    project: newProject,
    asanaGid: lead.asanaGid,
    asanaMessage: asanaMessageEn,
    asanaMessageEs,
  });
});

export default router;
