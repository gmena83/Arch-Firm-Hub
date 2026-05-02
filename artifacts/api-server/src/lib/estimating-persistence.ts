// DEPRECATED — this module used to own JSON-on-disk persistence for the
// estimating routes. Task #141 moved the source of truth into Postgres
// (see `lib/estimating-store.ts`); this file is now a true no-op shim
// kept ONLY so older imports don't break during the transition. New
// code MUST NOT import anything from here.
//
// Removed in this revision:
//   - All `fs` / `path` / `os` IO. The "save" entry point silently
//     drops its argument; the "load" entry point always returns `null`.
//     This guarantees no stale JSON file is ever written or read by the
//     running server, which closes the "two sources of truth" gap the
//     code review flagged.
//   - The `getEstimatingPersistFile` / `setEstimatingPersistFile`
//     pair previously cached a path; the path is now computed on
//     demand and used only by the one-time migration test, which
//     passes its own explicit `jsonPath` and never calls these.

import * as path from "node:path";
import * as os from "node:os";

function defaultPath(): string {
  if (process.env["ESTIMATING_PERSIST_FILE"]) {
    return process.env["ESTIMATING_PERSIST_FILE"] as string;
  }
  if (process.env["NODE_ENV"] === "test") {
    return path.join(
      os.tmpdir(),
      `konti-estimating-test-${process.pid}.json`,
    );
  }
  const baseDir = process.env["KONTI_DATA_DIR"]
    ? (process.env["KONTI_DATA_DIR"] as string)
    : path.resolve(process.cwd(), ".data");
  return path.join(baseDir, "estimating.json");
}

let _path: string | null = null;

/**
 * @deprecated Returns the legacy JSON path. Postgres is the source of
 *   truth — this is only used to pass an explicit `jsonPath` into the
 *   one-time migration helper for tests. The server itself never reads
 *   from or writes to this file.
 */
export function getEstimatingPersistFile(): string {
  if (_path === null) {
    _path = defaultPath();
  }
  return _path;
}

/**
 * @deprecated Test-only override of the legacy JSON path. No effect on
 *   production persistence.
 */
export function setEstimatingPersistFile(p: string | null): void {
  _path = p;
}

/**
 * @deprecated No-op. Estimating state lives in Postgres; call
 *   `persistEstimatingState()` (in `routes/estimating.ts`) instead.
 *   This shim used to write the snapshot to a JSON file; that path is
 *   gone so the file is never written by the running server, which
 *   prevents the dual-source-of-truth drift the code review called
 *   out. Kept only so any straggling imports compile.
 */
export function saveEstimatingToDisk(_state: unknown): void {
  // Intentionally empty — Postgres is the only persistence boundary.
}

/**
 * @deprecated No-op. Always returns `null`. Estimating state is loaded
 *   from Postgres via `loadEstimatingSnapshotFromDb()` in
 *   `lib/estimating-store.ts`. Kept only so any straggling imports
 *   compile.
 */
export function loadEstimatingFromDisk<T = unknown>(): T | null {
  return null as T | null;
}
