// DEPRECATED — kept only as a thin compatibility shim for code paths that
// still want a path-style "where would the legacy JSON live?" answer (e.g.
// the migration test). The real persistence lives in `estimating-store.ts`
// and writes to Postgres (Task #141).
//
// Do not call `saveEstimatingToDisk` / `loadEstimatingFromDisk` from new
// code — they are no-ops / null returns now and exist purely so existing
// imports don't break during the transition. They will be removed once the
// last test reference is migrated.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { logger } from "./logger";

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

export function getEstimatingPersistFile(): string {
  if (_path === null) {
    _path = defaultPath();
  }
  return _path;
}

export function setEstimatingPersistFile(p: string | null): void {
  _path = p;
}

/**
 * @deprecated Estimating state now lives in Postgres. This still writes the
 *   provided snapshot to the legacy JSON path so a small handful of older
 *   tests can introspect it, but the API server itself no longer reads it.
 */
export function saveEstimatingToDisk(state: unknown): void {
  const file = getEstimatingPersistFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    logger.error({ err, file }, "estimating-persistence: legacy save failed");
  }
}

/**
 * @deprecated Estimating state now lives in Postgres. Returns `null` if the
 *   legacy file doesn't exist; otherwise parses it (used by the one-time
 *   migration test in `routes/__tests__`).
 */
export function loadEstimatingFromDisk<T = unknown>(): T | null {
  const file = getEstimatingPersistFile();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error({ err, file }, "estimating-persistence: legacy load failed");
    return null;
  }
}
