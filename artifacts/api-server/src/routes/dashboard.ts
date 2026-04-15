import { Router, type IRouter } from "express";
import { PROJECTS, DOCUMENTS, PROJECT_TASKS, RECENT_ACTIVITY } from "../data/seed";

const router: IRouter = Router();

router.get("/dashboard/summary", (_req, res) => {
  const totalProjects = PROJECTS.length;
  const activeProjects = PROJECTS.filter((p) => p.status === "active").length;
  const completedProjects = PROJECTS.filter((p) => p.status === "completed").length;
  const totalBudget = PROJECTS.reduce((sum, p) => sum + p.budgetAllocated, 0);
  const budgetUsed = PROJECTS.reduce((sum, p) => sum + p.budgetUsed, 0);
  const totalDocuments = Object.values(DOCUMENTS).reduce((sum, docs) => sum + docs.length, 0);

  const allTasks = Object.values(PROJECT_TASKS).flat();
  const pendingTasks = allTasks.filter((t) => !t.completed).length;

  const projectsByPhase: Record<string, number> = {};
  for (const p of PROJECTS) {
    projectsByPhase[p.phase] = (projectsByPhase[p.phase] ?? 0) + 1;
  }

  res.json({
    totalProjects,
    activeProjects,
    completedProjects,
    totalBudget,
    budgetUsed,
    totalDocuments,
    pendingTasks,
    projectsByPhase,
  });
});

router.get("/dashboard/activity", (_req, res) => {
  res.json(RECENT_ACTIVITY);
});

router.get("/notifications", (_req, res) => {
  res.json(RECENT_ACTIVITY);
});

export default router;
