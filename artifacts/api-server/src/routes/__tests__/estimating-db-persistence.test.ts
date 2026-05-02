// Postgres-backed persistence tests (Task #141).
//
// These tests cover the two pieces that the older `estimating.test.ts`
// "survives a restart" sub-test does NOT exercise:
//   1. Calculator-entry persistence end-to-end through the PATCH route.
//   2. The one-time JSON → Postgres migration is idempotent and renames
//      the legacy file.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import app from "../../app";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  importedMaterialsTable,
  laborRatesTable,
  projectContractorEstimatesTable,
  projectContractorEstimateLinesTable,
  projectReceiptsTable,
  projectReportTemplatesTable,
  projectCalculatorEntriesTable,
  estimatingMigrationsTable,
} from "@workspace/db";
import {
  loadCalculatorEntriesFromDb,
  saveCalculatorEntriesForProject,
  saveEstimatingSnapshotToDb,
  loadEstimatingSnapshotFromDb,
  migrateEstimatingJsonIfNeeded,
  __resetEstimatingTablesForTest,
  type CalculatorEntry,
} from "../../lib/estimating-store";
import { CALCULATOR_ENTRIES } from "../../data/seed";
import {
  flushCalculatorPersistence,
  __resetCalculatorHydrationForTest,
  ensureCalculatorHydrated,
} from "../projects";

type LoginResponse = { token: string; user: { id: string; role: string } };

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  try { return await fn(baseUrl); }
  finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

async function login(baseUrl: string, email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "konti2026" }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as LoginResponse;
  return body.token;
}

function snapshotCalc(projectId: string): Record<string, unknown>[] {
  const calc = CALCULATOR_ENTRIES as unknown as Record<string, Record<string, unknown>[]>;
  return calc[projectId] ? JSON.parse(JSON.stringify(calc[projectId])) : [];
}
function restoreCalc(projectId: string, before: Record<string, unknown>[]) {
  const calc = CALCULATOR_ENTRIES as unknown as Record<string, Record<string, unknown>[]>;
  calc[projectId] = before;
}

test("DB-1: estimating snapshot round-trips via Postgres (per-store coverage)", async () => {
  await __resetEstimatingTablesForTest();
  try {
    await saveEstimatingSnapshotToDb({
      extraMaterials: [
        { id: "mat-imp-rt", item: "RoundTrip Tile", itemEs: "Loseta RT", category: "finishes", unit: "sqft", basePrice: 8.25 },
      ],
      laborRates: [
        { trade: "RT Trade", tradeEs: "RT Oficio", unit: "hour", hourlyRate: 41.5, source: "import", updatedAt: "2026-04-01T00:00:00Z" },
      ],
      receipts: {
        "proj-rt": [
          { id: "rec-rt-1", vendor: "RT Vendor A", date: "2026-04-10", trade: "RT Trade", amount: 200.5, hours: 4 },
          { id: "rec-rt-2", vendor: "RT Vendor B", date: "2026-04-11", trade: "RT Trade", amount: 50.25, hours: 1 },
        ],
      },
      reportTemplates: {
        "proj-rt": {
          name: "RT Template",
          columns: ["Category", "Item", "Total"],
          headerLines: ["RT Header 1", "RT Header 2"],
          footer: "RT Footer",
          uploadedAt: "2026-04-12T10:00:00Z",
          uploadedBy: "rt@konti.com",
        },
      },
      contractorEstimates: {
        "proj-rt": {
          projectId: "proj-rt",
          source: "RT Source",
          squareMeters: 100,
          projectType: "residencial",
          scope: ["roof", "kitchen"],
          bathrooms: 1,
          kitchens: 1,
          lines: [
            { id: "ln-rt-1", category: "materials", description: "RT line 1", descriptionEs: "RT línea 1", quantity: 2, unit: "unit", unitPrice: 100, lineTotal: 200 },
            { id: "ln-rt-2", category: "labor", description: "RT line 2", descriptionEs: "RT línea 2", quantity: 5, unit: "hour", unitPrice: 41.5, lineTotal: 207.5 },
          ],
          subtotalMaterials: 200,
          subtotalLabor: 207.5,
          subtotalSubcontractor: 0,
          contingencyPercent: 8,
          contingency: 32.6,
          marginPercent: 12,
          marginAmount: 50,
          managementFeePercent: 5,
          managementFeeAmount: 24,
          grandTotal: 514.1,
          generatedAt: "2026-04-12T10:01:00Z",
          generatedBy: "rt@konti.com",
        },
      },
    });

    const fromDb = await loadEstimatingSnapshotFromDb();
    assert.ok(fromDb);
    assert.equal(fromDb!.extraMaterials.length, 1);
    assert.equal(fromDb!.extraMaterials[0]!.item, "RoundTrip Tile");
    assert.equal(fromDb!.laborRates.length, 1);
    assert.equal(fromDb!.laborRates[0]!.hourlyRate, 41.5);
    assert.equal(fromDb!.receipts["proj-rt"]?.length, 2);
    // Order preserved by `position`.
    assert.equal(fromDb!.receipts["proj-rt"]?.[0]?.id, "rec-rt-1");
    assert.equal(fromDb!.receipts["proj-rt"]?.[1]?.id, "rec-rt-2");
    assert.deepEqual(fromDb!.reportTemplates["proj-rt"]?.columns, ["Category", "Item", "Total"]);
    assert.equal(fromDb!.contractorEstimates["proj-rt"]?.lines.length, 2);
    // Line ordering preserved by `position`.
    assert.equal(fromDb!.contractorEstimates["proj-rt"]?.lines[0]?.id, "ln-rt-1");
    assert.equal(fromDb!.contractorEstimates["proj-rt"]?.lines[1]?.id, "ln-rt-2");
    assert.equal(fromDb!.contractorEstimates["proj-rt"]?.grandTotal, 514.1);

    // Save again as empty → all tables should be empty after, and load returns null.
    await saveEstimatingSnapshotToDb({
      extraMaterials: [],
      laborRates: [],
      receipts: {},
      reportTemplates: {},
      contractorEstimates: {},
    });
    const empty = await loadEstimatingSnapshotFromDb();
    assert.equal(empty, null);
  } finally {
    await __resetEstimatingTablesForTest();
  }
});

test("DB-2: calculator-entry edits are persisted via PATCH and survive a simulated restart", async () => {
  // We use `proj-1`, which has 5 seeded calculator lines. Snapshot the
  // in-memory state so we can put it back at the end.
  const projectId = "proj-1";
  const before = snapshotCalc(projectId);
  await __resetEstimatingTablesForTest();
  __resetCalculatorHydrationForTest();

  try {
    const lineId = "calc-1-1";
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      // Bump quantity on the first line and apply a manual override.
      const patchRes = await fetch(`${baseUrl}/api/projects/${projectId}/calculations/${lineId}`, {
        method: "PATCH",
        headers: auth,
        body: JSON.stringify({ quantity: 7, manualPriceOverride: 1234.5 }),
      });
      assert.equal(patchRes.status, 200);
      const patched = (await patchRes.json()) as { entry: { quantity: number; manualPriceOverride: number; effectivePrice: number; lineTotal: number } };
      assert.equal(patched.entry.quantity, 7);
      assert.equal(patched.entry.manualPriceOverride, 1234.5);
      assert.equal(patched.entry.effectivePrice, 1234.5);
      assert.equal(patched.entry.lineTotal, Math.round(1234.5 * 7 * 100) / 100);
    });

    // Wait for the fire-and-forget DB write to settle.
    await flushCalculatorPersistence();

    // The whole project's entries should now be in Postgres, in order.
    const byProject = await loadCalculatorEntriesFromDb();
    assert.ok(byProject[projectId], "project should have entries in DB");
    assert.equal(byProject[projectId]!.length, before.length);
    const persistedFirst = byProject[projectId]!.find((e) => e.id === lineId);
    assert.ok(persistedFirst, "patched line should be in DB");
    assert.equal(persistedFirst!.quantity, 7);
    assert.equal(persistedFirst!.manualPriceOverride, 1234.5);
    assert.equal(persistedFirst!.lineTotal, Math.round(1234.5 * 7 * 100) / 100);

    // Simulate a restart: wipe in-memory entries for this project, then run
    // hydration the same way the bootstrap path does. The patched line
    // must come back from the DB (not the seed defaults).
    const calc = CALCULATOR_ENTRIES as unknown as Record<string, CalculatorEntry[]>;
    delete calc[projectId];
    __resetCalculatorHydrationForTest();
    await ensureCalculatorHydrated();

    const reloaded = (CALCULATOR_ENTRIES as unknown as Record<string, CalculatorEntry[]>)[projectId];
    assert.ok(reloaded, "calc entries should rehydrate from DB");
    const reloadedFirst = reloaded!.find((e) => e.id === lineId);
    assert.equal(reloadedFirst?.quantity, 7);
    assert.equal(reloadedFirst?.manualPriceOverride, 1234.5);
    assert.equal(reloadedFirst?.lineTotal, Math.round(1234.5 * 7 * 100) / 100);

    // Projects with no DB rows should still use seed defaults — confirm
    // by checking proj-2 (which was never patched in this test) is intact.
    const proj2 = (CALCULATOR_ENTRIES as unknown as Record<string, CalculatorEntry[]>)["proj-2"];
    assert.ok(proj2 && proj2.length > 0, "proj-2 keeps seed defaults");
  } finally {
    // Restore in-memory state for the rest of the suite, clean up DB rows.
    restoreCalc(projectId, before);
    await saveCalculatorEntriesForProject(projectId, []);
    __resetCalculatorHydrationForTest();
  }
});

test("DB-3: legacy JSON migration is idempotent and renames the source file", async () => {
  await __resetEstimatingTablesForTest();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "konti-mig-"));
  const jsonPath = path.join(tmpDir, "estimating.json");

  const legacy = {
    extraMaterials: [
      { id: "mat-leg-1", item: "Legacy Tile", itemEs: "Loseta Legacy", category: "finishes", unit: "sqft", basePrice: 5.5 },
    ],
    laborRates: [
      { trade: "Legacy Trade", tradeEs: "Oficio Legacy", unit: "hour", hourlyRate: 33, source: "import", updatedAt: "2026-03-01T00:00:00Z" },
    ],
    receipts: {
      "proj-legacy": [
        { id: "rec-leg-1", vendor: "Legacy Vendor", date: "2026-03-15", trade: "Legacy Trade", amount: 99, hours: 2 },
      ],
    },
    reportTemplates: {},
    contractorEstimates: {},
  };
  fs.writeFileSync(jsonPath, JSON.stringify(legacy), "utf8");

  try {
    // First call — does the actual import.
    const r1 = await migrateEstimatingJsonIfNeeded({ jsonPath });
    assert.equal(r1.status, "migrated");
    assert.ok(r1.backupPath, "should rename the source file on success");
    assert.ok(!fs.existsSync(jsonPath), "original file should be moved");
    assert.ok(fs.existsSync(r1.backupPath!), "backup file should exist");

    const snap = await loadEstimatingSnapshotFromDb();
    assert.ok(snap);
    assert.ok(snap!.extraMaterials.some((m) => m.id === "mat-leg-1"));
    assert.ok(snap!.laborRates.some((l) => l.trade === "Legacy Trade"));
    assert.ok(snap!.receipts["proj-legacy"]?.some((r) => r.id === "rec-leg-1"));

    // Migration recorded.
    const recorded = await db
      .select()
      .from(estimatingMigrationsTable)
      .where(eq(estimatingMigrationsTable.id, "estimating-json-2026-05"));
    assert.equal(recorded.length, 1);

    // Second call (even if someone restored a fresh file) — must NOT re-import.
    fs.writeFileSync(jsonPath, JSON.stringify({ extraMaterials: [{ id: "should-not-import", item: "Nope", itemEs: "Nope", category: "x", unit: "x", basePrice: 1 }], laborRates: [], receipts: {}, reportTemplates: {}, contractorEstimates: {} }), "utf8");
    const r2 = await migrateEstimatingJsonIfNeeded({ jsonPath });
    assert.equal(r2.status, "already_applied");
    const after = await loadEstimatingSnapshotFromDb();
    assert.ok(after!.extraMaterials.every((m) => m.id !== "should-not-import"));
    // The file we just wrote should still be there since the migration is a no-op now.
    assert.ok(fs.existsSync(jsonPath));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await __resetEstimatingTablesForTest();
  }
});

// Suppress unused warning — these helpers are exported for downstream use
// and we want to keep them in the test surface in case future tests need
// them, but only some are referenced above.
void importedMaterialsTable;
void laborRatesTable;
void projectContractorEstimatesTable;
void projectContractorEstimateLinesTable;
void projectReceiptsTable;
void projectReportTemplatesTable;
void projectCalculatorEntriesTable;
