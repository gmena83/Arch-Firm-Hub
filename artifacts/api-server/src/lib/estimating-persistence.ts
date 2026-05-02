// Deprecated compatibility shim — Task #141.
//
// This module USED to be the JSON-on-disk persistence layer for the
// estimating + calculator stores (writing `.data/estimating.json`).
// Task #141 moved persistence to Postgres via Drizzle; the canonical
// API now lives in `./estimating-store.ts`.
//
// All in-repo callers were migrated as part of #141 (a repo-wide search
// for `loadEstimatingFromDisk` / `saveEstimatingToDisk` /
// `getEstimatingPersistFile` / `setEstimatingPersistFile` returns
// nothing outside this file). This file is kept for one release as a
// thin delegation shim so any out-of-tree consumer still importing the
// old names gets routed to the new DB-backed functions instead of
// silently doing nothing or failing to resolve.
//
// IMPORTANT: the original sync signatures cannot be preserved — the new
// store is async (it talks to Postgres). Deprecated callers therefore
// receive promises and must `await` them; that is intentional and is
// exactly the migration the route handlers already performed.
//
// Remove this file in the release after #141 ships.

import { logger } from "./logger";
import {
  loadEstimatingSnapshotFromDb,
  saveEstimatingSnapshotToDb,
  type PersistedEstimatingSnapshot,
} from "./estimating-store";

let _persistFilePath = ".data/estimating.json";
let _warnedLoad = false;
let _warnedSave = false;
let _warnedFile = false;

function warnOnce(flag: { value: boolean }, fnName: string): void {
  if (flag.value) return;
  flag.value = true;
  logger.warn(
    { fn: fnName },
    "estimating-persistence shim is deprecated; import from './estimating-store' instead (Task #141)",
  );
}

const loadFlag = { get value() { return _warnedLoad; }, set value(v: boolean) { _warnedLoad = v; } };
const saveFlag = { get value() { return _warnedSave; }, set value(v: boolean) { _warnedSave = v; } };
const fileFlag = { get value() { return _warnedFile; }, set value(v: boolean) { _warnedFile = v; } };

/**
 * @deprecated Task #141 — use `loadEstimatingSnapshotFromDb` from
 * `./estimating-store` directly. This shim returns a Promise (the
 * original was sync) because Postgres I/O cannot be made synchronous.
 */
export function loadEstimatingFromDisk(): Promise<PersistedEstimatingSnapshot | null> {
  warnOnce(loadFlag, "loadEstimatingFromDisk");
  return loadEstimatingSnapshotFromDb();
}

/**
 * @deprecated Task #141 — use `saveEstimatingSnapshotToDb` from
 * `./estimating-store` directly. Returns a Promise; callers MUST await
 * it to retain the durability guarantee they had with the old sync
 * disk write.
 */
export function saveEstimatingToDisk(
  state: PersistedEstimatingSnapshot,
): Promise<void> {
  warnOnce(saveFlag, "saveEstimatingToDisk");
  return saveEstimatingSnapshotToDb(state);
}

/**
 * @deprecated Task #141 — file-based persistence is gone. The path is
 * still tracked for the one-time JSON migration in
 * `migrateEstimatingJsonIfNeeded({ jsonPath })`, but no live writes
 * target this file anymore.
 */
export function getEstimatingPersistFile(): string {
  warnOnce(fileFlag, "getEstimatingPersistFile");
  return _persistFilePath;
}

/**
 * @deprecated Task #141 — file-based persistence is gone. Setting this
 * value only affects the path passed to the legacy-JSON migration on
 * the next call to `migrateEstimatingJsonIfNeeded`.
 */
export function setEstimatingPersistFile(p: string): void {
  warnOnce(fileFlag, "setEstimatingPersistFile");
  _persistFilePath = p;
}
