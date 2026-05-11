import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../../app";

describe("CORS Configuration", () => {
  it("should allow requests with no origin", async () => {
    const res = await request(app).options("/api/health");
    assert.strictEqual(res.headers["access-control-allow-credentials"], "true");
  });

  it("should allow http://localhost:3000", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "http://localhost:3000");
    assert.strictEqual(res.headers["access-control-allow-origin"], "http://localhost:3000");
    assert.strictEqual(res.headers["access-control-allow-credentials"], "true");
  });

  it("should allow https://localhost:8080", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "https://localhost:8080");
    assert.strictEqual(res.headers["access-control-allow-origin"], "https://localhost:8080");
  });

  it("should allow replit.dev domains", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "https://my-app.replit.dev");
    assert.strictEqual(res.headers["access-control-allow-origin"], "https://my-app.replit.dev");
  });

  it("should allow replit.app domains", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "https://my-app.replit.app");
    assert.strictEqual(res.headers["access-control-allow-origin"], "https://my-app.replit.app");
  });

  it("should allow claude.work domains", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "https://workspace-xyz.claude.work");
    assert.strictEqual(res.headers["access-control-allow-origin"], "https://workspace-xyz.claude.work");
  });

  it("should reject unallowed domains", async () => {
    const res = await request(app)
      .options("/api/health")
      .set("Origin", "https://evil.com");
    assert.strictEqual(res.headers["access-control-allow-origin"], undefined);
  });
});
