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

type ProjectRecord = (typeof PROJECTS)[number];

const router: IRouter = Router();

router.get("/leads", requireRole("admin", "architect", "superadmin"), (_req, res) => {
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

router.post("/leads", (req, res) => {
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
  res.status(201).json(lead);
});

// Track lead -> project for idempotency
const ACCEPTED_LEAD_PROJECTS = new Map<string, string>();

router.post("/leads/:id/accept", requireRole("admin", "architect", "superadmin"), (req, res) => {
  const lead = LEADS.find((l) => l.id === req.params["id"]);
  if (!lead) {
    res.status(404).json({ error: "not_found", message: "Lead not found" });
    return;
  }
  const acceptBody = (req.body ?? {}) as Record<string, unknown>;

  // Idempotent: if already accepted, return the existing project
  if (lead.status === "accepted") {
    const existingProjectId = ACCEPTED_LEAD_PROJECTS.get(lead.id);
    const existingProject = existingProjectId
      ? PROJECTS.find((p) => p.id === existingProjectId)
      : undefined;
    if (existingProject) {
      res.status(200).json({
        lead,
        project: existingProject,
        asanaGid: lead.asanaGid ?? "",
        asanaMessage: `Lead already accepted (ASANA gid: ${lead.asanaGid ?? "n/a"})`,
      });
      return;
    }
    // Fall through if no project recorded (shouldn't happen)
  }

  lead.status = "accepted";
  lead.asanaGid = `12345678${Math.floor(Math.random() * 90000 + 10000)}`;

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
  };
  PROJECTS.push(newProject);
  ACCEPTED_LEAD_PROJECTS.set(lead.id, projectId);
  // Scaffold full per-project state so the new project can be driven through
  // the entire lifecycle (pre-design checklist, design stepper, signatures,
  // permit items, calculator/cost-plus/inspections/milestones).
  scaffoldSynthesizedProjectState(projectId);

  res.json({
    lead,
    project: newProject,
    asanaGid: lead.asanaGid,
    asanaMessage: `ASANA task created (gid: ${lead.asanaGid})`,
  });
});

export default router;
