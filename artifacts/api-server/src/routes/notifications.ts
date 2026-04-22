import { Router, type IRouter } from "express";
import { PROJECTS, RECENT_ACTIVITY } from "../data/seed";
import { PROJECT_NOTES } from "./ai";
import { requireRole } from "../middlewares/require-role";

const router: IRouter = Router();

// Per-user "seen" set kept in memory for the demo session.
const SEEN: Map<string, Set<string>> = new Map();

function seenSetFor(userId: string): Set<string> {
  let set = SEEN.get(userId);
  if (!set) { set = new Set(); SEEN.set(userId, set); }
  return set;
}

function clientOwnsProject(userId: string, projectId: string): boolean {
  const p = PROJECTS.find((x) => x.id === projectId) as { clientUserId?: string } | undefined;
  return !!(p?.clientUserId === userId);
}

interface NotificationItem {
  id: string;
  type: "document_upload" | "task_completed" | "phase_change" | "weather_alert" | "comment" | "client_question";
  projectId: string;
  projectName: string;
  description: string;
  descriptionEs: string;
  actor: string;
  timestamp: string;
  seen: boolean;
}

function buildFor(userRole: string, userId: string): NotificationItem[] {
  const seen = seenSetFor(userId);
  const isClient = userRole === "client";

  // Base activity feed.
  const base = RECENT_ACTIVITY
    .filter((a) => !isClient || clientOwnsProject(userId, a.projectId))
    // Hide a client's own questions from their own bell.
    .filter((a) => !(isClient && a.id.startsWith("act-q-")));

  // For team users, also surface still-open client questions as standalone items.
  const openQuestionItems: NotificationItem[] = [];
  if (!isClient) {
    for (const [projectId, notes] of Object.entries(PROJECT_NOTES)) {
      const project = PROJECTS.find((p) => p.id === projectId);
      for (const n of notes) {
        if (n.type !== "client_question" || n.status !== "open") continue;
        const id = `q-${n.id}`;
        // De-dupe with the activity feed's act-q- entry — prefer this richer item.
        openQuestionItems.push({
          id,
          type: "client_question",
          projectId,
          projectName: project?.name ?? projectId,
          description: `Open question from ${n.createdBy}: "${n.text.slice(0, 80)}${n.text.length > 80 ? "…" : ""}"`,
          descriptionEs: `Pregunta abierta de ${n.createdBy}: "${n.text.slice(0, 80)}${n.text.length > 80 ? "…" : ""}"`,
          actor: n.createdBy,
          timestamp: n.createdAt,
          seen: seen.has(id),
        });
      }
    }
  }

  const baseItems: NotificationItem[] = base.map((a) => ({
    id: a.id,
    type: a.type,
    projectId: a.projectId,
    projectName: a.projectName,
    description: a.description,
    descriptionEs: a.descriptionEs,
    actor: a.actor,
    timestamp: a.timestamp,
    seen: seen.has(a.id),
  }));

  // For team users, drop the duplicate act-q- entries when a richer q- item exists.
  const richIds = new Set(openQuestionItems.map((i) => i.id.replace(/^q-/, "act-q-")));
  const baseDeduped = baseItems.filter((i) => !richIds.has(i.id));

  return [...openQuestionItems, ...baseDeduped]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);
}

router.get("/notifications", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const user = (req as { user?: { id: string; role: string } }).user!;
  const items = buildFor(user.role, user.id);
  const unread = items.filter((i) => !i.seen).length;
  res.json({ items, unread });
});

router.post("/notifications/:id/seen", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const user = (req as { user?: { id: string } }).user!;
  const id = req.params["id"] as string;
  seenSetFor(user.id).add(id);
  res.json({ ok: true });
});

router.post("/notifications/seen-all", requireRole(["team", "admin", "superadmin", "architect", "client"]), (req, res) => {
  const user = (req as { user?: { id: string; role: string } }).user!;
  const set = seenSetFor(user.id);
  for (const it of buildFor(user.role, user.id)) set.add(it.id);
  res.json({ ok: true });
});

export default router;
