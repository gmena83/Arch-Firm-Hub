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
  let docs = DOCUMENTS[projectId as keyof typeof DOCUMENTS] ?? [];

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

export default router;
