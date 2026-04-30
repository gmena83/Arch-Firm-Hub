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

export function saveEstimatingToDisk(state: unknown): void {
  const file = getEstimatingPersistFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    logger.error({ err, file }, "estimating-persistence: save failed");
  }
}

export function loadEstimatingFromDisk<T = unknown>(): T | null {
  const file = getEstimatingPersistFile();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error({ err, file }, "estimating-persistence: load failed");
    return null;
  }
}
