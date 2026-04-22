import { Router, type IRouter } from "express";
import {
  PROJECTS,
  PROJECT_TASKS,
  WEATHER_DATA,
  DOCUMENTS,
  CALCULATOR_ENTRIES,
  MATERIALS,
  PRE_DESIGN_CHECKLISTS,
  PROJECT_ACTIVITIES,
  PROJECT_STRUCTURED_VARS,
  PROJECT_ASSISTED_BUDGETS,
  WEEKLY_REPORTS,
  PHASE_ORDER,
  appendActivity,
  computeAssistedBudget,
  PROJECT_DESIGN_STATE,
  DESIGN_SUB_PHASE_ORDER,
  DESIGN_SUB_PHASE_LABELS,
  PROJECT_PROPOSALS,
  PROJECT_CHANGE_ORDERS,
  PROJECT_PERMIT_AUTHORIZATIONS,
  PROJECT_REQUIRED_SIGNATURES,
  PROJECT_PERMIT_ITEMS,
  PERMIT_ITEM_STATE_ORDER,
  PROJECT_COST_PLUS,
  PROJECT_INSPECTIONS,
  STRUCTURAL_ENGINEERS,
  PROJECT_MILESTONES,
  type Inspection,
  type InspectionType,
  type InspectionStatus,
  type Milestone,
  type MilestoneStatus,
  type ChecklistStatus,
  type DesignSubPhase,
  type DesignDeliverableStatus,
  type ChangeOrder,
  type PermitItemState,
} from "../data/seed";
import { requireRole } from "../middlewares/require-role";

const router: IRouter = Router();

// Phase labels for UI sync — mirrors PHASE_LABELS_MAP in seed.ts
import { PHASE_LABELS_MAP } from "../data/seed";
const PHASE_LABELS = PHASE_LABELS_MAP;

const VALID_CHECKLIST_STATUS: ChecklistStatus[] = ["pending", "in_progress", "done"];
const VALID_PROJECT_TYPES = ["residencial", "comercial", "mixto", "contenedor"] as const;
const VALID_ZONING = /^[A-Z]{1,3}-[0-9]{1,2}$/;

// Demo project ownership: maps client user ids to the projects they own.
// The demo client account is associated with all three sample projects so
// reviewers can exercise both the consultation gate and the in-flight project
// views from a single login.
function clientCanAccessProject(userId: string, projectId: string): boolean {
  const project = PROJECTS.find((p) => p.id === projectId) as { clientUserId?: string } | undefined;
  if (!project || !project.clientUserId) return false;
  return project.clientUserId === userId;
}

router.get("/projects", (_req, res) => {
  return res.json(PROJECTS);
});

router.get("/projects/:projectId", (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["projectId"]);
  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }
  return res.json(project);
});

router.get("/projects/:projectId/tasks", (req, res) => {
  const tasks = PROJECT_TASKS[req.params["projectId"] as keyof typeof PROJECT_TASKS] ?? [];
  return res.json(tasks);
});

router.get("/projects/:projectId/weather", (req, res) => {
  const weather = WEATHER_DATA[req.params["projectId"] as keyof typeof WEATHER_DATA];
  if (!weather) {
    res.status(404).json({ error: "not_found", message: "Weather data not found for project" });
    return;
  }
  return res.json({ ...weather, lastUpdated: new Date().toISOString() });
});

router.get("/projects/:projectId/documents", (req, res) => {
  const projectId = req.params["projectId"];
  const clientVisible = req.query["clientVisible"];
  let docs = (DOCUMENTS[projectId as keyof typeof DOCUMENTS] ?? []) as Array<{
    id: string; projectId: string; name: string; type: string; category: string;
    isClientVisible: boolean; uploadedBy: string; uploadedAt: string; fileSize: string; description: string;
  }>;

  if (clientVisible === "true") {
    docs = docs.filter((d) => d.isClientVisible);
  } else if (clientVisible === "false") {
    docs = docs.filter((d) => !d.isClientVisible);
  }

  return res.json(docs);
});

router.get("/projects/:projectId/calculations", (req, res) => {
  const projectId = req.params["projectId"];
  const entries = CALCULATOR_ENTRIES[projectId as keyof typeof CALCULATOR_ENTRIES] ?? [];

  const subtotalByCategory: Record<string, number> = {};
  let grandTotal = 0;

  for (const entry of entries) {
    subtotalByCategory[entry.category] = (subtotalByCategory[entry.category] ?? 0) + entry.lineTotal;
    grandTotal += entry.lineTotal;
  }

  return res.json({ projectId, entries, subtotalByCategory, grandTotal });
});

router.get("/materials", (req, res) => {
  const category = req.query["category"] as string | undefined;
  const materials = category
    ? MATERIALS.filter((m) => m.category === category)
    : MATERIALS;
  return res.json(materials);
});

let cachedPrices: { prices: Array<{ id: string; item: string; suggestedPrice: number; source: string }>; refreshedAt: string; source: string; cached: boolean } | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000;

router.post("/materials/prices/refresh", async (req, res) => {
  const perplexityKey = process.env["PERPLEXITY_API_KEY"];
  if (!perplexityKey) {
    res.status(501).json({ error: "perplexity_not_configured", message: "Perplexity API key not configured" });
    return;
  }

  const category = req.query["category"] as string | undefined;

  if (!category && cachedPrices && Date.now() < cacheExpiresAt) {
    res.json({ ...cachedPrices, cached: true });
    return;
  }

  const filteredMaterials = category
    ? MATERIALS.filter((m) => m.category === category)
    : MATERIALS;

  const materialList = filteredMaterials
    .map((m) => `- ${m.id}: ${m.item} (unit: ${m.unit})`)
    .join("\n");

  const prompt = `You are a construction materials pricing assistant for Puerto Rico. Look up current retail prices from Home Depot (USA/Puerto Rico) for each of the following construction materials. Return a JSON array only, no markdown, no explanation.

For each material, return an object with:
- "id": the exact ID provided
- "item": the material name
- "suggestedPrice": a realistic current retail price (number, in USD)
- "source": "Home Depot (estimated)"

Materials to price:
${materialList}

Respond with ONLY a valid JSON array. No code fences. No extra text.`;

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a construction materials pricing assistant. Always respond with valid JSON arrays only." },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, errText }, "Perplexity API error");
      res.status(502).json({ error: "perplexity_error", message: "Perplexity API request failed" });
      return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";

    let rawPrices: unknown[] = [];
    try {
      const cleaned = content.replace(/```json|```/g, "").trim();
      rawPrices = JSON.parse(cleaned);
      if (!Array.isArray(rawPrices)) throw new Error("Not an array");
    } catch {
      req.log.error({ content }, "Failed to parse Perplexity response as JSON");
      res.status(502).json({ error: "parse_error", message: "Could not parse pricing data from AI response" });
      return;
    }

    const knownIds = new Set(filteredMaterials.map((m) => m.id));
    const prices: Array<{ id: string; item: string; suggestedPrice: number; source: string }> = [];
    for (const entry of rawPrices) {
      if (
        typeof entry !== "object" || entry === null ||
        typeof (entry as Record<string, unknown>)["id"] !== "string" ||
        typeof (entry as Record<string, unknown>)["item"] !== "string" ||
        typeof (entry as Record<string, unknown>)["suggestedPrice"] !== "number" ||
        !isFinite((entry as Record<string, unknown>)["suggestedPrice"] as number) ||
        (entry as Record<string, unknown>)["suggestedPrice"] as number <= 0 ||
        !knownIds.has((entry as Record<string, unknown>)["id"] as string)
      ) {
        req.log.warn({ entry }, "Skipping invalid price entry from Perplexity");
        continue;
      }
      prices.push({
        id: (entry as Record<string, unknown>)["id"] as string,
        item: (entry as Record<string, unknown>)["item"] as string,
        suggestedPrice: (entry as Record<string, unknown>)["suggestedPrice"] as number,
        source: typeof (entry as Record<string, unknown>)["source"] === "string"
          ? (entry as Record<string, unknown>)["source"] as string
          : "Home Depot (estimated)",
      });
    }

    if (prices.length === 0) {
      req.log.error({ content }, "No valid prices returned from Perplexity");
      res.status(502).json({ error: "parse_error", message: "No valid prices returned from AI" });
      return;
    }

    const result = {
      prices,
      refreshedAt: new Date().toISOString(),
      source: "Home Depot via Perplexity AI (sonar) · Prices sourced from public listings",
      cached: false,
    };

    if (!category) {
      cachedPrices = result;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Perplexity fetch error");
    res.status(502).json({ error: "perplexity_error", message: "Failed to reach Perplexity API" });
  }
});

router.post("/projects/:id/pdf", async (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }

  const pdfApiKey = process.env["PDF_CO_API_KEY"];
  if (!pdfApiKey) {
    res.status(501).json({ error: "pdf_not_configured", message: "PDF export not configured" });
    return;
  }

  const reportUrl = process.env["REPLIT_DEV_DOMAIN"]
    ? `https://${process.env["REPLIT_DEV_DOMAIN"]}/projects/${project.id}/report`
    : `http://localhost:${process.env["PORT"] ?? 8080}/projects/${project.id}/report`;

  try {
    const pdfResponse = await fetch("https://api.pdf.co/v1/pdf/convert/from/url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": pdfApiKey,
      },
      body: JSON.stringify({
        url: reportUrl,
        name: `KONTi-Report-${project.name.replace(/\s+/g, "-")}.pdf`,
        async: false,
        printBackground: true,
        landscape: false,
        paperSize: "Letter",
      }),
    });

    if (!pdfResponse.ok) {
      req.log.error({ status: pdfResponse.status }, "PDF.co API request failed");
      res.status(500).json({ error: "pdf_error", message: "PDF generation failed" });
      return;
    }

    const pdfData = await pdfResponse.json() as { url?: string; error?: boolean; message?: string };

    if (!pdfData.url || pdfData.error) {
      req.log.error({ pdfData }, "PDF.co did not return a URL");
      res.status(500).json({ error: "pdf_error", message: "PDF generation failed" });
      return;
    }

    const fileResponse = await fetch(pdfData.url);
    if (!fileResponse.ok || !fileResponse.body) {
      res.status(500).json({ error: "pdf_download_error", message: "Failed to fetch generated PDF" });
      return;
    }

    const safeName = project.name.replace(/[^a-zA-Z0-9\-_]/g, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="KONTi-Report-${safeName}.pdf"`);

    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(fileResponse.body as import("stream/web").ReadableStream);
    nodeStream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "PDF export error");
    res.status(500).json({ error: "pdf_error", message: "PDF generation failed" });
  }
});

// ---------------------------------------------------------------------------
// Phase 2 — Pre-Design & Viability endpoints
// ---------------------------------------------------------------------------

router.get("/projects/:id/pre-design", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const user = (req as { user?: { id: string; role: string } }).user;
  if (user?.role === "client" && !clientCanAccessProject(user.id, project.id)) {
    return res.status(403).json({ error: "forbidden", message: "Client cannot access this project" });
  }
  return res.json({
    projectId: project.id,
    checklist: PRE_DESIGN_CHECKLISTS[project.id] ?? [],
    structuredVariables: PROJECT_STRUCTURED_VARS[project.id] ?? null,
    assistedBudgetRange: PROJECT_ASSISTED_BUDGETS[project.id] ?? null,
    weeklyReports: WEEKLY_REPORTS[project.id] ?? [],
    activities: PROJECT_ACTIVITIES[project.id] ?? [],
  });
});

router.post("/projects/:id/checklist-toggle", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const { itemId, status } = req.body ?? {};
  if (typeof itemId !== "string" || !VALID_CHECKLIST_STATUS.includes(status)) {
    return res.status(400).json({ error: "invalid_payload", message: "itemId (string) and status (pending|in_progress|done) required" });
  }
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const list = PRE_DESIGN_CHECKLISTS[project.id];
  if (!list) return res.status(404).json({ error: "no_checklist" });
  const item = list.find((c) => c.id === itemId);
  if (!item) return res.status(404).json({ error: "item_not_found" });
  item.status = status;
  item.completedAt = status === "done" ? new Date().toISOString() : undefined;
  appendActivity(project.id, {
    type: "checklist_toggle",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `Checklist item "${item.label}" → ${status}`,
    descriptionEs: `Tarea "${item.labelEs}" → ${status}`,
  });
  return res.json({ projectId: project.id, item });
});

router.post("/projects/:id/structured-variables", requireRole(["admin", "superadmin"]), (req, res) => {
  const { squareMeters, zoningCode, projectType } = req.body ?? {};
  if (typeof squareMeters !== "number" || squareMeters <= 0 || squareMeters > 100000) {
    return res.status(400).json({ error: "invalid_square_meters" });
  }
  if (typeof zoningCode !== "string" || !VALID_ZONING.test(zoningCode)) {
    return res.status(400).json({ error: "invalid_zoning_code", message: "Format: R-3, C-2, etc." });
  }
  if (!VALID_PROJECT_TYPES.includes(projectType)) {
    return res.status(400).json({ error: "invalid_project_type" });
  }
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });

  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const vars = {
    squareMeters,
    zoningCode,
    projectType,
    submittedAt: new Date().toISOString(),
    submittedBy: actor,
  };
  PROJECT_STRUCTURED_VARS[project.id] = vars;
  const budget = computeAssistedBudget(vars);
  PROJECT_ASSISTED_BUDGETS[project.id] = budget;
  appendActivity(project.id, {
    type: "structured_variables",
    actor,
    description: `Structured variables saved: ${squareMeters} m², ${zoningCode}, ${projectType}`,
    descriptionEs: `Variables estructuradas guardadas: ${squareMeters} m², ${zoningCode}, ${projectType}`,
  });
  return res.json({ projectId: project.id, structuredVariables: vars, assistedBudgetRange: budget });
});

router.post("/projects/:id/advance-phase", requireRole(["team", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const user = (req as { user?: { id: string; name?: string; role?: string } }).user;
  const isClient = user?.role === "client";

  // Ownership gate first — non-owning clients should get 403 regardless of
  // project state, so we don't leak phase information to unauthorized callers.
  if (isClient && (!user || !clientCanAccessProject(user.id, project.id))) {
    return res.status(403).json({ error: "forbidden", message: "Client cannot advance this project" });
  }

  const idx = PHASE_ORDER.indexOf(project.phase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) {
    return res.status(400).json({ error: "cannot_advance", message: "Project is already in final phase" });
  }

  // Client gate: clients may only approve the consultation → pre_design transition.
  if (isClient && project.phase !== "consultation") {
    return res.status(400).json({ error: "client_gate_invalid", message: "Clients may only approve the consultation gate" });
  }

  const nextPhase = PHASE_ORDER[idx + 1];
  const labels = PHASE_LABELS[nextPhase];
  (project as { phase: typeof nextPhase }).phase = nextPhase;
  (project as { phaseLabel: string }).phaseLabel = labels.en;
  (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
  (project as { phaseNumber: number }).phaseNumber = idx + 2;

  const actor = user?.name ?? "Client";
  appendActivity(project.id, {
    type: "phase_change",
    actor,
    description: `Phase advanced to ${labels.en}${isClient ? " (client decision)" : ""}`,
    descriptionEs: `Fase avanzada a ${labels.es}${isClient ? " (decisión del cliente)" : ""}`,
  });

  // Simulate the automated comms that follow a client-approved consultation
  if (isClient) {
    appendActivity(project.id, {
      type: "email_sent",
      actor: "System",
      description: "Pre-Design kickoff email sent to client and team",
      descriptionEs: "Correo de inicio de Pre-Diseño enviado al cliente y al equipo",
    });
    appendActivity(project.id, {
      type: "invoice_sent",
      actor: "System",
      description: "Pre-Design & Viability Study invoice issued",
      descriptionEs: "Factura del Estudio de Pre-Diseño y Viabilidad emitida",
    });
  }

  return res.json({ project, advancedTo: nextPhase });
});

router.post("/projects/:id/decline-phase", requireRole(["client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const { reason } = req.body ?? {};
  const user = (req as { user?: { id: string; name?: string } }).user;
  if (!user || !clientCanAccessProject(user.id, project.id)) {
    return res.status(403).json({ error: "forbidden", message: "Client cannot decline this project" });
  }
  if (project.phase !== "consultation") {
    return res.status(400).json({ error: "client_gate_invalid", message: "Decline only available at the consultation gate" });
  }
  const note = typeof reason === "string" && reason.trim().length > 0 ? `: ${reason.trim().slice(0, 200)}` : "";
  appendActivity(project.id, {
    type: "phase_change",
    actor: user.name ?? "Client",
    description: `Client declined to advance to Pre-Design${note}`,
    descriptionEs: `El cliente no aprobó avanzar a Pre-Diseño${note}`,
  });
  appendActivity(project.id, {
    type: "email_sent",
    actor: "System",
    description: "Internal team notified of client decline",
    descriptionEs: "Equipo interno notificado del rechazo del cliente",
  });
  return res.json({ project, declinedAt: new Date().toISOString() });
});

router.post("/projects/:id/gamma-report", requireRole(["team"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found" });
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const reportId = `gamma-${project.id}-${Date.now()}`;
  const url = `https://gamma.app/docs/konti-${project.id}-${reportId}`;
  (project as { gammaReportUrl?: string }).gammaReportUrl = url;
  appendActivity(project.id, {
    type: "gamma_generated",
    actor: `${actor} via GAMMA`,
    description: "GAMMA presentation generated for client review",
    descriptionEs: "Presentación GAMMA generada para revisión del cliente",
  });
  return res.json({
    projectId: project.id,
    reportId,
    gammaReportUrl: url,
    url,
    generatedAt: new Date().toISOString(),
    generatedBy: "GAMMA",
    pages: 12,
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — Design sub-phases, Proposals & Change Orders
// ---------------------------------------------------------------------------

const VALID_DELIVERABLE_STATUS: DesignDeliverableStatus[] = ["pending", "in_progress", "done"];

function getProjectOr404(id: string, res: import("express").Response) {
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  return project;
}

function clientCanReadOrForbid(req: import("express").Request, res: import("express").Response, projectId: string): boolean {
  const user = (req as { user?: { id: string; role: string } }).user;
  if (user?.role === "client" && !clientCanAccessProject(user.id, projectId)) {
    res.status(403).json({ error: "forbidden", message: "Client cannot access this project" });
    return false;
  }
  return true;
}

router.get("/projects/:id/design", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  const state = PROJECT_DESIGN_STATE[project.id];
  // Derive current sub-phase from canonical project phase
  let derivedCurrent: DesignSubPhase | "complete" | null = null;
  if (DESIGN_SUB_PHASE_ORDER.includes(project.phase as DesignSubPhase)) {
    derivedCurrent = project.phase as DesignSubPhase;
  } else if (PHASE_ORDER.indexOf(project.phase) > PHASE_ORDER.indexOf("construction_documents")) {
    derivedCurrent = "complete";
  }
  const inDesign = derivedCurrent !== null;
  const stateOut = state && derivedCurrent !== null ? { ...state, currentSubPhase: derivedCurrent } : state;
  return res.json({
    projectId: project.id,
    available: !!state,
    isProjectInDesign: inDesign,
    state: stateOut ?? null,
    subPhaseOrder: DESIGN_SUB_PHASE_ORDER,
    subPhaseLabels: DESIGN_SUB_PHASE_LABELS,
    docVersionCadence: {
      schematic_design: { maxVersions: 3, label: "SD up to V3" },
      design_development: { maxVersions: 3, label: "DD up to V3" },
      construction_documents: { maxVersions: 2, label: "CD up to V2" },
    },
  });
});

router.post("/projects/:id/design/deliverable", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const { subPhase, deliverableId, status } = req.body ?? {};
  if (!DESIGN_SUB_PHASE_ORDER.includes(subPhase)) return res.status(400).json({ error: "invalid_sub_phase" });
  if (!VALID_DELIVERABLE_STATUS.includes(status)) return res.status(400).json({ error: "invalid_status" });
  const state = PROJECT_DESIGN_STATE[project.id];
  if (!state) return res.status(404).json({ error: "no_design_state" });
  const sp = state.subPhases[subPhase as DesignSubPhase];
  const item = sp.deliverables.find((d) => d.id === deliverableId);
  if (!item) return res.status(404).json({ error: "deliverable_not_found" });
  item.status = status;
  item.completedAt = status === "done" ? new Date().toISOString() : undefined;
  return res.json({ projectId: project.id, subPhase, item });
});

router.post("/projects/:id/design/advance-sub-phase", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const state = PROJECT_DESIGN_STATE[project.id];
  if (!state) return res.status(404).json({ error: "no_design_state" });
  // Resolve current sub-phase from canonical project phase
  if (!DESIGN_SUB_PHASE_ORDER.includes(project.phase as DesignSubPhase)) {
    return res.status(400).json({ error: "not_in_design", message: "Project is not currently in a design sub-phase" });
  }
  const currentSub = project.phase as DesignSubPhase;
  const idx = DESIGN_SUB_PHASE_ORDER.indexOf(currentSub);
  const current = state.subPhases[currentSub];
  const allDone = current.deliverables.every((d) => d.status === "done");
  if (!allDone) {
    return res.status(400).json({ error: "deliverables_incomplete", message: "All deliverables must be marked done before advancing" });
  }
  const now = new Date().toISOString();
  current.completedAt = now;
  const completedLabel = DESIGN_SUB_PHASE_LABELS[currentSub];
  let nextPhase: typeof project.phase;
  if (idx === DESIGN_SUB_PHASE_ORDER.length - 1) {
    state.currentSubPhase = "complete";
    nextPhase = "permits";
    appendActivity(project.id, {
      type: "sub_phase_advanced",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Design complete — ${completedLabel.en} signed off, advanced to Permits`,
      descriptionEs: `Diseño completo — ${completedLabel.es} aprobado, avanzado a Permisos`,
    });
  } else {
    const next = DESIGN_SUB_PHASE_ORDER[idx + 1];
    state.currentSubPhase = next;
    state.subPhases[next].startedAt = now;
    nextPhase = next;
    const nextLabel = DESIGN_SUB_PHASE_LABELS[next];
    appendActivity(project.id, {
      type: "sub_phase_advanced",
      actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
      description: `Advanced to ${nextLabel.en} (${completedLabel.en} complete)`,
      descriptionEs: `Avanzado a ${nextLabel.es} (${completedLabel.es} completado)`,
    });
  }
  // Sync canonical project phase
  const labels = PHASE_LABELS[nextPhase];
  (project as { phase: typeof nextPhase }).phase = nextPhase;
  (project as { phaseLabel: string }).phaseLabel = labels.en;
  (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
  (project as { phaseNumber: number }).phaseNumber = PHASE_ORDER.indexOf(nextPhase) + 1;
  return res.json({ projectId: project.id, state, project });
});

router.get("/projects/:id/proposals", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  return res.json({ projectId: project.id, proposals: PROJECT_PROPOSALS[project.id] ?? [] });
});

router.post("/projects/:id/proposals/:proposalId/approve", requireRole(["client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const user = (req as { user?: { id: string; name?: string } }).user;
  if (!user || !clientCanAccessProject(user.id, project.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  const list = PROJECT_PROPOSALS[project.id] ?? [];
  const target = list.find((p) => p.id === String(req.params["proposalId"]));
  if (!target) return res.status(404).json({ error: "proposal_not_found" });
  if (list.some((p) => p.status === "approved")) {
    return res.status(400).json({ error: "already_approved", message: "A proposal has already been approved for this project" });
  }
  // Phase gate: only approvable while the project is still in pre-design or schematic design (i.e. before permits)
  const allowedPhases = ["pre_design", "schematic_design"];
  if (!allowedPhases.includes(project.phase)) {
    return res.status(400).json({
      error: "invalid_phase",
      message: `Proposal approval is only allowed during ${allowedPhases.join(" or ")} (current: ${project.phase})`,
    });
  }
  const now = new Date().toISOString();
  for (const p of list) {
    if (p.id === target.id) {
      p.status = "approved";
      p.decidedAt = now;
      p.decidedBy = user.name ?? "Client";
    } else if (p.status === "pending") {
      p.status = "rejected";
      p.decidedAt = now;
      p.decidedBy = user.name ?? "Client";
    }
  }
  appendActivity(project.id, {
    type: "proposal_decision",
    actor: user.name ?? "Client",
    description: `Client approved "${target.title}" ($${target.totalCost.toLocaleString()})`,
    descriptionEs: `Cliente aprobó "${target.titleEs}" ($${target.totalCost.toLocaleString()})`,
  });
  appendActivity(project.id, {
    type: "email_sent",
    actor: "System",
    description: "Proposal acceptance receipt and contract draft sent",
    descriptionEs: "Recibo de aceptación de propuesta y borrador de contrato enviados",
  });
  // Approving a proposal commits the contract — auto-advance the project to Permits
  const labels = PHASE_LABELS["permits"];
  (project as { phase: "permits" }).phase = "permits";
  (project as { phaseLabel: string }).phaseLabel = labels.en;
  (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
  (project as { phaseNumber: number }).phaseNumber = PHASE_ORDER.indexOf("permits") + 1;
  appendActivity(project.id, {
    type: "phase_change",
    actor: "System",
    description: `Phase advanced to ${labels.en} (proposal approved)`,
    descriptionEs: `Fase avanzada a ${labels.es} (propuesta aprobada)`,
  });
  return res.json({ projectId: project.id, proposals: list, approved: target, project });
});

router.get("/projects/:id/change-orders", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  const orders = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const totals = {
    approvedDelta: orders.filter((o) => o.status === "approved").reduce((s, o) => s + o.amountDelta, 0),
    pendingDelta: orders.filter((o) => o.status === "pending").reduce((s, o) => s + o.amountDelta, 0),
    approvedDays: orders.filter((o) => o.status === "approved").reduce((s, o) => s + o.scheduleImpactDays, 0),
  };
  return res.json({ projectId: project.id, changeOrders: orders, totals });
});

router.post("/projects/:id/change-orders", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const { title, titleEs, description, descriptionEs, amountDelta, scheduleImpactDays, reason, reasonEs, outsideOfScope } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length < 3) return res.status(400).json({ error: "invalid_title" });
  if (typeof amountDelta !== "number" || !isFinite(amountDelta)) return res.status(400).json({ error: "invalid_amount" });
  if (typeof scheduleImpactDays !== "number" || !isFinite(scheduleImpactDays) || scheduleImpactDays < 0) {
    return res.status(400).json({ error: "invalid_schedule" });
  }
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? (PROJECT_CHANGE_ORDERS[project.id] = []);
  const number = `CO-${String(list.length + 1).padStart(3, "0")}`;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const co: ChangeOrder = {
    id: `co-${project.id}-${Date.now()}`,
    projectId: project.id,
    number,
    title: title.trim(),
    titleEs: typeof titleEs === "string" && titleEs.trim() ? titleEs.trim() : title.trim(),
    description: typeof description === "string" ? description : "",
    descriptionEs: typeof descriptionEs === "string" ? descriptionEs : (typeof description === "string" ? description : ""),
    amountDelta,
    scheduleImpactDays,
    reason: typeof reason === "string" ? reason : "",
    reasonEs: typeof reasonEs === "string" ? reasonEs : (typeof reason === "string" ? reason : ""),
    requestedBy: actor,
    requestedAt: new Date().toISOString(),
    status: "pending",
    outsideOfScope: typeof outsideOfScope === "boolean" ? outsideOfScope : false,
  };
  list.push(co);
  appendActivity(project.id, {
    type: "change_order_created",
    actor,
    description: `${number} created: ${co.title} (${amountDelta >= 0 ? "+" : "−"}$${Math.abs(amountDelta).toLocaleString()})`,
    descriptionEs: `${number} creada: ${co.titleEs} (${amountDelta >= 0 ? "+" : "−"}$${Math.abs(amountDelta).toLocaleString()})`,
  });
  return res.status(201).json({ projectId: project.id, changeOrder: co });
});

router.patch("/projects/:id/change-orders/:coId", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const co = list.find((o) => o.id === String(req.params["coId"]));
  if (!co) return res.status(404).json({ error: "change_order_not_found" });
  if (co.status !== "pending") {
    return res.status(400).json({ error: "cannot_edit_decided", message: "Only pending change orders can be edited" });
  }
  const body = (req.body ?? {}) as Partial<ChangeOrder>;
  const changes: string[] = [];
  if (typeof body.title === "string" && body.title.trim().length >= 3 && body.title.trim() !== co.title) {
    co.title = body.title.trim(); changes.push("title");
  }
  if (typeof body.titleEs === "string" && body.titleEs.trim() && body.titleEs.trim() !== co.titleEs) {
    co.titleEs = body.titleEs.trim(); changes.push("titleEs");
  }
  if (typeof body.description === "string" && body.description !== co.description) {
    co.description = body.description; changes.push("description");
  }
  if (typeof body.descriptionEs === "string" && body.descriptionEs !== co.descriptionEs) {
    co.descriptionEs = body.descriptionEs; changes.push("descriptionEs");
  }
  if (typeof body.reason === "string" && body.reason !== co.reason) {
    co.reason = body.reason; changes.push("reason");
  }
  if (typeof body.reasonEs === "string" && body.reasonEs !== co.reasonEs) {
    co.reasonEs = body.reasonEs; changes.push("reasonEs");
  }
  if (typeof body.amountDelta === "number" && isFinite(body.amountDelta) && body.amountDelta !== co.amountDelta) {
    co.amountDelta = body.amountDelta; changes.push("amount");
  }
  if (typeof body.scheduleImpactDays === "number" && isFinite(body.scheduleImpactDays) && body.scheduleImpactDays >= 0 && body.scheduleImpactDays !== co.scheduleImpactDays) {
    co.scheduleImpactDays = body.scheduleImpactDays; changes.push("schedule");
  }
  if (typeof body.outsideOfScope === "boolean" && body.outsideOfScope !== co.outsideOfScope) {
    co.outsideOfScope = body.outsideOfScope; changes.push("outsideOfScope");
  }
  if (changes.length === 0) {
    return res.status(400).json({ error: "no_changes" });
  }
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "change_order_created",
    actor,
    description: `${co.number} edited (${changes.join(", ")})`,
    descriptionEs: `${co.number} editada (${changes.join(", ")})`,
  });
  return res.json({ projectId: project.id, changeOrder: co });
});

router.delete("/projects/:id/change-orders/:coId", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const idx = list.findIndex((o) => o.id === String(req.params["coId"]));
  if (idx === -1) return res.status(404).json({ error: "change_order_not_found" });
  const co = list[idx];
  if (co.status !== "pending") {
    return res.status(400).json({ error: "cannot_delete_decided", message: "Only pending change orders can be deleted" });
  }
  list.splice(idx, 1);
  appendActivity(project.id, {
    type: "change_order_decision",
    actor: (req as { user?: { name?: string } }).user?.name ?? "Team",
    description: `${co.number} withdrawn before decision`,
    descriptionEs: `${co.number} retirada antes de la decisión`,
  });
  return res.json({ projectId: project.id, deleted: co.id });
});

// Change-order status is admin/architect-only per spec — clients have read-only access.
router.post("/projects/:id/change-orders/:coId/status", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const user = (req as { user?: { id: string; name?: string } }).user;
  const { status, note } = req.body ?? {};
  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return res.status(400).json({ error: "invalid_status" });
  }
  const list = PROJECT_CHANGE_ORDERS[project.id] ?? [];
  const co = list.find((o) => o.id === String(req.params["coId"]));
  if (!co) return res.status(404).json({ error: "change_order_not_found" });
  co.status = status;
  if (status === "pending") {
    co.decidedAt = undefined;
    co.decidedBy = undefined;
    co.decisionNote = undefined;
  } else {
    co.decidedAt = new Date().toISOString();
    co.decidedBy = user?.name ?? "Team";
    if (typeof note === "string" && note.trim()) co.decisionNote = note.trim().slice(0, 300);
  }
  appendActivity(project.id, {
    type: "change_order_decision",
    actor: user?.name ?? "Team",
    description: `${co.number} marked ${status}${co.decisionNote ? `: ${co.decisionNote}` : ""}`,
    descriptionEs: `${co.number} marcada ${status === "approved" ? "aprobada" : status === "rejected" ? "rechazada" : "pendiente"}${co.decisionNote ? `: ${co.decisionNote}` : ""}`,
  });
  return res.json({ projectId: project.id, changeOrder: co });
});

// ---------------------------------------------------------------------------
// Phase 4 — Permits Authorization Workflow
// ---------------------------------------------------------------------------

function computePermitMilestones(projectId: string) {
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[projectId] ?? { status: "none" as const, summaryAccepted: false };
  const sigs = PROJECT_REQUIRED_SIGNATURES[projectId] ?? [];
  const items = PROJECT_PERMIT_ITEMS[projectId] ?? [];
  const allSigned = sigs.length > 0 && sigs.filter((s) => s.required).every((s) => !!s.signedAt);
  const anySubmitted = items.some((i) => i.state !== "not_submitted");
  const anyInReviewLike = items.some((i) => i.state === "in_review" || i.state === "approved" || i.state === "revision_requested");
  const allApproved = items.length > 0 && items.every((i) => i.state === "approved");
  return {
    auth, sigs, items, allSigned, anySubmitted, anyInReviewLike, allApproved,
    milestones: {
      authorization: auth.status === "authorized",
      signatures: allSigned,
      submission: anySubmitted,
      review: anyInReviewLike,
      approval: allApproved,
    },
  };
}

router.get("/projects/:id/permits", requireRole(["team", "client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  if (!clientCanReadOrForbid(req, res, project.id)) return;
  const m = computePermitMilestones(project.id);
  return res.json({
    projectId: project.id,
    authorization: m.auth,
    requiredSignatures: m.sigs,
    permitItems: m.items,
    milestones: m.milestones,
    canSubmitToOgpe: m.auth.status === "authorized" && m.allSigned && m.items.some((i) => i.state === "not_submitted"),
    stateOrder: PERMIT_ITEM_STATE_ORDER,
  });
});

router.post("/projects/:id/authorize-permits", requireRole(["client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const user = (req as { user?: { id: string; name?: string } }).user;
  if (!user || !clientCanAccessProject(user.id, project.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (project.phase !== "permits") {
    return res.status(400).json({ error: "invalid_phase", message: "Project is not in the permits phase" });
  }
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[project.id] ?? (PROJECT_PERMIT_AUTHORIZATIONS[project.id] = { status: "none", summaryAccepted: false });
  if (auth.status === "authorized") {
    return res.status(400).json({ error: "already_authorized" });
  }
  auth.status = "authorized";
  auth.authorizedBy = user.name ?? "Client";
  auth.authorizedAt = new Date().toISOString();
  auth.summaryAccepted = true;
  // Capture client IP for the audit trail. Demo data is in-memory, so we
  // accept the proxied request IP and fall back to a mock placeholder.
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  auth.authorizedIpMock = fwd || req.ip || req.socket?.remoteAddress || "127.0.0.1 (mock)";
  appendActivity(project.id, {
    type: "permit_authorization",
    actor: user.name ?? "Client",
    description: "Client authorized OGPE submission packet",
    descriptionEs: "Cliente autorizó el paquete de sometimiento a OGPE",
  });
  return res.json({ projectId: project.id, authorization: auth });
});

router.post("/projects/:id/sign/:signatureId", requireRole(["client"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const user = (req as { user?: { id: string; name?: string } }).user;
  if (!user || !clientCanAccessProject(user.id, project.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (project.phase !== "permits") {
    return res.status(400).json({ error: "invalid_phase", message: "Signatures only accepted during the permits phase" });
  }
  // Sequencing: client must authorize the OGPE packet before signing forms.
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[project.id];
  if (!auth || auth.status !== "authorized") {
    return res.status(400).json({ error: "not_authorized", message: "Authorize the OGPE submission packet before signing forms" });
  }
  const { signatureName } = req.body ?? {};
  if (typeof signatureName !== "string" || signatureName.trim().length < 2) {
    return res.status(400).json({ error: "invalid_signature_name", message: "Signature name must be at least 2 characters" });
  }
  const sigs = PROJECT_REQUIRED_SIGNATURES[project.id] ?? [];
  const sig = sigs.find((s) => s.id === String(req.params["signatureId"]));
  if (!sig) return res.status(404).json({ error: "signature_not_found" });
  if (sig.signedAt) return res.status(400).json({ error: "already_signed" });
  sig.signedBy = signatureName.trim().slice(0, 100);
  sig.signedAt = new Date().toISOString();
  appendActivity(project.id, {
    type: "permit_signature",
    actor: sig.signedBy,
    description: `Signed: ${sig.formName}`,
    descriptionEs: `Firmado: ${sig.formNameEs}`,
  });
  return res.json({ projectId: project.id, signature: sig });
});

router.post("/projects/:id/permit-items/submit-to-ogpe", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const auth = PROJECT_PERMIT_AUTHORIZATIONS[project.id];
  const sigs = PROJECT_REQUIRED_SIGNATURES[project.id] ?? [];
  const items = PROJECT_PERMIT_ITEMS[project.id] ?? [];
  if (!auth || auth.status !== "authorized") {
    return res.status(400).json({ error: "not_authorized", message: "Client authorization required before submitting" });
  }
  if (!sigs.filter((s) => s.required).every((s) => !!s.signedAt)) {
    return res.status(400).json({ error: "signatures_incomplete", message: "All required signatures must be collected first" });
  }
  const now = new Date().toISOString();
  let count = 0;
  for (const it of items) {
    if (it.state === "not_submitted") {
      it.state = "submitted";
      it.lastUpdatedAt = now;
      count++;
    }
  }
  if (count === 0) {
    return res.status(400).json({ error: "nothing_to_submit", message: "All permit items have already been submitted" });
  }
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "permit_submitted",
    actor,
    description: `Submitted ${count} permit item${count === 1 ? "" : "s"} to OGPE`,
    descriptionEs: `Enviados ${count} ítem${count === 1 ? "" : "s"} de permiso a OGPE`,
  });
  return res.json({ projectId: project.id, permitItems: items, submittedCount: count });
});

router.post("/projects/:id/permit-items/:itemId/state", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = getProjectOr404(String(req.params["id"]), res);
  if (!project) return;
  const { state, revisionNote, revisionNoteEs } = req.body ?? {};
  if (!PERMIT_ITEM_STATE_ORDER.includes(state)) {
    return res.status(400).json({ error: "invalid_state" });
  }
  const items = PROJECT_PERMIT_ITEMS[project.id] ?? [];
  const item = items.find((i) => i.id === String(req.params["itemId"]));
  if (!item) return res.status(404).json({ error: "permit_item_not_found" });
  const targetState: PermitItemState = state;
  item.state = targetState;
  item.lastUpdatedAt = new Date().toISOString();
  if (targetState === "revision_requested") {
    if (typeof revisionNote === "string" && revisionNote.trim()) item.revisionNote = revisionNote.trim().slice(0, 300);
    if (typeof revisionNoteEs === "string" && revisionNoteEs.trim()) item.revisionNoteEs = revisionNoteEs.trim().slice(0, 300);
  } else if (targetState === "approved" || targetState === "submitted" || targetState === "in_review") {
    item.revisionNote = undefined;
    item.revisionNoteEs = undefined;
  }
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "permit_state_change",
    actor,
    description: `${item.name} → ${targetState}`,
    descriptionEs: `${item.nameEs} → ${targetState}`,
  });
  // Auto-advance to construction when all permit items are approved
  let advanced = false;
  if (project.phase === "permits" && items.length > 0 && items.every((i) => i.state === "approved")) {
    const labels = PHASE_LABELS["construction"];
    (project as { phase: "construction" }).phase = "construction";
    (project as { phaseLabel: string }).phaseLabel = labels.en;
    (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
    (project as { phaseNumber: number }).phaseNumber = PHASE_ORDER.indexOf("construction") + 1;
    appendActivity(project.id, {
      type: "phase_change",
      actor: "System",
      description: "All permits approved — advanced to Construction",
      descriptionEs: "Todos los permisos aprobados — avanzado a Construcción",
    });
    advanced = true;
  }
  return res.json({ projectId: project.id, permitItem: item, project, advancedToConstruction: advanced });
});

// ---------------------------------------------------------------------------
// Phase 5 — Construction: Cost-Plus, Inspections, Milestones, Engineers
// ---------------------------------------------------------------------------

const VALID_INSPECTION_TYPES: InspectionType[] = ["foundation", "framing", "electrical", "plumbing", "final"];
const VALID_INSPECTION_STATUS: InspectionStatus[] = ["scheduled", "passed", "failed", "re_inspect"];
const VALID_MILESTONE_STATUS: MilestoneStatus[] = ["completed", "in_progress", "upcoming"];

router.get("/structural-engineers", requireRole(["admin", "architect", "superadmin"]), (_req, res) => {
  res.json(STRUCTURAL_ENGINEERS);
});

router.get("/projects/:id/cost-plus", (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const cp = PROJECT_COST_PLUS[project.id];
  if (!cp) return res.status(404).json({ error: "not_found", message: "Cost-plus budget not configured" });
  return res.json(cp);
});

router.get("/projects/:id/inspections", (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_INSPECTIONS[project.id] ?? [];
  return res.json({ projectId: project.id, inspections: list });
});

router.get("/projects/:id/inspections/:insId", (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const insp = (PROJECT_INSPECTIONS[project.id] ?? []).find((i) => i.id === req.params["insId"]);
  if (!insp) return res.status(404).json({ error: "not_found", message: "Inspection not found" });
  return res.json({ projectId: project.id, inspection: insp });
});

router.post("/projects/:id/inspections", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const body = (req.body ?? {}) as Partial<Inspection>;
  if (!body.type || !VALID_INSPECTION_TYPES.includes(body.type)) {
    return res.status(400).json({ error: "validation", message: "type required" });
  }
  if (!body.title || !body.titleEs || !body.inspector || !body.scheduledDate) {
    return res.status(400).json({ error: "validation", message: "title, titleEs, inspector, scheduledDate required" });
  }
  const status: InspectionStatus = body.status && VALID_INSPECTION_STATUS.includes(body.status) ? body.status : "scheduled";
  const list = PROJECT_INSPECTIONS[project.id] ?? (PROJECT_INSPECTIONS[project.id] = []);
  const inspection: Inspection = {
    id: `ins-${project.id}-${Date.now()}`,
    projectId: project.id,
    type: body.type,
    title: body.title,
    titleEs: body.titleEs,
    inspector: body.inspector,
    scheduledDate: body.scheduledDate,
    status,
    ...(body.completedDate ? { completedDate: body.completedDate } : {}),
    ...(body.notes ? { notes: body.notes } : {}),
    ...(body.notesEs ? { notesEs: body.notesEs } : {}),
  };
  list.push(inspection);
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "inspection_scheduled",
    actor,
    description: `Inspection scheduled: ${inspection.title} (${inspection.scheduledDate})`,
    descriptionEs: `Inspección programada: ${inspection.titleEs} (${inspection.scheduledDate})`,
  });
  return res.status(201).json({ projectId: project.id, inspection });
});

router.patch("/projects/:id/inspections/:insId", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_INSPECTIONS[project.id] ?? [];
  const insp = list.find((i) => i.id === req.params["insId"]);
  if (!insp) return res.status(404).json({ error: "not_found", message: "Inspection not found" });
  const body = (req.body ?? {}) as Partial<Inspection>;
  const prevStatus = insp.status;
  if (body.status !== undefined) {
    if (!VALID_INSPECTION_STATUS.includes(body.status)) {
      return res.status(400).json({ error: "validation", message: "invalid status" });
    }
    insp.status = body.status;
    if ((body.status === "passed" || body.status === "failed") && !insp.completedDate) {
      insp.completedDate = body.completedDate ?? new Date().toISOString().slice(0, 10);
    }
  }
  if (body.scheduledDate !== undefined) insp.scheduledDate = body.scheduledDate;
  if (body.completedDate !== undefined) insp.completedDate = body.completedDate;
  if (body.inspector !== undefined) insp.inspector = body.inspector;
  if (body.notes !== undefined) insp.notes = body.notes;
  if (body.notesEs !== undefined) insp.notesEs = body.notesEs;
  if (body.title !== undefined) insp.title = body.title;
  if (body.titleEs !== undefined) insp.titleEs = body.titleEs;
  if (body.reportDocumentUrl !== undefined) insp.reportDocumentUrl = body.reportDocumentUrl;
  if (body.reportDocumentName !== undefined) insp.reportDocumentName = body.reportDocumentName;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  if (body.status !== undefined && body.status !== prevStatus) {
    appendActivity(project.id, {
      type: "inspection_status_change",
      actor,
      description: `${insp.title}: ${prevStatus} → ${insp.status}`,
      descriptionEs: `${insp.titleEs}: ${prevStatus} → ${insp.status}`,
    });
  }
  return res.json({ projectId: project.id, inspection: insp });
});

router.post("/projects/:id/inspections/:insId/send-report", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_INSPECTIONS[project.id] ?? [];
  const insp = list.find((i) => i.id === req.params["insId"]);
  if (!insp) return res.status(404).json({ error: "not_found", message: "Inspection not found" });
  if (insp.status !== "passed" && insp.status !== "failed" && insp.status !== "re_inspect") {
    return res.status(400).json({ error: "validation", message: "Report can only be sent for completed inspections" });
  }
  const body = (req.body ?? {}) as { engineerId?: string; note?: string };
  const engineer = STRUCTURAL_ENGINEERS.find((e) => e.id === body.engineerId);
  if (!engineer) return res.status(400).json({ error: "validation", message: "engineerId required" });
  insp.reportSentTo = engineer.id;
  insp.reportSentToName = engineer.name;
  insp.reportSentAt = new Date().toISOString();
  if (body.note) insp.reportSentNote = body.note;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  appendActivity(project.id, {
    type: "inspection_report_sent",
    actor,
    description: `${insp.title} report sent to ${engineer.name} (${engineer.firm})`,
    descriptionEs: `Reporte de ${insp.titleEs} enviado a ${engineer.name} (${engineer.firm})`,
  });
  return res.json({ projectId: project.id, inspection: insp });
});

router.get("/projects/:id/milestones", (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_MILESTONES[project.id] ?? [];
  return res.json({ projectId: project.id, milestones: list });
});

router.patch("/projects/:id/milestones/:milestoneId", requireRole(["admin", "architect", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["id"]);
  if (!project) return res.status(404).json({ error: "not_found", message: "Project not found" });
  const list = PROJECT_MILESTONES[project.id] ?? [];
  const m = list.find((x) => x.id === req.params["milestoneId"]);
  if (!m) return res.status(404).json({ error: "not_found", message: "Milestone not found" });
  const body = (req.body ?? {}) as Partial<Milestone>;
  const prev = m.status;
  if (body.status !== undefined) {
    if (!VALID_MILESTONE_STATUS.includes(body.status)) {
      return res.status(400).json({ error: "validation", message: "invalid status" });
    }
    m.status = body.status;
  }
  if (body.startDate !== undefined) m.startDate = body.startDate;
  if (body.endDate !== undefined) m.endDate = body.endDate;
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  if (body.status !== undefined && body.status !== prev) {
    appendActivity(project.id, {
      type: "milestone_status_change",
      actor,
      description: `Milestone ${m.title}: ${prev} → ${m.status}`,
      descriptionEs: `Hito ${m.titleEs}: ${prev} → ${m.status}`,
    });
  }
  return res.json({ projectId: project.id, milestone: m });
});

export default router;
