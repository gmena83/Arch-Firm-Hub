// Per-project calculator-entry persistence (Task #141, extracted in
// post-review hardening to break a `routes/estimating.ts` ↔
// `routes/projects.ts` circular import).
//
// CALCULATOR_ENTRIES lives in seed.ts as a const-bound object whose keys
// are project IDs. Mutations happen in-place via the route handlers. At
// boot we hydrate the projects that have rows in
// `project_calculator_entries` (overriding the seed values for those
// keys), while projects with no rows continue to use the seed defaults —
// so adding a brand new project to seed.ts still works without touching
// the DB.
//
// Every mutating route calls `persistCalculatorEntriesForProject(id)`,
// which is fire-and-forget but serialised through a per-project queue so
// two rapid edits cannot race to overwrite each other.

import { CALCULATOR_ENTRIES } from "../data/seed";
import {
  loadCalculatorEntriesFromDb,
  saveCalculatorEntriesForProject,
  type CalculatorEntry,
} from "./estimating-store";
import { logger } from "./logger";

let _calcHydrationPromise: Promise<void> | null = null;

export function ensureCalculatorHydrated(): Promise<void> {
  if (_calcHydrationPromise) return _calcHydrationPromise;
  _calcHydrationPromise = (async () => {
    try {
      const fromDb = await loadCalculatorEntriesFromDb();
      const calc = CALCULATOR_ENTRIES as unknown as Record<string, CalculatorEntry[]>;
      for (const [projectId, entries] of Object.entries(fromDb)) {
        calc[projectId] = entries;
      }
    } catch (err) {
      logger.error({ err }, "calculator: hydration from Postgres failed");
    }
  })();
  return _calcHydrationPromise;
}

export function __resetCalculatorHydrationForTest(): void {
  _calcHydrationPromise = null;
}

// Per-project serialised write queue. Two writes in quick succession to
// the SAME project will serialise; writes to different projects can run
// in parallel.
const _calcPendingByProject: Map<string, Promise<unknown>> = new Map();

export function persistCalculatorEntriesForProject(projectId: string): void {
  const calc = CALCULATOR_ENTRIES as unknown as Record<string, CalculatorEntry[]>;
  const entries = calc[projectId] ?? [];
  const prev = _calcPendingByProject.get(projectId) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(() => saveCalculatorEntriesForProject(projectId, entries));
  next.catch((err) => {
    logger.error({ err, projectId }, "calculator: persist to Postgres failed");
  });
  _calcPendingByProject.set(projectId, next);
}

export function flushCalculatorPersistence(): Promise<void> {
  const all = Array.from(_calcPendingByProject.values());
  return Promise.allSettled(all).then(() => undefined);
}
