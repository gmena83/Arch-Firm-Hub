import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import app from "../../app";
import {
  PROJECTS,
  PROJECT_PERMIT_AUTHORIZATIONS,
  PROJECT_REQUIRED_SIGNATURES,
  PROJECT_PROPOSALS,
} from "../../data/seed";

// Audit coverage for every POST/PATCH/DELETE in routes/projects.ts that
// accepts the "client" role. Each endpoint must reject non-owning clients
// with 403 and let owning clients through (subject to other validation).
//
// Endpoints under test:
//   POST /projects/:id/advance-phase          (covered separately)
//   POST /projects/:id/decline-phase
//   POST /projects/:id/proposals/:pid/approve
//   POST /projects/:id/authorize-permits
//   POST /projects/:id/sign/:signatureId

type LoginResponse = { token: string; user: { id: string; role: string } };

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function login(baseUrl: string, email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "konti2026" }),
  });
  assert.equal(res.status, 200, `login for ${email} should succeed`);
  const body = (await res.json()) as LoginResponse;
  return body.token;
}

function authHeaders(token: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// Snapshot/restore a project's mutable phase fields so individual tests can
// flip phases without poisoning the shared in-memory seed.
function snapshotProject(id: string) {
  const p = PROJECTS.find((x) => x.id === id)!;
  return { ref: p, snapshot: { ...(p as Record<string, unknown>) } };
}
function restoreProject(s: ReturnType<typeof snapshotProject>) {
  Object.assign(s.ref, s.snapshot);
}

function setPhase(projectId: string, phase: string) {
  const p = PROJECTS.find((x) => x.id === projectId) as { phase: string };
  p.phase = phase;
}

// ----------------------------------------------------------------------------
// decline-phase
// ----------------------------------------------------------------------------

test("decline-phase: non-owner client → 403", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "client2@konti.com");
    const res = await fetch(`${baseUrl}/api/projects/proj-1/decline-phase`, {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify({ reason: "no" }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "forbidden");
  });
});

test("decline-phase: owning client → 200", async () => {
  await withServer(async (baseUrl) => {
    const snap = snapshotProject("proj-1");
    try {
      setPhase("proj-1", "consultation");
      const token = await login(baseUrl, "client@konti.com");
      const res = await fetch(`${baseUrl}/api/projects/proj-1/decline-phase`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({ reason: "scheduling conflict" }),
      });
      assert.equal(res.status, 200);
    } finally {
      restoreProject(snap);
    }
  });
});

// ----------------------------------------------------------------------------
// proposals/:pid/approve
// ----------------------------------------------------------------------------

test("proposals/approve: non-owner client → 403", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "client2@konti.com");
    const res = await fetch(
      `${baseUrl}/api/projects/proj-1/proposals/anything/approve`,
      { method: "POST", headers: authHeaders(token) },
    );
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "forbidden");
  });
});

test("proposals/approve: owning client passes ownership gate", async () => {
  await withServer(async (baseUrl) => {
    const snap = snapshotProject("proj-1");
    const proposalsBackup = JSON.parse(JSON.stringify(PROJECT_PROPOSALS["proj-1"] ?? []));
    try {
      // Reset proposals to pending so the owner can actually approve one.
      for (const p of PROJECT_PROPOSALS["proj-1"] ?? []) {
        p.status = "pending";
        p.decidedAt = undefined;
        p.decidedBy = undefined;
      }
      setPhase("proj-1", "pre_design");
      const target = (PROJECT_PROPOSALS["proj-1"] ?? [])[0];
      assert.ok(target, "proj-1 should have at least one proposal in seed data");
      const token = await login(baseUrl, "client@konti.com");
      const res = await fetch(
        `${baseUrl}/api/projects/proj-1/proposals/${target.id}/approve`,
        { method: "POST", headers: authHeaders(token) },
      );
      assert.equal(res.status, 200);
    } finally {
      PROJECT_PROPOSALS["proj-1"] = proposalsBackup;
      restoreProject(snap);
    }
  });
});

// ----------------------------------------------------------------------------
// authorize-permits
// ----------------------------------------------------------------------------

test("authorize-permits: non-owner client → 403", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "client2@konti.com");
    const res = await fetch(`${baseUrl}/api/projects/proj-1/authorize-permits`, {
      method: "POST",
      headers: authHeaders(token),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "forbidden");
  });
});

test("authorize-permits: owning client passes ownership gate (200)", async () => {
  await withServer(async (baseUrl) => {
    const snap = snapshotProject("proj-1");
    const authBackup = PROJECT_PERMIT_AUTHORIZATIONS["proj-1"]
      ? { ...PROJECT_PERMIT_AUTHORIZATIONS["proj-1"] }
      : undefined;
    try {
      setPhase("proj-1", "permits");
      PROJECT_PERMIT_AUTHORIZATIONS["proj-1"] = { status: "none", summaryAccepted: false };
      const token = await login(baseUrl, "client@konti.com");
      const res = await fetch(`${baseUrl}/api/projects/proj-1/authorize-permits`, {
        method: "POST",
        headers: authHeaders(token),
      });
      assert.equal(res.status, 200);
    } finally {
      if (authBackup) PROJECT_PERMIT_AUTHORIZATIONS["proj-1"] = authBackup;
      else delete PROJECT_PERMIT_AUTHORIZATIONS["proj-1"];
      restoreProject(snap);
    }
  });
});

// ----------------------------------------------------------------------------
// sign/:signatureId
// ----------------------------------------------------------------------------

test("sign: non-owner client → 403", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "client2@konti.com");
    const res = await fetch(`${baseUrl}/api/projects/proj-1/sign/anything`, {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify({ signatureName: "Other Person" }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "forbidden");
  });
});

test("sign: owning client passes ownership gate (200 on real signature)", async () => {
  await withServer(async (baseUrl) => {
    const snap = snapshotProject("proj-1");
    const authBackup = PROJECT_PERMIT_AUTHORIZATIONS["proj-1"]
      ? { ...PROJECT_PERMIT_AUTHORIZATIONS["proj-1"] }
      : undefined;
    const sigsBackup = JSON.parse(JSON.stringify(PROJECT_REQUIRED_SIGNATURES["proj-1"] ?? []));
    try {
      setPhase("proj-1", "permits");
      PROJECT_PERMIT_AUTHORIZATIONS["proj-1"] = {
        status: "authorized",
        summaryAccepted: true,
        authorizedBy: "Test",
        authorizedAt: new Date().toISOString(),
      };
      // Reset signatures so we have one available to sign
      for (const s of PROJECT_REQUIRED_SIGNATURES["proj-1"] ?? []) {
        s.signedAt = undefined;
        s.signedBy = undefined;
      }
      const sig = (PROJECT_REQUIRED_SIGNATURES["proj-1"] ?? [])[0];
      assert.ok(sig, "proj-1 should have at least one required signature");
      const token = await login(baseUrl, "client@konti.com");
      const res = await fetch(`${baseUrl}/api/projects/proj-1/sign/${sig.id}`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({ signatureName: "Owner Client" }),
      });
      assert.equal(res.status, 200);
    } finally {
      if (authBackup) PROJECT_PERMIT_AUTHORIZATIONS["proj-1"] = authBackup;
      else delete PROJECT_PERMIT_AUTHORIZATIONS["proj-1"];
      PROJECT_REQUIRED_SIGNATURES["proj-1"] = sigsBackup;
      restoreProject(snap);
    }
  });
});
