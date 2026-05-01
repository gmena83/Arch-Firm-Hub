import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSecureSlug } from "../lib/crypto.ts";

test("generateSecureSlug generates a string of requested length", () => {
  const slug5 = generateSecureSlug(5);
  assert.equal(slug5.length, 5);

  const slug10 = generateSecureSlug(10);
  assert.equal(slug10.length, 10);
});

test("generateSecureSlug uses only allowed characters", () => {
  const allowed = "0123456789abcdefghijklmnopqrstuvwxyz";
  const slug = generateSecureSlug(100);
  for (const char of slug) {
    assert.ok(allowed.includes(char), `Character ${char} is not in alphabet`);
  }
});

test("generateSecureSlug generates different strings (basic randomness check)", () => {
  const s1 = generateSecureSlug(10);
  const s2 = generateSecureSlug(10);
  assert.notEqual(s1, s2);
});
