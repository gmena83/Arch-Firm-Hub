// Persisted single-record integrations config (Task #127).
//
// Mirrors the JSON-on-disk pattern used by `estimating-persistence.ts` so a
// server restart preserves the chosen Asana workspace + board, the queued
// sync attempts, and the rolling sync log without needing a real database.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { logger } from "./logger";

export interface AsanaIntegrationConfig {
  enabled: boolean;
  workspaceGid: string | null;
  workspaceName: string | null;
  boardGid: string | null;
  boardName: string | null;
  defaultAssigneeGid: string | null;
  // Optional UI deep-link prefix used inside Asana comments so the team can
  // jump back into the dashboard from the Asana web UI.
  dashboardBaseUrl: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  projectId: string;
  projectName: string;
  activityType: string;
  asanaTaskGid: string | null;
  status: "ok" | "failed" | "skipped" | "retried";
  attempts: number;
  message: string;
  messageEs: string;
  /** Original activity payload, kept so the admin can manually retry a failed entry. */
  payload: {
    actor: string;
    description: string;
    descriptionEs: string;
    type: string;
    activityId: string;
  };
}

export interface QueuedSyncJob {
  id: string;
  enqueuedAt: string;
  nextAttemptAt: string;
  attempts: number;
  projectId: string;
  activity: {
    id: string;
    timestamp: string;
    type: string;
    actor: string;
    description: string;
    descriptionEs: string;
  };
}

export interface IntegrationsState {
  asana: AsanaIntegrationConfig;
  syncLog: SyncLogEntry[];
  queue: QueuedSyncJob[];
}

const DEFAULT_STATE: IntegrationsState = {
  asana: {
    enabled: false,
    workspaceGid: null,
    workspaceName: null,
    boardGid: null,
    boardName: null,
    defaultAssigneeGid: null,
    dashboardBaseUrl: null,
    connectedAt: null,
    connectedBy: null,
  },
  syncLog: [],
  queue: [],
};

const SYNC_LOG_LIMIT = 50;

function defaultPath(): string {
  if (process.env["INTEGRATIONS_PERSIST_FILE"]) {
    return process.env["INTEGRATIONS_PERSIST_FILE"] as string;
  }
  if (process.env["NODE_ENV"] === "test") {
    return path.join(os.tmpdir(), `konti-integrations-test-${process.pid}.json`);
  }
  const baseDir = process.env["KONTI_DATA_DIR"]
    ? (process.env["KONTI_DATA_DIR"] as string)
    : path.resolve(process.cwd(), ".data");
  return path.join(baseDir, "integrations.json");
}

let _path: string | null = null;
function getPersistFile(): string {
  if (_path === null) _path = defaultPath();
  return _path;
}

export function setIntegrationsPersistFile(p: string | null): void {
  _path = p;
  // Force a reload on next access.
  _state = null;
}

let _state: IntegrationsState | null = null;

function loadFromDisk(): IntegrationsState {
  const file = getPersistFile();
  try {
    if (!fs.existsSync(file)) return structuredClone(DEFAULT_STATE);
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as Partial<IntegrationsState>;
    return {
      asana: { ...DEFAULT_STATE.asana, ...(parsed.asana ?? {}) },
      syncLog: Array.isArray(parsed.syncLog) ? parsed.syncLog.slice(0, SYNC_LOG_LIMIT) : [],
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
    };
  } catch (err) {
    logger.error({ err, file }, "integrations-config: load failed; falling back to defaults");
    return structuredClone(DEFAULT_STATE);
  }
}

function persist(): void {
  if (!_state) return;
  const file = getPersistFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(_state, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    logger.error({ err, file }, "integrations-config: save failed");
  }
}

export function getState(): IntegrationsState {
  if (_state === null) _state = loadFromDisk();
  return _state;
}

export function getAsanaConfig(): AsanaIntegrationConfig {
  return { ...getState().asana };
}

export function updateAsanaConfig(patch: Partial<AsanaIntegrationConfig>): AsanaIntegrationConfig {
  const state = getState();
  state.asana = { ...state.asana, ...patch };
  persist();
  return { ...state.asana };
}

export function isAsanaEnabled(): boolean {
  const cfg = getState().asana;
  return cfg.enabled && !!cfg.workspaceGid && !!cfg.boardGid;
}

export function appendSyncLog(entry: Omit<SyncLogEntry, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
}): SyncLogEntry {
  const state = getState();
  const e: SyncLogEntry = {
    id: entry.id ?? `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    projectId: entry.projectId,
    projectName: entry.projectName,
    activityType: entry.activityType,
    asanaTaskGid: entry.asanaTaskGid,
    status: entry.status,
    attempts: entry.attempts,
    message: entry.message,
    messageEs: entry.messageEs,
    payload: entry.payload,
  };
  state.syncLog.unshift(e);
  if (state.syncLog.length > SYNC_LOG_LIMIT) state.syncLog.length = SYNC_LOG_LIMIT;
  persist();
  return e;
}

export function getSyncLog(): SyncLogEntry[] {
  return [...getState().syncLog];
}

export function findSyncLogEntry(id: string): SyncLogEntry | undefined {
  return getState().syncLog.find((e) => e.id === id);
}

// ---------------------------------------------------------------------------
// Retry queue
// ---------------------------------------------------------------------------

export function enqueueJob(job: Omit<QueuedSyncJob, "id" | "enqueuedAt" | "nextAttemptAt" | "attempts"> & {
  id?: string;
  enqueuedAt?: string;
  nextAttemptAt?: string;
  attempts?: number;
}): QueuedSyncJob {
  const state = getState();
  // Dedupe by activityId + projectId: if the same activity is already queued
  // we return the existing job rather than enqueueing twice. This prevents a
  // burst of writes (e.g. an activity fired during a manual retry) from
  // posting two identical comments to the same Asana task.
  const existing = state.queue.find(
    (q) => q.projectId === job.projectId && q.activity.id === job.activity.id,
  );
  if (existing) return existing;
  const now = new Date().toISOString();
  const entry: QueuedSyncJob = {
    id: job.id ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: job.enqueuedAt ?? now,
    nextAttemptAt: job.nextAttemptAt ?? now,
    attempts: job.attempts ?? 0,
    projectId: job.projectId,
    activity: job.activity,
  };
  state.queue.push(entry);
  persist();
  return entry;
}

export function listQueue(): QueuedSyncJob[] {
  return [...getState().queue];
}

export function dequeueJob(id: string): void {
  const state = getState();
  state.queue = state.queue.filter((j) => j.id !== id);
  persist();
}

export function bumpJobAttempt(id: string, nextAttemptAt: string): void {
  const state = getState();
  const j = state.queue.find((q) => q.id === id);
  if (!j) return;
  j.attempts += 1;
  j.nextAttemptAt = nextAttemptAt;
  persist();
}

// Test helper — clears all in-memory state and removes the persist file.
export function _resetForTests(): void {
  _state = structuredClone(DEFAULT_STATE);
  const file = getPersistFile();
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* best-effort */
  }
}
