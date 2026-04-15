import { Router, type IRouter } from "express";
import {
  PROJECTS,
  PROJECT_TASKS,
  WEATHER_DATA,
  DOCUMENTS,
  CALCULATOR_ENTRIES,
  MATERIALS,
} from "../data/seed";

const router: IRouter = Router();

router.get("/projects", (_req, res) => {
  res.json(PROJECTS);
});

router.get("/projects/:projectId", (req, res) => {
  const project = PROJECTS.find((p) => p.id === req.params["projectId"]);
  if (!project) {
    res.status(404).json({ error: "not_found", message: "Project not found" });
    return;
  }
  res.json(project);
});

router.get("/projects/:projectId/tasks", (req, res) => {
  const tasks = PROJECT_TASKS[req.params["projectId"] as keyof typeof PROJECT_TASKS] ?? [];
  res.json(tasks);
});

router.get("/projects/:projectId/weather", (req, res) => {
  const weather = WEATHER_DATA[req.params["projectId"] as keyof typeof WEATHER_DATA];
  if (!weather) {
    res.status(404).json({ error: "not_found", message: "Weather data not found for project" });
    return;
  }
  res.json({ ...weather, lastUpdated: new Date().toISOString() });
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

  res.json(docs);
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

  res.json({ projectId, entries, subtotalByCategory, grandTotal });
});

router.get("/materials", (req, res) => {
  const category = req.query["category"] as string | undefined;
  const materials = category
    ? MATERIALS.filter((m) => m.category === category)
    : MATERIALS;
  res.json(materials);
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

    const pdfData = await pdfResponse.json() as { url?: string; error?: boolean; message?: string };

    if (!pdfData.url) {
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

export default router;
