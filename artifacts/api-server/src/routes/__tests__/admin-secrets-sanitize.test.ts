// Verify safeErrorMessage() (Task #130) never lets a raw secret leak through
// upstream error text. We assert on three classes of input:
//   1. Provider error that literally echoes the submitted key.
//   2. Provider error that mentions a different sk-prefixed token.
//   3. Long opaque alphanumeric tokens with no recognised prefix.

import { test } from "node:test";
import assert from "node:assert/strict";

const { safeErrorMessage } = await import("../admin-secrets");

test("redacts the literal submitted secret", () => {
  const key = "sk-ant-this-is-a-real-key-deadbeef-12345";
  const upstream = `Authentication error: invalid api key ${key} please check`;
  const out = safeErrorMessage(upstream, key);
  assert.ok(!out.includes(key), `output still contained the live key: ${out}`);
  assert.ok(out.includes("[REDACTED]"));
});

test("redacts other sk- / pk- / Bearer tokens we did not submit", () => {
  const out = safeErrorMessage(
    "401 from upstream — token sk-other-secret-abcdef1234567 was rejected",
  );
  assert.ok(!out.includes("sk-other-secret-abcdef1234567"));
  assert.ok(out.includes("[REDACTED]"));
});

test("redacts long opaque alphanumeric runs", () => {
  const out = safeErrorMessage(
    "PDF.co response: account=ABCDEFGHIJ1234567890ZZZZ rejected",
  );
  assert.ok(!out.includes("ABCDEFGHIJ1234567890ZZZZ"));
});

test("preserves long pure-alpha words (e.g. error codes / english phrases)", () => {
  const out = safeErrorMessage(
    "AuthenticationFailedException: please check configuration",
  );
  assert.ok(out.includes("AuthenticationFailedException"));
});

test("caps result length at 160 characters", () => {
  const huge = "x".repeat(5000);
  const out = safeErrorMessage(huge);
  assert.ok(out.length <= 161); // 160 + the ellipsis
});

test("falls back to a default message when input is empty / nullish", () => {
  assert.equal(safeErrorMessage(undefined), "Operation failed");
  assert.equal(safeErrorMessage(null), "Operation failed");
  assert.equal(safeErrorMessage(""), "Operation failed");
});

test("handles Error instances", () => {
  const out = safeErrorMessage(new Error("boom: sk-leak-1234567890abcdef"));
  assert.ok(!out.includes("sk-leak-1234567890abcdef"));
  assert.ok(out.startsWith("boom:"));
});
