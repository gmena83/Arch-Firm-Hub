import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import app from "../../app";
import {
  EXTRA_MATERIALS,
  LABOR_RATES,
  PROJECT_CONTRACTOR_ESTIMATE,
  PROJECT_RECEIPTS,
  PROJECT_REPORT_TEMPLATE,
  applyEstimatingSnapshot,
  persistEstimatingState,
} from "../estimating";
import {
  getEstimatingPersistFile,
  loadEstimatingFromDisk,
  setEstimatingPersistFile,
} from "../../lib/estimating-persistence";

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

function snapshotState() {
  return {
    extra: EXTRA_MATERIALS.length,
    labor: LABOR_RATES.length,
    laborRates: LABOR_RATES.map((r) => ({ trade: r.trade, hourlyRate: r.hourlyRate, source: r.source })),
    receipts: { ...PROJECT_RECEIPTS },
    template: { ...PROJECT_REPORT_TEMPLATE },
    estimates: { ...PROJECT_CONTRACTOR_ESTIMATE },
  };
}
function restoreState(snap: ReturnType<typeof snapshotState>) {
  EXTRA_MATERIALS.splice(snap.extra);
  LABOR_RATES.splice(0, LABOR_RATES.length);
  for (const r of snap.laborRates) {
    LABOR_RATES.push({ trade: r.trade, tradeEs: r.trade, unit: "hour", hourlyRate: r.hourlyRate, source: r.source as "seed" | "import" | "receipts", updatedAt: "2026-01-01T00:00:00Z" });
  }
  for (const k of Object.keys(PROJECT_RECEIPTS)) delete PROJECT_RECEIPTS[k];
  for (const k of Object.keys(PROJECT_REPORT_TEMPLATE)) delete PROJECT_REPORT_TEMPLATE[k];
  for (const k of Object.keys(PROJECT_CONTRACTOR_ESTIMATE)) delete PROJECT_CONTRACTOR_ESTIMATE[k];
  Object.assign(PROJECT_RECEIPTS, snap.receipts);
  Object.assign(PROJECT_REPORT_TEMPLATE, snap.template);
  Object.assign(PROJECT_CONTRACTOR_ESTIMATE, snap.estimates);
  // Keep the persisted file aligned with the restored in-memory state so other
  // tests in the same process don't see leftover mutations on disk.
  persistEstimatingState();
}

test("estimating end-to-end: import → contractor estimate → receipts → variance report", async () => {
  const snap = snapshotState();
  try {
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      // 1. Import materials via CSV
      const csv = "item,item_es,category,unit,base_price\nGreen Roof Membrane,Membrana Verde,finishes,sqft,18.50\n,,,,";
      const importRes = await fetch(`${baseUrl}/api/estimating/materials/import`, { method: "POST", headers: auth, body: JSON.stringify({ csv }) });
      assert.equal(importRes.status, 200);
      const imp = (await importRes.json()) as { imported: number; skipped: number };
      assert.equal(imp.imported, 1);
      assert.equal(imp.skipped, 1);

      // 2. Import labor rates
      const labRes = await fetch(`${baseUrl}/api/estimating/labor-rates/import`, {
        method: "POST", headers: auth,
        body: JSON.stringify({ rates: [{ trade: "Carpenter", hourly_rate: 42 }, { trade: "Specialty Welder", hourly_rate: 60 }] }),
      });
      assert.equal(labRes.status, 200);
      const labBody = (await labRes.json()) as { imported: number; rates: Array<{ trade: string; hourlyRate: number }> };
      assert.equal(labBody.imported, 2);
      const carp = labBody.rates.find((r) => r.trade === "Carpenter");
      assert.equal(carp?.hourlyRate, 42);

      // 3. Create contractor estimate for proj-1
      const estRes = await fetch(`${baseUrl}/api/projects/proj-1/contractor-estimate`, {
        method: "POST", headers: auth,
        body: JSON.stringify({ squareMeters: 180, projectType: "residencial", scope: ["pool", "solar"] }),
      });
      assert.equal(estRes.status, 200);
      const est = (await estRes.json()) as { lines: Array<{ category: string; lineTotal: number; quantity: number; unitPrice: number }>; grandTotal: number };
      assert.ok(est.lines.length >= 5);
      assert.ok(est.grandTotal > 0);
      assert.ok(est.lines.some((l) => l.category === "subcontractor"), "should include subcontractor for pool/solar");

      // 4. Upload receipts → labor baseline refresh
      const recRes = await fetch(`${baseUrl}/api/projects/proj-1/receipts`, {
        method: "POST", headers: auth,
        body: JSON.stringify({ receipts: [
          { vendor: "Ferretería PR", date: "2026-04-10", trade: "Carpenter", amount: 800, hours: 20 },
          { vendor: "Home Depot", date: "2026-04-12", trade: "Carpenter", amount: 880, hours: 22 },
          { vendor: "Ferretería PR", date: "2026-04-15", trade: "Carpenter", amount: 900, hours: 20 },
        ] }),
      });
      assert.equal(recRes.status, 200);
      const recBody = (await recRes.json()) as { receipts: unknown[]; updatedTrades: string[]; rates: Array<{ trade: string; hourlyRate: number; source: string }> };
      assert.equal(recBody.receipts.length, 3);
      const carpAfter = recBody.rates.find((r) => r.trade === "Carpenter");
      assert.equal(carpAfter?.source, "receipts");
      // (800+880+900)/(20+22+20) = 2580/62 ≈ 41.61
      assert.ok(carpAfter && Math.abs(carpAfter.hourlyRate - 41.61) < 0.05, `expected ~41.61 got ${carpAfter?.hourlyRate}`);

      // 5. Report template
      const tplRes = await fetch(`${baseUrl}/api/projects/proj-1/report-template`, {
        method: "POST", headers: auth,
        body: JSON.stringify({ name: "KONTi Standard v2", columns: ["Category", "Item", "Qty", "Total"], headerLines: ["KONTi", "Casa Solar Rincón"], footer: "© KONTi 2026 Confidential" }),
      });
      assert.equal(tplRes.status, 200);

      // 5b. Report template is retrievable for the PDF/report rendering pipeline
      const tplGet = await fetch(`${baseUrl}/api/projects/proj-1/report-template`, { headers: auth });
      assert.equal(tplGet.status, 200);
      const tplBody = (await tplGet.json()) as { name: string; footer: string; headerLines: string[]; columns: string[] };
      assert.equal(tplBody.name, "KONTi Standard v2");
      assert.equal(tplBody.footer, "© KONTi 2026 Confidential");
      assert.ok(tplBody.headerLines.includes("Casa Solar Rincón"));
      assert.ok(tplBody.columns.includes("Total"));

      // 5c. Imported materials are visible from the unified /api/materials catalog
      const matsList = await fetch(`${baseUrl}/api/materials`, { headers: auth });
      assert.equal(matsList.status, 200);
      const allMats = (await matsList.json()) as Array<{ id: string; item: string }>;
      assert.ok(allMats.some((m) => m.item === "Green Roof Membrane"), "imported material should appear in /api/materials");

      // 5d. Edit contractor estimate lines — totals must include non-labor/sub categories
      // (foundation/steel/finishes/etc. are materials buckets and must NOT be dropped from subtotal)
      const editLines = est.lines.map((l, i) => i === 0 ? { ...l, quantity: l.quantity, unitPrice: l.unitPrice + 100 } : l);
      const editRes = await fetch(`${baseUrl}/api/projects/proj-1/contractor-estimate/lines`, {
        method: "PUT", headers: auth, body: JSON.stringify({ lines: editLines }),
      });
      assert.equal(editRes.status, 200);
      const edited = (await editRes.json()) as {
        lines: Array<{ category: string; lineTotal: number }>;
        subtotalMaterials: number; subtotalLabor: number; subtotalSubcontractor: number;
        contingency: number; grandTotal: number; contingencyPercent: number;
      };
      const sumAll = edited.lines.reduce((a, b) => a + b.lineTotal, 0);
      const sumByBuckets = edited.subtotalMaterials + edited.subtotalLabor + edited.subtotalSubcontractor;
      assert.ok(Math.abs(sumAll - sumByBuckets) < 0.05, `subtotals must include all categories (sumAll=${sumAll} buckets=${sumByBuckets})`);
      const expectedGrand = Math.round((sumAll + sumAll * (edited.contingencyPercent / 100)) * 100) / 100;
      assert.ok(Math.abs(edited.grandTotal - expectedGrand) < 0.05, `grandTotal should reflect all line categories: got ${edited.grandTotal}, expected ~${expectedGrand}`);
      assert.ok(edited.subtotalMaterials > 0, "materials bucket must capture foundation/steel/etc. lines");

      // 6. Variance report
      const varRes = await fetch(`${baseUrl}/api/projects/proj-1/variance-report`, { headers: auth });
      assert.equal(varRes.status, 200);
      const v = (await varRes.json()) as {
        estimateSource: string;
        buckets: Array<{ key: string; estimated: number; actual: number; variance: number; status: string }>;
        totals: { estimated: number; actual: number; variance: number };
      };
      assert.equal(v.estimateSource, "contractor_estimate");
      assert.equal(v.buckets.length, 3);
      const matBucket = v.buckets.find((b) => b.key === "materials");
      assert.ok(matBucket && matBucket.estimated > 0);
      assert.ok(typeof v.totals.variance === "number");
    });
  } finally {
    restoreState(snap);
  }
});

test("contractor estimate requires auth", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/projects/proj-1/contractor-estimate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ squareMeters: 100 }),
    });
    assert.equal(res.status, 401);
  });
});

test("client cannot import materials", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "client@konti.com");
    const res = await fetch(`${baseUrl}/api/estimating/materials/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ csv: "item,category,unit,base_price\nFoo,steel,unit,10" }),
    });
    assert.equal(res.status, 403);
  });
});

test("estimating state survives a server restart (persists to disk and reloads)", async () => {
  // Use an isolated persist file so this test can simulate a "fresh" server.
  const tmpFile = path.join(
    os.tmpdir(),
    `konti-estimating-persist-${process.pid}-${Date.now()}.json`,
  );
  const previousFile = getEstimatingPersistFile();
  const snap = snapshotState();
  setEstimatingPersistFile(tmpFile);
  // Reset in-memory state so we know what's on disk came from this test.
  applyEstimatingSnapshot(null);

  try {
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      // Imported material
      const importRes = await fetch(`${baseUrl}/api/estimating/materials/import`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          csv: "item,item_es,category,unit,base_price\nPersist Test Tile,Loseta Persistente,finishes,sqft,12.50",
        }),
      });
      assert.equal(importRes.status, 200);

      // Imported labor rate
      const labRes = await fetch(`${baseUrl}/api/estimating/labor-rates/import`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ rates: [{ trade: "Persist Trade", hourly_rate: 77 }] }),
      });
      assert.equal(labRes.status, 200);

      // Contractor estimate
      const estRes = await fetch(`${baseUrl}/api/projects/proj-1/contractor-estimate`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ squareMeters: 120, projectType: "residencial", scope: ["roof"] }),
      });
      assert.equal(estRes.status, 200);

      // Receipts
      const recRes = await fetch(`${baseUrl}/api/projects/proj-1/receipts`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          receipts: [
            { vendor: "Persist Vendor", date: "2026-04-20", trade: "Carpenter", amount: 500, hours: 10 },
          ],
        }),
      });
      assert.equal(recRes.status, 200);

      // Report template
      const tplRes = await fetch(`${baseUrl}/api/projects/proj-1/report-template`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          name: "Persist Template",
          columns: ["Category", "Item", "Total"],
          headerLines: ["KONTi", "Persist Test"],
          footer: "Footer-Persist",
        }),
      });
      assert.equal(tplRes.status, 200);
    });

    // The persist file should now exist with all five stores represented.
    assert.ok(fs.existsSync(tmpFile), "persist file should exist after mutations");
    const onDisk = JSON.parse(fs.readFileSync(tmpFile, "utf8")) as {
      extraMaterials: Array<{ item: string }>;
      laborRates: Array<{ trade: string; hourlyRate: number }>;
      receipts: Record<string, Array<{ vendor: string }>>;
      reportTemplates: Record<string, { name: string; footer: string }>;
      contractorEstimates: Record<string, { grandTotal: number; lines: unknown[] }>;
    };
    assert.ok(onDisk.extraMaterials.some((m) => m.item === "Persist Test Tile"));
    assert.ok(onDisk.laborRates.some((r) => r.trade === "Persist Trade" && r.hourlyRate === 77));
    assert.ok(onDisk.receipts["proj-1"]?.some((r) => r.vendor === "Persist Vendor"));
    assert.equal(onDisk.reportTemplates["proj-1"]?.name, "Persist Template");
    assert.ok((onDisk.contractorEstimates["proj-1"]?.grandTotal ?? 0) > 0);

    // Simulate a server restart: blow away in-memory state, then reload from disk.
    applyEstimatingSnapshot(null);
    assert.equal(EXTRA_MATERIALS.length, 0);
    assert.equal(Object.keys(PROJECT_RECEIPTS).length, 0);
    assert.equal(Object.keys(PROJECT_REPORT_TEMPLATE).length, 0);
    assert.equal(Object.keys(PROJECT_CONTRACTOR_ESTIMATE).length, 0);

    applyEstimatingSnapshot(loadEstimatingFromDisk());

    assert.ok(EXTRA_MATERIALS.some((m) => m.item === "Persist Test Tile"));
    assert.ok(LABOR_RATES.some((r) => r.trade === "Persist Trade" && r.hourlyRate === 77));
    assert.ok(PROJECT_RECEIPTS["proj-1"]?.some((r) => r.vendor === "Persist Vendor"));
    assert.equal(PROJECT_REPORT_TEMPLATE["proj-1"]?.name, "Persist Template");
    assert.ok((PROJECT_CONTRACTOR_ESTIMATE["proj-1"]?.grandTotal ?? 0) > 0);

    // Variance report continues to work end-to-end against the reloaded data.
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const varRes = await fetch(`${baseUrl}/api/projects/proj-1/variance-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(varRes.status, 200);
      const v = (await varRes.json()) as {
        estimateSource: string;
        buckets: Array<{ key: string; estimated: number }>;
      };
      assert.equal(v.estimateSource, "contractor_estimate");
      assert.ok(v.buckets.length === 3);
    });
  } finally {
    fs.rmSync(tmpFile, { force: true });
    setEstimatingPersistFile(previousFile);
    restoreState(snap);
  }
});
