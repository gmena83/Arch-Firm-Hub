import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import app from "../../app";
import { PROJECT_NOTES } from "../ai";

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

function clearProjectNotes(projectId: string) {
  if (PROJECT_NOTES[projectId]) delete PROJECT_NOTES[projectId];
}

test("/api/ai/chat requires authentication", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi", mode: "client_assistant" }),
    });
    assert.equal(res.status, 401);
  });
});

test("/api/ai/chat: client role cannot use internal_spec_bot mode", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "client@konti.com");
    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: "What's the spec?", mode: "internal_spec_bot", projectId: "proj-1" }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "forbidden");
  });
});

test("/api/ai/chat: team role can use both client_assistant and internal_spec_bot modes", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "demo@konti.com");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const clientRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST", headers,
      body: JSON.stringify({ message: "Project status?", mode: "client_assistant", projectId: "proj-1" }),
    });
    assert.equal(clientRes.status, 200);
    const clientBody = (await clientRes.json()) as { mode: string; message: string };
    assert.equal(clientBody.mode, "client_assistant");
    assert.equal(typeof clientBody.message, "string");

    const internalRes = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST", headers,
      body: JSON.stringify({ message: "Spec lookup", mode: "internal_spec_bot", projectId: "proj-1" }),
    });
    assert.equal(internalRes.status, 200);
    const internalBody = (await internalRes.json()) as { mode: string; message: string };
    assert.equal(internalBody.mode, "internal_spec_bot");
    assert.equal(typeof internalBody.message, "string");
  });
});

test("GET /api/projects/:id/notes requires authentication", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/projects/proj-1/notes`);
    assert.equal(res.status, 401);
  });
});

test("POST /api/projects/:id/notes requires authentication", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/projects/proj-1/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    assert.equal(res.status, 401);
  });
});

test("POST /api/projects/:id/notes returns 404 on missing project", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "demo@konti.com");
    const res = await fetch(`${baseUrl}/api/projects/proj-does-not-exist/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: "hello" }),
    });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "not_found");
  });
});

test("POST /api/projects/:id/notes rejects empty text", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "demo@konti.com");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const blank = await fetch(`${baseUrl}/api/projects/proj-1/notes`, {
      method: "POST", headers, body: JSON.stringify({ text: "   " }),
    });
    assert.equal(blank.status, 400);
    const blankBody = (await blank.json()) as { error: string };
    assert.equal(blankBody.error, "empty_note");

    const missing = await fetch(`${baseUrl}/api/projects/proj-1/notes`, {
      method: "POST", headers, body: JSON.stringify({}),
    });
    assert.equal(missing.status, 400);
  });
});

test("POST then GET /api/projects/:id/notes round-trips a saved note", async () => {
  clearProjectNotes("proj-1");
  try {
    await withServer(async (baseUrl) => {
      const token = await login(baseUrl, "demo@konti.com");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      const create = await fetch(`${baseUrl}/api/projects/proj-1/notes`, {
        method: "POST", headers,
        body: JSON.stringify({ text: "Site walk: foundation looks good", type: "voice_note", lang: "en" }),
      });
      assert.equal(create.status, 200);
      const note = (await create.json()) as { id: string; text: string; type: string };
      assert.equal(note.type, "voice_note");
      assert.equal(note.text, "Site walk: foundation looks good");

      const list = await fetch(`${baseUrl}/api/projects/proj-1/notes`, { headers });
      assert.equal(list.status, 200);
      const body = (await list.json()) as { projectId: string; notes: Array<{ id: string }> };
      assert.equal(body.projectId, "proj-1");
      assert.ok(body.notes.some((n) => n.id === note.id));
    });
  } finally {
    clearProjectNotes("proj-1");
  }
});

test("POST /api/ai/confirm-classification rejects empty items", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "demo@konti.com");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const empty = await fetch(`${baseUrl}/api/ai/confirm-classification`, {
      method: "POST", headers,
      body: JSON.stringify({ projectId: "proj-1", action: "classify_photos", items: [] }),
    });
    assert.equal(empty.status, 400);
    const emptyBody = (await empty.json()) as { error: string };
    assert.equal(emptyBody.error, "no_items");

    const missing = await fetch(`${baseUrl}/api/ai/confirm-classification`, {
      method: "POST", headers,
      body: JSON.stringify({ projectId: "proj-1", action: "classify_photos" }),
    });
    assert.equal(missing.status, 400);
  });
});

test("POST /api/ai/confirm-classification records spec events", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "demo@konti.com");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const before = await fetch(`${baseUrl}/api/projects/proj-1/spec-updates-report`, { headers });
    assert.equal(before.status, 200);
    const beforeBody = (await before.json()) as { totals: { added: number } };
    const beforeAdded = beforeBody.totals.added;

    const confirm = await fetch(`${baseUrl}/api/ai/confirm-classification`, {
      method: "POST", headers,
      body: JSON.stringify({ projectId: "proj-1", action: "classify_photos", items: ["foundation", "framing", "roofing"] }),
    });
    assert.equal(confirm.status, 200);
    const confirmBody = (await confirm.json()) as { ok: boolean; classified: number; action: string };
    assert.equal(confirmBody.ok, true);
    assert.equal(confirmBody.classified, 3);
    assert.equal(confirmBody.action, "classify_photos");

    const after = await fetch(`${baseUrl}/api/projects/proj-1/spec-updates-report`, { headers });
    const afterBody = (await after.json()) as { totals: { added: number } };
    assert.equal(afterBody.totals.added, beforeAdded + 3);
  });
});

test("GET /api/projects/:id/spec-updates-report returns totals + addedByWeek + openVsResolved", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "demo@konti.com");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const res = await fetch(`${baseUrl}/api/projects/proj-1/spec-updates-report`, { headers });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      projectId: string;
      totals: { added: number; opened: number; resolved: number };
      addedByWeek: Array<{ week: string; count: number }>;
      openVsResolved: Array<{ status: string; count: number }>;
    };
    assert.equal(body.projectId, "proj-1");
    assert.equal(typeof body.totals.added, "number");
    assert.equal(typeof body.totals.opened, "number");
    assert.equal(typeof body.totals.resolved, "number");
    assert.ok(Array.isArray(body.addedByWeek));
    assert.ok(body.addedByWeek.length > 0, "seeded data should yield at least one week bucket");
    assert.ok(body.addedByWeek.every((b) => typeof b.week === "string" && typeof b.count === "number"));
    assert.ok(Array.isArray(body.openVsResolved));
    assert.equal(body.openVsResolved.length, 2);
    const labels = body.openVsResolved.map((b) => b.status).sort();
    assert.deepEqual(labels, ["Open", "Resolved"]);
  });
});

test("GET /api/projects/:id/spec-updates-report returns 404 on missing project", async () => {
  await withServer(async (baseUrl) => {
    const token = await login(baseUrl, "demo@konti.com");
    const res = await fetch(`${baseUrl}/api/projects/proj-does-not-exist/spec-updates-report`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 404);
  });
});
