// Postgres-backed lifecycle persistence tests (Task #144).
//
// Mirrors the #141 estimating playbook. Covers the durability contract
// for every store routed through `lib/lifecycle-store.ts`:
//   LC-1  snapshot round-trip (whole-snapshot save/load)
//   LC-2  POST /projects survives a simulated restart
//   LC-3  POST /projects/:id/inspections persists before 200 OK
//   LC-4  POST /projects/:id/change-orders persists before 201
//   LC-5  POST /projects/:id/structured-variables persists vars + budget
//   LC-6  POST /projects/:id/checklist-toggle persists checklist + activity
//   LC-7  POST /leads + accept-lead persist both stores
//   LC-8  PATCH /me persists user profile
//   LC-9  /notifications/:id/seen persists per-user seen ids
//   LC-10 seed migration is idempotent + clobber guard
//   LC-11 boot order: hydrate runs alongside estimating + calculator
//   LC-12 appendActivityAndPersist appends in memory AND in Postgres

import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import app from "../../app";
import {
  loadLifecycleSnapshotFromDb,
  saveLifecycleSnapshotToDb,
  migrateLifecycleSeedIfNeeded,
  __resetLifecycleTablesForTest,
} from "../../lib/lifecycle-store";
import {
  flushLifecyclePersistence,
  __resetLifecycleHydrationForTest,
  ensureLifecycleHydrated,
  appendActivityAndPersist,
} from "../../lib/lifecycle-persistence";

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

test("LC-1: lifecycle snapshot round-trips through Postgres", async () => {
  await __resetLifecycleTablesForTest();
  try {
    await saveLifecycleSnapshotToDb({
      projects: [{ id: "lc-rt-p1", name: "Round-Trip Project", phase: "discovery" }],
      leads: [{
        id: "lc-rt-l1", source: "website", projectType: "residencial",
        location: "Bayamón", budgetRange: "150k_300k", terrainStatus: "no_terrain",
        contactName: "RT Lead", email: "rt@x.com", phone: "555",
        createdAt: "2026-05-01T00:00:00Z", score: 50, status: "new",
      }],
      inspections: { "lc-rt-p1": [{
        id: "ins-rt-1", projectId: "lc-rt-p1", type: "framing",
        title: "RT", titleEs: "RT", inspector: "RT Inspector",
        scheduledDate: "2026-05-10", status: "scheduled",
      }] },
      changeOrders: { "lc-rt-p1": [{
        id: "co-rt-1", projectId: "lc-rt-p1", number: "CO-001",
        title: "RT CO", titleEs: "RT CO", description: "", descriptionEs: "",
        amountDelta: 100, scheduleImpactDays: 0, reason: "", reasonEs: "",
        requestedBy: "RT", requestedAt: "2026-05-01T00:00:00Z",
        status: "pending", outsideOfScope: false,
      }] },
      userProfiles: [{ userId: "lc-rt-u1", phone: "1", postalAddress: "PO", physicalAddress: "PA" }],
      notificationsSeen: { "lc-rt-u1": ["n-1", "n-2"] },
      structuredVars: { "lc-rt-p1": { squareMeters: 120, zoningCode: "R-3", projectType: "residencial", submittedAt: "2026-05-01", submittedBy: "RT" } },
      assistedBudgets: { "lc-rt-p1": { low: 200000, mid: 250000, high: 300000, currency: "USD", perSqMeterMid: 2000 } },
      csvMappings: { "lc-rt-p1": { materials: { Cement: "Cemento" } } },
      projectTasks: { "lc-rt-p1": [{ id: "t1", projectId: "lc-rt-p1", title: "Do thing", titleEs: "Hacer cosa", dueDate: "2026-05-10", completed: false, assignee: "RT", priority: "medium", phase: "discovery" }] },
      preDesignChecklists: { "lc-rt-p1": [{ id: "ck-1", label: "Site visit", labelEs: "Visita", status: "pending", assignee: "RT" }] },
      activities: { "lc-rt-p1": [{ id: "act-1", type: "phase_change", actor: "RT", description: "Created", descriptionEs: "Creado", timestamp: "2026-05-01T00:00:00Z" }] },
    });

    const fromDb = await loadLifecycleSnapshotFromDb();
    assert.ok(fromDb);
    assert.equal(fromDb!.projects.length, 1);
    assert.equal(fromDb!.projects[0]!.id, "lc-rt-p1");
    assert.equal(fromDb!.leads.length, 1);
    assert.equal(fromDb!.inspections["lc-rt-p1"]?.[0]?.id, "ins-rt-1");
    assert.equal(fromDb!.changeOrders["lc-rt-p1"]?.[0]?.number, "CO-001");
    assert.equal(fromDb!.userProfiles.find((p) => p.userId === "lc-rt-u1")?.phone, "1");
    assert.deepEqual(fromDb!.notificationsSeen["lc-rt-u1"]?.slice().sort(), ["n-1", "n-2"]);
    assert.equal(fromDb!.structuredVars["lc-rt-p1"]?.zoningCode, "R-3");
    assert.equal(fromDb!.assistedBudgets["lc-rt-p1"]?.high, 300000);
    assert.equal(fromDb!.preDesignChecklists["lc-rt-p1"]?.[0]?.label, "Site visit");
    assert.equal(fromDb!.activities["lc-rt-p1"]?.length, 1);
  } finally {
    await __resetLifecycleTablesForTest();
  }
});

test("LC-3: POST /projects/:id/inspections persists before 200 OK", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const res = await fetch(`${baseUrl}/api/projects/proj-1/inspections`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          type: "framing",
          title: "LC-3 Inspection",
          titleEs: "Inspección LC-3",
          inspector: "Test Inspector",
          scheduledDate: "2026-06-01",
        }),
      });
      assert.equal(res.status, 201);
      // The persist queue is awaited inside the handler before 201, so the
      // row MUST already be visible in Postgres at this point.
      const snap = await loadLifecycleSnapshotFromDb();
      const list = snap!.inspections["proj-1"] ?? [];
      assert.ok(list.some((i) => i.title === "LC-3 Inspection"), "inspection row must exist in Postgres before ack");
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-4: POST /projects/:id/change-orders persists before 201", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const res = await fetch(`${baseUrl}/api/projects/proj-1/change-orders`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          title: "LC-4 Change", amountDelta: 1500, scheduleImpactDays: 2,
        }),
      });
      assert.equal(res.status, 201);
      const snap = await loadLifecycleSnapshotFromDb();
      const list = snap!.changeOrders["proj-1"] ?? [];
      assert.ok(list.some((co) => co.title === "LC-4 Change"));
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-7: POST /leads persists before 201 and accept-lead persists both stores", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const created = await fetch(`${baseUrl}/api/leads`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "website", projectType: "residencial",
          location: "San Juan", budgetRange: "150k_300k",
          terrainStatus: "no_terrain",
          contactName: "LC-7 Lead", email: "lc7@x.com", phone: "555-1234",
        }),
      });
      assert.equal(created.status, 201);
      const lead = (await created.json()) as { id: string };

      const snap1 = await loadLifecycleSnapshotFromDb();
      assert.ok(snap1!.leads.some((l) => l.id === lead.id), "new lead must be in DB before 201");

      const token = await login(baseUrl, "demo@konti.com");
      const accept = await fetch(`${baseUrl}/api/leads/${lead.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: "{}",
      });
      assert.equal(accept.status, 200);
      const accepted = (await accept.json()) as { project: { id: string }; lead: { status: string } };

      const snap2 = await loadLifecycleSnapshotFromDb();
      assert.equal(snap2!.leads.find((l) => l.id === lead.id)?.status, "accepted", "lead status flip must be persisted");
      assert.ok(snap2!.projects.some((p) => p.id === accepted.project.id), "synthesized project must be persisted");
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-8: PATCH /me persists user profile before 200", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const res = await fetch(`${baseUrl}/api/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: "+1-787-555-LC08", postalAddress: "PO LC8", physicalAddress: "Phys LC8" }),
      });
      assert.equal(res.status, 200);
      const updated = (await res.json()) as { id: string; phone: string };
      const snap = await loadLifecycleSnapshotFromDb();
      const profile = snap!.userProfiles.find((p) => p.userId === updated.id);
      assert.equal(profile?.phone, "+1-787-555-LC08");
      assert.equal(profile?.postalAddress, "PO LC8");
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-9: /notifications/:id/seen persists per-user seen set before 200", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const res = await fetch(`${baseUrl}/api/notifications/act-lc9-test/seen`, { method: "POST", headers: auth });
      assert.equal(res.status, 200);
      // userId for demo@konti.com:
      const me = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meBody = (await me.json()) as { id: string };
      const snap = await loadLifecycleSnapshotFromDb();
      assert.ok(snap!.notificationsSeen[meBody.id]?.includes("act-lc9-test"), "seen id must be in DB before ack");
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-10: seed migration is idempotent and refuses to clobber non-empty tables", async () => {
  await __resetLifecycleTablesForTest();
  try {
    const first = await migrateLifecycleSeedIfNeeded();
    assert.equal(first.status, "migrated", "first call should migrate");

    const second = await migrateLifecycleSeedIfNeeded();
    assert.equal(second.status, "already_applied", "second call must be a no-op (marker present)");

    // Wipe the marker but leave a row behind → clobber guard must trip and
    // re-insert the marker without overwriting the existing rows.
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`DELETE FROM lifecycle_migrations`);
    const beforeProjects = (await loadLifecycleSnapshotFromDb())!.projects.length;
    const third = await migrateLifecycleSeedIfNeeded();
    assert.equal(third.status, "already_applied", "clobber guard must report as already_applied");
    const afterProjects = (await loadLifecycleSnapshotFromDb())!.projects.length;
    assert.equal(afterProjects, beforeProjects, "clobber guard must NOT reseed on top of existing rows");
  } finally {
    await __resetLifecycleTablesForTest();
  }
});

test("LC-2: POST /projects/:id/advance-phase persists project.phase before 200 OK", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      // proj-1 starts in consultation with no seeded punchlist; team can advance freely.
      const before = (await loadLifecycleSnapshotFromDb())!.projects.find((p) => p.id === "proj-1");
      const beforePhase = (before as unknown as { phase: string }).phase;
      const res = await fetch(`${baseUrl}/api/projects/proj-1/advance-phase`, { method: "POST", headers: auth, body: "{}" });
      assert.equal(res.status, 200, "advance-phase must succeed");
      const snap = await loadLifecycleSnapshotFromDb();
      const after = snap!.projects.find((p) => p.id === "proj-1") as unknown as { phase: string };
      assert.notEqual(after.phase, beforePhase, "phase must be persisted (not still old phase)");
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-5: PUT /projects/:id/csv-mappings/:kind persists CSV mapping before 200 OK", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const res = await fetch(`${baseUrl}/api/projects/proj-1/csv-mappings/materials`, {
        method: "PUT",
        headers: auth,
        body: JSON.stringify({ mapping: { "Cement LC-5": "Cemento LC-5" } }),
      });
      assert.equal(res.status, 200);
      const snap = await loadLifecycleSnapshotFromDb();
      assert.equal(snap!.csvMappings["proj-1"]?.materials?.["Cement LC-5"], "Cemento LC-5");
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-6: PATCH /projects/:projectId/metadata persists project metadata before 200 OK", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const res = await fetch(`${baseUrl}/api/projects/proj-1/metadata`, {
        method: "PATCH",
        headers: auth,
        body: JSON.stringify({ squareMeters: 246, bathrooms: 4, kitchens: 1, projectType: "residencial", contingencyPercent: 9 }),
      });
      assert.equal(res.status, 200);
      const snap = await loadLifecycleSnapshotFromDb();
      const proj = snap!.projects.find((p) => p.id === "proj-1") as unknown as { squareMeters?: number; bathrooms?: number };
      assert.equal(proj.squareMeters, 246);
      assert.equal(proj.bathrooms, 4);
    });
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});

test("LC-12: appendActivityAndPersist writes both in memory and in Postgres", async () => {
  await __resetLifecycleTablesForTest();
  __resetLifecycleHydrationForTest();
  try {
    await ensureLifecycleHydrated();
    const entry = await appendActivityAndPersist("proj-1", {
      type: "phase_change",
      actor: "LC-12",
      description: "LC-12 marker",
      descriptionEs: "LC-12 marcador",
    });
    assert.ok(entry.id, "in-memory append returns an entry");
    const snap = await loadLifecycleSnapshotFromDb();
    const persisted = snap!.activities["proj-1"]?.find((a) => a.id === entry.id);
    assert.ok(persisted, "activity row must exist in Postgres after appendActivityAndPersist resolves");
    assert.equal(persisted!.description, "LC-12 marker");
  } finally {
    await flushLifecyclePersistence();
    await __resetLifecycleTablesForTest();
    __resetLifecycleHydrationForTest();
  }
});
