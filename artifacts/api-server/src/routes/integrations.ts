// Settings → Integrations API surface (Task #127).
//
// All routes are admin/superadmin gated. Read endpoints return the current
// connection state; write endpoints persist the chosen workspace + board so
// the sync queue can drain into Asana.

import { Router, type IRouter } from "express";
import { requireRole } from "../middlewares/require-role";
import {
  getAsanaConfig,
  updateAsanaConfig,
  getSyncLog,
  findSyncLogEntry,
  enqueueJob,
  listQueue,
} from "../lib/integrations-config";
import {
  listWorkspaces,
  listProjectsForWorkspace,
  AsanaNotConnectedError,
  AsanaApiError,
  getAsanaAccessToken,
} from "../lib/asana-client";
import { drainQueue } from "../lib/asana-sync";

const router: IRouter = Router();

const ADMIN_ROLES = ["admin", "superadmin"] as const;

// Quick "is the connector even reachable" probe. Doesn't depend on board
// configuration — used by the Settings page to render Connect / Connected.
router.get("/integrations/asana/status", requireRole([...ADMIN_ROLES]), async (_req, res) => {
  const cfg = getAsanaConfig();
  let connected = false;
  let connectionMessage = "Not connected. Use the Replit Asana connector to authorize.";
  let connectionMessageEs = "No conectado. Autoriza el conector Asana de Replit.";
  try {
    await getAsanaAccessToken();
    connected = true;
    connectionMessage = "Connector authorized.";
    connectionMessageEs = "Conector autorizado.";
  } catch (err) {
    if (err instanceof AsanaNotConnectedError) {
      connectionMessage = err.message;
    } else {
      connectionMessage = (err as Error).message ?? connectionMessage;
    }
  }
  res.json({
    connected,
    connectionMessage,
    connectionMessageEs,
    config: cfg,
  });
});

router.get("/integrations/asana/workspaces", requireRole([...ADMIN_ROLES]), async (_req, res) => {
  try {
    const data = await listWorkspaces();
    res.json({ workspaces: data });
  } catch (err) {
    if (err instanceof AsanaNotConnectedError) {
      return res.status(412).json({ error: "not_connected", message: err.message });
    }
    if (err instanceof AsanaApiError) {
      return res.status(502).json({ error: "asana_error", status: err.status, message: err.message });
    }
    return res.status(500).json({ error: "internal", message: (err as Error).message });
  }
});

router.get("/integrations/asana/boards", requireRole([...ADMIN_ROLES]), async (req, res) => {
  const workspaceGid = String(req.query["workspaceGid"] ?? "");
  if (!workspaceGid) {
    return res.status(400).json({ error: "bad_request", message: "workspaceGid query param required" });
  }
  try {
    const data = await listProjectsForWorkspace(workspaceGid);
    res.json({ boards: data });
  } catch (err) {
    if (err instanceof AsanaNotConnectedError) {
      return res.status(412).json({ error: "not_connected", message: err.message });
    }
    if (err instanceof AsanaApiError) {
      return res.status(502).json({ error: "asana_error", status: err.status, message: err.message });
    }
    return res.status(500).json({ error: "internal", message: (err as Error).message });
  }
});

// Save the chosen workspace + board and flip the integration on. The
// dashboardBaseUrl is optional but we accept it so the comments link back to
// the right hostname for this Repl.
router.post("/integrations/asana/configure", requireRole([...ADMIN_ROLES]), (req, res) => {
  const body = (req.body ?? {}) as {
    workspaceGid?: unknown; workspaceName?: unknown;
    boardGid?: unknown; boardName?: unknown;
    defaultAssigneeGid?: unknown; dashboardBaseUrl?: unknown;
  };
  const workspaceGid = typeof body.workspaceGid === "string" ? body.workspaceGid.trim() : "";
  const boardGid = typeof body.boardGid === "string" ? body.boardGid.trim() : "";
  if (!workspaceGid || !boardGid) {
    return res.status(400).json({ error: "bad_request", message: "workspaceGid and boardGid required" });
  }
  const user = (req as { user?: { name?: string } }).user;
  const next = updateAsanaConfig({
    enabled: true,
    workspaceGid,
    boardGid,
    workspaceName: typeof body.workspaceName === "string" ? body.workspaceName.slice(0, 200) : null,
    boardName: typeof body.boardName === "string" ? body.boardName.slice(0, 200) : null,
    defaultAssigneeGid:
      typeof body.defaultAssigneeGid === "string" && body.defaultAssigneeGid.length > 0
        ? body.defaultAssigneeGid.slice(0, 64)
        : null,
    dashboardBaseUrl:
      typeof body.dashboardBaseUrl === "string" && body.dashboardBaseUrl.length > 0
        ? body.dashboardBaseUrl.slice(0, 200)
        : null,
    connectedAt: new Date().toISOString(),
    connectedBy: user?.name ?? "Admin",
  });
  res.json({ config: next });
});

router.post("/integrations/asana/disconnect", requireRole([...ADMIN_ROLES]), (_req, res) => {
  const next = updateAsanaConfig({
    enabled: false,
    workspaceGid: null,
    workspaceName: null,
    boardGid: null,
    boardName: null,
    defaultAssigneeGid: null,
    dashboardBaseUrl: null,
    connectedAt: null,
    connectedBy: null,
  });
  res.json({ config: next });
});

router.get("/integrations/asana/sync-log", requireRole([...ADMIN_ROLES]), (_req, res) => {
  res.json({ entries: getSyncLog(), queueLength: listQueue().length });
});

// Re-enqueue a previously failed/skipped log entry so the next drain tick
// retries it. The entry stays in the log (for the audit trail) but a fresh
// queue job is created with attempts=0.
router.post("/integrations/asana/sync-log/:id/retry", requireRole([...ADMIN_ROLES]), async (req, res) => {
  const id = req.params["id"] as string;
  const entry = findSyncLogEntry(id);
  if (!entry) {
    return res.status(404).json({ error: "not_found", message: "Sync log entry not found" });
  }
  enqueueJob({
    projectId: entry.projectId,
    activity: {
      id: entry.payload.activityId,
      timestamp: new Date().toISOString(),
      type: entry.payload.type,
      actor: entry.payload.actor,
      description: entry.payload.description,
      descriptionEs: entry.payload.descriptionEs,
    },
  });
  // Best-effort drain so a manual retry feels immediate.
  void drainQueue().catch(() => undefined);
  res.json({ ok: true });
});

export default router;
