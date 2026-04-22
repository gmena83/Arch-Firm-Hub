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
  type ChecklistStatus,
} from "../data/seed";
import { requireRole } from "../middlewares/require-role";

const router: IRouter = Router();

// Phase labels for UI sync
const PHASE_LABELS: Record<string, { en: string; es: string }> = {
  discovery: { en: "Discovery", es: "Descubrimiento" },
  consultation: { en: "Consultation", es: "Consulta Inicial" },
  pre_design: { en: "Pre-Design & Viability", es: "Pre-Diseño y Viabilidad" },
  design: { en: "Design", es: "Diseño" },
  permits: { en: "Permits", es: "Permisos" },
  construction: { en: "Construction", es: "Construcción" },
  completed: { en: "Completed", es: "Completado" },
};

const VALID_CHECKLIST_STATUS: ChecklistStatus[] = ["pending", "in_progress", "done"];
const VALID_PROJECT_TYPES = ["residencial", "comercial", "mixto", "contenedor"] as const;
const VALID_ZONING = /^[A-Z]{1,3}-[0-9]{1,2}$/;

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
  const project = PROJECTS.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "not_found" });
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
  const project = PROJECTS.find((p) => p.id === req.params.id);
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

router.post("/projects/:id/structured-variables", requireRole(["team", "admin", "superadmin"]), (req, res) => {
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
  const project = PROJECTS.find((p) => p.id === req.params.id);
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

router.post("/projects/:id/advance-phase", requireRole(["team", "admin", "superadmin", "client"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "not_found" });
  const idx = PHASE_ORDER.indexOf(project.phase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) {
    return res.status(400).json({ error: "cannot_advance", message: "Project is already in final phase" });
  }
  const nextPhase = PHASE_ORDER[idx + 1];
  const labels = PHASE_LABELS[nextPhase];
  // mutate (demo state)
  (project as { phase: typeof nextPhase }).phase = nextPhase;
  (project as { phaseLabel: string }).phaseLabel = labels.en;
  (project as { phaseLabelEs: string }).phaseLabelEs = labels.es;
  (project as { phaseNumber: number }).phaseNumber = idx + 2;
  const actor = (req as { user?: { name?: string; role?: string } }).user;
  appendActivity(project.id, {
    type: "phase_change",
    actor: actor?.name ?? "Client",
    description: `Phase advanced to ${labels.en}${actor?.role === "client" ? " (client decision)" : ""}`,
    descriptionEs: `Fase avanzada a ${labels.es}${actor?.role === "client" ? " (decisión del cliente)" : ""}`,
  });
  return res.json({ project, advancedTo: nextPhase });
});

router.post("/projects/:id/gamma-report", requireRole(["team", "admin", "superadmin"]), (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "not_found" });
  const actor = (req as { user?: { name?: string } }).user?.name ?? "Team";
  const reportId = `gamma-${project.id}-${Date.now()}`;
  appendActivity(project.id, {
    type: "gamma_generated",
    actor: `${actor} via GAMMA`,
    description: "GAMMA presentation generated for client review",
    descriptionEs: "Presentación GAMMA generada para revisión del cliente",
  });
  return res.json({
    projectId: project.id,
    reportId,
    url: `/projects/${project.id}/report`,
    generatedAt: new Date().toISOString(),
    generatedBy: "GAMMA",
    pages: 12,
  });
});

export default router;
